"""Retriever interface for RAG pipeline."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional

from app.rag.chunker import DocumentChunk
from app.rag.vector_store import VectorSearchResult, VectorStore
from app.rag.embedding_provider import EmbeddingProvider


@dataclass
class RetrievedContext:
    """Container for retrieved context with metadata."""
    chunks: list[DocumentChunk]
    search_results: list[VectorSearchResult]
    total_retrieved: int
    filter_applied: Optional[dict[str, Any]] = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class RetrievalConfig:
    """Configuration for retrieval operations."""
    top_k: int = 5
    # 0.5 preserves semantically valid short support queries such as
    # "My printer is not working" (measured similarity ~0.55).
    similarity_threshold: float = 0.5
    filter_metadata: Optional[dict[str, Any]] = None
    rerank: bool = False
    max_tokens: Optional[int] = None


class Retriever(ABC):
    """Abstract base class for retrievers."""
    
    @abstractmethod
    def retrieve(self, query: str, config: Optional[RetrievalConfig] = None) -> RetrievedContext:
        """Retrieve relevant context for a query.
        
        Args:
            query: User query string.
            config: Optional retrieval configuration.
            
        Returns:
            RetrievedContext containing relevant chunks and metadata.
            
        Raises:
            RetrievalError: If retrieval fails.
        """
        pass
    
    @abstractmethod
    def retrieve_with_embedding(
        self,
        query_embedding: list[float],
        config: Optional[RetrievalConfig] = None,
    ) -> RetrievedContext:
        """Retrieve relevant context using a pre-computed query embedding.
        
        Args:
            query_embedding: Pre-computed embedding vector of the query.
            config: Optional retrieval configuration.
            
        Returns:
            RetrievedContext containing relevant chunks and metadata.
            
        Raises:
            RetrievalError: If retrieval fails.
        """
        pass
    
    @abstractmethod
    def get_config(self) -> RetrievalConfig:
        """Get the current retrieval configuration.
        
        Returns:
            RetrievalConfig instance.
        """
        pass
    
    @abstractmethod
    def set_config(self, config: RetrievalConfig) -> None:
        """Set the retrieval configuration.
        
        Args:
            config: New retrieval configuration to use.
        """
        pass


class RetrievalError(Exception):
    """Exception raised when retrieval operations fail."""
    pass


class Reranker(ABC):
    """Abstract base class for rerankers."""
    
    @abstractmethod
    def rerank(
        self,
        query: str,
        search_results: list[VectorSearchResult],
    ) -> list[VectorSearchResult]:
        """Rerank search results based on relevance.
        
        Args:
            query: Original user query.
            search_results: Initial search results to rerank.
            
        Returns:
            Reranked list of VectorSearchResult objects.
            
        Raises:
            RerankingError: If reranking fails.
        """
        pass


class RerankingError(Exception):
    """Exception raised when reranking fails."""
    pass


class FAISSRetriever(Retriever):
    """FAISS-based retriever implementation."""

    def __init__(
        self,
        embedding_provider: EmbeddingProvider,
        vector_store: VectorStore,
        config: Optional[RetrievalConfig] = None,
    ):
        self.embedding_provider = embedding_provider
        self.vector_store = vector_store
        self.config = config or RetrievalConfig()

    def retrieve(self, query: str, config: Optional[RetrievalConfig] = None) -> RetrievedContext:
        """Retrieve relevant context for a query."""
        effective_config = config or self.config

        # Generate query embedding
        embedding_result = self.embedding_provider.embed(query)

        # Retrieve using embedding
        return self.retrieve_with_embedding(embedding_result.embedding, effective_config)

    def retrieve_with_embedding(
        self,
        query_embedding: list[float],
        config: Optional[RetrievalConfig] = None,
    ) -> RetrievedContext:
        """Retrieve relevant context using a pre-computed query embedding."""
        effective_config = config or self.config

        # Search vector store
        search_results = self.vector_store.search(
            query_embedding,
            top_k=effective_config.top_k,
            filter_metadata=effective_config.filter_metadata,
        )

        # Filter by similarity threshold
        filtered_results = [
            r
            for r in search_results
            if r.similarity_score >= effective_config.similarity_threshold
        ]

        # Collect chunks
        chunks = [r.chunk for r in filtered_results]

        return RetrievedContext(
            chunks=chunks,
            search_results=filtered_results,
            total_retrieved=len(filtered_results),
            filter_applied=effective_config.filter_metadata,
            metadata={
                "top_k": effective_config.top_k,
                "similarity_threshold": effective_config.similarity_threshold,
            },
        )

    def get_config(self) -> RetrievalConfig:
        """Get the current retrieval configuration."""
        return self.config

    def set_config(self, config: RetrievalConfig) -> None:
        """Set the retrieval configuration."""
        self.config = config


class RetrieverFactory:
    """Factory for creating retriever instances."""
    
    @staticmethod
    def create(retriever_type: str, **kwargs) -> Retriever:
        """Create a retriever instance.
        
        Args:
            retriever_type: Type of retriever to create.
            **kwargs: Additional retriever-specific configuration.
            
        Returns:
            Retriever instance.
            
        Raises:
            ValueError: If retriever_type is not supported.
        """
        if retriever_type.lower() == "faiss":
            return FAISSRetriever(**kwargs)
        raise ValueError(f"Retriever type '{retriever_type}' not implemented")
