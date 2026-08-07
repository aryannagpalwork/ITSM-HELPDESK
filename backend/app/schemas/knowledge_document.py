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


class ConversationTracker(ORMBase):
    """Per-session runtime conversation state used to decide when to show the
    satisfaction prompt.  Persisted inside the in-memory session registry in
    chat.py and reset whenever the user clicks "Reset Thread" or opens a new
    session."""
    total_user_messages: int = 0
    total_assistant_messages: int = 0
    troubleshooting_iterations: int = 0
    sentiment_history: list[dict] = []  # list of {"role", "sentiment", "message"}
    likely_resolution_provided: bool = False
    satisfaction_prompt_shown: bool = False

    def record_user_message(self, message: str, sentiment: str) -> None:
        self.total_user_messages += 1
        self.sentiment_history.append({"role": "user", "sentiment": sentiment, "message": message})
        if sentiment == "negative":
            self.troubleshooting_iterations += 1

    def record_assistant_message(self, likely_resolution: bool = False) -> None:
        self.total_assistant_messages += 1
        if likely_resolution:
            self.likely_resolution_provided = True

    @property
    def sentiment_trend(self) -> str:
        """Return 'positive' | 'negative' | 'neutral' based on the last 3 user messages."""
        recent = [h for h in self.sentiment_history if h.get("role") == "user"][-3:]
        if not recent:
            return "neutral"
        p = sum(1 for h in recent if h.get("sentiment") == "positive")
        n = sum(1 for h in recent if h.get("sentiment") == "negative")
        if p > n:
            return "positive"
        if n > p:
            return "negative"
        if p == n and p > 0:
            return "neutral"
        return "neutral"


class SatisfactionCard(ORMBase):
    """Structured UI component that the backend asks the frontend to render
    once per thread when the completion conditions are met.  The satisfaction
    prompt is NEVER embedded as plain text into the answer field."""
    show: bool = False
    reason: str | None = None  # "POSITIVE_TREND"  | "NEGATIVE_STALL" | None
    session_id: str | None = None


class ChatResponse(ORMBase):
    answer: str
    # NOTE: sources / confidence / retrieved_documents are preserved here for
    # backwards compatibility with existing API consumers, but the frontend
    # no longer displays them.  Retrieval metadata should stay in backend logs.
    sources: list[RetrievedDocumentSource]
    confidence: float
    retrieved_documents: int
    session_id: str | None = None
    suggested_ticket: dict | None = None
    satisfaction_card: SatisfactionCard | None = None
    # Optional guided-troubleshooting fields. Existing clients can ignore these.
    diagnostic_question: str | None = None
    guided_actions: list[str] = []
    guided_state: str | None = None
    ticket_id: str | None = None
    ticket_number: str | None = None


class EscalateToTicketRequest(ORMBase):
    session_id: str
    user_feedback: str | None = None


class GeneratedTicketDetails(ORMBase):
    title: str
    summary: str
    category: str
    priority: str
    description: str

