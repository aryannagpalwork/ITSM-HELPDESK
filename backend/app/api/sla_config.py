"""Admin-only SLA configuration endpoints."""

import logging
from fastapi import APIRouter, Depends

from app.api.deps import DatabaseSession
from app.auth.dependencies import get_current_user, require_roles
from app.schemas.sla_config import SLAConfigRead, SLAConfigUpdate, PrioritySLAConfig
from app.services.sla import apply_sla_config, recalculate_sla_for_all_tickets

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sla-config", tags=["SLA Configuration"])

DEFAULT_SLA_CONFIG = {
    "critical": {"sla_target_hours": 4.0, "first_response_minutes": 15},
    "high": {"sla_target_hours": 8.0, "first_response_minutes": 30},
    "medium": {"sla_target_hours": 24.0, "first_response_minutes": 120},
    "low": {"sla_target_hours": 72.0, "first_response_minutes": 240},
    "near_breach_percent": 80.0,
}


async def _load_config(db: DatabaseSession) -> dict:
    doc = await db.app_settings.find_one({"_id": "sla_config"})
    if doc:
        merged = {**DEFAULT_SLA_CONFIG, **{k: v for k, v in doc.items() if k != "_id"}}
        return merged
    return dict(DEFAULT_SLA_CONFIG)


async def _save_config(db: DatabaseSession, config: dict) -> None:
    await db.app_settings.update_one(
        {"_id": "sla_config"},
        {"$set": config},
        upsert=True,
    )


@router.get("", response_model=SLAConfigRead)
async def get_sla_config(
    db: DatabaseSession,
    _current_user: dict = Depends(get_current_user),
) -> SLAConfigRead:
    raw = await _load_config(db)
    return SLAConfigRead(
        critical=PrioritySLAConfig(**raw["critical"]),
        high=PrioritySLAConfig(**raw["high"]),
        medium=PrioritySLAConfig(**raw["medium"]),
        low=PrioritySLAConfig(**raw["low"]),
        near_breach_percent=raw["near_breach_percent"],
    )


@router.put("", response_model=SLAConfigRead)
async def update_sla_config(
    payload: SLAConfigUpdate,
    db: DatabaseSession,
    _current_user: dict = Depends(require_roles(["Administrator"])),
) -> SLAConfigRead:
    raw = await _load_config(db)

    # Track which priorities were changed
    changed_priorities = []
    
    for key in ("critical", "high", "medium", "low"):
        patch = getattr(payload, key, None)
        if patch is not None:
            raw[key] = patch.model_dump()
            changed_priorities.append(key.title())

    if payload.near_breach_percent is not None:
        raw["near_breach_percent"] = payload.near_breach_percent

    await _save_config(db, raw)
    apply_sla_config(raw)
    
    # Recalculate SLA status for all affected tickets
    try:
        if changed_priorities:
            # Only recalculate tickets of changed priorities
            updated_count = await recalculate_sla_for_all_tickets(db, changed_priorities)
        else:
            # If only near_breach_percent changed, recalculate all tickets
            updated_count = await recalculate_sla_for_all_tickets(db)
        
        logger.info(f"SLA configuration updated. Recalculated SLA for {updated_count} tickets.")
    except Exception as exc:
        logger.error(f"Failed to recalculate SLA for tickets: {exc}")
        # Don't fail the API call if recalculation fails; config was saved successfully
    
    return SLAConfigRead(
        critical=PrioritySLAConfig(**raw["critical"]),
        high=PrioritySLAConfig(**raw["high"]),
        medium=PrioritySLAConfig(**raw["medium"]),
        low=PrioritySLAConfig(**raw["low"]),
        near_breach_percent=raw["near_breach_percent"],
    )
