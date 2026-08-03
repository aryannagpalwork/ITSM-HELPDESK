from datetime import datetime, timedelta
import json
import logging
from uuid import uuid4
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.api.deps import DatabaseSession
from app.auth.dependencies import get_current_user, require_roles
from app.services.tickets import get_agent_metrics
from app.services.tickets import get_agent_metrics
from app.services.tickets import get_agent_metrics
from app.auth.security import hash_password
from app.schemas.user import UserRead, UserCreate, AdminUserCreate, UserUpdate, UserRoleUpdate, UserStatus
from app.auth.dependencies import FRONTEND_TO_INTERNAL

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


# ──────────────────────────────────────────────
# Audit Logging Helper
# ──────────────────────────────────────────────


async def _write_audit_log(
    db: AsyncIOMotorDatabase,
    *,
    action: str,
    user_id: str | None,
    entity_id: str | None,
    metadata: dict | None = None,
    reason: str | None = None,
) -> None:
    """Write an audit log entry to the database."""
    audit_log = {
        "_id": str(uuid4()),
        "user_id": user_id,
        "action": action,
        "entity_type": "user",
        "entity_id": entity_id,
        "metadata_json": json.dumps(metadata) if metadata else None,
        "reason": reason,
        "created_at": datetime.utcnow(),
    }
    await db.audit_logs.insert_one(audit_log)


# ──────────────────────────────────────────────
# Last Active Admin Safeguard
# ──────────────────────────────────────────────


async def _get_active_admin_count(db: AsyncIOMotorDatabase) -> int:
    """Count the number of active, non-deleted admin users."""
    return await db.users.count_documents({
        "role": "admin",
        "deleted": {"$ne": True},
        "is_active": True,
        "status": {"$in": [UserStatus.ACTIVE.value, UserStatus.APPROVED.value]},
    })


async def _ensure_not_last_admin(db: AsyncIOMotorDatabase) -> None:
    """Raise 400 if there is only one active admin remaining."""
    count = await _get_active_admin_count(db)
    if count <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot perform this action on the last active admin account."
        )


def _map_db_user_to_read(db_user: dict) -> UserRead:
    """Map a MongoDB user dict to a UserRead model"""
    from app.auth.dependencies import INTERNAL_TO_FRONTEND

    mapped_user = db_user.copy()
    mapped_user["id"] = mapped_user["_id"]
    mapped_user["role"] = INTERNAL_TO_FRONTEND.get(mapped_user["role"], mapped_user["role"])
    return UserRead(**mapped_user)


@router.get("/users", response_model=list[UserRead], status_code=status.HTTP_200_OK)
async def list_users(
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))],
    include_deleted: bool = False,
) -> list[UserRead]:
    """List all users (admin only).
    If include_deleted is True, returns all users including soft-deleted ones.
    """
    query = {} if include_deleted else {"deleted": {"$ne": True}}
    users = await db.users.find(query).to_list(length=None)
    return [_map_db_user_to_read(user) for user in users]


class AdminAgentRead(BaseModel):
    id: str
    full_name: str
    email: str
    department: str | None = None
    specialization: list[str] | str | None = None
    availability: str | None = None
    max_capacity: int = 10
    active_ticket_count: int = 0
    total_assigned: int = 0
    total_resolved: int = 0
    last_assigned_at: datetime | None = None
    status: str | None = None
    is_active: bool = True


class AdminAgentListResponse(BaseModel):
    items: list[AdminAgentRead]
    total: int
    page: int
    page_size: int
    pages: int


class AdminAgentTicketRead(BaseModel):
    id: str
    ticket_number: str
    title: str
    category: str
    priority: str
    status: str
    employee_name: str | None = None
    created_at: datetime
    updated_at: datetime


class AdminAgentTicketListResponse(BaseModel):
    items: list[AdminAgentTicketRead]
    total: int
    page: int
    page_size: int
    pages: int
    summary: dict[str, int] = Field(default_factory=dict)


