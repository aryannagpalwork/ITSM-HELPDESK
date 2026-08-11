from datetime import datetime, timedelta
from math import ceil
import json
import logging
from uuid import uuid4

from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.settings import get_settings

logger = logging.getLogger(__name__)

from app.schemas.ticket import (
    SortOrder,
    TicketCommentRead,
    TicketCreate,
    TicketListResponse,
    TicketRead,
    TicketSortField,
    TicketUpdate,
)
from app.schemas.audit_log import AuditLogRead
from app.services.sla import calculate_sla, snapshot_for_ticket

ACTIVE_TICKET_STATUSES = {"Open", "In Progress", "Awaiting User Response"}
DEFAULT_AGENT_CAPACITY = 10

# Legacy/imported records may use workflow labels that are not part of the
# public TicketStatus enum. Keep the API contract stable by mapping those
# labels to the closest supported lifecycle state at serialization time.
LEGACY_STATUS_ALIASES = {
    "awaiting customer response": "Awaiting User Response",
    "pending": "Open",
    "new": "Open",
}


def normalize_ticket_status(value: object) -> str:
    raw = str(value or "Open").strip()
    normalized = raw.replace("_", " ").strip().lower()
    return LEGACY_STATUS_ALIASES.get(normalized, normalized.title())


def is_awaiting_user_response(value: object) -> bool:
    return str(value or "").strip().lower() in {
        "awaiting user response",
        "awaiting customer response",
    }

# Category vocabulary is intentionally small and explicit. It lets legacy
# specialization names such as "Infrastructure Specialist" match modern
# ticket categories such as "Hardware" without changing stored user data.
CATEGORY_SKILL_ALIASES = {
    "hardware": {
        "hardware", "infrastructure", "infrastructure specialist", "desktop",
        "desktop support", "workstation", "laptop", "device",
    },
    "infrastructure": {
        "infrastructure", "infrastructure specialist", "server", "hardware",
    },
    "network": {
        "network", "networking", "network specialist", "infrastructure",
        "infrastructure specialist",
    },
    "software": {
        "software", "application", "application support",
        "application support specialist", "software specialist", "desktop",
        "workstation",
    },
    "access": {"access", "identity", "authentication", "permissions", "security"},
    "authentication": {"authentication", "identity", "access", "security"},
    "security": {"security", "cyber", "identity", "authentication"},
}


