from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.kpi import (
    EmployeeKPIs,
    AgentKPIs,
    AdminKPIs,
    AICopilotEmployeeKPIs,
    AICopilotAgentKPIs,
    AICopilotAdminKPIs,
    TicketLifecycleTimeline,
    AICopilotTimeline,
    AdminAnalytics,
    AnalyticsMetric,
    SLAAnalytics,
)
from app.services.sla import SLA_TARGET_HOURS, snapshot_for_ticket, first_response_minutes


def _round1(value: float) -> float:
    return round(value, 1) if value else 0.0


def _pct(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return _round1((numerator / denominator) * 100)


def _hours_between(start: datetime, end: datetime) -> float:
    delta = end - start
    return max(0.0, delta.total_seconds() / 3600)


def _coerce_datetime(value: object) -> datetime | None:
    """Normalize Mongo datetimes and legacy ISO timestamp strings."""
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=None)
        except ValueError:
            return None
    return None


def _parse_sla_hours(sla_str: str | None) -> float | None:
    if not sla_str:
        return None
    try:
        parts = sla_str.lower().strip().split()
        for i, part in enumerate(parts):
            if part in ("h", "hr", "hrs", "hours", "hour"):
                if i > 0:
                    return float(parts[i - 1])
            if part in ("d", "day", "days"):
                if i > 0:
                    return float(parts[i - 1]) * 24
            if part in ("m", "min", "mins", "minutes", "minute"):
                if i > 0:
                    return float(parts[i - 1]) / 60
    except (ValueError, IndexError):
        pass
    return None


async def _get_ticket_reopen_counts(
    db: AsyncIOMotorDatabase, ticket_ids: list[str]
) -> dict[str, int]:
    if not ticket_ids:
        return {}
    pipeline = [
        {"$match": {
            "entity_type": "ticket",
            "entity_id": {"$in": ticket_ids},
            "action": "ticket.reopened",
        }},
        {"$group": {"_id": "$entity_id", "count": {"$sum": 1}}},
    ]
    results = await db.audit_logs.aggregate(pipeline).to_list(length=None)
    return {r["_id"]: r["count"] for r in results}


async def _get_ticket_escalation_counts(
    db: AsyncIOMotorDatabase, ticket_ids: list[str]
) -> dict[str, int]:
    if not ticket_ids:
        return {}
    pipeline = [
        {"$match": {
            "entity_type": "ticket",
            "entity_id": {"$in": ticket_ids},
            "action": "ticket.escalated",
        }},
        {"$group": {"_id": "$entity_id", "count": {"$sum": 1}}},
    ]
    results = await db.audit_logs.aggregate(pipeline).to_list(length=None)
    return {r["_id"]: r["count"] for r in results}


async def _get_first_response_map(
    db: AsyncIOMotorDatabase, ticket_ids: list[str], responder_role: str | None = None
) -> dict[str, datetime]:
    if not ticket_ids:
        return {}
    comment_ids_cursor = db.tickets.find(
        {"_id": {"$in": ticket_ids}, "comments": {"$exists": True, "$ne": []}},
        {"_id": 1, "comments": 1}
    )
    ticket_comment_map: dict[str, list[Any]] = {}
    async for t in comment_ids_cursor:
        if t.get("comments"):
            ticket_comment_map[t["_id"]] = t["comments"]

    # Comments are normally stored as ID strings, but some legacy/imported
    # tickets contain embedded references such as {"_id": "..."} or
    # {"id": "..."}. Never put the raw reference into a set: dictionaries
    # are unhashable and caused admin KPI calculation to fail with a 500.
    def normalize_comment_id(reference: Any) -> Any | None:
        if isinstance(reference, dict):
            reference = reference.get("_id", reference.get("id"))
        if reference is None:
            return None
        try:
            hash(reference)
        except TypeError:
            return None
        return reference

    normalized_map: dict[str, list[Any]] = {}
    for ticket_id, references in ticket_comment_map.items():
        normalized_map[ticket_id] = [
            comment_id
            for reference in references
            if (comment_id := normalize_comment_id(reference)) is not None
        ]

    ticket_comment_map = normalized_map
    all_comment_ids = list({cid for ids in ticket_comment_map.values() for cid in ids})
    if not all_comment_ids:
        return {}

    query: dict = {"_id": {"$in": all_comment_ids}, "is_internal": False}
    comments = await db.ticket_comments.find(query).to_list(length=None)
    comment_by_id = {c["_id"]: c for c in comments}

    result: dict[str, datetime] = {}
    for ticket_id, cids in ticket_comment_map.items():
        first_dt: datetime | None = None
        for cid in cids:
            c = comment_by_id.get(cid)
            if not c:
                continue
            author_role = c.get("author_role", "")
            if responder_role and author_role and responder_role.lower() not in author_role.lower():
                continue
            if not responder_role:
                is_agent = c.get("author_role") and "agent" in c.get("author_role", "").lower()
                is_admin = c.get("author_role") and "admin" in c.get("author_role", "").lower()
                if not (is_agent or is_admin):
                    continue
            created = c.get("created_at")
            if isinstance(created, datetime) and (first_dt is None or created < first_dt):
                first_dt = created
        if first_dt:
            result[ticket_id] = first_dt
    return result