def _map_agent_to_read(agent: dict) -> AdminAgentRead:
    return AdminAgentRead(
        id=agent["_id"], full_name=agent.get("full_name", ""), email=agent.get("email", ""),
        department=agent.get("department"), specialization=agent.get("specialization"),
        availability=agent.get("availability", "Available"),
        max_capacity=agent.get("max_capacity") or 10,
        active_ticket_count=agent.get("active_ticket_count") or 0,
        total_assigned=agent.get("total_assigned") or 0,
        total_resolved=agent.get("total_resolved") or 0,
        last_assigned_at=agent.get("last_assigned_at"), status=agent.get("status"),
        is_active=agent.get("is_active", True),
    )


@router.get("/agents", response_model=AdminAgentListResponse, status_code=status.HTTP_200_OK)
async def list_admin_agents(
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))],
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = None,
    department: str | None = None,
    specialization: str | None = None,
    availability: str | None = None,
) -> AdminAgentListResponse:
    """Read-only paginated agent directory for administrators."""
    query: dict = {"role": "agent", "deleted": {"$ne": True}}
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    if department:
        query["department"] = {"$regex": department, "$options": "i"}
    if specialization:
        query["specialization"] = {"$regex": specialization, "$options": "i"}
    if availability:
        query["availability"] = availability

    total = await db.users.count_documents(query)
    skip = (page - 1) * page_size
    agents = await db.users.find(query).sort([("full_name", 1), ("_id", 1)]).skip(skip).limit(page_size).to_list(length=page_size)
    return AdminAgentListResponse(
        items=[_map_agent_to_read(agent) for agent in agents], total=total,
        page=page, page_size=page_size, pages=(total + page_size - 1) // page_size if total else 0,
    )


@router.get("/agents/{agent_id}", response_model=AdminAgentRead, status_code=status.HTTP_200_OK)
async def get_admin_agent(
    agent_id: str,
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))],
) -> AdminAgentRead:
    agent = await db.users.find_one({"_id": agent_id, "role": "agent", "deleted": {"$ne": True}})
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")
    return _map_agent_to_read(agent)


@router.get("/agents/{agent_id}/tickets", response_model=AdminAgentTicketListResponse, status_code=status.HTTP_200_OK)
async def list_admin_agent_tickets(
    agent_id: str,
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))],
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = None,
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
) -> AdminAgentTicketListResponse:
    agent = await db.users.find_one({"_id": agent_id, "role": "agent", "deleted": {"$ne": True}}, {"_id": 1})
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")

    query: dict = {"assigned_to": agent_id}
    if search:
        query["$or"] = [
            {"ticket_number": {"$regex": search, "$options": "i"}},
            {"title": {"$regex": search, "$options": "i"}},
            {"category": {"$regex": search, "$options": "i"}},
        ]
    sort_fields = {"created_at", "updated_at", "title", "priority", "status", "ticket_number"}
    direction = 1 if sort_order.lower() == "asc" else -1
    sort_field = sort_by if sort_by in sort_fields else "created_at"
    total = await db.tickets.count_documents(query)
    skip = (page - 1) * page_size
    tickets = await db.tickets.find(query).sort([(sort_field, direction), ("_id", direction)]).skip(skip).limit(page_size).to_list(length=page_size)

    requester_ids = {ticket.get("created_by") for ticket in tickets if ticket.get("created_by")}
    requesters = await db.users.find({"_id": {"$in": list(requester_ids)}}, {"_id": 1, "full_name": 1}).to_list(length=None) if requester_ids else []
    requester_names = {user["_id"]: user.get("full_name") for user in requesters}
    items = [AdminAgentTicketRead(
        id=ticket["_id"], ticket_number=ticket.get("ticket_number", ticket["_id"]),
        title=ticket.get("title", ""), category=ticket.get("category", "General"),
        priority=ticket.get("priority", "Medium"), status=ticket.get("status", "Open"),
        employee_name=requester_names.get(ticket.get("created_by")),
        created_at=ticket["created_at"], updated_at=ticket["updated_at"],
    ) for ticket in tickets]

    summary = {"total_assigned": total}
    for status_name in ("Open", "In Progress", "Pending", "Resolved", "Closed"):
        summary[status_name.lower().replace(" ", "_")] = await db.tickets.count_documents({"assigned_to": agent_id, "status": status_name})
    return AdminAgentTicketListResponse(
        items=items, total=total, page=page, page_size=page_size,
        pages=(total + page_size - 1) // page_size if total else 0, summary=summary,
    )


