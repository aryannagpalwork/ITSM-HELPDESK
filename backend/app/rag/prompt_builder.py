"""Prompt builder interface for RAG pipeline."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional
from enum import Enum

from app.rag.retriever import RetrievedContext


class MessageRole(Enum):
    """Roles for chat messages."""
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    FUNCTION = "function"


@dataclass
class ChatMessage:
    """A single chat message."""
    role: MessageRole
    content: str
    name: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class PromptTemplate:
    """Template for building prompts."""
    template: str
    variables: list[str]
    name: str
    description: Optional[str] = None


@dataclass
class BuiltPrompt:
    """Result of building a prompt."""
    messages: list[ChatMessage]
    context_used: RetrievedContext
    metadata: dict[str, Any] = field(default_factory=dict)


class PromptBuilder(ABC):
    """Abstract base class for prompt builders."""
    
    @abstractmethod
    def build(
        self,
        query: str,
        context: RetrievedContext,
        chat_history: Optional[list[ChatMessage]] = None,
    ) -> BuiltPrompt:
        """Build a prompt from query, context, and chat history.
        
        Args:
            query: User's current query.
            context: Retrieved context from knowledge base.
            chat_history: Optional previous chat messages.
            
        Returns:
            BuiltPrompt containing messages and metadata.
            
        Raises:
            PromptBuildingError: If prompt building fails.
        """
        pass
    
    @abstractmethod
    def register_template(self, template: PromptTemplate) -> None:
        """Register a new prompt template.
        
        Args:
            template: PromptTemplate to register.
        """
        pass
    
    @abstractmethod
    def get_template(self, name: str) -> Optional[PromptTemplate]:
        """Get a registered template by name.
        
        Args:
            name: Name of the template to retrieve.
            
        Returns:
            PromptTemplate if found, None otherwise.
        """
        pass
    
    @abstractmethod
    def set_system_prompt(self, prompt: str) -> None:
        """Set the system prompt.
        
        Args:
            prompt: System prompt text.
        """
        pass
    
    @abstractmethod
    def get_system_prompt(self) -> str:
        """Get the current system prompt.
        
        Returns:
            Current system prompt text.
        """
        pass


class PromptBuildingError(Exception):
    """Exception raised when prompt building fails."""
    pass


class RAGPromptBuilder(PromptBuilder):
    """Concrete prompt builder for RAG applications."""

    DEFAULT_SYSTEM_PROMPT = """You are an enterprise IT support assistant for an IT Service Management (ITSM) help desk.

Behave like a polished conversational support engineer, not a single-turn RAG chatbot.
- Ask concise follow-up questions when the user's request is missing important details.
- Remember the active conversation thread and combine prior answers with the latest question.
- Use the knowledge base silently to ground your answer. Never mention retrieval, chunk IDs, document IDs, embeddings, confidence scores, or internal RAG diagnostics.
- Keep responses natural, concise, and professional.
- If you need more information, say something like: "I need a little more information before I can narrow this down."
- Troubleshoot step-by-step with the user.
- Only suggest ticket creation after the user confirms the issue is still unresolved or the troubleshooting did not work.
- Do not expose internal metadata or source citations to the end user.
- If the user has clearly provided enough information, provide troubleshooting steps or resolution guidance directly.
"""

    def __init__(self):
        self.system_prompt = self.DEFAULT_SYSTEM_PROMPT
        self.templates: dict[str, PromptTemplate] = {}

    def build(
        self,
        query: str,
        context: RetrievedContext,
        chat_history: Optional[list[ChatMessage]] = None,
    ) -> BuiltPrompt:
        """Build a prompt from query, context, and chat history."""
        # Build context string
        context_str = ""
        if context.chunks:
            context_str = "Here is the relevant information from our knowledge base:\n\n"
            for i, chunk in enumerate(context.chunks):
                context_str += f"--- Document Chunk {i + 1} (ID: {chunk.chunk_id}) ---\n"
                if chunk.heading:
                    context_str += f"Heading: {chunk.heading}\n"
                if chunk.section:
                    context_str += f"Section: {chunk.section}\n"
                context_str += f"Content: {chunk.text}\n\n"
        else:
            context_str = "No relevant information found in the knowledge base.\n"

        # Build user prompt
        user_prompt = f"Question: {query}\n\n{context_str}"

        # Build messages
        messages: list[ChatMessage] = []
        
        # Add system prompt
        messages.append(ChatMessage(role=MessageRole.SYSTEM, content=self.system_prompt))
        
        # Add chat history if present
        if chat_history:
            messages.extend(chat_history)
        
        # Add current user query with context
        messages.append(ChatMessage(role=MessageRole.USER, content=user_prompt))

        return BuiltPrompt(
            messages=messages,
            context_used=context,
            metadata={
                "context_available": len(context.chunks) > 0,
                "num_chunks_used": len(context.chunks),
            },
        )

    def register_template(self, template: PromptTemplate) -> None:
        """Register a new prompt template."""
        self.templates[template.name] = template

    def get_template(self, name: str) -> Optional[PromptTemplate]:
        """Get a registered template by name."""
        return self.templates.get(name)

    def set_system_prompt(self, prompt: str) -> None:
        """Set the system prompt."""
        self.system_prompt = prompt

    def get_system_prompt(self) -> str:
        """Get the current system prompt."""
        return self.system_prompt


class PromptBuilderFactory:
    """Factory for creating prompt builder instances."""
    
    @staticmethod
    def create(builder_type: str, **kwargs) -> PromptBuilder:
        """Create a prompt builder instance.
        
        Args:
            builder_type: Type of prompt builder to create.
            **kwargs: Additional builder-specific configuration.
            
        Returns:
            PromptBuilder instance.
            
        Raises:
            ValueError: If builder_type is not supported.
        """
        if builder_type.lower() == "rag":
            return RAGPromptBuilder(**kwargs)
        raise ValueError(f"Prompt builder type '{builder_type}' not implemented")