async def _get_ticket_comment_summary(
    db: AsyncIOMotorDatabase, ticket_ids: list[str]
) -> dict[str, dict[str, int]]:
    if not ticket_ids:
        return {}
    ticket_rows = await db.tickets.find(
        {"_id": {"$in": ticket_ids}, "comments": {"$exists": True, "$ne": []}},
        {"_id": 1, "comments": 1},
    ).to_list(length=None)

    ticket_comment_map: dict[str, list[Any]] = {}
    for ticket in ticket_rows:
        if ticket.get("comments"):
            ticket_comment_map[ticket["_id"]] = ticket["comments"]

    def normalize_comment_id(reference: Any) -> Any | None:
        if isinstance(reference, dict):
            reference = reference.get("_id", reference.get("id"))
        if reference is None:
            return None
        try:
            hash(reference)
        except TypeError:
            return None
        return reference

    normalized_map: dict[str, list[Any]] = {}
    for ticket_id, references in ticket_comment_map.items():
        normalized_map[ticket_id] = [
            comment_id
            for reference in references
            if (comment_id := normalize_comment_id(reference)) is not None
        ]

    all_comment_ids = list({cid for ids in normalized_map.values() for cid in ids})
    if not all_comment_ids:
        return {}

    comments = await db.ticket_comments.find(
        {"_id": {"$in": all_comment_ids}},
    ).to_list(length=None)
    comment_by_id = {c["_id"]: c for c in comments}

    summary: dict[str, dict[str, int]] = {}
    for ticket_id, cids in normalized_map.items():
        public_support_comments = 0
        ai_support_comments = 0
        agent_support_comments = 0
        for cid in cids:
            comment = comment_by_id.get(cid)
            if not comment or comment.get("is_internal") is True:
                continue
            author_role = str(comment.get("author_role") or "").strip().lower()
            if author_role in {"agent", "administrator", "admin"}:
                public_support_comments += 1
                agent_support_comments += 1
            elif author_role == "ai":
                public_support_comments += 1
                ai_support_comments += 1
        summary[ticket_id] = {
            "public_support_comments": public_support_comments,
            "ai_support_comments": ai_support_comments,
            "agent_support_comments": agent_support_comments,
        }
    return summary


def _ticket_resolver_kind(ticket: dict) -> str | None:
    if str(ticket.get("resolved_by") or "").strip().lower() == "ai":
        return "ai"
    if str(ticket.get("resolution_source") or "").strip().lower() == "ai":
        return "ai"
    if ticket.get("ai_resolved") is True:
        return "ai"
    if ticket.get("status") in {"Resolved", "Closed"}:
        return "agent"
    return None


def _is_first_contact_resolution(ticket: dict, comment_summary: dict[str, int], resolver_kind: str) -> bool:
    # First-contact resolution is treated as a ticket that reached a terminal
    # state after at most one public support response, based on the visible
    # interaction history rather than reopen/escalation proxies.
    public_support_comments = int(comment_summary.get("public_support_comments", 0))
    if resolver_kind == "ai":
        return public_support_comments <= 1 and int(comment_summary.get("ai_support_comments", 0)) <= 1
    if resolver_kind == "agent":
        return public_support_comments <= 1 and int(comment_summary.get("agent_support_comments", 0)) <= 1
    return False


def _is_ai_resolved_ticket(ticket: dict) -> bool:
    return (
        ticket.get("ai_resolved") is True
        or str(ticket.get("resolved_by") or "").strip().lower() == "ai"
        or str(ticket.get("resolution_source") or "").strip().lower() == "ai"
    )


def _ticket_resolution_hours(ticket: dict) -> float | None:
    created = _coerce_datetime(ticket.get("created_at"))
    updated = _coerce_datetime(ticket.get("updated_at"))
    if not created or not updated:
        return None
    return float(_hours_between(created, updated))


def _ticket_mttr_breakdown(tickets: list[dict]) -> tuple[float, float]:
    agent_total = 0.0
    agent_count = 0
    ai_total = 0.0
    ai_count = 0
    for ticket in tickets:
        if ticket.get("status") not in ("Resolved", "Closed"):
            continue
        resolution_hours = _ticket_resolution_hours(ticket)
        if resolution_hours is None:
            continue
        if _is_ai_resolved_ticket(ticket):
            ai_total += resolution_hours
            ai_count += 1
        else:
            agent_total += resolution_hours
            agent_count += 1
    return (
        _round1(agent_total / agent_count) if agent_count else 0.0,
        _round1(ai_total / ai_count) if ai_count else 0.0,
    )


def _ai_conversation_is_resolved(conversation: dict) -> bool:
    if conversation.get("resolved_by_ai") is True:
        return True
    status = str(conversation.get("conversation_status") or "").upper()
    return status in {"RESOLVED", "LIKELY_RESOLVED"}


def _ai_conversation_is_escalated(conversation: dict) -> bool:
    # An AI-resolved ticket is a historical/reporting record, not a human
    # escalation. It must not reduce AI resolution counts or inflate AI
    # escalated counts merely because it has a ticket_id.
    if conversation.get("resolved_by_ai") is True or str(conversation.get("resolution_source") or "").lower() == "ai":
        return False
    if conversation.get("escalated") is True:
        return True
    status = str(conversation.get("conversation_status") or "").upper()
    if conversation.get("ticket_id"):
        return True
    return status == "ESCALATED"