# ──────────────────────────────────────────────
# Enterprise User Approval Workflow Endpoints
# NOTE: /users/pending MUST be defined before /users/{user_id} to avoid
#       FastAPI capturing "pending" as a user_id path parameter.
# ──────────────────────────────────────────────


@router.get("/users/pending", response_model=list[UserRead], status_code=status.HTTP_200_OK)
async def list_pending_users(
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))]
) -> list[UserRead]:
    """List all users with PENDING status (admin only)"""
    users = await db.users.find(
        {"status": UserStatus.PENDING.value, "deleted": {"$ne": True}}
    ).to_list(length=None)
    return [_map_db_user_to_read(user) for user in users]


@router.get("/users/{user_id}", response_model=UserRead, status_code=status.HTTP_200_OK)
async def get_user(
    user_id: str,
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))]
) -> UserRead:
    """Get single user (admin only)"""
    user = await db.users.find_one({"_id": user_id, "deleted": {"$ne": True}})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return _map_db_user_to_read(user)


@router.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: AdminUserCreate,
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))]
) -> UserRead:
    """Create a new user with immediate access (admin only).
    New users are created with APPROVED status so they can log in right away.
    """
    logger.debug(f"create_user: Called by user id={current_user.get('id')}, "
                 f"internal_role={current_user.get('internal_role')}, "
                 f"frontend_role={current_user.get('role')}")
    logger.debug(f"create_user: Received payload fields: email='{payload.email}', "
                 f"full_name='{payload.full_name}', role='{payload.role}', "
                 f"has_password={bool(payload.password)}")
    # Normalize inputs
    email = payload.email.lower().strip()
    full_name = payload.full_name.strip()
    normalized_role = payload.role.lower().strip()

    # Validate role
    allowed_roles = ["employee", "agent", "admin", "end_user", "administrator"]
    if normalized_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{payload.role}'. Must be one of: employee, agent, admin"
        )

    # Convert to internal role
    role_mapping = {"employee": "end_user", "administrator": "admin"}
    internal_role = role_mapping.get(normalized_role, normalized_role)

    # Check if email already exists
    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists"
        )

    # Hash the password
    hashed_password = hash_password(payload.password)

    # Create user with APPROVED status
    user_id = str(uuid4())
    now = datetime.utcnow()

    new_user = {
        "_id": user_id,
        "email": email,
        "full_name": full_name,
        "role": internal_role,
        "hashed_password": hashed_password,
        "department": payload.department.strip() if payload.department else None,
        "status": UserStatus.APPROVED.value,
        "is_active": True,
        "created_by": current_user["id"],
        "created_at": now,
        "updated_at": now,
        "last_login": None,
        "invitation_token": None,
        "invitation_expiry": None,
        "email_verified": True,
        "first_login_completed": True,
        "deleted": False,
    }
    if internal_role == "agent":
        new_user.update({
            "specialization": payload.specialization or [],
            "availability": payload.availability or "Available",
            "max_capacity": payload.max_capacity or 10,
            "active_ticket_count": 0,
            "total_assigned": 0,
            "total_resolved": 0,
        })

    await db.users.insert_one(new_user)

    # Audit log
    await _write_audit_log(
        db,
        action="user.created",
        user_id=current_user["id"],
        entity_id=user_id,
        metadata={
            "email": email,
            "role": internal_role,
            "created_by": current_user["id"],
        },
    )

    return _map_db_user_to_read(new_user)


