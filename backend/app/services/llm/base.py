
"""Abstract base class for LLM services"""
from abc import ABC, abstractmethod
from typing import Optional, Any
from app.rag.prompt_builder import BuiltPrompt, ChatMessage


class LLMService(ABC):
    """Abstract interface for language model services"""

    @abstractmethod
    def generate_response(
        self,
        built_prompt: BuiltPrompt,
        temperature: float = 0.7,
        max_output_tokens: Optional[int] = None,
    ) -> tuple[str, dict[str, Any]]:
        """Generate a response from the LLM and return (text, usage_metadata)"""
        pass

    @abstractmethod
    def generate_ticket_details(
        self,
        chat_history: list[ChatMessage],
        user_feedback: Optional[str] = None,
        temperature: float = 0.3,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """Generate ticket details from chat history and return (details, usage_metadata)"""
        pass
        
    @abstractmethod
    def analyze_ticket(
        self,
        title: str,
        description: str,
        severity: str,
        context_str: str,
        temperature: float = 0.3,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """Analyze a ticket and return structured analysis (details, usage_metadata)"""
        pass

