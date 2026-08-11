from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator

from app.schemas.base import ORMBase


class LeaveRequestStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class LeaveRequestCreate(BaseModel):
    start_date: date
    end_date: date
    reason: str = Field(min_length=1, max_length=1000)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        return value.strip()

    @field_validator("start_date")
    @classmethod
    def validate_start_date_is_not_in_the_past(cls, value: date) -> date:
        if value < date.today():
            raise ValueError("start_date must be today or a future date")
        return value

    @field_validator("end_date")
    @classmethod
    def validate_date_range(cls, value: date, info) -> date:
        if value < date.today():
            raise ValueError("end_date must be today or a future date")
        start_date = info.data.get("start_date")
        if start_date and value < start_date:
            raise ValueError("end_date must be on or after start_date")
        return value


class LeaveRequestReject(BaseModel):
    rejection_reason: str = Field(min_length=1, max_length=1000)

    @field_validator("rejection_reason")
    @classmethod
    def normalize_rejection_reason(cls, value: str) -> str:
        return value.strip()


class LeaveRequestRead(ORMBase):
    id: str
    agent_id: str
    agent_name: str | None = None
    start_date: date
    end_date: date
    reason: str
    status: LeaveRequestStatus
    requested_at: datetime
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    rejection_reason: str | None = None


class AgentAvailabilityRead(ORMBase):
    agent_id: str
    name: str
    on_leave_today: bool
    open_ticket_count: int
    department: str | None = None
    specialization: list[str] | str | None = None


class CurrentlyOnLeaveRead(ORMBase):
    agent_id: str
    agent_name: str
    start_date: date
    end_date: date
    open_ticket_count: int
    status: str = "on_leave"
