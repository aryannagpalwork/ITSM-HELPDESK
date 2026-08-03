from datetime import datetime

from app.schemas.base import ORMBase


class ChatHistoryRead(ORMBase):
    id: int
    user_id: str | None = None
    session_id: str | None = None
    role: str
    message: str
    created_at: datetime