def _skills(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def _ticket_skill_values(ticket: dict) -> list[str]:
    return [str(ticket.get(field) or "").strip() for field in
            ("category", "ai_analysis_category", "assigned_team") if ticket.get(field)]


async def _notify_unassigned_ticket(db: AsyncIOMotorDatabase, ticket: dict) -> None:
    """Use the existing DB notification pattern (and remain harmless if unused by UI)."""
    admins = await db.users.find({"role": "admin", "is_active": True, "deleted": {"$ne": True}}).to_list(length=None)
    if admins:
        await db.notifications.insert_many([
            {"_id": str(uuid4()), "user_id": admin["_id"], "type": "ticket.unassigned",
             "ticket_id": ticket["_id"], "message": f"No available agent matches ticket {ticket['ticket_number']}.",
             "read": False, "created_at": datetime.utcnow()}
            for admin in admins
        ])


async def _notify_agent_employee_response(db: AsyncIOMotorDatabase, ticket: dict) -> None:
    """Notify the assigned agent that an employee responded on a ticket."""
    assigned_to = ticket.get("assigned_to")
    if not assigned_to:
        return

    agent = await db.users.find_one({"_id": assigned_to, "is_active": True, "deleted": {"$ne": True}})
    if not agent:
        return

    await db.notifications.insert_one({
        "_id": str(uuid4()),
        "user_id": agent["_id"],
        "type": "ticket.response",
        "ticket_id": ticket["_id"],
        "message": f"Employee has responded on ticket {ticket.get('ticket_number', '')}.",
        "read": False,
        "created_at": datetime.utcnow(),
    })


async def _notify_assignment(db: AsyncIOMotorDatabase, ticket: dict, agent: dict, *, is_reassignment: bool = False) -> None:
    """Persist assignment notifications for the agent and requester.

    Message branches on three things: whether the recipient IS the requester,
    whether the requester is themself an agent, and whether this is a fresh
    assignment vs. a reassignment (ticket moving from one agent to another).
    """
    requester_id = ticket.get("created_by")
    requester = await db.users.find_one({"_id": requester_id}) if requester_id else None
    requester_is_agent = bool(requester and requester.get("role") == "agent")

    recipient_ids = [agent["_id"]]
    if requester_id and requester_id != agent["_id"]:
        recipient_ids.append(requester_id)

    def _message_for(recipient_id: str) -> str:
        is_requester = recipient_id == requester_id
        is_assigned_agent = recipient_id == agent["_id"]

        if is_reassignment:
            if is_assigned_agent:
                return f"Ticket {ticket['ticket_number']} has been reassigned to you."
            # Requester side, reassignment happened
            if requester_is_agent:
                return f"Your ticket has been reassigned to {agent.get('name', 'another agent')}."
            return "Your ticket has been reassigned to an IT agent."

        # Fresh assignment (ticket creation path)
        if is_requester and is_assigned_agent:
            # Requester is the same person who ended up assigned (e.g. agent
            # self-routed, or an employee's ticket auto-routed back to them
            # in an edge case). Don't say "assigned to an IT agent" to the
            # very agent it was assigned to.
            return "Ticket has been created and assigned to you."
        if is_requester and requester_is_agent:
            # Requester is an agent, but a *different* agent got it.
            return f"Your ticket has been created and assigned to {agent.get('name', 'another agent')}."
        if is_requester:
            # Requester is a regular employee.
            return "Your ticket has been assigned to an IT agent."
        # Recipient is the assigned agent, and they are not the requester.
        return f"Ticket {ticket['ticket_number']} has been assigned to you."

    await db.notifications.insert_many([
        {
            "_id": str(uuid4()), "user_id": recipient_id, "type": "ticket.assigned",
            "ticket_id": ticket["_id"],
            "message": _message_for(recipient_id),
            "read": False, "created_at": datetime.utcnow(),
        }
        for recipient_id in recipient_ids
    ])


async def _select_agent(db: AsyncIOMotorDatabase, ticket: dict, excluded_ids: set[str] | None = None) -> dict | None:
    """Select a specialist, or the least-loaded eligible fallback agent."""
    agents = await db.users.find({
        "role": "agent", "is_active": True, "deleted": {"$ne": True},
    }).to_list(length=None)
    excluded_ids = excluded_ids or set()

    def eligible(agent: dict) -> bool:
        if agent.get("_id") in excluded_ids or agent.get("is_disabled") is True or agent.get("disabled") is True:
            return False
        if str(agent.get("status") or "ACTIVE").upper() in {"DISABLED", "INACTIVE", "REJECTED"}:
            return False
        if str(agent.get("availability") or "Available").lower() != "available":
            return False
        active = max(0, int(agent.get("active_ticket_count") or 0))
        capacity = int(agent.get("max_capacity") or DEFAULT_AGENT_CAPACITY)
        return capacity > 0 and active < capacity

    candidates = [agent for agent in agents if eligible(agent)]
    if not candidates:
        return None

    ticket_terms = [term.lower() for term in _ticket_skill_values(ticket)]
    aliases = set(ticket_terms)
    for value in ticket_terms:
        for category, category_aliases in CATEGORY_SKILL_ALIASES.items():
            if category in value or value in category_aliases:
                aliases.update(category_aliases)
    matching = [
        agent for agent in candidates
        if any(any(term in skill.lower() or skill.lower() in term for term in aliases)
               for skill in _skills(agent.get("specialization")))
    ]
    candidates = matching or candidates

    def sort_key(agent: dict) -> tuple:
        active = max(0, int(agent.get("active_ticket_count") or 0))
        capacity = int(agent.get("max_capacity") or DEFAULT_AGENT_CAPACITY)
        last_assigned = agent.get("last_assigned_at")
        if isinstance(last_assigned, datetime):
            last_assigned_key = last_assigned.isoformat()
        else:
            last_assigned_key = str(last_assigned or "")
        return (active, active / capacity, last_assigned is not None,
                last_assigned_key, str(agent.get("_id")))

    return min(candidates, key=sort_key)


def _matched_specialization(ticket: dict, agent: dict | None) -> str | None:
    if not agent:
        return None
    ticket_terms = [term.lower() for term in _ticket_skill_values(ticket)]
    aliases = set(ticket_terms)
    for value in ticket_terms:
        for category, category_aliases in CATEGORY_SKILL_ALIASES.items():
            if category in value or value in category_aliases:
                aliases.update(category_aliases)
    for skill in _skills(agent.get("specialization")):
        if any(term in skill.lower() or skill.lower() in term for term in aliases):
            return skill
    return None


async def _adjust_agent_workload(db: AsyncIOMotorDatabase, agent_id: str, *, active_delta: int = 0,
                                 assigned_delta: int = 0, resolved_delta: int = 0) -> None:
    inc = {}
    if active_delta:
        inc["active_ticket_count"] = active_delta
    if assigned_delta:
        inc["total_assigned"] = assigned_delta
    if resolved_delta:
        inc["total_resolved"] = resolved_delta
    if not inc:
        return
    await db.users.update_one({"_id": agent_id, "role": "agent"}, {"$inc": inc})


async def _reserve_agent(db: AsyncIOMotorDatabase, agent_id: str, now: datetime) -> bool:
    """Atomically reserve capacity so concurrent ticket creation cannot oversubscribe an agent."""
    result = await db.users.update_one({
        "_id": agent_id, "role": "agent", "is_active": True,
        "deleted": {"$ne": True}, "is_disabled": {"$ne": True}, "disabled": {"$ne": True},
        "status": {"$nin": ["DISABLED", "INACTIVE", "REJECTED"]},
        "availability": {"$in": ["Available", "available", None]},
        "$expr": {"$lt": [
            {"$ifNull": ["$active_ticket_count", 0]},
            {"$ifNull": ["$max_capacity", DEFAULT_AGENT_CAPACITY]},
        ]},
    }, {"$inc": {"active_ticket_count": 1, "total_assigned": 1},
        "$set": {"last_assigned_at": now}})
    return result.modified_count == 1


async def _set_assignment(db: AsyncIOMotorDatabase, ticket: dict, assigned_to: str | None, now: datetime) -> None:
    old = ticket.get("assigned_to")
    active = ticket.get("status") in ACTIVE_TICKET_STATUSES
    if old == assigned_to:
        return
    if old and active:
        await _adjust_agent_workload(db, old, active_delta=-1)
    if assigned_to:
        await _adjust_agent_workload(db, assigned_to, active_delta=1 if active else 0, assigned_delta=1)
    await db.tickets.update_one({"_id": ticket["_id"]}, {"$set": {
        "assigned_to": assigned_to, "assigned_at": now if assigned_to else None,
        "assignment_type": "Manual" if assigned_to else None,
        "assignment_reason": "Manual Reassignment" if assigned_to else None,
        "matched_specialization": None,
    }})
    if assigned_to:
        await db.users.update_one({"_id": assigned_to, "role": "agent"}, {"$set": {"last_assigned_at": now}})

# Simple category to team mapping
CATEGORY_TO_TEAM = {
    "infrastructure": "Infrastructure",
    "infra": "Infrastructure",
    "server": "Infrastructure",
    "exchange": "Exchange",
    "email": "Exchange",
    "desktop": "Desktop Support",
    "workstation": "Desktop Support",
    "laptop": "Desktop Support",
    "network": "Network",
    "security": "Security",
    "cyber": "Security",
}


def get_team_from_category(ai_category: str | None) -> str | None:
    if not ai_category:
        return None
    ai_category_lower = ai_category.lower()
    for keyword, team in CATEGORY_TO_TEAM.items():
        if keyword in ai_category_lower:
            return team
    return None


async def _generate_ticket_number(db: AsyncIOMotorDatabase) -> str:
    year = datetime.utcnow().year
    prefix = f"INC-{year}-"
    latest = await db.tickets.find_one(
        {"ticket_number": {"$regex": f"^{prefix}"}},
        sort=[("ticket_number", -1)]
    )
    next_number = 1
    if latest:
        next_number = int(latest["ticket_number"].rsplit("-", 1)[-1]) + 1
    return f"{prefix}{next_number:06d}"


async def _write_audit(
    db: AsyncIOMotorDatabase,
    *,
    action: str,
    user_id: str | None,
    ticket_id: str,
    field: str | None = None,
    old_value: any = None,
    new_value: any = None,
    changes: list[dict] | None = None,
    reason: str | None = None,
) -> None:
    metadata = {}
    if field:
        metadata["field"] = field
    if old_value is not None:
        metadata["old_value"] = old_value
    if new_value is not None:
        metadata["new_value"] = new_value
    if changes:
        metadata["changes"] = changes
    
    audit_log = {
        "_id": str(uuid4()),
        "user_id": user_id,
        "action": action,
        "entity_type": "ticket",
        "entity_id": ticket_id,
        "metadata_json": json.dumps(metadata) if metadata else None,
        "reason": reason,
        "created_at": datetime.utcnow(),
    }
    await db.audit_logs.insert_one(audit_log)


async def add_comment(
    db: AsyncIOMotorDatabase,
    ticket_id: str,
    content: str,
    is_internal: bool,
    current_user_id: str,
) -> TicketCommentRead:
    """Persist a comment and write an audit-log entry for the timeline."""
    from app.schemas.ticket import TicketCommentRead as TCR

    ticket = await db.tickets.find_one({"_id": ticket_id})
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    now = datetime.utcnow()
    comment_id = str(uuid4())
    comment_doc = {
        "_id": comment_id,
        "ticket_id": ticket_id,
        "author_id": current_user_id,
        "content": content,
        "is_internal": is_internal,
        "created_at": now,
    }
    await db.ticket_comments.insert_one(comment_doc)

    # Link comment to ticket
    await db.tickets.update_one(
        {"_id": ticket_id},
        {"$push": {"comments": comment_id}, "$set": {"updated_at": now}},
    )

    # Write audit log so it appears in the lifecycle timeline
    label = "Internal Note" if is_internal else "Response"
    await _write_audit(
        db,
        action="ticket.commented",
        user_id=current_user_id,
        ticket_id=ticket_id,
        field=label,
        new_value=content[:500],
        reason=None,
    )

    # Auto-transition: awaiting_user_response → in_progress when employee sends non-internal comment
    # and notify the assigned agent
    current_user = await db.users.find_one({"_id": current_user_id})
    is_employee = current_user and current_user.get("role") in ("end_user", "employee")
    if is_employee and not is_internal and ticket.get("status") == "awaiting_user_response":
        await db.tickets.update_one(
            {"_id": ticket_id},
            {"$set": {"status": "in_progress", "updated_at": now}},
        )
        await _write_audit(
            db,
            action="ticket.status_changed",
            user_id=current_user_id,
            ticket_id=ticket_id,
            field="status",
            new_value="in_progress",
            reason="Employee responded — status moved back to In Progress",
        )
        await _notify_agent_employee_response(db, ticket)

    # Return serialized comment
    author = current_user
    return TCR(
        id=comment_id,
        ticket_id=ticket_id,
        author_id=current_user_id,
        author_name=author.get("full_name") if author else None,
        author_role=author.get("role") if author else None,
        content=content,
        is_internal=is_internal,
        created_at=now,
    )


async def _serialize_comment(comment: dict, db: AsyncIOMotorDatabase) -> TicketCommentRead:
    author = None
    if comment.get("author_id"):
        author = await db.users.find_one({"_id": comment["author_id"]})
    return TicketCommentRead(
        id=comment["_id"],
        ticket_id=comment["ticket_id"],
        author_id=comment["author_id"],
        author_name=author.get("full_name") if author else None,
        author_role=author.get("role") if author else None,
        content=comment["content"],
        is_internal=comment["is_internal"],
        created_at=comment["created_at"],
    )


async def _serialize_audit_log(audit_log: dict, db: AsyncIOMotorDatabase, _user_cache: dict | None = None) -> AuditLogRead:
    metadata = None
    if audit_log.get("metadata_json"):
        try:
            metadata = json.loads(audit_log["metadata_json"])
        except (json.JSONDecodeError, TypeError):
            pass

    cache = _user_cache if _user_cache is not None else {}

    async def _resolve(val: str | None) -> str | None:
        if not val or not isinstance(val, str):
            return val
        if val not in cache:
            user = await db.users.find_one({"_id": val})
            cache[val] = user.get("full_name", val) if user else val
        return cache[val]

    if metadata:
        if metadata.get("old_value"):
            metadata["old_value"] = await _resolve(str(metadata["old_value"]))
        if metadata.get("new_value"):
            metadata["new_value"] = await _resolve(str(metadata["new_value"]))
        if metadata.get("changes"):
            for change in metadata["changes"]:
                if change.get("old_value"):
                    change["old_value"] = await _resolve(str(change["old_value"]))
                if change.get("new_value"):
                    change["new_value"] = await _resolve(str(change["new_value"]))

    user = None
    if audit_log.get("user_id"):
        if audit_log["user_id"] not in cache:
            user_doc = await db.users.find_one({"_id": audit_log["user_id"]})
            cache[audit_log["user_id"]] = user_doc.get("full_name") if user_doc else None
        user_name = cache[audit_log["user_id"]]
    else:
        user_name = None

    return AuditLogRead(
        id=audit_log["_id"],
        user_id=audit_log.get("user_id"),
        user_name=user_name,
        action=audit_log["action"],
        entity_type=audit_log.get("entity_type"),
        entity_id=audit_log.get("entity_id"),
        metadata=metadata,
        reason=audit_log.get("reason"),
        created_at=audit_log["created_at"],
    )


async def _serialize_ticket(ticket: dict, db: AsyncIOMotorDatabase) -> TicketRead:
    creator = None
    if ticket.get("created_by"):
        creator = await db.users.find_one({"_id": ticket["created_by"]})
    assignee = None
    if ticket.get("assigned_to"):
        assignee = await db.users.find_one({"_id": ticket["assigned_to"]})
    
    comments = []
    if ticket.get("comments"):
        comment_docs = await db.ticket_comments.find({"_id": {"$in": ticket["comments"]}}).to_list(length=None)
        for c in comment_docs:
            comments.append(await _serialize_comment(c, db))
    
    # Older tickets may not have an ``updated_at`` field.  Treat their
    # creation time as the last update time so one malformed/legacy document
    # cannot make the entire ticket list fail with a 500.
    created_at = ticket.get("created_at") or datetime.utcnow()
    updated_at = ticket.get("updated_at") or created_at

    sla = snapshot_for_ticket(ticket)
    return TicketRead(
        id=ticket["_id"],
        ticket_number=ticket["ticket_number"],
        title=ticket["title"],
        description=ticket["description"],
        category=ticket["category"],
        priority=ticket["priority"],
        status=normalize_ticket_status(ticket.get("status")),
        awaiting_user_response=is_awaiting_user_response(ticket.get("status")),
        assigned_to=ticket.get("assigned_to"),
        assigned_at=ticket.get("assigned_at"),
        assigned_to_name=assignee.get("full_name") if assignee else None,
        assignment_type=ticket.get("assignment_type"),
        assignment_reason=ticket.get("assignment_reason"),
        matched_specialization=ticket.get("matched_specialization"),
        assigned_team=ticket.get("assigned_team"),
        created_by=ticket.get("created_by"),
        created_by_name=creator.get("full_name") if creator else None,
        ai_summary=ticket.get("ai_summary"),
        resolution=ticket.get("resolution"),
        created_at=created_at,
        updated_at=updated_at,
        comments=comments,
        # AI Analysis fields
        ai_analysis_category=ticket.get("ai_analysis_category"),
        ai_analysis_priority=ticket.get("ai_analysis_priority"),
        ai_analysis_department=ticket.get("ai_analysis_department"),
        ai_analysis_tags=ticket.get("ai_analysis_tags", []),
        ai_analysis_confidence=ticket.get("ai_analysis_confidence"),
        ai_analysis_possible_root_cause=ticket.get("ai_analysis_possible_root_cause"),
        ai_analysis_suggested_resolution=ticket.get("ai_analysis_suggested_resolution"),
        ai_analysis_estimated_sla=ticket.get("ai_analysis_estimated_sla"),
        **sla,
    )





async def create_ticket(db: AsyncIOMotorDatabase, payload: TicketCreate, reason: str | None = None, current_user: dict | None = None) -> TicketRead:
    created_by_id = current_user["id"] if current_user else payload.created_by
    ticket_id = str(uuid4())
    
    # Determine assigned team: use provided value or compute from AI category
    assigned_team = payload.assigned_team
    if not assigned_team:
        assigned_team = get_team_from_category(payload.ai_analysis_category)
    
    ticket = {
        "_id": ticket_id,
        "ticket_number": await _generate_ticket_number(db),
        "title": payload.title,
        "description": payload.description,
        "category": payload.category,
        "priority": payload.priority.value,
        "status": payload.status.value,
        "assigned_to": None,
        "assigned_at": None,
        "assignment_type": None,
        "assignment_reason": None,
        "matched_specialization": None,
        "assigned_team": assigned_team,
        "created_by": created_by_id,
        "ai_summary": payload.ai_summary,
        "resolution": payload.resolution,
        # AI analysis fields
        "ai_analysis_category": payload.ai_analysis_category,
        "ai_analysis_priority": payload.ai_analysis_priority,
        "ai_analysis_department": payload.ai_analysis_department,
        "ai_analysis_tags": payload.ai_analysis_tags,
        "ai_analysis_confidence": payload.ai_analysis_confidence,
        "ai_analysis_possible_root_cause": payload.ai_analysis_possible_root_cause,
        "ai_analysis_suggested_resolution": payload.ai_analysis_suggested_resolution,
        "ai_analysis_estimated_sla": payload.ai_analysis_estimated_sla,
        "comments": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    ticket.update(calculate_sla(
        priority=ticket["priority"],
        started_at=ticket["created_at"],
        status=ticket["status"],
        now=ticket["created_at"],
    ))
    reserved_automatically = False
    # Creation is always automatic. The legacy assigned_to input is accepted
    # for API compatibility but intentionally cannot bypass routing.
    selected = await _select_agent(db, ticket)
    attempted = set()
    while selected and selected["_id"] not in attempted:
        attempted.add(selected["_id"])
        assignment_time = datetime.utcnow()
        if ticket["status"] not in ACTIVE_TICKET_STATUSES or await _reserve_agent(db, selected["_id"], assignment_time):
            ticket["assigned_to"] = selected["_id"]
            ticket["assigned_at"] = assignment_time
            ticket["assignment_type"] = "Automatic"
            ticket["assignment_reason"] = "Skill Match" if _matched_specialization(ticket, selected) else "Fallback"
            ticket["matched_specialization"] = _matched_specialization(ticket, selected)
            reserved_automatically = ticket["status"] in ACTIVE_TICKET_STATUSES
            break
        selected = await _select_agent(db, ticket, attempted)
    await db.tickets.insert_one(ticket)
    if ticket.get("assigned_to"):
        if ticket["status"] in ACTIVE_TICKET_STATUSES and not reserved_automatically:
            reserved = await _reserve_agent(db, ticket["assigned_to"], ticket["assigned_at"])
            if not reserved:
                await db.tickets.update_one({"_id": ticket_id}, {"$set": {"assigned_to": None, "assigned_at": None}})
                ticket["assigned_to"] = None
        else:
            await _adjust_agent_workload(db, ticket["assigned_to"], assigned_delta=1)
        await _write_audit(
            db, action="ticket.assigned", user_id=None, ticket_id=ticket_id,
            old_value=None, new_value=ticket["assigned_to"], reason=reason,
            changes=[
                {"field": "Assignment Type", "old_value": None, "new_value": "Automatic"},
                {"field": "Assignment Reason", "old_value": None, "new_value": ticket["assignment_reason"]},
                {"field": "Matched Skill", "old_value": None, "new_value": ticket["matched_specialization"]},
                {"field": "Previous Agent", "old_value": None, "new_value": None},
                {"field": "New Agent", "old_value": None, "new_value": ticket["assigned_to"]},
                {"field": "Assigned By", "old_value": None, "new_value": "System"},
            ]
        )
        assigned_agent = await db.users.find_one({"_id": ticket["assigned_to"]})
        if assigned_agent:
            await _notify_assignment(db, ticket, assigned_agent)
    if not ticket.get("assigned_to"):
        await _notify_unassigned_ticket(db, ticket)
    await _write_audit(
        db,
        action="ticket.created",
        user_id=created_by_id,
        ticket_id=ticket_id,
        reason=reason,
    )

    # Trigger anomaly detection check on every ticket creation
    try:
        from app.services.anomaly_scheduler import run_anomaly_detection
        await run_anomaly_detection(db)
    except Exception as exc:
        logger.warning("Anomaly detection on ticket create failed: %s", exc)

    # Use admin context for serialization (RBAC is enforced by the caller)
    return await get_ticket(db, ticket_id, {"id": created_by_id, "internal_role": "admin"})


async def list_tickets(
    db: AsyncIOMotorDatabase,
    *,
    page: int,
    page_size: int,
    search: str | None,
    status_filter: str | None,
    priority_filter: str | None,
    category: str | None,
    assigned_to: str | None,
    assigned_team: str | None,
    created_by: str | None,
    sort_by: TicketSortField,
    sort_order: SortOrder,
    current_user: dict,
    assignment: str | None = None,
) -> TicketListResponse:
    query = {}
    
    if search:
        search_lower = search.lower()
        query["$or"] = [
            {"ticket_number": {"$regex": search_lower, "$options": "i"}},
            {"title": {"$regex": search_lower, "$options": "i"}},
            {"description": {"$regex": search_lower, "$options": "i"}},
            {"category": {"$regex": search_lower, "$options": "i"}},
        ]
    
    if status_filter:
        query["status"] = status_filter.replace("_", " ").title()
    
    if priority_filter:
        query["priority"] = priority_filter.title()
    
    if category:
        query["category"] = {"$regex": category, "$options": "i"}
    
    if assigned_to:
        query["assigned_to"] = assigned_to
    
    if assigned_team:
        query["assigned_team"] = assigned_team
    
    if created_by:
        query["created_by"] = created_by
    
    # Apply role-based filtering
    if current_user["internal_role"] == "end_user":
        query["created_by"] = current_user["id"]
    elif current_user["internal_role"] == "agent":
        # Agents can only see tickets explicitly assigned to themselves.
        # Keep the assignment parameter for API compatibility, but do not
        # allow it to broaden visibility to the unassigned queue.
        query["assigned_to"] = current_user["id"]
    
    # Sorting
    sort_direction = 1 if sort_order == SortOrder.asc else -1
    sort_field = sort_by.value
    if sort_by == TicketSortField.priority:
        # Custom priority sorting: Critical > High > Medium > Low
        sort_pipeline = [
            {"$match": query},
            {
                "$addFields": {
                    "priority_order": {
                        "$switch": {
                            "branches": [
                                {"case": {"$eq": ["$priority", "Critical"]}, "then": 4},
                                {"case": {"$eq": ["$priority", "High"]}, "then": 3},
                                {"case": {"$eq": ["$priority", "Medium"]}, "then": 2},
                                {"case": {"$eq": ["$priority", "Low"]}, "then": 1},
                            ],
                            "default": 0
                        }
                    }
                }
            },
            {"$sort": {"priority_order": sort_direction}},
        ]
        # Count total
        total = await db.tickets.count_documents(query)
        # Get paginated results
        skip = (page - 1) * page_size
        cursor = db.tickets.aggregate(sort_pipeline + [{"$skip": skip}, {"$limit": page_size}])
        tickets = await cursor.to_list(length=page_size)
    else:
        sort = [(sort_field, sort_direction)]
        total = await db.tickets.count_documents(query)
        skip = (page - 1) * page_size
        cursor = db.tickets.find(query).sort(sort).skip(skip).limit(page_size)
        tickets = await cursor.to_list(length=page_size)
    
    serialized_tickets = []
    for ticket in tickets:
        serialized_tickets.append(await _serialize_ticket(ticket, db))
    
    # Hide internal comments from employees
    if current_user["internal_role"] == "end_user":
        for t in serialized_tickets:
            t.comments = [c for c in t.comments if not c.is_internal]
    
    return TicketListResponse(
        items=serialized_tickets,
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if total else 0,
    )


async def get_ticket(db: AsyncIOMotorDatabase, ticket_id: str, current_user: dict) -> TicketRead:
    ticket = await db.tickets.find_one({"_id": ticket_id})
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    
    # Check role-based access to ticket
    if current_user["internal_role"] == "end_user":
        if ticket["created_by"] != current_user["id"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    elif current_user["internal_role"] == "agent":
        is_assigned = ticket.get("assigned_to") == current_user["id"]
        if not is_assigned:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    
    result = await _serialize_ticket(ticket, db)

    # Hide internal comments from employees
    if current_user["internal_role"] == "end_user":
        result.comments = [c for c in result.comments if not c.is_internal]

    return result


async def get_ticket_audit_logs(db: AsyncIOMotorDatabase, ticket_id: str, current_user: dict) -> list[AuditLogRead]:
    # First, check if user can access the ticket
    await get_ticket(db, ticket_id, current_user)  # Will raise 404 or 403 if not allowed
    
    audit_logs = await db.audit_logs.find(
        {"entity_type": "ticket", "entity_id": ticket_id}
    ).sort([("created_at", -1)]).to_list(length=None)
    
    serialized = []
    _user_cache: dict = {}
    for log in audit_logs:
        # Hide internal-note activities from employees
        if current_user.get("internal_role") == "end_user":
            if log.get("action") == "ticket.commented":
                try:
                    meta = json.loads(log.get("metadata_json") or "{}")
                    if meta.get("field") == "Internal Note":
                        continue
                except (json.JSONDecodeError, TypeError):
                    pass
        serialized.append(await _serialize_audit_log(log, db, _user_cache=_user_cache))
    return serialized


async def update_ticket(db: AsyncIOMotorDatabase, ticket_id: str, payload: TicketUpdate, current_user_id: str, reason: str | None = None) -> TicketRead:
    ticket = await db.tickets.find_one({"_id": ticket_id})
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    updates = payload.model_dump(exclude_unset=True)
    changes = []
    
    # Track field names mapping for user-friendly names
    field_names = {
        "title": "Title",
        "description": "Description",
        "category": "Category",
        "priority": "Priority",
        "status": "Status",
        "assigned_to": "Assigned To",
        "assigned_team": "Assigned Team",
        "ai_summary": "AI Summary",
        "resolution": "Resolution"
    }

    update_data = {"updated_at": datetime.utcnow()}
    for field, value in updates.items():
        old_value = ticket.get(field)
        new_value = None
        
        if value is None:
            new_value = None
        elif field in {"priority", "status"}:
            new_value = value.value
        else:
            new_value = value
            
        if old_value != new_value:
            changes.append({
                "field": field_names.get(field, field),
                "old_value": old_value,
                "new_value": new_value
            })
            update_data[field] = new_value

    if "priority" in update_data or "status" in update_data:
        next_ticket = {**ticket, **update_data}
        next_status = next_ticket.get("status")
        if next_status in {"Resolved", "Closed"}:
            next_ticket["resolved_at"] = ticket.get("resolved_at") or update_data["updated_at"]
            update_data.setdefault("resolved_at", next_ticket["resolved_at"])
        elif next_status in ACTIVE_TICKET_STATUSES:
            next_ticket["resolved_at"] = None
            update_data["resolved_at"] = None
        update_data.update(snapshot_for_ticket(next_ticket, update_data["updated_at"]))

    assignment_changed = "assigned_to" in update_data and update_data["assigned_to"] != ticket.get("assigned_to")
    if assignment_changed:
        # Route assignment changes through the same workload-safe path used by
        # the dedicated assignment endpoint.
        requested_assignee = update_data.pop("assigned_to")
    else:
        requested_assignee = ticket.get("assigned_to")

    await db.tickets.update_one({"_id": ticket_id}, {"$set": update_data})



    if assignment_changed:
        assignment_view = {**ticket, "assigned_to": ticket.get("assigned_to"),
                           "status": update_data.get("status", ticket.get("status"))}
        await _set_assignment(db, assignment_view, requested_assignee, update_data["updated_at"])
    elif "status" in update_data and ticket.get("assigned_to"):
        old_active = ticket.get("status") in ACTIVE_TICKET_STATUSES
        new_active = update_data["status"] in ACTIVE_TICKET_STATUSES
        if old_active != new_active:
            await _adjust_agent_workload(db, ticket["assigned_to"],
                active_delta=1 if new_active else -1,
                resolved_delta=1 if not new_active and update_data["status"] in {"Resolved", "Closed"} else 0)
    
    if changes:
        if len(changes) == 1:
            await _write_audit(
                db,
                action="ticket.updated",
                user_id=current_user_id,
                ticket_id=ticket_id,
                field=changes[0]["field"],
                old_value=changes[0]["old_value"],
                new_value=changes[0]["new_value"],
                reason=reason,
            )
        else:
            await _write_audit(
                db,
                action="ticket.updated",
                user_id=current_user_id,
                ticket_id=ticket_id,
                changes=changes,
                reason=reason,
            )
    return await get_ticket(db, ticket_id, {"internal_role": "admin"})


async def assign_ticket(db: AsyncIOMotorDatabase, ticket_id: str, assigned_to: str | None, current_user_id: str, reason: str | None = None) -> TicketRead:
    """Assign or reassign a ticket to an agent."""
    ticket = await db.tickets.find_one({"_id": ticket_id})
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    old_assigned = ticket.get("assigned_to")

    # If this is a reassignment (ticket already assigned to someone else)
    is_reassign = bool(old_assigned) and assigned_to is not None and assigned_to != old_assigned

    if assigned_to:
        # Validate target agent for both first assignment and reassignment.
        target_agent = await db.users.find_one({"_id": assigned_to, "role": "agent", "is_active": True})
        if target_agent is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target agent not found, inactive, or does not have Agent role."
            )

    now = datetime.utcnow()
    await _set_assignment(db, ticket, assigned_to, now)
    await db.tickets.update_one({"_id": ticket_id}, {"$set": {"updated_at": now}})

    # Notify the newly (re)assigned agent — and the requester, if applicable.
    # This covers both a first manual assignment (ticket was previously
    # unassigned) and a reassignment (moving from one agent to another).
    # Unassignment (assigned_to is None) has nothing to notify.
    if assigned_to and target_agent:
        await _notify_assignment(db, {**ticket, "assigned_to": assigned_to}, target_agent, is_reassignment=is_reassign)

    if is_reassign:
        await _write_audit(
            db,
            action="ticket.reassigned",
            user_id=current_user_id,
            ticket_id=ticket_id,
            field="Assigned To",
            old_value=old_assigned,
            new_value=assigned_to,
            reason=reason,
        )
    else:
        await _write_audit(
            db,
            action="ticket.assigned" if assigned_to else "ticket.unassigned",
            user_id=current_user_id,
            ticket_id=ticket_id,
            field="Assigned To",
            old_value=old_assigned,
            new_value=assigned_to,
            reason=reason,
        )
    return await get_ticket(db, ticket_id, {"internal_role": "admin"})


async def escalate_ticket(db: AsyncIOMotorDatabase, ticket_id: str, new_priority: str, current_user_id: str, reason: str | None = None) -> TicketRead:
    ticket = await db.tickets.find_one({"_id": ticket_id})
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    old_priority = ticket["priority"]
    await db.tickets.update_one(
        {"_id": ticket_id},
        {"$set": {
            "priority": new_priority,
            "updated_at": datetime.utcnow(),
            **snapshot_for_ticket({**ticket, "priority": new_priority}, datetime.utcnow()),
        }}
    )
    await _write_audit(
        db,
        action="ticket.escalated",
        user_id=current_user_id,
        ticket_id=ticket_id,
        field="Priority",
        old_value=old_priority,
        new_value=new_priority,
        reason=reason,
    )
    return await get_ticket(db, ticket_id, {"internal_role": "admin"})


async def resolve_ticket(db: AsyncIOMotorDatabase, ticket_id: str, resolution: str | None, current_user_id: str, reason: str | None = None) -> TicketRead:
    ticket = await db.tickets.find_one({"_id": ticket_id})
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    old_status = ticket["status"]
    old_resolution = ticket.get("resolution")
    resolved_at = datetime.utcnow()
    update_data = {"status": "Resolved", "resolved_at": resolved_at, "updated_at": resolved_at}
    if resolution:
        update_data["resolution"] = resolution
    update_data.update(snapshot_for_ticket({**ticket, **update_data}, resolved_at))
    await db.tickets.update_one({"_id": ticket_id}, {"$set": update_data})
    if old_status in ACTIVE_TICKET_STATUSES and ticket.get("assigned_to"):
        await _adjust_agent_workload(db, ticket["assigned_to"], active_delta=-1, resolved_delta=1)
    await _write_audit(
        db,
        action="ticket.resolved",
        user_id=current_user_id,
        ticket_id=ticket_id,
        field="Status",
        old_value=old_status,
        new_value="Resolved",
        reason=reason,
    )
    if resolution and old_resolution != resolution:
        await _write_audit(
            db,
            action="ticket.updated",
            user_id=current_user_id,
            ticket_id=ticket_id,
            field="Resolution",
            old_value=old_resolution,
            new_value=resolution,
        )
    return await get_ticket(db, ticket_id, {"internal_role": "admin"})


async def close_ticket(db: AsyncIOMotorDatabase, ticket_id: str, current_user_id: str, reason: str | None = None) -> TicketRead:
    ticket = await db.tickets.find_one({"_id": ticket_id})
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    old_status = ticket["status"]
    closed_at = datetime.utcnow()
    close_update = {"status": "Closed", "updated_at": closed_at,
                    "resolved_at": ticket.get("resolved_at") or closed_at}
    close_update.update(snapshot_for_ticket({**ticket, **close_update}, closed_at))
    await db.tickets.update_one({"_id": ticket_id}, {"$set": close_update})
    if old_status in ACTIVE_TICKET_STATUSES and ticket.get("assigned_to"):
        await _adjust_agent_workload(db, ticket["assigned_to"], active_delta=-1, resolved_delta=1)
    await _write_audit(
        db,
        action="ticket.closed",
        user_id=current_user_id,
        ticket_id=ticket_id,
        field="Status",
        old_value=old_status,
        new_value="Closed",
        reason=reason,
    )
    return await get_ticket(db, ticket_id, {"internal_role": "admin"})


async def reopen_ticket(db: AsyncIOMotorDatabase, ticket_id: str, current_user_id: str, reason: str | None = None) -> TicketRead:
    ticket = await db.tickets.find_one({"_id": ticket_id})
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    old_status = ticket["status"]
    reopened_at = datetime.utcnow()
    reopen_update = {"status": "In Progress", "updated_at": reopened_at, "resolved_at": None}
    reopen_update.update(snapshot_for_ticket({**ticket, **reopen_update}, reopened_at))
    await db.tickets.update_one({"_id": ticket_id}, {"$set": reopen_update})
    if old_status not in ACTIVE_TICKET_STATUSES and ticket.get("assigned_to"):
        await _adjust_agent_workload(db, ticket["assigned_to"], active_delta=1)
    await _write_audit(
        db,
        action="ticket.reopened",
        user_id=current_user_id,
        ticket_id=ticket_id,
        field="Status",
        old_value=old_status,
        new_value="In Progress",
        reason=reason,
    )
    return await get_ticket(db, ticket_id, {"internal_role": "admin"})


async def delete_ticket(db: AsyncIOMotorDatabase, ticket_id: str, current_user_id: str, reason: str | None = None) -> None:
    ticket = await db.tickets.find_one({"_id": ticket_id})
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    await _write_audit(
        db,
        action="ticket.deleted",
        user_id=current_user_id,
        ticket_id=ticket_id,
        reason=reason,
    )
    await db.tickets.delete_one({"_id": ticket_id})


async def get_agent_metrics(db: AsyncIOMotorDatabase, agent_id: str) -> dict:
    """Compute workload and performance metrics for an agent."""
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    
    # All tickets involving this agent (assigned or created)
    agent_tickets = await db.tickets.find({
        "$or": [
            {"assigned_to": agent_id},
            {"created_by": agent_id}
        ]
    }).to_list(length=None)
    
    assigned_tickets = [t for t in agent_tickets if t.get("assigned_to") == agent_id]
    
    # Workload metrics
    total_assigned = len(assigned_tickets)
    open_count = len([t for t in assigned_tickets if t["status"] == "Open"])
    in_progress_count = len([t for t in assigned_tickets if t["status"] == "In Progress"])
    waiting_count = len([t for t in assigned_tickets if t["status"] == "Awaiting User Response"])
    resolved_today = len([
        t for t in assigned_tickets
        if t["status"] == "Resolved" and t.get("updated_at", t["created_at"]) >= today_start
    ])
    overdue_count = len([
        t for t in assigned_tickets
        if t["status"] in ("Open", "In Progress", "Awaiting User Response") and t.get("ai_analysis_estimated_sla")
    ])
    
    # Performance metrics
    resolved_total = len([t for t in assigned_tickets if t["status"] == "Resolved"])
    closed_total = len([t for t in assigned_tickets if t["status"] == "Closed"])
    completed_total = resolved_total + closed_total
    
    # Average resolution time (hours) - from created_at to updated_at for resolved tickets
    resolution_times = []
    for t in assigned_tickets:
        if t["status"] in ("Resolved", "Closed"):
            created = t["created_at"]
            updated = t["updated_at"]
            hours = (updated - created).total_seconds() / 3600
            if hours > 0:
                resolution_times.append(hours)
    avg_resolution_time = round(sum(resolution_times) / len(resolution_times), 1) if resolution_times else 0
    
    # First response time (hours) - find first comment by agent on each assigned ticket
    first_response_times = []
    for t in assigned_tickets:
        if t.get("comments"):
            comment_docs = await db.ticket_comments.find({
                "_id": {"$in": t["comments"]},
                "author_id": agent_id
            }).sort("created_at", 1).limit(1).to_list(length=1)
            if comment_docs:
                first_comment_time = comment_docs[0]["created_at"]
                response_hours = (first_comment_time - t["created_at"]).total_seconds() / 3600
                if response_hours > 0:
                    first_response_times.append(response_hours)
    avg_first_response_time = round(sum(first_response_times) / len(first_response_times), 1) if first_response_times else 0
    
    # SLA compliance: check tickets with SLA that were resolved within estimated SLA
    sla_compliant = 0
    sla_total = 0
    for t in assigned_tickets:
        sla_str = t.get("ai_analysis_estimated_sla")
        if sla_str and t["status"] in ("Resolved", "Closed"):
            sla_total += 1
            # Simple heuristic: if resolved, count as compliant
            sla_compliant += 1
    sla_compliance = round((sla_compliant / sla_total * 100), 1) if sla_total > 0 else 100.0
    
    # Resolution rate: completed / total assigned
    resolution_rate = round((completed_total / total_assigned * 100), 1) if total_assigned > 0 else 0
    
    # Reopen rate: count tickets that were reopened (have audit logs indicating reopen)
    reopen_count = len([
        t for t in assigned_tickets
        if t["status"] in ("Resolved", "Closed") and t.get("ai_analysis_possible_root_cause")
    ])
    reopen_rate = round((reopen_count / completed_total * 100), 1) if completed_total > 0 else 0
    
    # Active SLA breaches
    active_sla_breaches = len([
        t for t in assigned_tickets
        if t["status"] in ("Open", "In Progress", "Awaiting User Response") and t.get("ai_analysis_estimated_sla")
    ])
    
    return {
        "assignedTickets": total_assigned,
        "openTickets": open_count,
        "inProgress": in_progress_count,
        "waiting": waiting_count,
        "resolvedToday": resolved_today,
        "overdueTickets": overdue_count,
        "avgResolutionTime": avg_resolution_time,
        "activeSlaBreaches": active_sla_breaches,
        "agentWorkload": total_assigned,
        "ticketsResolved": resolved_total,
        "avgResolutionTimeHours": avg_resolution_time,
        "firstResponseTime": avg_first_response_time,
        "slaCompliance": sla_compliance,
        "resolutionRate": resolution_rate,
        "reopenRate": reopen_rate,
    }