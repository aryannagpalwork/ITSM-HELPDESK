import os
import re
from uuid import uuid4
import logging
from fastapi import APIRouter, Depends, HTTPException, status
import json
from datetime import datetime

from app.api.deps import DatabaseSession
from app.auth.dependencies import get_current_user
from app.config.settings import get_settings
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from app.schemas.knowledge_document import (
    ChatRequest,
    ChatResponse,
    ChatMessageInput,
    ConversationTracker,
    EscalateToTicketRequest,
    GeneratedTicketDetails,
    RetrievedDocumentSource,
    SatisfactionCard,
)
from app.schemas.ticket import TicketCreate, TicketRead, TicketPriority
from app.services.password_reset import PasswordResetService
from app.services.search_service import SearchService
from app.services.llm.llm_factory import LLMServiceFactory
from app.services.tickets import create_ticket
from app.rag.prompt_builder import (
    PromptBuilderFactory,
    ChatMessage,
    MessageRole,
    BuiltPrompt,
)
from app.rag.config import get_rag_settings
from app.rag.retriever import RetrievedContext

logger = logging.getLogger(__name__)

NO_KB_MATCH_RESPONSE = (
    "I couldn't find relevant information in the organization's Knowledge Base."
)

GREETING_PHRASES = {
    "hello", "hi", "hey", "good morning", "good afternoon", "thanks",
    "thank you", "bye",
}


def _classify_query(query: str) -> str:
    normalized = re.sub(r"[^a-z\s]", "", query.lower()).strip()
    if normalized in GREETING_PHRASES:
        return "GREETING"
    return "KNOWLEDGE_QUERY"


def _greeting_prompt(query: str) -> BuiltPrompt:
    context = RetrievedContext(chunks=[], search_results=[], total_retrieved=0)
    return BuiltPrompt(
        messages=[
            ChatMessage(
                role=MessageRole.SYSTEM,
                content=(
                    "You are a friendly IT support assistant. Respond naturally and briefly to this greeting. "
                    "Do not provide technical facts, troubleshooting, or information not requested."
                ),
            ),
            ChatMessage(role=MessageRole.USER, content=query),
        ],
        context_used=context,
        metadata={"query_type": "GREETING"},
    )


DEFAULT_TROUBLESHOOTING_FAILURE_THRESHOLD = int(os.getenv("TROUBLESHOOTING_FAILURE_THRESHOLD", "3"))

# Expanded lexicons match the user-provided examples (rule 7 positive / 10 negative).
POSITIVE_SENTIMENT_PATTERNS: tuple[str, ...] = (
    "thanks", "thank you", "thx", "worked", "fixed", "solved", "got it",
    "makes sense", "yes", "okay it works", "ok it works", "perfect", "awesome",
    "it works", "now working", "working now", "all set", "great", "that fixed it",
    "resolved", "appreciate it", "cool", "nice", "yep",
)

NEGATIVE_SENTIMENT_PATTERNS: tuple[str, ...] = (
    "still not working", "still broken", "still failing", "still stuck",
    "didn't help", "did not help", "same issue", "error persists", "not resolved",
    "that's not it", "that is not it", "doesn't work", "does not work",
    "failed", "no change", "still an issue", "still have the problem",
    "still experiencing", "still cant", "still can't", "still having",
    "still no luck", "no luck", "nope",
)

# These strongly negative signals should NOT auto-label a plain "no" reply when
# "no" is used as a polite filler.  Detect explicit "no" patterns separately.
_STRONG_NEGATIVE_PATTERNS: tuple[str, ...] = tuple(
    p for p in NEGATIVE_SENTIMENT_PATTERNS if p != "nope"
)


def _classify_user_sentiment(query: str) -> str:
    """Classify a user reply as positive / neutral / negative.

    Positive signals match the explicit resolution confirmations from the
    requirements.  Negative signals only match multi-word or unambiguous
    negative phrases so a bare "no" used out-of-context is treated as neutral.
    """
    normalized = re.sub(r"[^a-z0-9\s']", " ", (query or "").lower()).strip()
    if not normalized:
        return "neutral"

    for pattern in POSITIVE_SENTIMENT_PATTERNS:
        if pattern in normalized:
            # guard against false positive: "that didn't work" contains "work"
            # but is not positive — the negative multi-word checks below catch
            # that earlier in this function.
            if pattern in {"worked", "works", "work", "it works"}:
                if any(p in normalized for p in _STRONG_NEGATIVE_PATTERNS):
                    return "negative"
            return "positive"

    for pattern in NEGATIVE_SENTIMENT_PATTERNS:
        if pattern in normalized:
            return "negative"

    # Bare "no" surrounded only by punctuation — classify as "negative" only if
    # the message is essentially just "no".  Otherwise neutral.
    bare = re.sub(r"[^a-z]", "", normalized)
    if bare in {"no", "nope"} and len(normalized.split()) <= 3:
        return "negative"

    return "neutral"


