from typing import Any, List
from app.schemas.base import ORMBase, TimestampedSchema


class KnowledgeDocumentRead(TimestampedSchema):
    id: int
    title: str
    filename: str
    file_type: str
    category: str | None = None
    tags: List[str] = []
    uploaded_by: str | None = None
    uploaded_at: str
    status: str  # 'pending', 'processing', 'processed', 'error'
    file_path: str
    file_size: int | None = None


class KnowledgeDocumentUpdate(TimestampedSchema):
    title: str | None = None
    department: str | None = None


class SearchRequest(ORMBase):
    query: str
    top_k: int = 5
    similarity_threshold: float = 0.0


class SearchResultChunk(ORMBase):
    chunk_id: str
    text: str
    chunk_text: str | None = None
    page_number: int | None = None
    heading: str | None = None
    section: str | None = None
    chunk_number: int | None = None
    start_index: int | None = None
    end_index: int | None = None
    document_id: int | None = None
    metadata: dict[str, Any] = {}


class SearchResultItem(ORMBase):
    chunk: SearchResultChunk
    similarity_score: float
    rank: int
    metadata: dict[str, Any] = {}


class SearchResponse(ORMBase):
    query: str
    total_retrieved: int
    results: list[SearchResultItem]
    metadata: dict[str, Any] = {}


class ChatMessageInput(ORMBase):
    role: str
    content: str


class ChatRequest(ORMBase):
    query: str
    top_k: int = 5
    similarity_threshold: float = 0.0
    chat_history: list[ChatMessageInput] = []
    session_id: str | None = None


class RetrievedDocumentSource(ORMBase):
    chunk_id: str
    document_id: int | None = None
    document_title: str | None = None
    text: str
    similarity_score: float
    page_number: int | None = None
    heading: str | None = None
    section: str | None = None
    chunk_number: int | None = None


class ChatResponse(ORMBase):
    answer: str
    sources: list[RetrievedDocumentSource]
    confidence: float
    retrieved_documents: int
    session_id: str | None = None
    suggested_ticket: dict | None = None


class EscalateToTicketRequest(ORMBase):
    session_id: str
    user_feedback: str | None = None


class GeneratedTicketDetails(ORMBase):
    title: str
    summary: str
    category: str
    priority: str
    description: str