@router.post("/users/invite", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def invite_user(
    payload: UserCreate,
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))]
) -> UserRead:
    """Invite a new user (no password, invitation token, admin only).
    Preserves the original invitation flow for users who should set their own password.
    """
    # Validate role: only allow employee/agent
    normalized_role = payload.role.lower().strip()
    if normalized_role not in ["employee", "agent"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only 'employee' and 'agent' roles can be invited"
        )

    # Convert to internal role
    internal_role = FRONTEND_TO_INTERNAL.get(normalized_role, normalized_role)

    # Check if email already exists
    existing_user = await db.users.find_one({"email": payload.email.lower().strip()})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists"
        )

    # Create user
    user_id = str(uuid4())
    now = datetime.utcnow()
    invitation_token = str(uuid4())
    invitation_expiry = now + timedelta(days=7)

    new_user = {
        "_id": user_id,
        "email": payload.email.lower().strip(),
        "full_name": payload.full_name.strip(),
        "role": internal_role,
        "department": payload.department.strip() if payload.department else None,
        "status": UserStatus.INVITED.value,
        "is_active": False,
        "created_by": current_user["id"],
        "created_at": now,
        "updated_at": now,
        "last_login": None,
        "invitation_token": invitation_token,
        "invitation_expiry": invitation_expiry.isoformat(),
        "email_verified": False,
        "first_login_completed": False,
        "deleted": False,
    }
    if internal_role == "agent":
        new_user.update({
            "specialization": payload.specialization or [],
            "availability": payload.availability or "Available",
            "max_capacity": payload.max_capacity or 10,
            "active_ticket_count": 0,
            "total_assigned": 0,
            "total_resolved": 0,
        })

    await db.users.insert_one(new_user)

    # Audit log
    await _write_audit_log(
        db,
        action="user.invited",
        user_id=current_user["id"],
        entity_id=user_id,
        metadata={
            "email": payload.email.lower().strip(),
            "role": internal_role,
        },
    )

    return _map_db_user_to_read(new_user)


@router.patch("/users/{user_id}", response_model=UserRead, status_code=status.HTTP_200_OK)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))]
) -> UserRead:
    """Update user information (admin only)"""
    # Find user
    user = await db.users.find_one({"_id": user_id, "deleted": {"$ne": True}})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Track changes for audit
    changes = {}

    # Prepare update data
    update_data = {"updated_at": datetime.utcnow()}

    if payload.full_name is not None:
        update_data["full_name"] = payload.full_name.strip()
        changes["full_name"] = {"old": user.get("full_name"), "new": update_data["full_name"]}

    if payload.department is not None:
        update_data["department"] = payload.department.strip()
        changes["department"] = {"old": user.get("department"), "new": update_data["department"]}

    if payload.specialization is not None and user.get("role") == "agent":
        update_data["specialization"] = payload.specialization
        changes["specialization"] = {"old": user.get("specialization"), "new": payload.specialization}
    if payload.availability is not None and user.get("role") == "agent":
        if payload.availability not in {"Available", "Busy", "Offline"}:
            raise HTTPException(status_code=400, detail="Availability must be Available, Busy, or Offline")
        update_data["availability"] = payload.availability
    if payload.max_capacity is not None and user.get("role") == "agent":
        update_data["max_capacity"] = payload.max_capacity

    if payload.role is not None:
        normalized_role = payload.role.lower().strip()
        if normalized_role not in ["employee", "agent"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only 'employee' and 'agent' roles can be set"
            )
        new_internal_role = FRONTEND_TO_INTERNAL.get(normalized_role, normalized_role)
        update_data["role"] = new_internal_role
        changes["role"] = {"old": user.get("role"), "new": new_internal_role}

    # Update user
    await db.users.update_one(
        {"_id": user_id},
        {"$set": update_data}
    )

    # Audit log
    if changes:
        await _write_audit_log(
            db,
            action="user.updated",
            user_id=current_user["id"],
            entity_id=user_id,
            metadata={"changes": changes},
        )

    # Get updated user
    updated_user = await db.users.find_one({"_id": user_id})
    return _map_db_user_to_read(updated_user)


