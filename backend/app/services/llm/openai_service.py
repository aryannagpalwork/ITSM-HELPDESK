
"""OpenAI LLM Service implementation"""
import time
import logging
from typing import Optional, Any
import json

from openai import OpenAI
from openai.types.chat import ChatCompletion
from app.config.settings import get_settings
from app.rag.prompt_builder import BuiltPrompt, ChatMessage
from .base import LLMService

logger = logging.getLogger(__name__)

# OpenAI models such as GPT-5.5 can reject an explicit temperature override
# and only accept the default sampling behavior. Keep this list extensible
# by model family so we can omit the parameter for those models while
# preserving temperature support for the rest.
TEMPERATURE_UNSUPPORTED_MODEL_PREFIXES = (
    "gpt-5",
    "gpt-5.5",
)


def _build_conversation_summary(
    chat_history: list[ChatMessage], user_feedback: Optional[str] = None
) -> str:
    """Create a readable incident handoff when structured LLM output is unavailable."""
    def excerpt(message: str) -> str:
        normalized = " ".join(message.split())
        return normalized[:280] + ("..." if len(normalized) > 280 else "")

    user_messages = [excerpt(message.content) for message in chat_history if message.role.value == "user" and message.content.strip()]
    assistant_messages = [excerpt(message.content) for message in chat_history if message.role.value == "assistant" and message.content.strip()]
    parts = []
    if user_messages:
        parts.append(f"User reported: {user_messages[-1]}")
    if assistant_messages:
        parts.append(f"AI Copilot response: {assistant_messages[-1]}")
    if user_feedback:
        parts.append(f"Current outcome: {excerpt(user_feedback)}")
    return " ".join(parts) or "Chat session escalated to IT support for investigation."