# ─── In-memory conversation tracker registry ────────────────────────────────
# We track richer state (sentiment, counters, likely_resolution) per session
# here.  If a session restarts or the user clicks Reset Thread, a new
# session_id arrives and we get a fresh ConversationTracker automatically.
_CONVERSATION_TRACKERS: dict[str, ConversationTracker] = {}


def _get_or_create_tracker(session_id: str | None) -> ConversationTracker:
    if not session_id:
        return ConversationTracker()
    if session_id not in _CONVERSATION_TRACKERS:
        _CONVERSATION_TRACKERS[session_id] = ConversationTracker()
    return _CONVERSATION_TRACKERS[session_id]


def _should_show_satisfaction_card(tracker: ConversationTracker) -> tuple[bool, str | None]:
    """Apply the 5 user-specified satisfaction prompt rules.

    Returns:
        (show_card: bool, reason: "POSITIVE_TREND" | "NEGATIVE_STALL" | None)
    """
    # Rule 4: never ask twice.
    if tracker.satisfaction_prompt_shown:
        return False, None

    # Rule 1: never ask before at least 2 user replies.
    if tracker.total_user_messages < 2:
        return False, None

    trend = tracker.sentiment_trend

    # Rule 2: positive trend + likely solution already provided → show card
    # after 2+ productive iterations (user_msg >= 2 already).
    if trend == "positive" and tracker.likely_resolution_provided and tracker.total_user_messages >= 2:
        return True, "POSITIVE_TREND"

    # Rule 3: negative trend continues for 2-3 unsuccessful iterations → show.
    if (
        trend == "negative"
        and tracker.troubleshooting_iterations >= 3
        and tracker.total_user_messages >= 2
    ):
        return True, "NEGATIVE_STALL"

    # Mild: after 2 unsuccessful negative signals (without strong resolution) we
    # surface the card so feedback is still captured.
    if (
        trend == "negative"
        and tracker.troubleshooting_iterations >= 2
        and tracker.total_user_messages >= 3
    ):
        return True, "NEGATIVE_STALL"

    return False, None



async def _get_conversation_state(
    db: DatabaseSession,
    session_id: str | None,
) -> tuple[str, dict]:
    """Get the current conversation state and metadata for the active interaction."""
    if not session_id:
        return "ACTIVE", {"conversation_state": "ACTIVE", "unsuccessful_troubleshooting_iterations": 0}

    last_assistant = await db["chat_history"].find_one(
        {"session_id": session_id, "role": "assistant"},
        sort=[("created_at", -1)],
    )
    if not last_assistant:
        return "ACTIVE", {"conversation_state": "ACTIVE", "unsuccessful_troubleshooting_iterations": 0}

    metadata = {}
    if last_assistant.get("metadata_json"):
        try:
            metadata = json.loads(last_assistant["metadata_json"])
        except (json.JSONDecodeError, TypeError):
            metadata = {}

    state = metadata.get("conversation_state") or "ACTIVE"
    iterations = int(metadata.get("unsuccessful_troubleshooting_iterations", 0) or 0)
    return state, {"conversation_state": state, "unsuccessful_troubleshooting_iterations": iterations}


def _update_conversation_metadata(
    current_state: str,
    query: str,
    existing_metadata: dict | None = None,
    *,
    tracker: ConversationTracker | None = None,
) -> tuple[str, dict]:
    """Update the conversation state AND feed the latest user message to the
    ConversationTracker.  The structured SatisfactionCard (not plain text) is
    decided later in the chat endpoint, NOT here."""
    metadata = dict(existing_metadata or {})
    state = current_state or "ACTIVE"

    sentiment = _classify_user_sentiment(query) if query else "neutral"
    if tracker is not None:
        tracker.record_user_message(query or "", sentiment)

    if sentiment == "positive":
        state = "LIKELY_RESOLVED"
        metadata["conversation_state"] = state
        metadata["unsuccessful_troubleshooting_iterations"] = 0
        return state, metadata

    if sentiment == "negative":
        iterations = int(metadata.get("unsuccessful_troubleshooting_iterations", 0) or 0) + 1
        metadata["unsuccessful_troubleshooting_iterations"] = iterations
        state = "INVESTIGATING" if iterations < 3 else "WAITING_FOR_USER"
        metadata["conversation_state"] = state
        return state, metadata

    metadata["conversation_state"] = state or "ACTIVE"
    return state, metadata


