"""Centralized SLA configuration and lifecycle calculations."""

from datetime import datetime, timedelta, timezone
from typing import Any


SLA_TARGET_HOURS: dict[str, float] = {
    "Critical": 4.0,
    "High": 8.0,
    "Medium": 24.0,
    "Low": 72.0,
}
FIRST_RESPONSE_MINUTES: dict[str, float] = {
    "Critical": 15.0,
    "High": 30.0,
    "Medium": 120.0,
    "Low": 240.0,
}
NEAR_BREACH_PERCENT = 80.0
ACTIVE_STATUSES = {"Open", "In Progress", "Waiting for User Response"}
TERMINAL_STATUSES = {"Resolved", "Closed"}


def target_hours(priority: str | None) -> float:
    normalized = (priority or "Medium").replace("_", " ").title()
    return SLA_TARGET_HOURS.get(normalized, SLA_TARGET_HOURS["Medium"])


def first_response_minutes(priority: str | None) -> float:
    normalized = (priority or "Medium").replace("_", " ").title()
    return FIRST_RESPONSE_MINUTES.get(normalized, FIRST_RESPONSE_MINUTES["Medium"])


def near_breach_threshold() -> float:
    return NEAR_BREACH_PERCENT


def apply_sla_config(config: dict[str, Any]) -> None:
    """Update module-level constants from a DB-loaded config dict."""
    global SLA_TARGET_HOURS, FIRST_RESPONSE_MINUTES, NEAR_BREACH_PERCENT
    for key in ("critical", "high", "medium", "low"):
        if key in config and isinstance(config[key], dict):
            title_key = key.title()
            if "sla_target_hours" in config[key]:
                SLA_TARGET_HOURS[title_key] = float(config[key]["sla_target_hours"])
            if "first_response_minutes" in config[key]:
                FIRST_RESPONSE_MINUTES[title_key] = float(config[key]["first_response_minutes"])
    if "near_breach_percent" in config:
        NEAR_BREACH_PERCENT = float(config["near_breach_percent"])


async def load_sla_config_from_db(db) -> None:
    """Load SLA config from app_settings collection and apply to module constants."""
    doc = await db.app_settings.find_one({"_id": "sla_config"})
    if doc:
        apply_sla_config({k: v for k, v in doc.items() if k != "_id"})


def _hours_between(start: datetime, end: datetime) -> float:
    return max(0.0, (end - start).total_seconds() / 3600.0)


def _as_datetime(value: Any, fallback: datetime) -> datetime:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            pass
    return fallback


def calculate_sla(
    *,
    priority: str | None,
    started_at: datetime,
    status: str | None,
    now: datetime | None = None,
    resolved_at: datetime | None = None,
) -> dict[str, Any]:
    """Return the complete SLA snapshot for a ticket without mutating storage."""
    current_time = now or datetime.utcnow()
    hours = target_hours(priority)
    due_at = started_at + timedelta(hours=hours)
    comparison_time = resolved_at if resolved_at and status in TERMINAL_STATUSES else current_time
    elapsed = _hours_between(started_at, comparison_time)
    remaining = max(0.0, hours - elapsed)
    breached = elapsed > hours
    compliant = elapsed <= hours if status in TERMINAL_STATUSES else None

    threshold = near_breach_threshold() / 100.0

    if status == "Closed":
        sla_status = "Completed"
    elif status == "Resolved":
        sla_status = "Breached" if breached else "Within SLA"
    elif breached:
        sla_status = "Breached"
    elif elapsed >= hours * threshold:
        sla_status = "Near Breach"
    else:
        sla_status = "Active"

    return {
        "sla_target_hours": hours,
        "sla_started_at": started_at,
        "sla_due_at": due_at,
        "sla_remaining_hours": remaining,
        "sla_status": sla_status,
        "sla_breached": breached,
        "resolution_duration_hours": elapsed if status in TERMINAL_STATUSES else None,
        "sla_compliant": compliant,
    }


def snapshot_for_ticket(ticket: dict[str, Any], now: datetime | None = None) -> dict[str, Any]:
    current_time = now or datetime.utcnow()
    started_at = _as_datetime(ticket.get("sla_started_at") or ticket.get("created_at"), current_time)
    resolved_at = _as_datetime(ticket.get("resolved_at"), current_time) if ticket.get("resolved_at") else None
    if resolved_at is None and ticket.get("status") in TERMINAL_STATUSES:
        resolved_at = _as_datetime(ticket.get("updated_at"), current_time)
    return calculate_sla(
        priority=ticket.get("priority"),
        started_at=started_at,
        status=ticket.get("status"),
        now=current_time,
        resolved_at=resolved_at,
    )
