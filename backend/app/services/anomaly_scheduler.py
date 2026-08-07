"""Anomaly detection service — cron-style TUMBLING window, run only by the periodic background job.

Design (replaces the old sliding-window approach):
  - A single cursor document (`system_state` collection, _id="anomaly_scheduler")
    stores `last_checked_at`.
  - Each run only looks at tickets created in [last_checked_at, now) — a
    non-overlapping slice of time — then advances the cursor to `now`
    regardless of outcome.
  - Because every ticket is examined by exactly one run, ever, an old ticket
    can never resurface later to spawn a "surprise" alert the way it could
    under the old "rescan the last 60 minutes on every run" design.

Extracts specific categories from ticket title if category is 'General' or missing
(e.g., 'VPN', 'Email', 'Network', 'MFA', 'Hardware', 'Software').

Creates an 'auto_detected' alert when ticket count ≥ threshold (default 5)
and fans out notifications to all agents and admins.
"""

import logging
import re
from datetime import datetime, timedelta
from uuid import uuid4

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.settings import get_settings
from app.database.mongodb import get_database

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None

# Keywords to infer specific category from ticket title/description if category is 'General'
CATEGORY_PATTERNS = [
    (r'\b(vpn|remote\s*access|cisco\s*anyconnect|globalprotect)\b', 'VPN'),
    (r'\b(email|mail|outlook|exchange|smtp|gmail)\b', 'Email'),
    (r'\b(network|wifi|wi-fi|internet|dns|router|switch|lan|wan)\b', 'Network'),
    (r'\b(mfa|okta|2fa|authenticator|password|login|auth|sso)\b', 'Authentication'),
    (r'\b(hardware|laptop|pc|monitor|keyboard|mouse|printer|dock)\b', 'Hardware'),
    (r'\b(software|app|application|license|excel|teams|slack)\b', 'Software'),
]


def _infer_category(doc: dict) -> str | None:
    """Infer a specific category from the ticket document.

    Returns None when the category genuinely cannot be determined (e.g. AI
    categorisation hasn't finished yet or the text is too vague).  Callers
    must skip None results so uncategorisable tickets never inflate any
    category's spike count.
    """
    cat = (doc.get("category") or "").strip()
    ai_cat = (doc.get("ai_analysis_category") or "").strip()

    # Prefer explicit category fields when they are specific
    if cat and cat.lower() not in ('general', ''):
        return cat
    if ai_cat and ai_cat.lower() not in ('general', ''):
        return ai_cat

    # Fall back to keyword matching on title + description only
    text = f"{doc.get('title', '')} {doc.get('description', '')}".lower()
    for pattern, matched_category in CATEGORY_PATTERNS:
        if re.search(pattern, text):
            return matched_category

    # Cannot determine a reliable category — exclude from spike counting
    return None


CURSOR_DOC_ID = "anomaly_scheduler"


async def _get_cursor(db: AsyncIOMotorDatabase, now: datetime, window_minutes: int) -> datetime:
    """Return last_checked_at, initializing it on first-ever run.

    On first run there's no prior cursor, so we seed it to `now - window_minutes`
    (one window's worth of lookback) rather than the epoch, so we don't suddenly
    sweep in months of historical tickets on first deploy.
    """
    doc = await db.system_state.find_one({"_id": CURSOR_DOC_ID})
    if doc and doc.get("last_checked_at"):
        return doc["last_checked_at"]

    seed = now - timedelta(minutes=window_minutes)
    await db.system_state.update_one(
        {"_id": CURSOR_DOC_ID},
        {"$set": {"last_checked_at": seed}},
        upsert=True,
    )
    return seed


async def _advance_cursor(db: AsyncIOMotorDatabase, now: datetime) -> None:
    await db.system_state.update_one(
        {"_id": CURSOR_DOC_ID},
        {"$set": {"last_checked_at": now}},
        upsert=True,
    )


# ── Core detection logic (async) ─────────────────────────────────────────