@router.patch("/users/{user_id}/disable", response_model=UserRead, status_code=status.HTTP_200_OK)
async def disable_user(
    user_id: str,
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))]
) -> UserRead:
    """Disable user (admin only)"""
    user = await db.users.find_one({"_id": user_id, "deleted": {"$ne": True}})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent disabling self
    if user["_id"] == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot disable your own account"
        )

    # If target is an admin, ensure they're not the last one
    if user.get("role") == "admin":
        await _ensure_not_last_admin(db)

    # Update user
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {
            "status": UserStatus.DISABLED.value,
            "is_active": False,
            "updated_at": datetime.utcnow()
        }}
    )

    # Audit log
    await _write_audit_log(
        db,
        action="user.disabled",
        user_id=current_user["id"],
        entity_id=user_id,
        metadata={"previous_status": user.get("status")},
    )

    updated_user = await db.users.find_one({"_id": user_id})
    return _map_db_user_to_read(updated_user)


@router.patch("/users/{user_id}/enable", response_model=UserRead, status_code=status.HTTP_200_OK)
async def enable_user(
    user_id: str,
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))]
) -> UserRead:
    """Enable user (admin only)"""
    user = await db.users.find_one({"_id": user_id, "deleted": {"$ne": True}})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Determine is_active: if status was INVITED, remains inactive until first login; if it was ACTIVE, set to True
    new_is_active = True if user.get("status") == UserStatus.ACTIVE.value else False

    # Update user
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {
            "status": UserStatus.ACTIVE.value if user.get("status") != UserStatus.INVITED.value else UserStatus.INVITED.value,
            "is_active": new_is_active,
            "updated_at": datetime.utcnow()
        }}
    )

    # Audit log
    await _write_audit_log(
        db,
        action="user.enabled",
        user_id=current_user["id"],
        entity_id=user_id,
        metadata={"previous_status": user.get("status")},
    )

    updated_user = await db.users.find_one({"_id": user_id})
    return _map_db_user_to_read(updated_user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))]
) -> None:
    """Soft delete user (admin only)"""
    user = await db.users.find_one({"_id": user_id, "deleted": {"$ne": True}})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user["_id"] == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    # If target is an admin, ensure they're not the last one
    if user.get("role") == "admin":
        await _ensure_not_last_admin(db)

    # Soft delete
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {
            "deleted": True,
            "is_active": False,
            "status": UserStatus.DISABLED.value,
            "updated_at": datetime.utcnow()
        }}
    )

    # Audit log
    await _write_audit_log(
        db,
        action="user.deleted",
        user_id=current_user["id"],
        entity_id=user_id,
        metadata={"email": user.get("email")},
    )


@router.put("/users/{user_id}/approve", response_model=UserRead, status_code=status.HTTP_200_OK)
async def approve_user(
    user_id: str,
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))]
) -> UserRead:
    """Approve a pending user (admin only)"""
    user = await db.users.find_one({"_id": user_id, "deleted": {"$ne": True}})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.get("status") != UserStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve user with status '{user.get('status')}'. Only PENDING users can be approved."
        )

    now = datetime.utcnow()
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {
            "status": UserStatus.APPROVED.value,
            "is_active": True,
            "updated_at": now
        }}
    )

    # Audit log
    await _write_audit_log(
        db,
        action="user.approved",
        user_id=current_user["id"],
        entity_id=user_id,
    )

    updated_user = await db.users.find_one({"_id": user_id})
    return _map_db_user_to_read(updated_user)


@router.put("/users/{user_id}/reject", response_model=UserRead, status_code=status.HTTP_200_OK)
async def reject_user(
    user_id: str,
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))]
) -> UserRead:
    """Reject a pending user (admin only)"""
    user = await db.users.find_one({"_id": user_id, "deleted": {"$ne": True}})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.get("status") != UserStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject user with status '{user.get('status')}'. Only PENDING users can be rejected."
        )

    now = datetime.utcnow()
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {
            "status": UserStatus.REJECTED.value,
            "is_active": False,
            "updated_at": now
        }}
    )

    # Audit log
    await _write_audit_log(
        db,
        action="user.rejected",
        user_id=current_user["id"],
        entity_id=user_id,
    )

    updated_user = await db.users.find_one({"_id": user_id})
    return _map_db_user_to_read(updated_user)