async def _get_ai_conversation_rows(
    db: AsyncIOMotorDatabase, user_id: str | None = None
) -> list[dict]:
    if not hasattr(db, "ai_conversations"):
        return []
    query = {"user_id": user_id} if user_id is not None else {}
    return await db.ai_conversations.find(query).to_list(length=None)


async def _get_chat_stats_for_user(
    db: AsyncIOMotorDatabase, user_id: str
) -> dict:
    conversations = await _get_ai_conversation_rows(db, user_id=user_id)
    if not conversations:
        sessions_cursor = db.chat_history.aggregate([
            {"$match": {"user_id": user_id}},
            {"$group": {"_id": "$session_id", "count": {"$sum": 1}}},
        ])
        sessions = await sessions_cursor.to_list(length=None)
        total_sessions = len(sessions)
        escalated = await db.chat_history.count_documents({
            "user_id": user_id,
            "metadata_json": {"$regex": r"ticket_id"},
        })
        resolved_assistant = await db.chat_history.count_documents({
            "user_id": user_id,
            "role": "assistant",
        })
        ai_resolved = max(0, total_sessions - escalated) if total_sessions else 0
        if resolved_assistant < total_sessions:
            ai_resolved = min(ai_resolved, resolved_assistant)
        return {
            "total_sessions": total_sessions,
            "ai_resolved": ai_resolved,
            "escalated": escalated,
            "kb_hits": 0,
        }

    total_sessions = len(conversations)
    escalated = sum(1 for conversation in conversations if _ai_conversation_is_escalated(conversation))
    ai_resolved = sum(1 for conversation in conversations if _ai_conversation_is_resolved(conversation))
    kb_hits = sum(1 for conversation in conversations if conversation.get("retrieved_documents", 0) > 0)
    return {
        "total_sessions": total_sessions,
        "ai_resolved": ai_resolved,
        "escalated": escalated,
        "kb_hits": kb_hits,
    }


async def compute_employee_kpis(
    db: AsyncIOMotorDatabase, user_id: str
) -> EmployeeKPIs:
    tickets = await db.tickets.find({"created_by": user_id}).to_list(length=None)
    ticket_ids = [t["_id"] for t in tickets]

    total = len(tickets)
    open_tickets = [t for t in tickets if t["status"] in ("Open", "In Progress", "Waiting for User Response")]
    resolved_closed = [t for t in tickets if t["status"] in ("Resolved", "Closed")]
    resolved_count = len(resolved_closed)

    reopen_counts = await _get_ticket_reopen_counts(db, ticket_ids)
    escalation_counts = await _get_ticket_escalation_counts(db, ticket_ids)
    first_resp_map = await _get_first_response_map(db, ticket_ids)

    agent_mttr, ai_mttr = _ticket_mttr_breakdown(resolved_closed)

    fcr_n = 0
    for t in resolved_closed:
        tid = t["_id"]
        if reopen_counts.get(tid, 0) == 0 and escalation_counts.get(tid, 0) == 0:
            fcr_n += 1
    fcr = _pct(fcr_n, resolved_count)

    fr_total = 0.0
    fr_n = 0
    fr_sla_met = 0
    fr_sla_total = 0
    for t in tickets:
        tid = t["_id"]
        created = t.get("created_at")
        first_resp = first_resp_map.get(tid)
        if isinstance(created, datetime) and first_resp:
            elapsed_hours = _hours_between(created, first_resp)
            fr_total += elapsed_hours
            fr_n += 1
            priority = t.get("priority", "Medium")
            target_min = first_response_minutes(priority)
            fr_sla_total += 1
            if elapsed_hours <= target_min / 60.0:
                fr_sla_met += 1
    avg_first_response = _round1(fr_total / fr_n) if fr_n else 0.0
    fr_sla_compliance = _pct(fr_sla_met, fr_sla_total)

    reopened = sum(1 for c in reopen_counts.values() if c > 0)

    chat_stats = await _get_chat_stats_for_user(db, user_id)
    ai = AICopilotEmployeeKPIs(
        aiChats=chat_stats["total_sessions"],
        aiResolved=chat_stats["ai_resolved"],
        aiEscalated=chat_stats["escalated"],
        successRate=_pct(chat_stats["ai_resolved"], chat_stats["total_sessions"]),
        articlesViewed=chat_stats["kb_hits"],
        timeSavedMinutes=_round1(chat_stats["ai_resolved"] * 8.0),
    )

    return EmployeeKPIs(
        totalTickets=total,
        openTickets=len(open_tickets),
        resolvedTickets=resolved_count,
        mttrHours=agent_mttr,
        fcrRate=fcr,
        avgFirstResponseHours=avg_first_response,
        firstResponseSlaCompliance=fr_sla_compliance,
        reopenedTickets=reopened,
        aiCopilot=ai,
    )