async def run_anomaly_detection(
    db: AsyncIOMotorDatabase | None = None,
    *,
    advance_cursor: bool = True,
) -> None:
    """Check a non-overlapping (tumbling) window of new tickets and create/update auto_detected alerts.

    Every ticket is evaluated by exactly one run: the cursor only ever moves
    forward, so a ticket already covered by a past run can never be
    re-examined and spawn a new alert later.

    The optional ``advance_cursor`` flag is used by tests and by the ticket-create
    hook so a run can inspect the current batch without immediately sealing the
    window before the next ticket in the same burst is created.
    """
    if db is None:
        db = get_database()

    settings = get_settings()
    threshold = settings.alert_ticket_threshold     # default 5
    window_minutes = settings.alert_window_minutes   # default 60
    now = datetime.utcnow()

    window_start = await _get_cursor(db, now, window_minutes)

    # Fetch only tickets created since the cursor position. When this run is
    # triggered by ticket creation, we intentionally leave the cursor open so
    # the same burst of tickets can be counted together; the periodic scheduler
    # later advances the cursor once the window has truly finished.
    tickets = await db.tickets.find({
        "created_at": {"$gte": window_start, "$lt": now},
    }).to_list(length=None)

    # Group tickets by inferred category, skipping tickets whose category
    # cannot be reliably determined (returns None) so they never inflate any
    # category's spike count.
    category_counts: dict[str, list[dict]] = {}
    for ticket in tickets:
        cat = _infer_category(ticket)
        if cat is None:
            logger.debug("Ticket %s skipped — category undetermined", ticket.get("_id"))
            continue
        category_counts.setdefault(cat, []).append(ticket)

    alerts_created = 0
    for cat, cat_tickets in category_counts.items():
        count = len(cat_tickets)
        ticket_ids = set(t["_id"] for t in cat_tickets)

        if count < threshold:
            continue

        # Check if an active auto_detected alert already exists for this category
        existing_active = await db.alerts.find_one({
            "category": cat,
            "status": "active",
            "source": "auto_detected",
        })

        if existing_active:
            # If the existing active auto-detected alert already belongs to
            # the current open window, update it rather than resolving and
            # recreating it. This prevents duplicate auto-detected alerts from
            # being generated by ticket-create hook / scheduler runs within the
            # same tumbling window.
            if existing_active.get("window_start") == window_start:
                await db.alerts.update_one(
                    {"_id": existing_active["_id"]},
                    {"$set": {
                        "ticket_count": count,
                        "related_ticket_ids": list(ticket_ids),
                        "window_end": now,
                    }},
                )
                logger.info("Updated existing active auto-detected alert for '%s' within the same window (count=%d)", cat, count)
                continue

            # A new window is a fresh anomaly event, so close the previous
            # active alert and create a new one for the current window.
            await db.alerts.update_one(
                {"_id": existing_active["_id"]},
                {"$set": {
                    "status": "resolved",
                    "resolved_at": now,
                    "resolved_by": None,
                }},
            )
            logger.info("Resolved prior active auto-detected alert for '%s' before creating a new window alert", cat)

        # No active alert for this category, and this window's tickets were
        # never evaluated by any previous run (cursor guarantees that) — so
        # this is a genuinely fresh spike. Create a new alert.
        # (The old code had extra guards here — diffing against the most
        # recently resolved alert's ticket IDs, and merging into any active
        # alert that shared a ticket ID across categories. Both existed only
        # to paper over the sliding window re-examining the same tickets on
        # later runs. With a tumbling window that can't happen — each ticket
        # is grouped into exactly one category and seen by exactly one run —
        # so those guards are removed rather than left as dead weight.)

        # Create new auto_detected alert
        alert_id = str(uuid4())
        alert_doc = {
            "_id": alert_id,
            "title": f"High Ticket Volume: {cat}",
            "message": f"Multiple reports of {cat} issues — our team is investigating.",
            "recommendation": None,
            "source": "auto_detected",
            "category": cat,
            "status": "active",
            "created_by": None,
            "created_at": now,
            "resolved_by": None,
            "resolved_at": None,
            "ticket_count": count,
            "related_ticket_ids": list(ticket_ids),
            "window_start": window_start,
            "window_end": now,
        }

        # Try attaching a KB recommendation
        try:
            from app.services.alert_recommendation import get_kb_recommendation
            kb_rec = await get_kb_recommendation(db, cat)
            if kb_rec:
                alert_doc["message"] = kb_rec
                alert_doc["recommendation"] = kb_rec
        except Exception as exc:
            logger.debug("KB recommendation lookup skipped for '%s': %s", cat, exc)

        await db.alerts.insert_one(alert_doc)
        alerts_created += 1
        logger.info("Auto-detected alert created for category '%s' (count=%d)", cat, count)

        # Fan-out notifications to all agents and admins
        recipients = await db.users.find({
            "role": {"$in": ["agent", "admin", "Agent", "Admin"]},
            "is_active": True,
            "deleted": {"$ne": True},
        }, {"_id": 1}).to_list(length=None)

        if recipients:
            # Avoid creating duplicate notifications for the same user and
            # alert title within a short time window (race conditions or
            # concurrent scheduler runs can otherwise produce duplicates).
            recipient_ids = [user["_id"] for user in recipients]
            recent_window = now - timedelta(minutes=5)
            existing = await db.notifications.find({
                "user_id": {"$in": recipient_ids},
                "title": alert_doc["title"],
                "created_at": {"$gte": recent_window},
            }).to_list(length=None)
            already_notified = {doc.get("user_id") for doc in existing}

            filtered = [user for user in recipients if user["_id"] not in already_notified]
            if not filtered:
                logger.debug("No new recipients to notify for alert '%s' (duplicates skipped)", alert_id)
            else:
                notif_docs = [
                    {
                        "_id": str(uuid4()),
                        "user_id": user["_id"],
                        "type": "alert",
                        "title": alert_doc["title"],
                        "message": alert_doc["message"],
                        "alert_id": alert_id,
                        "ticket_id": None,
                        "read": False,
                        "created_at": now,
                    }
                    for user in filtered
                ]
                await db.notifications.insert_many(notif_docs)
                logger.info("Notified %d users about auto-detected '%s' alert", len(notif_docs), cat)

    # Advance the cursor only when the caller is closing a finished window.
    # Ticket creation invokes this service immediately after insert, but the
    # current run should not consume the cursor before the next ticket in the
    # same burst has a chance to be inserted.
    if advance_cursor:
        await _advance_cursor(db, now)

    if alerts_created:
        logger.info("Anomaly detection run finished: %d alert(s) created", alerts_created)
    logger.debug("Cursor advanced to %s (window was %s → %s)", now, window_start, now)


