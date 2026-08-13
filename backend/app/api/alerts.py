from datetime import datetime, timedelta
from typing import Literal, Optional
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.deps import DatabaseSession
from app.auth.dependencies import get_current_user, require_roles

router = APIRouter(prefix="/alerts", tags=["Alerts"])


class AlertCreate(BaseModel):
    title: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    category: Optional[str] = None
    target_roles: Optional[list[str]] = None  # ["employee", "agent"] for manual alerts


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
    target_roles: Optional[list[str]] = None  # For manual alerts: ["employee", "agent"] or subset


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
        target_roles=doc.get("target_roles"),
    )


@router.post("", response_model=AlertRead, status_code=status.HTTP_201_CREATED)
async def create_alert(
    payload: AlertCreate,
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["admin"])),
):
    """Create a manual system alert (Admin only). Runs KB recommendation lookup.
    
    For manual alerts, optional target_roles specifies notification recipients:
    - ["employee"] → notify employees only
    - ["agent"] → notify agents only  
    - ["employee", "agent"] → notify both
    
    If target_roles is omitted or empty for a manual alert, defaults to notifying both.
    Automatic alerts are unaffected and always notify agents + admins.
    """
    from uuid import uuid4
    
    # If target_roles is omitted, preserve backward compatibility by notifying both.
    # If it is explicitly provided, at least one valid recipient must be selected.
    if payload.target_roles is None:
        target_roles = ["employee", "agent"]
    else:
        target_roles = payload.target_roles
        valid_roles = {"employee", "agent"}
        if not target_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Select at least one recipient.",
            )
        if not all(role in valid_roles for role in target_roles):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid target_roles. Must be subset of {valid_roles}.",
            )

    # Manual alerts are admin-authored announcements and should not receive
    # automatic AI/KB recommendations. Automatic alerts may still populate
    # the recommendation field through their existing generation path.
    recommendation = None

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
        "target_roles": target_roles,
    }
    await db.alerts.insert_one(doc)
    
    # Fan out notifications to selected recipient roles
    # Map frontend roles to backend roles
    role_mapping = {
        "employee": "end_user",
        "agent": "agent",
    }
    backend_roles = [role_mapping.get(r) for r in target_roles if r in role_mapping]
    
    if backend_roles:
        recipients = await db.users.find({
            "internal_role": {"$in": backend_roles},
            "is_active": True,
            "deleted": {"$ne": True},
        }, {"_id": 1}).to_list(length=None)
        
        if recipients:
            recipient_ids = [user["_id"] for user in recipients]
            now = datetime.utcnow()
            recent_window = now - timedelta(minutes=5)
            
            # Check for recent duplicate notifications
            existing = await db.notifications.find({
                "user_id": {"$in": recipient_ids},
                "title": doc["title"],
                "created_at": {"$gte": recent_window},
            }).to_list(length=None)
            already_notified = {n.get("user_id") for n in existing}
            
            filtered = [user for user in recipients if user["_id"] not in already_notified]
            if filtered:
                notif_docs = [
                    {
                        "_id": str(uuid4()),
                        "user_id": user["_id"],
                        "type": "alert",
                        "title": doc["title"],
                        "message": doc["message"],
                        "alert_id": doc["_id"],
                        "ticket_id": None,
                        "read": False,
                        "created_at": now,
                    }
                    for user in filtered
                ]
                await db.notifications.insert_many(notif_docs)
    
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
        # Employees only see manual alerts that explicitly target employees.
        filter_query["source"] = "manual"
        filter_query["target_roles"] = "employee"
    elif internal_role == "agent":
        # Agents see all automatic alerts, plus only manual alerts that target agents.
        filter_query = {
            "status": "active",
            "$or": [
                {"source": "auto_detected"},
                {"source": "manual", "target_roles": "agent"},
                # Backward compatibility for older manual alerts without target_roles.
                {"source": "manual", "target_roles": {"$exists": False}},
            ],
        }
    elif internal_role == "admin":
        filter_query["source"] = "manual"
        filter_query["created_by"] = {"$ne": user_id}
    # Admin Alert Management remains the source of truth for admins.

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