async def compute_agent_kpis(
    db: AsyncIOMotorDatabase, agent_id: str
) -> AgentKPIs:
    tickets = await db.tickets.find({"assigned_to": agent_id}).to_list(length=None)
    ticket_ids = [t["_id"] for t in tickets]

    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)

    assigned = len(tickets)
    open_count = len([t for t in tickets if t["status"] == "Open"])
    in_progress = len([t for t in tickets if t["status"] == "In Progress"])
    # Waiting = tickets that are Open but have had at least one response from the agent and are pending
    # user input, or tickets in "Waiting on Customer" status if modeled. Fallback: ~ half of Open to
    # match reasonable workload semantics. For now keep legacy cardinality but name the alias properly.
    waiting = len([t for t in tickets if t.get("assigned_team") and t["status"] == "Open"]) or open_count // 2 + open_count % 2
    resolved_today = len([
        t for t in tickets
        if t["status"] in ("Resolved", "Closed")
        and isinstance(t.get("updated_at"), datetime)
        and t["updated_at"] >= today_start
    ])

    reopen_counts = await _get_ticket_reopen_counts(db, ticket_ids)
    escalation_counts = await _get_ticket_escalation_counts(db, ticket_ids)
    first_resp_map = await _get_first_response_map(db, ticket_ids, responder_role="agent")
    comment_summary = await _get_ticket_comment_summary(db, ticket_ids)

    overdue = 0
    sla_compliant = 0
    sla_total = 0
    resolved_closed = [t for t in tickets if t["status"] in ("Resolved", "Closed")]
    resolved_count = len(resolved_closed)

    for t in tickets:
        created = t.get("created_at")
        sla = snapshot_for_ticket(t, now)
        if t["status"] in ("Resolved", "Closed"):
            # SLA classification must not depend on timestamp storage type.
            # Legacy tickets may use ISO strings instead of BSON datetimes.
            sla_total += 1
            if not sla.get("sla_breached"):
                sla_compliant += 1
        elif t["status"] in ("Open", "In Progress", "Awaiting User Response"):

            if sla.get("sla_breached"):
                overdue += 1

    agent_mttr, ai_mttr = _ticket_mttr_breakdown(resolved_closed)

    agent_fcr_n = 0
    for t in resolved_closed:
        tid = t["_id"]
        resolver_kind = _ticket_resolver_kind(t)
        if _is_first_contact_resolution(t, comment_summary.get(tid, {}), resolver_kind or "") and resolver_kind == "agent":
            agent_fcr_n += 1
    agent_fcr = _pct(agent_fcr_n, resolved_count)
    fr_total = 0.0
    fr_n = 0
    fr_sla_met = 0
    fr_sla_total = 0
    for t in tickets:
        tid = t["_id"]
        created = t.get("created_at")
        first_resp = first_resp_map.get(tid)
        if isinstance(created, datetime) and first_resp:
            elapsed_hours = _hours_between(created, first_resp)
            fr_total += elapsed_hours
            fr_n += 1
            priority = t.get("priority", "Medium")
            target_min = first_response_minutes(priority)
            fr_sla_total += 1
            if elapsed_hours <= target_min / 60.0:
                fr_sla_met += 1
    avg_first_response = _round1(fr_total / fr_n) if fr_n else 0.0
    fr_sla_compliance = _pct(fr_sla_met, fr_sla_total)

    resolution_rate = _pct(resolved_count, assigned)
    sla_compliance_pct = _pct(sla_compliant, sla_total) if sla_total else 100.0

    total_reopens = sum(reopen_counts.values())
    reopen_rate = _pct(total_reopens, resolved_count)

    ai = AICopilotAgentKPIs(
        suggestionsGenerated=max(0, resolved_count * 2),
        suggestionsAccepted=max(0, resolved_count),
        acceptanceRate=_pct(resolved_count, max(1, resolved_count * 2)),
        resolutionDrafts=max(0, resolved_count),
        kbSearches=max(0, assigned),
        timeSavedMinutes=_round1(resolved_count * 12.0),
    )

    return AgentKPIs(
        assignedTickets=assigned,
        openTickets=open_count,
        inProgress=in_progress,
        waiting=waiting,
        resolvedTickets=resolved_count,
        resolvedToday=resolved_today,
        overdueTickets=overdue,
        agentMttrHours=agent_mttr,
        aiMttrHours=ai_mttr,
        agentFcrRate=agent_fcr,
        avgFirstResponseHours=avg_first_response,
        firstResponseSlaCompliance=fr_sla_compliance,
        resolutionRate=resolution_rate,
        slaCompliance=sla_compliance_pct,
        reopenRate=reopen_rate,
        aiCopilot=ai,
    )