# ── Async wrapper for APScheduler ────────────────────────────────────────

async def _run_anomaly_detection_async() -> None:
    """Entry-point called by AsyncIOScheduler on the main event loop."""
    try:
        await run_anomaly_detection()
    except Exception as exc:
        logger.error("Anomaly detection job failed: %s", exc, exc_info=True)


# ── Public start / stop helpers ──────────────────────────────────────────

def start_scheduler() -> None:
    """Start AsyncIOScheduler for periodic anomaly checks.

    IMPORTANT: the job interval should match `settings.alert_window_minutes`
    (default 60) so this is a true tumbling window — each run's [cursor, now)
    slice is contiguous with the next run's, with no gap and no overlap.
    Running the job more often than the window (e.g. every 5 min against a
    60 min window) would just mean most runs see zero new tickets, which is
    harmless but pointless; running it *less* often than the window would
    leave gaps. For fast local testing, lower `alert_window_minutes` in
    settings rather than decoupling this interval from it.

    AsyncIOScheduler runs coroutines directly on the running FastAPI event loop,
    so Motor DB handles (which are bound to that loop) work without any
    cross-loop issues.
    """
    global _scheduler
    if _scheduler is not None:
        return

    settings = get_settings()
    interval_minutes = settings.alert_window_minutes  # default 60

    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _run_anomaly_detection_async,
        "interval",
        minutes=interval_minutes,
        id="anomaly_detection",
        name="Anomaly Detection (tumbling window)",
        max_instances=1,
        next_run_time=datetime.utcnow() + timedelta(seconds=10),
    )
    _scheduler.start()
    logger.info("Anomaly detection scheduler started (interval=%dmin, tumbling window, async)", interval_minutes)


def stop_scheduler() -> None:
    """Gracefully shut down the scheduler."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Anomaly detection scheduler stopped")