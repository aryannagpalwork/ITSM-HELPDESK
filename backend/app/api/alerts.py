from datetime import datetime
from typing import Literal, Optional
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.deps import DatabaseSession
from app.auth.dependencies import get_current_user, require_roles
from app.services.alert_recommendation import get_kb_recommendation

router = APIRouter(prefix="/alerts", tags=["Alerts"])


class AlertCreate(BaseModel):
    title: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    category: Optional[str] = None


class AlertRead(BaseModel):
    id: str
    title: str
    message: str
    recommendation: Optional[str] = None
    source: Literal["manual", "auto_detected"]
    category: Optional[str] = None
    status: Literal["active", "resolved"]
    created_by: Optional[str] = None
    created_at: datetime
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None


class ClearHistoryResponse(BaseModel):
    deleted_count: int


def _format_alert(doc: dict) -> AlertRead:
    return AlertRead(
        id=str(doc.get("_id")),
        title=doc.get("title", ""),
        message=doc.get("message", ""),
        recommendation=doc.get("recommendation"),
        source=doc.get("source", "manual"),
        category=doc.get("category"),
        status=doc.get("status", "active"),
        created_by=str(doc["created_by"]) if doc.get("created_by") else None,
        created_at=doc.get("created_at", datetime.utcnow()),
        resolved_by=str(doc["resolved_by"]) if doc.get("resolved_by") else None,
        resolved_at=doc.get("resolved_at"),
    )


@router.post("", response_model=AlertRead, status_code=status.HTTP_201_CREATED)
async def create_alert(
    payload: AlertCreate,
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["admin"])),
):
    """Create a manual system alert (Admin only). Runs KB recommendation lookup."""
    query = f"{payload.category or ''} {payload.title}".strip()
    recommendation = await get_kb_recommendation(db, query)

    doc = {
        "_id": str(uuid4()),
        "title": payload.title,
        "message": payload.message,
        "recommendation": recommendation,
        "source": "manual",
        "category": payload.category,
        "status": "active",
        "created_by": str(current_user.get("id")) if current_user.get("id") else None,
        "created_at": datetime.utcnow(),
        "resolved_by": None,
        "resolved_at": None,
    }
    await db.alerts.insert_one(doc)
    return _format_alert(doc)


@router.get("/active", response_model=list[AlertRead])
async def get_active_alerts(
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
):
    """Get active system alerts filtered by strict role-based visibility matrix.

    - Employee (end_user role): sees manual alerts only. Auto-detected alerts hidden.
    - Agent (agent role): sees manual AND auto-detected alerts.
    - Admin (admin role): sees manual alerts created by OTHER admins (self-created excluded).
      Does NOT see auto-detected alerts in the notification bell.
    """
    internal_role = current_user.get("internal_role", "end_user")
    user_id = str(current_user.get("id", ""))

    filter_query: dict = {"status": "active"}

    if internal_role == "end_user":
        filter_query["source"] = "manual"
    elif internal_role == "admin":
        filter_query["source"] = "manual"
        filter_query["created_by"] = {"$ne": user_id}
    # agent sees all active alerts (source manual + auto_detected)

    cursor = db.alerts.find(filter_query).sort("created_at", -1)
    docs = await cursor.to_list(length=None)
    return [_format_alert(doc) for doc in docs]


@router.get("", response_model=list[AlertRead])
async def get_all_alerts(
    db: DatabaseSession,
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["admin"])),
):
    """Get alert history, optionally filtered by status and source (Admin only).

    For Admin Dashboard banner: GET /alerts?status=active&source=auto_detected
    """
    filter_query = {}
    if status:
        filter_query["status"] = status
    if source:
        filter_query["source"] = source

    cursor = db.alerts.find(filter_query).sort("created_at", -1)
    docs = await cursor.to_list(length=None)
    return [_format_alert(doc) for doc in docs]


@router.delete("/history", response_model=ClearHistoryResponse)
async def clear_resolved_alerts_history(
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["admin"])),
):
    """Delete all resolved system alerts (Admin only). Active alerts remain untouched."""
    result = await db.alerts.delete_many({"status": "resolved"})
    return ClearHistoryResponse(deleted_count=result.deleted_count)


@router.patch("/{alert_id}/resolve", response_model=AlertRead)
async def resolve_alert(
    alert_id: str,
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["admin"])),
):
    """Mark an alert as resolved (Admin only)."""
    existing = await db.alerts.find_one({"_id": alert_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    now = datetime.utcnow()
    await db.alerts.update_one(
        {"_id": alert_id},
        {
            "$set": {
                "status": "resolved",
                "resolved_by": str(current_user.get("id")),
                "resolved_at": now,
            }
        },
    )
    updated = await db.alerts.find_one({"_id": alert_id})
    return _format_alert(updated)