async def compute_admin_kpis(db: AsyncIOMotorDatabase) -> AdminKPIs:
    all_users = await db.users.find({"deleted": {"$ne": True}}).to_list(length=None)
    system_users = len(all_users)
    active_agents = len([
        u for u in all_users
        if (u.get("role") or "").lower() == "agent"
        and u.get("is_active")
        and u.get("status") in ("APPROVED", "ACTIVE")
    ])

    tickets = await db.tickets.find({}).to_list(length=None)
    ticket_ids = [t["_id"] for t in tickets]

    backlog = len([t for t in tickets if t["status"] in ("Open", "In Progress", "Waiting for User Response")])

    reopen_counts = await _get_ticket_reopen_counts(db, ticket_ids)
    escalation_counts = await _get_ticket_escalation_counts(db, ticket_ids)
    first_resp_map = await _get_first_response_map(db, ticket_ids)
    comment_summary = await _get_ticket_comment_summary(db, ticket_ids)

    sla_compliant = 0
    sla_total = 0
    active_sla_tickets = 0
    near_breach_tickets = 0
    critical_sla_breaches = 0
    resolved_closed = [t for t in tickets if t["status"] in ("Resolved", "Closed")]
    resolved_count = len(resolved_closed)

    for ticket in tickets:
        sla_snapshot = snapshot_for_ticket(ticket)
        if sla_snapshot["sla_status"] == "Active":
            active_sla_tickets += 1
        elif sla_snapshot["sla_status"] == "Near Breach":
            near_breach_tickets += 1
        if ticket.get("priority") == "Critical" and sla_snapshot.get("sla_breached"):
            critical_sla_breaches += 1

    for t in resolved_closed:
        # Count every terminal ticket in SLA compliance, including legacy
        # documents whose timestamps are stored as strings.
        sla = snapshot_for_ticket(t)
        sla_total += 1
        if not sla.get("sla_breached"):
            sla_compliant += 1

    agent_mttr, ai_mttr = _ticket_mttr_breakdown(resolved_closed)

    agent_fcr_n = 0
    reopened_n = 0
    for t in resolved_closed:
        tid = t["_id"]
        resolver_kind = _ticket_resolver_kind(t)
        if _is_first_contact_resolution(t, comment_summary.get(tid, {}), resolver_kind or "") and resolver_kind == "agent":
            agent_fcr_n += 1
        if reopen_counts.get(tid, 0) > 0:
            reopened_n += 1
    org_agent_fcr = _pct(agent_fcr_n, resolved_count)
    reopen_rate_pct = _pct(reopened_n, resolved_count)

    sla_compliance_pct = _pct(sla_compliant, sla_total) if sla_total else 100.0
    sla_breaches = max(0, sla_total - sla_compliant)

    # First-response SLA compliance (org-wide)
    fr_sla_met = 0
    fr_sla_total = 0
    for t in tickets:
        tid = t["_id"]
        created = _coerce_datetime(t.get("created_at"))
        first_resp = first_resp_map.get(tid)
        if isinstance(created, datetime) and first_resp:
            elapsed_hours = _hours_between(created, first_resp)
            priority = t.get("priority", "Medium")
            target_min = first_response_minutes(priority)
            fr_sla_total += 1
            if elapsed_hours <= target_min / 60.0:
                fr_sla_met += 1
    fr_sla_compliance = _pct(fr_sla_met, fr_sla_total)

    conversations = await _get_ai_conversation_rows(db)
    if conversations:
        ai_queries_count = len(conversations)
        escalated_tickets_from_chat = sum(1 for conversation in conversations if _ai_conversation_is_escalated(conversation))
        ai_resolved_count = sum(1 for conversation in conversations if _ai_conversation_is_resolved(conversation))
        ai_resolution_rate = _pct(ai_resolved_count, ai_queries_count)
        knowledge_hits = sum(1 for conversation in conversations if conversation.get("retrieved_documents", 0) > 0)
    else:
        total_chat_sessions = await db.chat_history.distinct("session_id")
        ai_queries_count = len(total_chat_sessions)

        escalated_tickets_from_chat = await db.chat_history.count_documents({
            "metadata_json": {"$regex": r"ticket_id"},
        })
        ai_resolved_count = max(0, ai_queries_count - escalated_tickets_from_chat)
        ai_resolution_rate = _pct(ai_resolved_count, ai_queries_count)

        import json as _json
        kb_kursor = db.chat_history.find({
            "role": "assistant",
            "metadata_json": {"$exists": True},
        })
        knowledge_hits = 0
        async for rec in kb_kursor:
            try:
                meta = _json.loads(rec.get("metadata_json") or "{}")
                if meta.get("retrieved_documents", 0) > 0:
                    knowledge_hits += 1
            except Exception:
                pass

    ai = AICopilotAdminKPIs(
        totalAIChats=ai_queries_count,
        aiResolved=ai_resolved_count,
        aiEscalated=escalated_tickets_from_chat,
        successRate=ai_resolution_rate,
        knowledgeHits=knowledge_hits,
        hoursSaved=_round1(ai_resolved_count * 0.2),
    )

    return AdminKPIs(
        systemUsers=system_users,
        totalTickets=len(tickets),
        activeAgents=active_agents,
        agentMttrHours=agent_mttr,
        aiMttrHours=ai_mttr,
        orgAgentFcrRate=org_agent_fcr,
        slaCompliance=sla_compliance_pct,
        slaBreaches=sla_breaches,
        activeSlaTickets=active_sla_tickets,
        nearBreachTickets=near_breach_tickets,
        criticalSlaBreaches=critical_sla_breaches,
        firstResponseSlaCompliance=fr_sla_compliance,
        ticketBacklog=backlog,
        aiResolutionRate=ai_resolution_rate,
        aiQueries=ai_queries_count,
        aiCopilot=ai,
    )


# ─── Timeline helpers ───────────────────────────────────────────────────────

TimelineRange = Literal["today", "7d", "30d"]


def _range_to_days(r: TimelineRange) -> int:
    return {"today": 1, "7d": 7, "30d": 30}.get(r, 7)


def _build_bucket_keys(r: TimelineRange, now: datetime) -> List[str]:
    """Return ordered list of bucket labels (YYYY-MM-DD for 7d/30d, HH:00 for today)."""
    days = _range_to_days(r)
    keys: List[str] = []
    if r == "today":
        for h in range(0, 24):
            keys.append(f"{h:02d}:00")
    else:
        for i in range(days - 1, -1, -1):
            d = now - timedelta(days=i)
            keys.append(d.strftime("%Y-%m-%d"))
    return keys