async def _upsert_ai_conversation_record(
    db: DatabaseSession,
    conversation_id: str | None,
    user_id: str | None,
    status: str | None,
    *,
    first_message_at: datetime | None = None,
    feedback: str | None = None,
    ticket_id: str | None = None,
    resolved_by_ai: bool | None = None,
    escalated: bool | None = None,
) -> dict:
    """Persist the canonical AI conversation record and update the same document instead of creating duplicates."""
    if not conversation_id:
        return {}

    now = datetime.utcnow()
    existing = await db["ai_conversations"].find_one({"conversation_id": conversation_id})
    if existing is None:
        record = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "conversation_status": status or "ACTIVE",
            "started_at": first_message_at or now,
            "first_message_at": first_message_at or now,
            "created_at": now,
            "updated_at": now,
            "status_history": [{"status": status or "ACTIVE", "timestamp": now}],
            "feedback": None,
            "ticket_id": None,
            "resolved_by_ai": False,
            "escalated": False,
        }
    else:
        record = dict(existing)
        if not record.get("user_id") and user_id:
            record["user_id"] = user_id
        if record.get("started_at") is None:
            record["started_at"] = first_message_at or now
        if record.get("first_message_at") is None:
            record["first_message_at"] = first_message_at or now
        if not isinstance(record.get("status_history"), list):
            record["status_history"] = []

    next_status = status or record.get("conversation_status") or "ACTIVE"
    if next_status != record.get("conversation_status"):
        record.setdefault("status_history", []).append({"status": next_status, "timestamp": now})
        record["conversation_status"] = next_status
    else:
        record["conversation_status"] = next_status

    if first_message_at and record.get("first_message_at") is None:
        record["first_message_at"] = first_message_at
    if first_message_at and record.get("started_at") is None:
        record["started_at"] = first_message_at

    if feedback is not None:
        record["feedback"] = feedback
        record["feedback_at"] = now
        if feedback == "positive":
            record["resolved_by_ai"] = True
        elif feedback == "negative":
            record["resolved_by_ai"] = False

    if ticket_id is not None:
        record["ticket_id"] = ticket_id
        record["escalated"] = True
        record["escalated_at"] = now

    if resolved_by_ai is not None:
        record["resolved_by_ai"] = resolved_by_ai
    if escalated is not None:
        record["escalated"] = escalated
        if escalated and not record.get("escalated_at"):
            record["escalated_at"] = now

    if next_status == "RESOLVED" and not record.get("resolved_at"):
        record["resolved_at"] = now
        record["resolved_by_ai"] = bool(record.get("resolved_by_ai", False)) or next_status == "RESOLVED"
    if next_status == "ESCALATED" and not record.get("escalated_at"):
        record["escalated_at"] = now
        record["escalated"] = True

    if record.get("first_message_at") and record.get("resolved_at"):
        first_dt = record["first_message_at"]
        if isinstance(first_dt, datetime):
            record["resolution_time_seconds"] = max(0, (record["resolved_at"] - first_dt).total_seconds())
    if record.get("first_message_at") and record.get("escalated_at"):
        first_dt = record["first_message_at"]
        if isinstance(first_dt, datetime):
            record["escalation_time_seconds"] = max(0, (record["escalated_at"] - first_dt).total_seconds())

    record["updated_at"] = now
    record["user_id"] = user_id or record.get("user_id")

    await db["ai_conversations"].update_one(
        {"conversation_id": conversation_id},
        {"$set": record},
        upsert=True,
    )
    return record


# ──────────────────────────────────────────────
# Password-Reset Intent Detection & Flow Helpers
# ──────────────────────────────────────────────

# Regex patterns to detect password-reset intents
_FORGOT_PASSWORD_PATTERNS = re.compile(
    r"(\bforgot\b.*\b(password|pass|login)\b)"
    r"|(\bcannot\b.*\blogin\b.*\bforgot\b)"
    r"|(\bcan't\b.*\blogin\b.*\bforgot\b)"
    r"|(\blocked?\b.*\bout\b.*\b(password|account)\b)"
    r"|(\bforgot\b.*\b(credential|credentials)\b)"
    r"|(\breset\b.*\b(password|pass)\b)"
    r"|(\bchange\b.*\b(password|pass)\b)"
    r"|(\bfix\b.*\b(password|pass|login)\b)",
    re.IGNORECASE,
)

_RESET_TOKEN_PATTERNS = re.compile(
    r"(\breceived?\b.*\b(reset|token|link)\b)"
    r"|(\bhave\b.*\b(reset|token|link)\b)"
    r"|(\bgot\b.*\b(reset|token|link)\b)"
    r"|(\bmy\b.*\b(reset|token|link)\b)"
    r"|(\breset\b.*\btoken\b)"
    r"|(\breceived?\b.*\btoken\b)"
    r"|(\btoken\b.*\b(received?|have|got)\b)",
    re.IGNORECASE,
)

_EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

# Password reset conversation states stored in assistant message metadata_json
# "password_reset_state": one of:
#   None              — not a password-reset conversation
#   "awaiting_email"  — user said forgot pw → Copilot asked for email
#   "token_generated" — email received, token generated → Copilot asked user to check email
#   "awaiting_reset"  — user has token → Copilot asks for email + token + new pw
#   "completed"       — password successfully reset
#   "failed"          — reset attempt failed


