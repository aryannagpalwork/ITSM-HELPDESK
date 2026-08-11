"""Admin-only SLA configuration endpoints."""

from fastapi import APIRouter, Depends

from app.api.deps import DatabaseSession
from app.auth.dependencies import get_current_user, require_roles
from app.schemas.sla_config import SLAConfigRead, SLAConfigUpdate, PrioritySLAConfig
from app.services.sla import apply_sla_config

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

    for key in ("critical", "high", "medium", "low"):
        patch = getattr(payload, key, None)
        if patch is not None:
            raw[key] = patch.model_dump()

    if payload.near_breach_percent is not None:
        raw["near_breach_percent"] = payload.near_breach_percent

    await _save_config(db, raw)
    apply_sla_config(raw)
    return SLAConfigRead(
        critical=PrioritySLAConfig(**raw["critical"]),
        high=PrioritySLAConfig(**raw["high"]),
        medium=PrioritySLAConfig(**raw["medium"]),
        low=PrioritySLAConfig(**raw["low"]),
        near_breach_percent=raw["near_breach_percent"],
    )
