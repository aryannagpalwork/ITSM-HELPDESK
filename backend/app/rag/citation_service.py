"""Citation service interface for RAG pipeline."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional
from enum import Enum

from app.rag.chunker import DocumentChunk
from app.rag.retriever import RetrievedContext


class CitationFormat(Enum):
    """Supported citation formats."""
    INLINE = "inline"
    FOOTNOTE = "footnote"
    ENDNOTE = "endnote"
    LINK = "link"


@dataclass
class Citation:
    """A single citation referencing a source chunk."""
    citation_id: str
    chunk: DocumentChunk
    format: CitationFormat
    reference_text: str
    page_number: Optional[int] = None
    section: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class CitedResponse:
    """Response with citations attached."""
    response_text: str
    citations: list[Citation]
    context: RetrievedContext
    metadata: dict[str, Any] = field(default_factory=dict)


class CitationService(ABC):
    """Abstract base class for citation services."""
    
    @abstractmethod
    def generate_citation(
        self,
        chunk: DocumentChunk,
        format: CitationFormat = CitationFormat.INLINE,
    ) -> Citation:
        """Generate a citation for a document chunk.
        
        Args:
            chunk: DocumentChunk to cite.
            format: Citation format to use.
            
        Returns:
            Citation object.
            
        Raises:
            CitationError: If citation generation fails.
        """
        pass
    
    @abstractmethod
    def attach_citations(
        self,
        response_text: str,
        context: RetrievedContext,
        format: CitationFormat = CitationFormat.INLINE,
    ) -> CitedResponse:
        """Attach citations to an LLM response.
        
        Args:
            response_text: Text from LLM response.
            context: Retrieved context used to generate response.
            format: Citation format to use.
            
        Returns:
            CitedResponse with citations attached.
            
        Raises:
            CitationError: If citation attachment fails.
        """
        pass
    
    @abstractmethod
    def validate_citation(self, citation: Citation) -> bool:
        """Validate that a citation is correct and references an existing source.
        
        Args:
            citation: Citation to validate.
            
        Returns:
            True if citation is valid, False otherwise.
        """
        pass
    
    @abstractmethod
    def get_citation_metadata(self, chunk: DocumentChunk) -> dict[str, Any]:
        """Extract metadata for citation from a chunk.
        
        Args:
            chunk: DocumentChunk to extract metadata from.
            
        Returns:
            Dictionary of citation-relevant metadata.
        """
        pass


class CitationError(Exception):
    """Exception raised when citation operations fail."""
    pass


class CitationServiceFactory:
    """Factory for creating citation service instances."""
    
    @staticmethod
    def create(service_type: str, **kwargs) -> CitationService:
        """Create a citation service instance.
        
        Args:
            service_type: Type of citation service to create.
            **kwargs: Additional service-specific configuration.
            
        Returns:
            CitationService instance.
            
        Raises:
            ValueError: If service_type is not supported.
        """
        # In a real implementation, you would map types to classes.
        # For this placeholder, raise NotImplementedError.
        raise NotImplementedError(f"Citation service type '{service_type}' not implemented")
