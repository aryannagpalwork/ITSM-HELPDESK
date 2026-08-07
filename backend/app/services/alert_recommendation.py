"""Helper service to get KB-backed recommendations for alerts using existing RAG infrastructure."""

import logging
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.rag.config import get_rag_settings
from app.services.search_service import SearchService

logger = logging.getLogger(__name__)


async def get_kb_recommendation(db: AsyncIOMotorDatabase, query: str) -> str | None:
    """Run query through existing SearchService and retriever with exact chat confidence thresholds.

    Returns the recommendation content string if found and cleared threshold; otherwise returns None.
    """
    query_str = (query or "").strip()
    if not query_str:
        return None

    try:
        rag_settings = get_rag_settings()
        similarity_threshold = rag_settings.similarity_threshold
        relevance_threshold = rag_settings.relevance_threshold

        search_service = SearchService(db=db)
        context = search_service.search(
            query=query_str,
            top_k=3,
            similarity_threshold=similarity_threshold,
            relevance_threshold=relevance_threshold,
        )

        if context and context.chunks:
            top_chunk = context.chunks[0]
            recommendation_text = (top_chunk.text or top_chunk.chunk_text or "").strip()
            if recommendation_text:
                logger.info("Found KB recommendation for query '%s'", query_str)
                return recommendation_text
    except Exception as exc:
        logger.warning("KB recommendation lookup failed for query '%s': %s", query_str, exc)

    return None