def _detect_password_reset_intent(query: str) -> str | None:
    """Detect if the query is a password-reset intent.

    Returns:
        "forgot" if the user wants to reset because they forgot their password.
        "has_token" if the user has a reset token/link and wants to proceed.
        None if no password-reset intent is detected.
    """
    query_lower = query.lower().strip()
    # Check for "has token" first since those patterns are more specific
    if _RESET_TOKEN_PATTERNS.search(query_lower):
        return "has_token"
    if _FORGOT_PASSWORD_PATTERNS.search(query_lower):
        return "forgot"
    return None


def _is_pure_email_response(query: str) -> bool:
    """Check if the query is purely an email address (user responding to 'what is your email?')."""
    return bool(_EMAIL_PATTERN.fullmatch(query.strip()))


def _extract_email(query: str) -> str | None:
    """Extract an email address from the query if present."""
    match = _EMAIL_PATTERN.search(query)
    return match.group(0).lower() if match else None


async def _get_password_reset_state(
    db: DatabaseSession,
    session_id: str | None,
) -> tuple[str | None, dict]:
    """Retrieve the current password-reset state from the session's last assistant message.

    Returns:
        (state, metadata) where state is None if no password-reset state is tracked.
    """
    if not session_id:
        return None, {}
    last_assistant = await db["chat_history"].find_one(
        {"session_id": session_id, "role": "assistant"},
        sort=[("created_at", -1)],
    )
    if not last_assistant:
        return None, {}
    metadata_json = last_assistant.get("metadata_json")
    if not metadata_json:
        return None, {}
    try:
        metadata = json.loads(metadata_json)
    except (json.JSONDecodeError, TypeError):
        return None, {}
    state = metadata.get("password_reset_state")
    return state, metadata


def _is_password_reset_conversation(state: str | None) -> bool:
    """Check if the tracked state indicates an active password-reset conversation."""
    return state in ("awaiting_email", "token_generated", "awaiting_reset", "completed", "failed")


def _make_password_reset_response(
    message: str,
    password_reset_state: str | None = None,
    *,
    session_id: str | None = None,
    satisfaction_card: SatisfactionCard | None = None,
) -> ChatResponse:
    """Build a ChatResponse for a password-reset conversation step."""
    return ChatResponse(
        answer=message,
        sources=[],
        confidence=1.0,
        retrieved_documents=0,
        session_id=session_id,
        suggested_ticket=None,
        satisfaction_card=satisfaction_card,
    )


async def _save_chat_messages(
    db: DatabaseSession,
    session_id: str,
    user_query: str,
    assistant_answer: str,
    metadata: dict,
) -> None:
    """Save user and assistant messages with password-reset metadata."""
    # Save user message
    user_history = {
        "_id": str(uuid4()),
        "session_id": session_id,
        "role": "user",
        "message": user_query,
        "created_at": datetime.utcnow(),
    }
    await db["chat_history"].insert_one(user_history)

    # Save assistant message
    assistant_history = {
        "_id": str(uuid4()),
        "session_id": session_id,
        "role": "assistant",
        "message": assistant_answer,
        "metadata_json": json.dumps(metadata),
        "created_at": datetime.utcnow(),
    }
    await db["chat_history"].insert_one(assistant_history)


# ──────────────────────────────────────────────
# Password-Reset Flow Handlers
# ──────────────────────────────────────────────


async def _handle_forgot_password_flow(
    query: str,
    db: DatabaseSession,
    current_state: str | None,
    state_metadata: dict,
) -> tuple[str | None, str | None, str | None]:
    """Process a single step of the 'forgot password' flow.

    Returns:
        (response_message, new_state, raw_token_or_None)
    """
    email = _extract_email(query)

    # State: initial detection — ask for email
    if current_state is None:
        return (
            "I see you need help with your password. No problem! "
            "To get started, please provide the email address associated with your account.",
            "awaiting_email",
            None,
        )

    # State: awaiting_email — user should provide email
    if current_state == "awaiting_email":
        if not email:
            return (
                "I didn't quite catch that email. Please provide the email address "
                "associated with your account so I can send you a password reset link.",
                "awaiting_email",
                None,
            )
        # Call forgot-password API
        service = PasswordResetService(db)
        raw_token = await service.generate_reset_token(email)
        if raw_token:
            msg = (
                f"A password reset link has been sent to **{email}**. "
                "Please check your email inbox (and spam folder) for the reset link.\n\n"
                f"📌 **For testing purposes**, your reset token is:\n"
                f"```\n{raw_token}\n```\n\n"
                "Once you have the token, let me know by saying **'I have my reset token'** "
                "and I'll help you complete the password reset."
            )
            return (msg, "token_generated", raw_token)
        else:
            return (
                f"Hmm, I wasn't able to find an account with that email (**{email}**). "
                "Please double-check the email address and try again.",
                "awaiting_email",
                None,
            )

    return (None, current_state, None)


