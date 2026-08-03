from datetime import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict

from app.schemas.base import TimestampedSchema


class UserStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    INACTIVE = "INACTIVE"
    INVITED = "INVITED"
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"


class UserRead(TimestampedSchema):
    id: str
    email: str
    full_name: str
    role: str
    department: str | None = None
    # Legacy installations store one specialization as a string. New agent
    # profiles may use an array; accepting both keeps existing clients valid.
    specialization: list[str] | str | None = None
    availability: str | None = None
    max_capacity: int | None = None
    active_ticket_count: int | None = None
    total_assigned: int | None = None
    total_resolved: int | None = None
    last_assigned_at: datetime | None = None
    average_resolution_time: float | None = None
    is_active: bool
    status: UserStatus
    created_by: str | None = None
    last_login: str | None = None
    invitation_token: str | None = None
    invitation_expiry: str | None = None
    email_verified: bool = False
    first_login_completed: bool = False
    deleted: bool = False

class UserCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    email: str
    full_name: str
    role: str  # should be "employee" or "agent"
    department: str | None = None
    specialization: list[str] | str | None = None
    availability: str | None = None
    max_capacity: int | None = None


class UserUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    full_name: str | None = None
    department: str | None = None
    role: str | None = None  # can update to employee or agent only
    specialization: list[str] | str | None = None
    availability: str | None = None
    max_capacity: int | None = None


class UserRoleUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    role: str  # "admin", "agent", or "end_user"


class AdminUserCreate(BaseModel):
    """Payload for admin to create a fully approved user."""
    model_config = ConfigDict(from_attributes=True)
    email: str
    full_name: str
    password: str
    role: str  # "employee", "agent", or "admin"
    department: str | None = None
    specialization: list[str] | str | None = None
    availability: str | None = None
    max_capacity: int | None = None
