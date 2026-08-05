
"""Search service for semantic retrieval."""

import logging
import time
from pathlib import Path
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.settings import get_settings
from app.rag.embedding_provider import EmbeddingProviderFactory
from app.rag.retriever import (
    FAISSRetriever,
    RetrievalConfig,
    RetrievedContext,
    expand_query_variants,
)
from app.rag.vector_store import VectorStoreFactory

logger = logging.getLogger(__name__)


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

        # Initialize the configured embedding provider
        self.embedding_provider = EmbeddingProviderFactory.create(self.settings.embedding_provider)

        # Initialize vector store
        dimension = self.embedding_provider.get_embedding_dimension()
        self.vector_store = VectorStoreFactory.create(
            "faiss",
            dimension=dimension,
            storage_path=self.storage_path,
        )
        try:
            self.vector_store.load()
        except Exception:
            logger.warning(
                "KB vector_store load failed, initializing empty FAISS index. "
                "Re-upload or re-index the Knowledge Base to populate it."
            )
            self.vector_store.initialize()

        # Initialize retriever
        self.retriever = FAISSRetriever(
            embedding_provider=self.embedding_provider,
            vector_store=self.vector_store,
            config=RetrievalConfig(top_k=5, similarity_threshold=0.0, relevance_threshold=0.35),
        )

    def search(
        self,
        query: str,
        top_k: int = 5,
        similarity_threshold: float = 0.0,
        relevance_threshold: float = 0.55,
    ) -> RetrievedContext:
        """Perform semantic and keyword hybrid retrieval with strict KB relevance validation."""
        config = RetrievalConfig(
            top_k=top_k,
            similarity_threshold=similarity_threshold,
            relevance_threshold=relevance_threshold,
        )
        started = time.perf_counter()
        expanded_query = expand_query_variants(query)
        try:
            context = self.retriever.retrieve(query, config)
            latency_ms = (time.perf_counter() - started) * 1000
            logger.info(
                "KB retrieval: expanded_query=%s latency_ms=%.2f threshold=%.2f relevance_threshold=%.2f results=%d similarity_scores=%s",
                expanded_query,
                latency_ms,
                similarity_threshold,
                relevance_threshold,
                context.total_retrieved,
                [round(result.similarity_score, 4) for result in context.search_results],
            )
            if context.search_results:
                logger.info(
                    "KB retrieval details: chunks=%s hybrid_scores=%s",
                    [chunk.chunk_id for chunk in context.chunks],
                    [round((result.metadata or {}).get("hybrid_score", result.similarity_score), 4) for result in context.search_results],
                )
            return context
        except Exception:
            logger.exception("Knowledge-base retrieval failed: query=%r expanded_query=%s", query, expanded_query)
            raise
