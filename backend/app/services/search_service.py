
"""Search service for semantic retrieval."""

from pathlib import Path
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.settings import get_settings
from app.rag.retriever import FAISSRetriever, RetrievalConfig, RetrievedContext
from app.rag.embedding_provider import EmbeddingProviderFactory
from app.rag.vector_store import VectorStoreFactory


class SearchService:
    """Service for semantic search operations."""

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        storage_path: Optional[Path] = None,
    ):
        self.db = db
        self.storage_path = storage_path or Path(__file__).parent.parent.parent / "vector_store"
        self.settings = get_settings()

        # Initialize the OpenAI embedding provider only
        self.embedding_provider = EmbeddingProviderFactory.create("openai")

        # Initialize vector store
        dimension = self.embedding_provider.get_embedding_dimension()
        self.vector_store = VectorStoreFactory.create(
            "faiss",
            dimension=dimension,
            storage_path=self.storage_path,
        )
        self.vector_store.load()

        # Initialize retriever
        self.retriever = FAISSRetriever(
            embedding_provider=self.embedding_provider,
            vector_store=self.vector_store,
            config=RetrievalConfig(top_k=5, similarity_threshold=0.0),
        )

    def search(
        self,
        query: str,
        top_k: int = 5,
        similarity_threshold: float = 0.0,
    ) -> RetrievedContext:
        """Perform semantic search.

        Args:
            query: Search query.
            top_k: Number of results to retrieve.
            similarity_threshold: Minimum similarity score for results.

        Returns:
            RetrievedContext with search results.
        """
        config = RetrievalConfig(
            top_k=top_k,
            similarity_threshold=similarity_threshold,
        )
        return self.retriever.retrieve(query, config)