@router.put("/users/{user_id}/activate", response_model=UserRead, status_code=status.HTTP_200_OK)
async def activate_user(
    user_id: str,
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))]
) -> UserRead:
    """Activate a user (admin only). Sets status to APPROVED and enables login."""
    user = await db.users.find_one({"_id": user_id, "deleted": {"$ne": True}})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # If target is an admin being deactivated, ensure they're not the last one
    # (Activate is safe - only check on deactivation)

    now = datetime.utcnow()
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {
            "status": UserStatus.APPROVED.value,
            "is_active": True,
            "updated_at": now
        }}
    )

    # Audit log
    await _write_audit_log(
        db,
        action="user.activated",
        user_id=current_user["id"],
        entity_id=user_id,
        metadata={"previous_status": user.get("status")},
    )

    updated_user = await db.users.find_one({"_id": user_id})
    return _map_db_user_to_read(updated_user)


@router.put("/users/{user_id}/deactivate", response_model=UserRead, status_code=status.HTTP_200_OK)
async def deactivate_user(
    user_id: str,
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))]
) -> UserRead:
    """Deactivate a user (admin only). Sets status to INACTIVE and prevents login."""
    user = await db.users.find_one({"_id": user_id, "deleted": {"$ne": True}})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user["_id"] == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )

    # If target is an admin, ensure they're not the last one
    if user.get("role") == "admin":
        await _ensure_not_last_admin(db)

    now = datetime.utcnow()
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {
            "status": UserStatus.INACTIVE.value,
            "is_active": False,
            "updated_at": now
        }}
    )

    # Audit log
    await _write_audit_log(
        db,
        action="user.deactivated",
        user_id=current_user["id"],
        entity_id=user_id,
        metadata={"previous_status": user.get("status")},
    )

    updated_user = await db.users.find_one({"_id": user_id})
    return _map_db_user_to_read(updated_user)


@router.put("/users/{user_id}/change-role", response_model=UserRead, status_code=status.HTTP_200_OK)
async def change_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    db: DatabaseSession,
    current_user: Annotated[dict, Depends(require_roles(["admin", "Administrator"]))]
) -> UserRead:
    """Change user role (admin only). Allows setting admin, agent, or end_user roles."""
    user = await db.users.find_one({"_id": user_id, "deleted": {"$ne": True}})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user["_id"] == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role"
        )

    # Validate role
    normalized_role = payload.role.lower().strip()
    allowed_roles = ["admin", "agent", "end_user", "employee", "administrator"]
    if normalized_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{payload.role}'. Must be one of: admin, agent, end_user"
        )

    # If changing away from admin, ensure not the last admin
    if user.get("role") == "admin" and normalized_role not in ("admin", "administrator"):
        await _ensure_not_last_admin(db)

    # Map frontend role names to internal role names
    role_mapping = {"employee": "end_user", "administrator": "admin"}
    internal_role = role_mapping.get(normalized_role, normalized_role)

    now = datetime.utcnow()
    update_data = {
        "role": internal_role,
        "updated_at": now,
    }

    # If changing TO admin, ensure the user is active
    if internal_role == "admin" and not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign admin role to an inactive user. Activate the user first."
        )

    await db.users.update_one(
        {"_id": user_id},
        {"$set": update_data}
    )

    # Audit log
    await _write_audit_log(
        db,
        action="user.role_changed",
        user_id=current_user["id"],
        entity_id=user_id,
        metadata={
            "old_role": user.get("role"),
            "new_role": internal_role,
        },
    )

    updated_user = await db.users.find_one({"_id": user_id})
    return _map_db_user_to_read(updated_user)