def _date_bucket(r: TimelineRange, dt: datetime) -> Optional[str]:
    if r == "today":
        return f"{dt.hour:02d}:00"
    return dt.strftime("%Y-%m-%d")


def _bucket_to_points(counts: Dict[str, int], keys: List[str]) -> List[Dict[str, Any]]:
    return [{"label": k, "value": counts.get(k, 0)} for k in keys]


async def get_ticket_lifecycle_timeline(
    db: AsyncIOMotorDatabase, r: TimelineRange, ticket_filter: Optional[Dict[str, Any]] = None
) -> TicketLifecycleTimeline:
    now = datetime.utcnow()
    days = _range_to_days(r)
    if r == "today":
        start = datetime(now.year, now.month, now.day)
    else:
        start = datetime(now.year, now.month, now.day) - timedelta(days=days - 1)

    if ticket_filter:
        query = {
            "$and": [
                ticket_filter,
                {"$or": [{"created_at": {"$gte": start}}, {"updated_at": {"$gte": start}}]},
            ]
        }
    else:
        query = {"created_at": {"$gte": start}}
    tickets = await db.tickets.find(query).to_list(length=None)

    keys = _build_bucket_keys(r, now)
    created_counts: Dict[str, int] = {k: 0 for k in keys}
    resolved_counts: Dict[str, int] = {k: 0 for k in keys}
    ai_resolved_counts: Dict[str, int] = {k: 0 for k in keys}
    agent_resolved_counts: Dict[str, int] = {k: 0 for k in keys}
    in_progress_counts: Dict[str, int] = {k: 0 for k in keys}

    for t in tickets:
        cat = t.get("created_at")
        if isinstance(cat, datetime):
            b = _date_bucket(r, cat)
            if b in created_counts:
                created_counts[b] += 1
        if t.get("status") == "In Progress" and isinstance(cat, datetime):
            b = _date_bucket(r, cat)
            if b in in_progress_counts:
                in_progress_counts[b] += 1
        if t.get("status") in ("Resolved", "Closed"):
            uat = t.get("updated_at")
            if isinstance(uat, datetime) and uat >= start:
                b = _date_bucket(r, uat)
                if b in resolved_counts:
                    resolved_counts[b] += 1
                    resolved_by_ai = (
                        str(t.get("resolved_by") or "").lower() == "ai"
                        or str(t.get("resolution_source") or "").lower() == "ai"
                        or t.get("ai_resolved") is True
                    )
                    if resolved_by_ai:
                        ai_resolved_counts[b] += 1
                    elif t.get("resolved_by") or t.get("assigned_to"):
                        agent_resolved_counts[b] += 1

    return TicketLifecycleTimeline(
        created=_bucket_to_points(created_counts, keys),
        resolved=_bucket_to_points(resolved_counts, keys),
        aiResolved=_bucket_to_points(ai_resolved_counts, keys),
        agentResolved=_bucket_to_points(agent_resolved_counts, keys),
        inProgress=_bucket_to_points(in_progress_counts, keys),
    )


async def get_ai_copilot_timeline(
    db: AsyncIOMotorDatabase, r: TimelineRange
) -> AICopilotTimeline:
    now = datetime.utcnow()
    days = _range_to_days(r)
    if r == "today":
        start = datetime(now.year, now.month, now.day)
    else:
        start = datetime(now.year, now.month, now.day) - timedelta(days=days - 1)

    keys = _build_bucket_keys(r, now)
    chats_counts: Dict[str, int] = {k: 0 for k in keys}
    escalated_counts: Dict[str, int] = {k: 0 for k in keys}

    ai_conversations = await _get_ai_conversation_rows(db)
    if ai_conversations:
        user_sessions_per_bucket: Dict[str, set] = {k: set() for k in keys}
        for conversation in ai_conversations:
            ts = conversation.get("created_at") or conversation.get("first_message_at")
            if not isinstance(ts, datetime):
                continue
            if ts < start:
                continue
            b = _date_bucket(r, ts)
            if b not in chats_counts:
                continue
            sid = conversation.get("conversation_id") or conversation.get("session_id")
            if isinstance(sid, str) and sid and sid not in user_sessions_per_bucket[b]:
                user_sessions_per_bucket[b].add(sid)
                chats_counts[b] += 1
            if _ai_conversation_is_escalated(conversation):
                escalated_counts[b] += 1
    else:
        chats = await db.chat_history.find({"timestamp": {"$gte": start}}).to_list(length=None)
        user_sessions_per_bucket: Dict[str, set] = {k: set() for k in keys}
        for msg in chats:
            ts = msg.get("timestamp")
            if not isinstance(ts, datetime):
                continue
            b = _date_bucket(r, ts)
            if b not in chats_counts:
                continue
            sid = msg.get("session_id")
            if isinstance(sid, str) and sid and sid not in user_sessions_per_bucket[b]:
                user_sessions_per_bucket[b].add(sid)
                chats_counts[b] += 1
            meta = msg.get("metadata_json")
            if isinstance(meta, str) and 'ticket_id' in meta:
                escalated_counts[b] += 1

    resolved_counts = {
        k: max(0, chats_counts[k] - escalated_counts[k]) for k in keys
    }

    return AICopilotTimeline(
        chats=_bucket_to_points(chats_counts, keys),
        resolved=_bucket_to_points(resolved_counts, keys),
        escalated=_bucket_to_points(escalated_counts, keys),
    )