class OpenAIService(LLMService):
    """Service for interacting with OpenAI API"""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        settings = get_settings()
        self.api_key = api_key or settings.openai_api_key
        self.model_name = model or settings.chat_model

        if not self.api_key:
            raise ValueError("OPENAI_API_KEY must be set.")

        self.client = OpenAI(api_key=self.api_key)

    def _supports_temperature(self) -> bool:
        """Return whether the configured model accepts an explicit temperature value.

        Some newer OpenAI model families accept only the default sampling behavior
        and reject a user-supplied temperature. We detect those model families by
        name prefix and omit the parameter entirely when needed.
        """
        normalized_model = self.model_name.lower()
        return not any(
            normalized_model.startswith(prefix)
            for prefix in TEMPERATURE_UNSUPPORTED_MODEL_PREFIXES
        )

    def _build_chat_params(
        self,
        messages: list[dict[str, str]],
        temperature: float,
        *,
        max_output_tokens: Optional[int] = None,
        response_format: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Build a chat-completions payload while keeping temperature optional."""
        params: dict[str, Any] = {
            "model": self.model_name,
            "messages": messages,
        }
        if self._supports_temperature():
            params["temperature"] = temperature
        if max_output_tokens:
            params["max_tokens"] = max_output_tokens
        if response_format:
            params["response_format"] = response_format
        return params

    def generate_response(
        self,
        built_prompt: BuiltPrompt,
        temperature: float = 0.7,
        max_output_tokens: Optional[int] = None,
    ) -> tuple[str, dict[str, Any]]:
        """Generate response from OpenAI and return (text, usage metadata)"""
        start_time = time.time()
        logger.info("Generating chat response with model: %s", self.model_name)

        # Convert ChatMessages to OpenAI format
        messages = []
        for msg in built_prompt.messages:
            role = msg.role.value
            if role == "system":
                role = "system"
            elif role == "user":
                role = "user"
            elif role == "model":
                role = "assistant"
            messages.append({"role": role, "content": msg.content})

        try:
            params = self._build_chat_params(
                messages,
                temperature,
                max_output_tokens=max_output_tokens,
            )

            response: ChatCompletion = self.client.chat.completions.create(**params)
            usage = response.usage.model_dump() if response.usage else {}
            text = response.choices[0].message.content or ""
            elapsed = round(time.time() - start_time, 2)

            logger.info(
                "Generated response. Model: %s, Prompt tokens: %s, Completion tokens: %s, Total tokens: %s, Time: %ss",
                self.model_name,
                usage.get("prompt_tokens"),
                usage.get("completion_tokens"),
                usage.get("total_tokens"),
                elapsed,
            )

            return text, usage
        except Exception as e:
            logger.error("OpenAI API error: %s", str(e))
            raise

    def generate_ticket_details(
        self,
        chat_history: list[ChatMessage],
        user_feedback: Optional[str] = None,
        temperature: float = 0.3,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """Generate ticket details from OpenAI, return (details, usage metadata)"""
        start_time = time.time()
        logger.info("Generating ticket details with model: %s", self.model_name)

        # Build history text
        history_text = ""
        for msg in chat_history:
            role = "User" if msg.role.value == "user" else "Assistant"
            history_text += f"{role}: {msg.content}\n"

        prompt = f"""Generate a support ticket based on the following chat history.

Chat History:
{history_text}

{f"Additional user feedback: {user_feedback}" if user_feedback else ""}

Generate ONLY a valid JSON object in this format (no markdown, no extra text):
{{
    "title": "Concise ticket title summarizing the issue",
    "summary": "2-4 sentence incident handoff. Separately state what the user reported (including relevant impact/context) and what the AI Copilot investigated, advised, or tried, then state the current outcome or next step. Do not return a generic one-line issue description.",
    "category": "One of: Hardware, Software, Network, Access, Permissions, Training, General",
    "priority": "One of: Low, Medium, High, Critical",
    "description": "Full description of the issue including all relevant details from chat history"
}}
"""
        try:
            params = self._build_chat_params(
                [
                    {"role": "system", "content": "You are a helpful AI assistant that generates support tickets in JSON format."},
                    {"role": "user", "content": prompt},
                ],
                temperature,
                response_format={"type": "json_object"},
            )

            response: ChatCompletion = self.client.chat.completions.create(**params)
            usage = response.usage.model_dump() if response.usage else {}
            text = response.choices[0].message.content or ""
            elapsed = round(time.time() - start_time, 2)

            logger.info(
                "Generated ticket details. Model: %s, Prompt tokens: %s, Completion tokens: %s, Total tokens: %s, Time: %ss",
                self.model_name,
                usage.get("prompt_tokens"),
                usage.get("completion_tokens"),
                usage.get("total_tokens"),
                elapsed,
            )

            try:
                ticket_details = json.loads(text)
                if not str(ticket_details.get("summary") or "").strip():
                    ticket_details["summary"] = _build_conversation_summary(chat_history, user_feedback)
                return ticket_details, usage
            except json.JSONDecodeError:
                return {
                    "title": "Support Request",
                    "summary": _build_conversation_summary(chat_history, user_feedback),
                    "category": "General",
                    "priority": "Medium",
                    "description": history_text,
                }, usage

        except Exception as e:
            logger.error("OpenAI API error (ticket generation): %s", str(e))
            raise
            
    def analyze_ticket(
        self,
        title: str,
        description: str,
        severity: str,
        context_str: str,
        temperature: float = 0.3,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """Analyze a ticket using OpenAI and return structured analysis"""
        start_time = time.time()
        logger.info("Analyzing ticket with model: %s", self.model_name)

        prompt = f"""You are an expert ITSM ticket analyst. Analyze the following ticket and provide structured insights.
        
Ticket Details:
- Title: {title}
- Description: {description}
- Severity: {severity}

Relevant Knowledge Base Context:
{context_str if context_str else "No relevant knowledge base context available"}
"""

        try:
            params = self._build_chat_params(
                [
                    {"role": "system", "content": "You are a helpful AI assistant that analyzes ITSM tickets and returns structured JSON responses."},
                    {"role": "user", "content": prompt},
                ],
                temperature,
                response_format={"type": "json_object"},
            )

            response: ChatCompletion = self.client.chat.completions.create(**params)
            usage = response.usage.model_dump() if response.usage else {}
            text = response.choices[0].message.content or ""
            elapsed = round(time.time() - start_time, 2)

            logger.info(
                "Analyzed ticket. Model: %s, Prompt tokens: %s, Completion tokens: %s, Total tokens: %s, Time: %ss",
                self.model_name,
                usage.get("prompt_tokens"),
                usage.get("completion_tokens"),
                usage.get("total_tokens"),
                elapsed,
            )

            try:
                ticket_analysis = json.loads(text)
                # Ensure all required fields exist with defaults
                ticket_analysis.setdefault("category", "General")
                ticket_analysis.setdefault("priority", "Medium")
                ticket_analysis.setdefault("department", "IT Support")
                ticket_analysis.setdefault("tags", [])
                ticket_analysis.setdefault("possible_root_cause", "Root cause could not be determined from provided information")
                ticket_analysis.setdefault("confidence", 50)
                ticket_analysis.setdefault("suggested_resolution", "Please investigate further or escalate to appropriate team")
                ticket_analysis.setdefault("knowledge_articles", [])
                ticket_analysis.setdefault("estimated_sla", "2 business days")
                
                return ticket_analysis, usage
            except json.JSONDecodeError:
                return {
                    "category": "General",
                    "priority": severity,
                    "department": "IT Support",
                    "tags": [],
                    "possible_root_cause": "Root cause could not be determined from provided information",
                    "confidence": 30,
                    "suggested_resolution": "Please investigate further or escalate to appropriate team",
                    "knowledge_articles": [],
                    "estimated_sla": "2 business days",
                }, usage

        except Exception as e:
            logger.error("OpenAI API error (ticket analysis): %s", str(e))
            raise