async def _handle_reset_password_flow(
    query: str,
    db: DatabaseSession,
    current_state: str | None,
    state_metadata: dict,
) -> tuple[str | None, str | None]:
    """Process a single step of the 'reset password with token' flow.

    Returns:
        (response_message, new_state)
    """
    email = _extract_email(query)
    query_lower = query.lower().strip()

    # State: user just said they have a token — ask for email first
    if current_state is None or current_state == "token_generated":
        return (
            "Great! Let's get your password reset. Please provide the **email address** "
            "associated with your account, your **reset token**, and your **new password**. "
            "You can send them all at once, for example:\n\n"
            "> my.email@company.com  abc123token  MyNewPassword123!",
            "awaiting_reset",
        )

    # State: awaiting_reset — parse email, token, new password
    if current_state == "awaiting_reset":
        parts = query.split()

        # Extract email first
        if not email:
            return (
                "I need your **email address** to proceed. "
                "Please provide it along with your reset token and new password.",
                "awaiting_reset",
            )

        # Extract token — look for stored token or find in query
        stored_token = state_metadata.get("password_reset_token")

        # Try to find token in the query (non-email parts longer than 12 chars)
        token_candidates = [p for p in parts if len(p) > 12 and not _EMAIL_PATTERN.match(p)]
        token = token_candidates[0] if token_candidates else stored_token

        # Find new password — everything after the token
        new_password = None
        if stored_token:
            idx = query_lower.find(stored_token.lower())
            if idx != -1:
                after_token = query[idx + len(stored_token):].strip()
                pw_parts = after_token.split()
                if pw_parts:
                    new_password = pw_parts[0] if pw_parts[0] else pw_parts[-1]
        elif token:
            idx = query_lower.find(token.lower())
            if idx != -1:
                after_token = query[idx + len(token):].strip()
                pw_parts = after_token.split()
                if pw_parts:
                    # Pick the last part that is at least 6 chars
                    for p in reversed(pw_parts):
                        if len(p) >= 6:
                            new_password = p
                            break
                    if not new_password and pw_parts:
                        new_password = pw_parts[-1]

        # If we still couldn't determine a password, ask for it
        if not new_password:
            return (
                f"Thanks **{email}**! I have the token. Now please provide the **new password** "
                "you'd like to use. It must be at least 8 characters long.",
                "awaiting_reset",
            )

        # Validate new password length
        if len(new_password) < 8:
            return (
                f"The password must be at least **8 characters** long. "
                "Please provide a longer password.",
                "awaiting_reset",
            )

        # Attempt the reset
        service = PasswordResetService(db)
        actual_token = token or stored_token
        if not actual_token:
            return (
                "I couldn't find the reset token. Please provide your **reset token** "
                "along with your new password.",
                "awaiting_reset",
            )

        success = await service.reset_password(email, actual_token, new_password)
        if success:
            return (
                "✅ **Password reset successful!**\n\n"
                "You can now log in with your new password.\n"
                "If you have any other issues, feel free to ask!",
                "completed",
            )
        else:
            return (
                "❌ **Password reset failed.** The token may be invalid or expired.\n\n"
                "Would you like me to:\n"
                "1. **Generate a new reset token** — say 'send new token'\n"
                "2. **Create a support ticket** — say 'create ticket' and I'll escalate this",
                "failed",
            )

    return (None, current_state)


