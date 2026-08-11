from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator

from app.schemas.base import ORMBase


class TicketPriority(str, Enum):
    low = "Low"
    medium = "Medium"
    high = "High"
    critical = "Critical"


class TicketStatus(str, Enum):
    open = "Open"
    in_progress = "In Progress"
    waiting_for_user_response = "Waiting for User Response"
    resolved = "Resolved"
    closed = "Closed"


class TicketSortField(str, Enum):
    created_at = "created_at"
    updated_at = "updated_at"
    priority = "priority"
    status = "status"
    ticket_number = "ticket_number"
    title = "title"


class SortOrder(str, Enum):
    asc = "asc"
    desc = "desc"


class TicketCommentRead(ORMBase):
    id: str
    ticket_id: str
    author_id: str | None = None
    author_name: str | None = None
    author_role: str | None = None
    content: str
    is_internal: bool
    created_at: datetime


class TicketCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    category: str = Field(default="General", min_length=1, max_length=100)
    priority: TicketPriority = TicketPriority.medium
    status: TicketStatus = TicketStatus.open
    assigned_to: str | None = None
    assigned_team: str | None = None
    created_by: str | None = None
    ai_summary: str | None = None
    resolution: str | None = None
    # AI Analysis fields
    ai_analysis_category: str | None = None
    ai_analysis_priority: str | None = None
    ai_analysis_department: str | None = None
    ai_analysis_tags: list[str] = Field(default_factory=list)
    ai_analysis_confidence: float | None = None
    ai_analysis_possible_root_cause: str | None = None
    ai_analysis_suggested_resolution: str | None = None
    ai_analysis_estimated_sla: str | None = None
    sla_target_hours: float | None = None
    sla_started_at: datetime | None = None
    sla_due_at: datetime | None = None
    sla_remaining_hours: float | None = None
    sla_status: str | None = None
    sla_breached: bool | None = None
    resolution_duration_hours: float | None = None
    sla_compliant: bool | None = None

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, value: str | TicketPriority) -> str | TicketPriority:
        if isinstance(value, str):
            return value.replace("_", " ").title()
        return value

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, value: str | TicketStatus) -> str | TicketStatus:
        if isinstance(value, str):
            normalized = value.replace("_", " ").title()
            return "Waiting for User Response" if normalized == "Waiting For User Response" else normalized
        return value


class TicketUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    priority: TicketPriority | None = None
    status: TicketStatus | None = None
    assigned_to: str | None = None
    assigned_team: str | None = None
    ai_summary: str | None = None
    resolution: str | None = None
    # AI Analysis fields
    ai_analysis_category: str | None = None
    ai_analysis_priority: str | None = None
    ai_analysis_department: str | None = None
    ai_analysis_tags: list[str] | None = None
    ai_analysis_confidence: float | None = None
    ai_analysis_possible_root_cause: str | None = None
    ai_analysis_suggested_resolution: str | None = None
    ai_analysis_estimated_sla: str | None = None

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, value: str | TicketPriority | None) -> str | TicketPriority | None:
        if isinstance(value, str):
            return value.replace("_", " ").title()
        return value

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, value: str | TicketStatus | None) -> str | TicketStatus | None:
        if isinstance(value, str):
            normalized = value.replace("_", " ").title()
            return "Waiting for User Response" if normalized == "Waiting For User Response" else normalized
        return value


class TicketRead(ORMBase):
    id: str
    ticket_number: str
    title: str
    description: str
    category: str
    priority: TicketPriority
    status: TicketStatus
    awaiting_user_response: bool = False
    assigned_to: str | None = None
    assigned_at: datetime | None = None
    assigned_to_name: str | None = None
    assignment_type: str | None = None
    assignment_reason: str | None = None
    matched_specialization: str | None = None
    assigned_team: str | None = None
    created_by: str | None = None
    created_by_name: str | None = None
    ai_summary: str | None = None
    resolution: str | None = None
    resolved_by: str | None = None
    resolution_source: str | None = None
    ai_resolved: bool = False
    created_at: datetime
    updated_at: datetime
    comments: list[TicketCommentRead] = Field(default_factory=list)
    # AI Analysis fields
    ai_analysis_category: str | None = None
    ai_analysis_priority: str | None = None
    ai_analysis_department: str | None = None
    ai_analysis_tags: list[str] = Field(default_factory=list)
    ai_analysis_confidence: float | None = None
    ai_analysis_possible_root_cause: str | None = None
    ai_analysis_suggested_resolution: str | None = None
    ai_analysis_estimated_sla: str | None = None
    sla_target_hours: float | None = None
    sla_started_at: datetime | None = None
    sla_due_at: datetime | None = None
    sla_remaining_hours: float | None = None
    sla_status: str | None = None
    sla_breached: bool | None = None
    resolution_duration_hours: float | None = None
    sla_compliant: bool | None = None

    @field_validator("status", mode="before")
    @classmethod
    def normalize_legacy_status(cls, value: str | TicketStatus) -> str | TicketStatus:
        if isinstance(value, str):
            legacy_statuses = {
                "awaiting customer response": "Open",
                "pending": "Open",
                "new": "Open",
            }
            normalized = value.replace("_", " ").strip()
            if normalized.lower() == "waiting for user response":
                return TicketStatus.waiting_for_user_response.value
            return legacy_statuses.get(normalized.lower(), normalized.title())
        return value


class TicketAnalyzeRequest(BaseModel):
    title: str
    description: str
    severity: str  # Will be "Low", "Medium", "High", "Critical"


class TicketAnalyzeResponse(BaseModel):
    category: str
    priority: str
    department: str
    tags: list[str]
    possible_root_cause: str
    confidence: float
    suggested_resolution: str
    knowledge_articles: list[str]
    estimated_sla: str


class TicketListResponse(BaseModel):
    items: list[TicketRead]
    total: int
    page: int
    page_size: int
    pages: int
