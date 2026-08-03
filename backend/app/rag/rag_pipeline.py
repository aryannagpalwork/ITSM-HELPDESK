"""RAG pipeline orchestrator for end-to-end RAG operations."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional, AsyncIterator
from pathlib import Path
from datetime import datetime

from app.rag.config import RAGSettings, get_rag_settings
from app.rag.document_loader import DocumentLoader, LoadedDocument
from app.rag.text_extractor import TextExtractor
from app.rag.chunker import Chunker, DocumentChunk
from app.rag.embedding_provider import EmbeddingProvider
from app.rag.vector_store import VectorStore
from app.rag.retriever import Retriever, RetrievedContext
from app.rag.prompt_builder import ChatMessage
from app.rag.prompt_builder import PromptBuilder, BuiltPrompt
from app.rag.citation_service import CitationService, CitedResponse


@dataclass
class RAGQueryResult:
    """Result of a RAG query operation."""
    query: str
    response: str
    cited_response: Optional[CitedResponse]
    context: RetrievedContext
    prompt: BuiltPrompt
    citations: list
    processing_time_ms: float
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class IndexingProgress:
    """Progress tracking for document indexing."""
    total_documents: int
    processed_documents: int
    total_chunks: int
    processed_chunks: int
    current_document: Optional[Path] = None
    errors: list[tuple[Path, Exception]] = field(default_factory=list)
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class RAGPipeline(ABC):
    """Abstract base class for RAG pipelines."""
    
    @abstractmethod
    def initialize(self) -> None:
        """Initialize the RAG pipeline.
        
        Sets up all components and connections.
        
        Raises:
            RAGPipelineError: If initialization fails.
        """
        pass
    
    @abstractmethod
    def query(
        self,
        query: str,
        chat_history: Optional[list[ChatMessage]] = None,
        include_citations: bool = True,
    ) -> RAGQueryResult:
        """Execute a RAG query.
        
        Args:
            query: User's query string.
            chat_history: Optional previous chat messages.
            include_citations: Whether to include citations in response.
            
        Returns:
            RAGQueryResult with response and metadata.
            
        Raises:
            RAGPipelineError: If query fails.
        """
        pass
    
    @abstractmethod
    async def query_stream(
        self,
        query: str,
        chat_history: Optional[list[ChatMessage]] = None,
        include_citations: bool = True,
    ) -> AsyncIterator[str]:
        """Execute a RAG query with streaming response.
        
        Args:
            query: User's query string.
            chat_history: Optional previous chat messages.
            include_citations: Whether to include citations in response.
            
        Yields:
            Response text chunks as they become available.
            
        Raises:
            RAGPipelineError: If query fails.
        """
        pass
    
    @abstractmethod
    def index_document(self, file_path: Path) -> int:
        """Index a single document.
        
        Args:
            file_path: Path to document to index.
            
        Returns:
            Number of chunks indexed.
            
        Raises:
            RAGPipelineError: If indexing fails.
        """
        pass
    
    @abstractmethod
    def index_directory(
        self,
        directory_path: Path,
        recursive: bool = True,
    ) -> IndexingProgress:
        """Index all documents in a directory.
        
        Args:
            directory_path: Path to directory containing documents.
            recursive: Whether to index subdirectories recursively.
            
        Returns:
            IndexingProgress with results.
            
        Raises:
            RAGPipelineError: If indexing fails.
        """
        pass
    
    @abstractmethod
    def refresh_index(self) -> None:
        """Refresh the index by reindexing all documents.
        
        Raises:
            RAGPipelineError: If refresh fails.
        """
        pass
    
    @abstractmethod
    def clear_index(self) -> None:
        """Clear all documents from the index.
        
        Raises:
            RAGPipelineError: If clearing fails.
        """
        pass
    
    @abstractmethod
    def get_settings(self) -> RAGSettings:
        """Get the pipeline settings.
        
        Returns:
            RAGSettings instance.
        """
        pass
    
    @abstractmethod
    def get_pipeline_stats(self) -> dict[str, Any]:
        """Get statistics about the pipeline.
        
        Returns:
            Dictionary of pipeline statistics.
        """
        pass


class RAGPipelineError(Exception):
    """Exception raised when RAG pipeline operations fail."""
    pass


class RAGPipelineFactory:
    """Factory for creating RAG pipeline instances."""
    
    @staticmethod
    def create(
        pipeline_type: str,
        settings: Optional[RAGSettings] = None,
        **kwargs,
    ) -> RAGPipeline:
        """Create a RAG pipeline instance.
        
        Args:
            pipeline_type: Type of RAG pipeline to create.
            settings: Optional RAGSettings to use.
            **kwargs: Additional pipeline-specific configuration.
            
        Returns:
            RAGPipeline instance.
            
        Raises:
            ValueError: If pipeline_type is not supported.
        """
        # In a real implementation, you would map types to classes.
        # For this placeholder, raise NotImplementedError.
        raise NotImplementedError(f"RAG pipeline type '{pipeline_type}' not implemented")