# ──────────────────────────────────────────────
# Main Router & Chat Endpoint
# ──────────────────────────────────────────────

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
) -> ChatResponse:
    """Process chat queries using RAG with LLM provider.

    Password-reset intents are detected and handled before RAG lookup.
    If confidence is low (< 0.5) and it is NOT a password-reset conversation,
    will suggest creating a ticket.
    """
    settings = get_settings()
    session_id = payload.session_id or str(uuid4())

    tracker = _get_or_create_tracker(session_id)

    conversation_state, conversation_metadata = await _get_conversation_state(db, session_id)
    conversation_state, conversation_metadata = _update_conversation_metadata(
        conversation_state,
        payload.query,
        conversation_metadata,
        tracker=tracker,
    )
    await _upsert_ai_conversation_record(
        db,
        session_id,
        current_user.get("id"),
        conversation_state,
        first_message_at=datetime.utcnow(),
    )

    query_type = _classify_query(payload.query)
    logger.debug("Chat query type=%s query=%r", query_type, payload.query)

    if query_type == "GREETING":
        logger.debug("Chat response source=Greeting kb_hit=false")
        llm_service = LLMServiceFactory.create(settings.llm_provider)
        answer, _ = llm_service.generate_response(_greeting_prompt(payload.query))
        await _save_chat_messages(db, session_id, payload.query, answer, {
            "query_type": query_type,
            "response_source": "Greeting",
            "retrieved_documents": 0,
            "kb_hit": False,
        })
        # Greetings never trigger the satisfaction card.
        return ChatResponse(
            answer=answer, sources=[], confidence=1.0,
            retrieved_documents=0, session_id=session_id, suggested_ticket=None,
            satisfaction_card=SatisfactionCard(show=False, reason=None, session_id=session_id),
        )

    # All non-greeting queries search the existing KB before response generation.
    rag_settings = get_rag_settings()
    configured_threshold = rag_settings.similarity_threshold
    retrieval_threshold = (
        payload.similarity_threshold
        if payload.similarity_threshold > 0
        else configured_threshold
    )
    relevance_threshold = rag_settings.relevance_threshold
    try:
        search_service = SearchService(db=db)
        retrieved_context = search_service.search(
            query=payload.query,
            top_k=payload.top_k,
            similarity_threshold=retrieval_threshold,
            relevance_threshold=relevance_threshold,
        )
        logger.debug(
            "Chat retrieval query_type=%s similarity_threshold=%s relevance_threshold=%s scores=%s documents=%s",
            query_type,
            retrieval_threshold,
            relevance_threshold,
            [round(result.similarity_score, 4) for result in retrieved_context.search_results],
            len(retrieved_context.chunks),
        )
    except Exception:
        logger.exception("Chat retrieval failed query_type=%s", query_type)
        retrieved_context = RetrievedContext(chunks=[], search_results=[], total_retrieved=0)

    # ── Step 0: Password-Reset Intent Detection (pre-RAG) ──
    intent = _detect_password_reset_intent(payload.query)
    current_state, state_metadata = await _get_password_reset_state(db, payload.session_id)

    # Check if the user is responding to a previous password-reset step
    is_password_reset_active = _is_password_reset_conversation(current_state)

    # Handle "send new token" or "create ticket" from failed state
    failed_retry = payload.query.lower().strip()
    if current_state == "failed":
        if "new token" in failed_retry or "send" in failed_retry or "new reset" in failed_retry:
            # Reset to awaiting_email to start fresh
            current_state = None
            intent = "forgot"
        elif "ticket" in failed_retry or "create" in failed_retry or "escalate" in failed_retry:
            # Let it fall through to the normal RAG pipeline for ticket suggestion
            is_password_reset_active = False
            intent = None

    # Handle forgot-password flow
    if intent == "forgot" or (is_password_reset_active and current_state in ("awaiting_email", "token_generated")):
        answer, new_state, raw_token = await _handle_forgot_password_flow(
            payload.query, db, current_state, state_metadata,
        )
        if answer:
            metadata = {"password_reset_state": new_state}
            if raw_token and new_state == "token_generated":
                metadata["password_reset_token"] = raw_token
            await _save_chat_messages(db, session_id, payload.query, answer, metadata)
            logger.debug("Chat response source=Knowledge Base-compatible password flow kb_hit=%s", bool(retrieved_context.chunks))
            return _make_password_reset_response(answer, new_state)

    # Handle reset-password flow (user has a token)
    if intent == "has_token" or (is_password_reset_active and current_state in ("awaiting_reset",)):
        answer, new_state = await _handle_reset_password_flow(
            payload.query, db, current_state, state_metadata,
        )
        if answer:
            metadata = {"password_reset_state": new_state}
            await _save_chat_messages(db, session_id, payload.query, answer, metadata)
            logger.debug("Chat response source=Knowledge Base-compatible password flow kb_hit=%s", bool(retrieved_context.chunks))
            return _make_password_reset_response(answer, new_state)

    # ── Standard RAG Pipeline (for non-password-reset queries) ──

    # The retrieval result above is authoritative for the response path.
    kb_hit = bool(retrieved_context.chunks)
    updated_metadata = dict(conversation_metadata)
    response_query_type = query_type if kb_hit else "OUT_OF_SCOPE"
    llm_service = None

    # Convert chat history
    chat_history = []
    for msg in payload.chat_history:
        role = (
            MessageRole.USER
            if msg.role.lower() == "user"
            else MessageRole.ASSISTANT
        )
        chat_history.append(ChatMessage(role=role, content=msg.content))

    # Calculate confidence from the already threshold-filtered results.
    confidence = 0.0
    if retrieved_context.search_results:
        avg_similarity = sum(
            r.similarity_score for r in retrieved_context.search_results
        ) / len(retrieved_context.search_results)
        confidence = avg_similarity

    if kb_hit:
        prompt_builder = PromptBuilderFactory.create("rag")
        built_prompt = prompt_builder.build(
            query=payload.query,
            context=retrieved_context,
            chat_history=chat_history,
        )
        built_prompt.messages[0].content += (
            "\n\nSTRICT KNOWLEDGE BASE GROUNDING:\n"
            "Answer only using the retrieved Knowledge Base context in this prompt. "
            "You may summarize, explain, format, or restructure it, but must not add "
            "external facts or rely on world knowledge. If the context does not answer "
            "the question, say that the Knowledge Base does not contain the information."
        )
        llm_service = LLMServiceFactory.create(settings.llm_provider)
        answer, _ = llm_service.generate_response(built_prompt)
        logger.debug(
            "Chat response source=Knowledge Base kb_hit=true scores=%s documents=%s",
            [round(result.similarity_score, 4) for result in retrieved_context.search_results],
            len(retrieved_context.chunks),
        )
    else:
        answer = NO_KB_MATCH_RESPONSE
        logger.debug(
            "Chat response source=No KB Match query_type=%s kb_hit=false threshold=%s documents=0",
            response_query_type,
            retrieval_threshold,
        )

    # Record the assistant response and set likely_resolution_provided when:
    #   - KB hit true (retrieved context used for grounded answer), OR
    #   - Password-reset completed successfully, OR
    #   - User already confirmed positive result previously.
    pw_completed = current_state == "completed"
    tracker.record_assistant_message(
        likely_resolution=bool(kb_hit or pw_completed or conversation_state == "LIKELY_RESOLVED")
    )

    # Satisfaction card is NEVER embedded as plain text in the answer.  It is a
    # first-class structured component (`satisfaction_card`) in ChatResponse.
    show_card, reason = _should_show_satisfaction_card(tracker)
    satisfaction_card: SatisfactionCard | None = None
    if show_card:
        tracker.satisfaction_prompt_shown = True
        satisfaction_card = SatisfactionCard(
            show=True,
            reason=reason,
            session_id=session_id,
        )
        updated_metadata["satisfaction_prompt_shown"] = True
        if reason == "POSITIVE_TREND":
            conversation_state = "LIKELY_RESOLVED"
        elif reason == "NEGATIVE_STALL":
            conversation_state = "WAITING_FOR_USER"
    else:
        updated_metadata["satisfaction_prompt_shown"] = tracker.satisfaction_prompt_shown

    updated_metadata["conversation_state"] = conversation_state or "ACTIVE"
    updated_metadata["tracker_snapshot"] = tracker.model_dump()
    await _upsert_ai_conversation_record(
        db,
        session_id,
        current_user.get("id"),
        conversation_state,
        first_message_at=datetime.utcnow(),
    )

    # Step 5: Prepare sources
    # Fetch all documents in one query for efficiency
    document_ids = list(set(r.chunk.document_id for r in retrieved_context.search_results if r.chunk.document_id))
    documents_cursor = db["knowledge_documents"].find({"_id": {"$in": document_ids}})
    documents = await documents_cursor.to_list(length=None)
    document_map = {doc["_id"]: doc for doc in documents}

    sources = []
    for r in retrieved_context.search_results:
        document = document_map.get(r.chunk.document_id) if r.chunk.document_id else None
        sources.append(
            RetrievedDocumentSource(
                chunk_id=r.chunk.chunk_id,
                document_id=r.chunk.document_id,
                document_title=document["title"] if document else None,
                text=r.chunk.text,
                similarity_score=r.similarity_score,
                page_number=r.chunk.page_number,
                heading=r.chunk.heading,
                section=r.chunk.section,
                chunk_number=r.chunk.chunk_number,
            )
        )

    # Step 6: Generate suggested ticket if confidence is low
    suggested_ticket = None
    if confidence < 0.5:
        # Do NOT suggest tickets for normal password-reset conversations
        is_pw_conversation = _is_password_reset_conversation(current_state) or intent is not None
        if not is_pw_conversation:
            # Get existing chat history for the session
            existing_history = []
            if payload.session_id:
                existing_history_cursor = db["chat_history"].find({"session_id": payload.session_id}).sort("created_at")
                existing_history = await existing_history_cursor.to_list(length=None)

            # Build chat history for ticket generation
            full_chat_history = []
            for hist_msg in existing_history:
                role = (
                    MessageRole.USER
                    if hist_msg["role"] == "user"
                    else MessageRole.ASSISTANT
                )
                full_chat_history.append(ChatMessage(role=role, content=hist_msg["message"]))

            # Add current user query
            full_chat_history.append(ChatMessage(role=MessageRole.USER, content=payload.query))

            # Generate suggested ticket
            if llm_service is None:
                llm_service = LLMServiceFactory.create(settings.llm_provider)
            suggested_ticket, _ = llm_service.generate_ticket_details(full_chat_history)

    # Step 7: Save chat history
    # Save user message
    user_history = {
        "_id": str(uuid4()),
        "session_id": session_id,
        "role": "user",
        "message": payload.query,
        "created_at": datetime.utcnow(),
    }
    await db["chat_history"].insert_one(user_history)

    # Save assistant message
    assistant_metadata = {
        "query_type": response_query_type,
        "response_source": "Knowledge Base" if kb_hit else "No KB Match",
        "kb_hit": kb_hit,
        "sources": [s.model_dump() for s in sources],
        "confidence": confidence,
        "retrieved_documents": len(sources),
        "conversation_state": conversation_state,
        "unsuccessful_troubleshooting_iterations": int(updated_metadata.get("unsuccessful_troubleshooting_iterations", 0) or 0),
        "satisfaction_prompt": bool(updated_metadata.get("satisfaction_prompt", False)),
        "ticket_prompt": bool(updated_metadata.get("ticket_prompt", False)),
    }
    if suggested_ticket:
        assistant_metadata["suggested_ticket"] = suggested_ticket

    assistant_history = {
        "_id": str(uuid4()),
        "session_id": session_id,
        "role": "assistant",
        "message": answer,
        "metadata_json": json.dumps(assistant_metadata),
        "created_at": datetime.utcnow(),
    }
    await db["chat_history"].insert_one(assistant_history)

    return ChatResponse(
        answer=answer,
        sources=sources,
        confidence=confidence,
        retrieved_documents=len(sources),
        session_id=session_id,
        suggested_ticket=suggested_ticket,
        satisfaction_card=satisfaction_card,
    )