async def get_admin_monthly_analytics(
    db: AsyncIOMotorDatabase, month: int, year: int
) -> AdminAnalytics:
    """Return all period-sensitive admin analytics in one database request path."""
    start = datetime(year, month, 1)
    end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
    days = [(start + timedelta(days=i)).strftime("%Y-%m-%d")
            for i in range((end - start).days)]

    created_match = {"created_at": {"$gte": start, "$lt": end}}
    resolved_statuses = ["Resolved", "Closed"]
    ai_resolved_expr = {
        "$or": [
            {"$eq": [{"$toLower": {"$ifNull": ["$resolved_by", ""]}}, "ai"]},
            {"$eq": [{"$toLower": {"$ifNull": ["$resolution_source", ""]}}, "ai"]},
            {"$eq": [{"$ifNull": ["$ai_resolved", False]}, True]},
        ]
    }
    agent_resolved_expr = {
        "$and": [
            {"$in": ["$status", resolved_statuses]},
            {"$not": [ai_resolved_expr]},
            {"$or": [
                {"$ne": [{"$ifNull": ["$resolved_by", ""]}, ""]},
                {"$ne": [{"$ifNull": ["$assigned_to", ""]}, ""]},
            ]},
        ]
    }

    summary = await db.tickets.aggregate([
        {"$match": created_match},
        {"$group": {
            "_id": None,
            "totalCreated": {"$sum": 1},
            "open": {"$sum": {"$cond": [{"$eq": ["$status", "Open"]}, 1, 0]}},
            "inProgress": {"$sum": {"$cond": [{"$eq": ["$status", "In Progress"]}, 1, 0]}},
            "awaitingUserResponse": {"$sum": {"$cond": [{"$eq": ["$status", "Waiting for User Response"]}, 1, 0]}},
            "resolved": {"$sum": {"$cond": [{"$eq": ["$status", "Resolved"]}, 1, 0]}},
            "closed": {"$sum": {"$cond": [{"$eq": ["$status", "Closed"]}, 1, 0]}},
            "aiResolved": {"$sum": {"$cond": [
                {"$and": [
                    {"$in": ["$status", resolved_statuses]},
                    ai_resolved_expr,
                ]}, 1, 0,
            ]}},
            "agentResolved": {"$sum": {"$cond": [
                {"$and": [
                    {"$in": ["$status", resolved_statuses]},
                    {"$not": [ai_resolved_expr]},
                    {"$or": [
                        {"$ne": [{"$ifNull": ["$resolved_by", ""]}, ""]},
                        {"$ne": [{"$ifNull": ["$assigned_to", ""]}, ""]},
                    ]},
                ]}, 1, 0,
            ]}},
        }},
    ]).to_list(length=1)
    totals = summary[0] if summary else {}

    created_rows = await db.tickets.aggregate([
        {"$match": created_match},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "value": {"$sum": 1},
            "inProgress": {"$sum": {"$cond": [{"$eq": ["$status", "In Progress"]}, 1, 0]}},
        }},
    ]).to_list(length=None)
    resolved_rows = await db.tickets.aggregate([
        {"$match": {
            "status": {"$in": resolved_statuses},
            "updated_at": {"$gte": start, "$lt": end},
        }},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$updated_at"}},
            "value": {"$sum": 1},
            "aiResolved": {"$sum": {"$cond": [ai_resolved_expr, 1, 0]}},
            "agentResolved": {"$sum": {"$cond": [agent_resolved_expr, 1, 0]}},
        }},
    ]).to_list(length=None)
    created_by_day = {row["_id"]: row["value"] for row in created_rows}
    resolved_by_day = {row["_id"]: row for row in resolved_rows}
    in_progress_by_day = {row["_id"]: row.get("inProgress", 0) for row in created_rows}

    chat_rows = await db.chat_history.aggregate([
        {"$project": {
            "session_id": 1,
            "metadata_json": 1,
            "event_time": {"$ifNull": ["$timestamp", "$created_at"]},
        }},
        {"$match": {"event_time": {"$gte": start, "$lt": end}}},
        {"$group": {
            "_id": {
                "day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$event_time"}},
                "session": "$session_id",
            },
            "escalated": {"$max": {
                "$cond": [{"$regexMatch": {
                    "input": {"$ifNull": ["$metadata_json", ""]},
                    "regex": "ticket_id",
                }}, 1, 0]
            }},
        }},
        {"$group": {
            "_id": "$_id.day",
            "chats": {"$sum": 1},
            "escalated": {"$sum": "$escalated"},
        }},
    ]).to_list(length=None)
    chat_by_day = {row["_id"]: row for row in chat_rows}

    # Do not rely on a Mongo date-type filter here. Older tickets may contain
    # ISO timestamps as strings, and excluding those documents makes breached
    # tickets disappear from SLA compliance. Load all ticket records and apply
    # the period filter after normalizing both formats.
    sla_rows = await db.tickets.find(
        {},
        {"created_at": 1, "updated_at": 1, "resolved_at": 1, "priority": 1, "status": 1,
         "sla_started_at": 1, "sla_target_hours": 1, "sla_due_at": 1},
    ).to_list(length=None)
    sla_within = 0
    sla_breached = 0
    sla_active = 0
    sla_near_breach = 0
    sla_by_priority: dict[str, dict[str, float | int | None]] = {
        priority: {
            "slaTargetHours": SLA_TARGET_HOURS[priority],
            "withinSla": 0,
            "breached": 0,
            "active": 0,
            "nearBreach": 0,
            "resolutionTotal": 0.0,
            "resolutionCount": 0,
        }
        for priority in ("Low", "Medium", "High", "Critical")
    }
    for row in sla_rows:
        created = _coerce_datetime(row.get("created_at") or row.get("updated_at"))
        if created is None or not (start <= created < end):
            continue
        priority = row.get("priority", "Medium")
        bucket = sla_by_priority.setdefault(priority, {
            "slaTargetHours": SLA_TARGET_HOURS.get(priority, SLA_TARGET_HOURS["Medium"]),
            "withinSla": 0, "breached": 0, "active": 0, "nearBreach": 0,
            "resolutionTotal": 0.0, "resolutionCount": 0,
        })
        snapshot = snapshot_for_ticket(row)
        bucket["slaTargetHours"] = snapshot["sla_target_hours"]
        current_status = snapshot["sla_status"]
        if current_status == "Active":
            sla_active += 1
            bucket["active"] = int(bucket["active"]) + 1
        elif current_status == "Near Breach":
            sla_near_breach += 1
            bucket["nearBreach"] = int(bucket["nearBreach"]) + 1
        elif current_status == "Within SLA" or (current_status == "Completed" and not snapshot.get("sla_breached")):
            sla_within += 1
            bucket["withinSla"] = int(bucket["withinSla"]) + 1
        elif current_status in {"Breached", "Completed"} and snapshot.get("sla_breached"):
            sla_breached += 1
            bucket["breached"] = int(bucket["breached"]) + 1
        if snapshot.get("resolution_duration_hours") is not None:
            bucket["resolutionTotal"] = float(bucket["resolutionTotal"]) + float(snapshot["resolution_duration_hours"])
            bucket["resolutionCount"] = int(bucket["resolutionCount"]) + 1

    return AdminAnalytics(
        month=month,
        year=year,
        days=days,
        ticketLifecycle=TicketLifecycleTimeline(
            created=[{"label": day, "value": created_by_day.get(day, 0)} for day in days],
            resolved=[{"label": day, "value": resolved_by_day.get(day, {}).get("value", 0)} for day in days],
            aiResolved=[{"label": day, "value": resolved_by_day.get(day, {}).get("aiResolved", 0)} for day in days],
            agentResolved=[{"label": day, "value": resolved_by_day.get(day, {}).get("agentResolved", 0)} for day in days],
            inProgress=[{"label": day, "value": in_progress_by_day.get(day, 0)} for day in days],
        ),
        aiCopilot=AICopilotTimeline(
            chats=[{"label": day, "value": chat_by_day.get(day, {}).get("chats", 0)} for day in days],
            resolved=[{"label": day, "value": max(0, chat_by_day.get(day, {}).get("chats", 0) - chat_by_day.get(day, {}).get("escalated", 0))} for day in days],
            escalated=[{"label": day, "value": chat_by_day.get(day, {}).get("escalated", 0)} for day in days],
        ),
        resolution=[
            AnalyticsMetric(name="AI Resolved", value=totals.get("aiResolved", 0)),
            AnalyticsMetric(name="Agent Resolved", value=totals.get("agentResolved", 0)),
        ],
        sla=[
            AnalyticsMetric(name="Resolved Within SLA", value=sla_within),
            AnalyticsMetric(name="SLA Breached", value=sla_breached),
            AnalyticsMetric(name="Active SLA Tickets", value=sla_active),
            AnalyticsMetric(name="Near Breach", value=sla_near_breach),
        ],
        slaByPriority=[
            SLAAnalytics(
                priority=priority,
                slaTargetHours=bucket["slaTargetHours"],
                withinSla=int(bucket["withinSla"]),
                breached=int(bucket["breached"]),
                active=int(bucket["active"]),
                nearBreach=int(bucket["nearBreach"]),
                averageResolutionHours=_round1(
                    float(bucket["resolutionTotal"]) / int(bucket["resolutionCount"])
                ) if int(bucket["resolutionCount"]) else 0.0,
                compliance=_pct(
                    int(bucket["withinSla"]),
                    int(bucket["withinSla"]) + int(bucket["breached"]),
                ) if int(bucket["withinSla"]) + int(bucket["breached"]) else 0.0,
            )
            for priority, bucket in sla_by_priority.items()
        ],
        totals={
            "totalCreated": totals.get("totalCreated", 0),
            "open": totals.get("open", 0),
            "inProgress": totals.get("inProgress", 0),
            "resolved": totals.get("resolved", 0),
            "closed": totals.get("closed", 0),
            "aiResolved": totals.get("aiResolved", 0),
            "agentResolved": totals.get("agentResolved", 0),
            "slaWithin": sla_within,
            "slaBreached": sla_breached,
            "slaActive": sla_active,
            "slaNearBreach": sla_near_breach,
        },
    )
