from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import DatabaseSession
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationRead(BaseModel):
    id: str
    user_id: str
    type: str  # any notification type stored in DB (e.g. info, alert, ticket.assigned, feedback_request)
    title: str
    message: str
    ticket_id: Optional[str] = None
    alert_id: Optional[str] = None
    read: bool
    created_at: datetime


class UnreadCountResponse(BaseModel):
    unread_count: int


def _format_notification(doc: dict) -> NotificationRead:
    return NotificationRead(
        id=str(doc.get("_id")),
        user_id=str(doc.get("user_id")),
        type=doc.get("type", "info"),
        title=doc.get("title", ""),
        message=doc.get("message", ""),
        ticket_id=str(doc["ticket_id"]) if doc.get("ticket_id") else None,
        alert_id=str(doc["alert_id"]) if doc.get("alert_id") else None,
        read=bool(doc.get("read", False)),
        created_at=doc.get("created_at", datetime.utcnow()),
    )


@router.get("", response_model=list[NotificationRead])
async def get_my_notifications(
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
):
    """Get notifications for current authenticated user, most recent first."""
    user_id = current_user.get("id")
    cursor = db.notifications.find({"user_id": user_id}).sort("created_at", -1)
    docs = await cursor.to_list(length=None)
    return [_format_notification(doc) for doc in docs]


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
):
    """Get unread notifications count for current authenticated user."""
    user_id = current_user.get("id")
    count = await db.notifications.count_documents({"user_id": user_id, "read": False})
    return UnreadCountResponse(unread_count=count)


@router.patch("/read-all", response_model=UnreadCountResponse)
async def mark_all_notifications_read(
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
):
    """Mark all unread notifications as read for current authenticated user."""
    user_id = current_user.get("id")
    await db.notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True}},
    )
    return UnreadCountResponse(unread_count=0)


@router.patch("/{notif_id}/read", response_model=NotificationRead)
async def mark_notification_read(
    notif_id: str,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
):
    """Mark a notification as read (own notification only)."""
    user_id = current_user.get("id")
    existing = await db.notifications.find_one({"_id": notif_id, "user_id": user_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    await db.notifications.update_one(
        {"_id": notif_id},
        {"$set": {"read": True}},
    )
    updated = await db.notifications.find_one({"_id": notif_id})
    return _format_notification(updated)