@router.post("/feedback")
async def submit_ai_conversation_feedback(
    payload: dict,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Persist AI CSAT feedback and resolution state without creating duplicate analytics records."""
    session_id = (payload or {}).get("session_id")
    feedback = (payload or {}).get("feedback")
    if not session_id or feedback not in {"positive", "negative"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valid session_id and feedback are required.")

    target_status = "RESOLVED" if feedback == "positive" else "INVESTIGATING"
    record = await _upsert_ai_conversation_record(
        db,
        session_id,
        current_user.get("id"),
        target_status,
        feedback=feedback,
        resolved_by_ai=(feedback == "positive"),
    )
    return {
        "conversation_id": session_id,
        "conversation_status": record.get("conversation_status", target_status),
        "feedback": feedback,
        "resolved_by_ai": bool(record.get("resolved_by_ai", feedback == "positive")),
    }


@router.post("/escalate-to-ticket", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
async def escalate_to_ticket(
    payload: EscalateToTicketRequest,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
) -> TicketRead:
    """Escalate a chat session to a support ticket."""
    settings = get_settings()

    existing_record = await db["ai_conversations"].find_one({"conversation_id": payload.session_id})
    if existing_record and existing_record.get("ticket_id"):
        existing_ticket = await db["tickets"].find_one({"_id": existing_record["ticket_id"]})
        if existing_ticket:
            return await create_ticket(db, TicketCreate(
                title=existing_ticket.get("title", "Support Request"),
                description=existing_ticket.get("description", ""),
                category=existing_ticket.get("category", "General"),
                priority=TicketPriority(existing_ticket.get("priority", "medium").lower()),
                ai_summary=existing_ticket.get("ai_summary"),
            ), reason="Escalated from chat", current_user=current_user)

    # Get all chat history for the session
    chat_history_records_cursor = db["chat_history"].find({"session_id": payload.session_id}).sort("created_at")
    chat_history_records = await chat_history_records_cursor.to_list(length=None)

    if not chat_history_records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found"
        )

    # Convert to ChatMessage objects
    chat_history = []
    for hist_msg in chat_history_records:
        role = (
            MessageRole.USER
            if hist_msg["role"] == "user"
            else MessageRole.ASSISTANT
        )
        chat_history.append(ChatMessage(role=role, content=hist_msg["message"]))

    # Generate ticket details with LLM
    llm_service = LLMServiceFactory.create(settings.llm_provider)
    ticket_details, _ = llm_service.generate_ticket_details(
        chat_history=chat_history,
        user_feedback=payload.user_feedback
    )

    # Map priority
    priority_map = {
        "Low": TicketPriority.low,
        "Medium": TicketPriority.medium,
        "High": TicketPriority.high,
        "Critical": TicketPriority.critical,
    }
    priority = priority_map.get(ticket_details.get("priority", "Medium"), TicketPriority.medium)

    # Create ticket payload
    ticket_payload = TicketCreate(
        title=ticket_details.get("title", "Support Request"),
        description=ticket_details.get("description", ""),
        category=ticket_details.get("category", "General"),
        priority=priority,
        ai_summary=ticket_details.get("summary"),
    )

    # Create ticket
    ticket = await create_ticket(db, ticket_payload, reason="Escalated from chat", current_user=current_user)

    # Update chat history records to link to ticket
    ticket_id = ticket.id
    for hist_msg in chat_history_records:
        metadata = {}
        if hist_msg.get("metadata_json"):
            try:
                metadata = json.loads(hist_msg["metadata_json"])
            except json.JSONDecodeError:
                metadata = {}
        metadata["ticket_id"] = ticket_id
        await db["chat_history"].update_one(
            {"_id": hist_msg["_id"]},
            {"$set": {"metadata_json": json.dumps(metadata)}}
        )

    await _upsert_ai_conversation_record(
        db,
        payload.session_id,
        current_user.get("id"),
        "ESCALATED",
        ticket_id=ticket_id,
        escalated=True,
        resolved_by_ai=False,
    )

    return ticket
