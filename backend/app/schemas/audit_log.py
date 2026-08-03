from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.base import ORMBase


class AuditLogMetadata(BaseModel):
    field: str | None = None
    old_value: Any = None
    new_value: Any = None
    changes: list[dict[str, Any]] | None = None


class AuditLogRead(ORMBase):
    id: str
    user_id: str | None = None
    user_name: str | None = None
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    metadata: AuditLogMetadata | None = None
    reason: str | None = None
    created_at: datetime
