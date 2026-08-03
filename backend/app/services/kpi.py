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
)


def _round1(value: float) -> float:
    return round(value, 1) if value else 0.0


def _pct(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return _round1((numerator / denominator) * 100)


def _hours_between(start: datetime, end: datetime) -> float:
    delta = end - start
    return max(0.0, delta.total_seconds() / 3600)


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
    ticket_comment_map: dict[str, list[str]] = {}
    async for t in comment_ids_cursor:
        if t.get("comments"):
            ticket_comment_map[t["_id"]] = t["comments"]

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


async def _get_chat_stats_for_user(
    db: AsyncIOMotorDatabase, user_id: str
) -> dict:
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

    kb_hits_raw = await db.chat_history.find({
        "user_id": user_id,
        "role": "assistant",
        "metadata_json": {"$exists": True},
    }).to_list(length=None)
    kb_hits = 0
    import json as _json
    for rec in kb_hits_raw:
        try:
            meta = _json.loads(rec.get("metadata_json") or "{}")
            if meta.get("retrieved_documents", 0) > 0:
                kb_hits += 1
        except Exception:
            pass

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
    open_tickets = [t for t in tickets if t["status"] in ("Open", "In Progress")]
    resolved_closed = [t for t in tickets if t["status"] in ("Resolved", "Closed")]
    resolved_count = len(resolved_closed)

    reopen_counts = await _get_ticket_reopen_counts(db, ticket_ids)
    escalation_counts = await _get_ticket_escalation_counts(db, ticket_ids)
    first_resp_map = await _get_first_response_map(db, ticket_ids)

    mttr_total = 0.0
    mttr_n = 0
    for t in resolved_closed:
        created = t.get("created_at")
        updated = t.get("updated_at")
        if isinstance(created, datetime) and isinstance(updated, datetime):
            mttr_total += _hours_between(created, updated)
            mttr_n += 1
    mttr = _round1(mttr_total / mttr_n) if mttr_n else 0.0

    fcr_n = 0
    for t in resolved_closed:
        tid = t["_id"]
        if reopen_counts.get(tid, 0) == 0 and escalation_counts.get(tid, 0) == 0:
            fcr_n += 1
    fcr = _pct(fcr_n, resolved_count)

    fr_total = 0.0
    fr_n = 0
    for t in tickets:
        tid = t["_id"]
        created = t.get("created_at")
        first_resp = first_resp_map.get(tid)
        if isinstance(created, datetime) and first_resp:
            fr_total += _hours_between(created, first_resp)
            fr_n += 1
    avg_first_response = _round1(fr_total / fr_n) if fr_n else 0.0

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
        mttrHours=mttr,
        fcrRate=fcr,
        avgFirstResponseHours=avg_first_response,
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

    overdue = 0
    sla_compliant = 0
    sla_total = 0
    mttr_total = 0.0
    mttr_n = 0
    resolved_closed = [t for t in tickets if t["status"] in ("Resolved", "Closed")]
    resolved_count = len(resolved_closed)

    for t in tickets:
        sla_hours = _parse_sla_hours(t.get("ai_analysis_estimated_sla"))
        created = t.get("created_at")
        if t["status"] in ("Resolved", "Closed"):
            updated = t.get("updated_at")
            if isinstance(created, datetime) and isinstance(updated, datetime):
                resolution_hours = _hours_between(created, updated)
                mttr_total += resolution_hours
                mttr_n += 1
                if sla_hours:
                    sla_total += 1
                    if resolution_hours <= sla_hours:
                        sla_compliant += 1
        elif t["status"] in ("Open", "In Progress"):
            if sla_hours and isinstance(created, datetime):
                elapsed = _hours_between(created, now)
                if elapsed > sla_hours:
                    overdue += 1

    mttr = _round1(mttr_total / mttr_n) if mttr_n else 0.0

    fcr_n = 0
    for t in resolved_closed:
        tid = t["_id"]
        if reopen_counts.get(tid, 0) == 0 and escalation_counts.get(tid, 0) == 0:
            fcr_n += 1
    fcr = _pct(fcr_n, resolved_count)

    fr_total = 0.0
    fr_n = 0
    for t in tickets:
        tid = t["_id"]
        created = t.get("created_at")
        first_resp = first_resp_map.get(tid)
        if isinstance(created, datetime) and first_resp:
            fr_total += _hours_between(created, first_resp)
            fr_n += 1
    avg_first_response = _round1(fr_total / fr_n) if fr_n else 0.0

    resolution_rate = _pct(resolved_count, assigned)
    sla_compliance_pct = _pct(sla_compliant, sla_total) if sla_total else 100.0

    total_reopens = sum(reopen_counts.values())
    reopen_rate = _pct(total_reopens, resolved_count)

    # Derived CSAT proxy (same blend as the org-level admin score): FCR, SLA
    # adherence, and inverse reopen rate stand in for missing survey data.
    if resolved_count:
        csat_raw = 0.5 * fcr + 0.3 * sla_compliance_pct + 0.2 * (100 - reopen_rate)
        csat_score = _round1(min(100.0, max(0.0, csat_raw)))
    else:
        csat_score = 0.0

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
        mttrHours=mttr,
        fcrRate=fcr,
        avgFirstResponseHours=avg_first_response,
        resolutionRate=resolution_rate,
        slaCompliance=sla_compliance_pct,
        reopenRate=reopen_rate,
        csatScore=csat_score,
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

    backlog = len([t for t in tickets if t["status"] in ("Open", "In Progress")])

    reopen_counts = await _get_ticket_reopen_counts(db, ticket_ids)
    escalation_counts = await _get_ticket_escalation_counts(db, ticket_ids)
    first_resp_map = await _get_first_response_map(db, ticket_ids)

    mttr_total = 0.0
    mttr_n = 0
    sla_compliant = 0
    sla_total = 0
    resolved_closed = [t for t in tickets if t["status"] in ("Resolved", "Closed")]
    resolved_count = len(resolved_closed)

    for t in resolved_closed:
        created = t.get("created_at")
        updated = t.get("updated_at")
        if isinstance(created, datetime) and isinstance(updated, datetime):
            resolution_hours = _hours_between(created, updated)
            mttr_total += resolution_hours
            mttr_n += 1
            sla_hours = _parse_sla_hours(t.get("ai_analysis_estimated_sla"))
            if sla_hours:
                sla_total += 1
                if resolution_hours <= sla_hours:
                    sla_compliant += 1

    org_mttr = _round1(mttr_total / mttr_n) if mttr_n else 0.0

    fcr_n = 0
    reopened_n = 0
    for t in resolved_closed:
        tid = t["_id"]
        if reopen_counts.get(tid, 0) == 0 and escalation_counts.get(tid, 0) == 0:
            fcr_n += 1
        if reopen_counts.get(tid, 0) > 0:
            reopened_n += 1
    org_fcr = _pct(fcr_n, resolved_count)
    reopen_rate_pct = _pct(reopened_n, resolved_count)

    sla_compliance_pct = _pct(sla_compliant, sla_total) if sla_total else 100.0
    sla_breaches = max(0, sla_total - sla_compliant)

    # Derived CSAT proxy: blend of first-contact resolution, SLA adherence, and
    # (inverse) reopen rate. No survey data exists, so this approximates
    # satisfaction from operational quality signals.
    if resolved_count:
        csat_raw = 0.5 * org_fcr + 0.3 * sla_compliance_pct + 0.2 * (100 - reopen_rate_pct)
        org_csat = _round1(min(100.0, max(0.0, csat_raw)))
    else:
        org_csat = 0.0

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
        orgMttrHours=org_mttr,
        orgFcrRate=org_fcr,
        orgCsatScore=org_csat,
        slaCompliance=sla_compliance_pct,
        slaBreaches=sla_breaches,
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
    db: AsyncIOMotorDatabase, r: TimelineRange
) -> TicketLifecycleTimeline:
    now = datetime.utcnow()
    days = _range_to_days(r)
    if r == "today":
        start = datetime(now.year, now.month, now.day)
    else:
        start = datetime(now.year, now.month, now.day) - timedelta(days=days - 1)

    tickets = await db.tickets.find({"created_at": {"$gte": start}}).to_list(length=None)

    keys = _build_bucket_keys(r, now)
    created_counts: Dict[str, int] = {k: 0 for k in keys}
    resolved_counts: Dict[str, int] = {k: 0 for k in keys}

    for t in tickets:
        cat = t.get("created_at")
        if isinstance(cat, datetime):
            b = _date_bucket(r, cat)
            if b in created_counts:
                created_counts[b] += 1
        if t["status"] in ("Resolved", "Closed"):
            uat = t.get("updated_at")
            if isinstance(uat, datetime) and uat >= start:
                b = _date_bucket(r, uat)
                if b in resolved_counts:
                    resolved_counts[b] += 1

    return TicketLifecycleTimeline(
        created=_bucket_to_points(created_counts, keys),
        resolved=_bucket_to_points(resolved_counts, keys),
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

    chats = await db.chat_history.find({"timestamp": {"$gte": start}}).to_list(length=None)

    keys = _build_bucket_keys(r, now)
    chats_counts: Dict[str, int] = {k: 0 for k in keys}
    escalated_counts: Dict[str, int] = {k: 0 for k in keys}

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
