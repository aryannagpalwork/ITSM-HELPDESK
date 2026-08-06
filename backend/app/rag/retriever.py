"""Retriever interface for RAG pipeline."""

import re
import time
from abc import ABC, abstractmethod
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Optional

from app.rag.chunker import DocumentChunk
from app.rag.vector_store import VectorSearchResult, VectorStore
from app.rag.embedding_provider import EmbeddingProvider


QUERY_SYNONYMS = {
    "printer": {"printer", "printing machine", "print machine", "photocopier", "photocopy machine", "copy machine", "machine not printing"},
    "mfa": {"mfa", "multi factor authentication", "multi-factor authentication", "authenticator", "authentication app", "secure login", "company account", "corporate login", "phone verification", "two factor", "2fa", "okta verify"},
    "login": {"login", "sign in", "signin", "secure login", "company account", "corporate login", "account access"},
    "password": {"password", "passcode", "credential", "credentials"},
}


def _tokenize(text: str) -> list[str]:
    return [token for token in re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).split() if token]


class QueryNormalizer:
    """Normalize and expand query terms to canonical Knowledge Base aliases."""

    @staticmethod
    def normalize(query: str) -> str:
        text = re.sub(r"[^a-z0-9]+", " ", (query or "").lower()).strip()
        if not text:
            return ""

        tokens = text.split()
        normalized_tokens: list[str] = []
        seen: set[str] = set()

        for token in tokens:
            canonical = token
            for canonical_term, variants in QUERY_SYNONYMS.items():
                if token in variants or token == canonical_term:
                    canonical = canonical_term
                    break
            if canonical not in seen:
                normalized_tokens.append(canonical)
                seen.add(canonical)

        long_text = " ".join(tokens)
        for canonical_term, variants in QUERY_SYNONYMS.items():
            if any(variant in long_text for variant in variants):
                if canonical_term not in seen:
                    normalized_tokens.append(canonical_term)
                    seen.add(canonical_term)

        return " ".join(normalized_tokens)


def normalize_query(query: str) -> str:
    """Return a canonicalized query string suitable for retrieval."""
    return QueryNormalizer.normalize(query)


def expand_query_variants(query: str) -> list[str]:
    """Generate variant queries used for semantic expansion before retrieval.

    Strategy:
      1. Keep the original and normalized query strings.
      2. For every canonical QUERY_SYNONYMS term matched by any token/variant,
         also emit EACH INDIVIDUAL synonym variant (the multi-word phrases such
         as "multi factor authentication", "authentication app", etc.) as its
         own embedding string. Short one-word queries ("MFA", "Authenticator")
         have low raw cosine similarity against multi-word chunk text. The
         expanded multi-word phrases produce much stronger semantic matches,
         which the hybrid scorer then blends with the keyword contribution.
    """
    base = (query or "").strip()
    normalized = normalize_query(base)
    variants: list[str] = []
    seen: set[str] = set()

    def _add(candidate: str) -> None:
        cleaned = re.sub(r"\s+", " ", (candidate or "")).strip()
        if cleaned and cleaned.lower() not in {s.lower() for s in seen}:
            variants.append(cleaned)
            seen.add(cleaned)

    for candidate in [
        base,
        normalized,
        " ".join(dict.fromkeys(_tokenize(base))),
        " ".join(dict.fromkeys(_tokenize(normalized))),
    ]:
        _add(candidate)

    # For each canonical term whose variants match any part of the query,
    # emit ALL variants as separate embedding queries.  This bridges the
    # lexical gap between short lookups ("MFA") and multi-word KB content.
    base_long = " ".join(dict.fromkeys(_tokenize(base)))
    normalized_long = " ".join(dict.fromkeys(_tokenize(normalized)))
    for canonical_term, variant_set in QUERY_SYNONYMS.items():
        triggered = False
        for variant in variant_set:
            v = variant.strip()
            if not v:
                continue
            if (
                v in base.lower()
                or v in normalized.lower()
                or v in base_long.lower()
                or v in normalized_long.lower()
                or canonical_term in v and (canonical_term in normalized or canonical_term in base.lower())
            ):
                triggered = True
                break
        if triggered:
            _add(canonical_term)
            for variant in variant_set:
                _add(variant)

    # Per-token single-word fallback (kept for robustness).
    if normalized:
        for token in dict.fromkeys(_tokenize(normalized)):
            _add(token)

    return variants or [base]


def _score_keyword_overlap(query: str, chunk_text: str) -> float:
    query_terms = set(_tokenize(normalize_query(query)))
    if not query_terms:
        return 0.0

    chunk_terms = Counter(_tokenize(chunk_text))
    overlap = 0
    for term in query_terms:
        if chunk_terms.get(term, 0):
            overlap += 1

    return overlap / max(1, len(query_terms))


def rank_hybrid_results(query: str, results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Blend semantic and keyword evidence into a single hybrid relevance score."""
    ranked: list[dict[str, Any]] = []
    for item in results:
        similarity = float(item.get("similarity_score", 0.0) or 0.0)
        keyword_score = float(item.get("keyword_score", 0.0) or 0.0)
        hybrid_score = 0.65 * similarity + 0.35 * keyword_score
        item = dict(item)
        item["hybrid_score"] = hybrid_score
        item["keyword_score"] = keyword_score
        item["similarity_score"] = similarity
        ranked.append(item)

    ranked.sort(key=lambda item: (item.get("hybrid_score", 0.0), item.get("similarity_score", 0.0), item.get("keyword_score", 0.0)), reverse=True)
    return ranked


def _deduplicate_ranked_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove duplicate/near-duplicate chunks after reranking.

    Upload-time overlap is useful for semantic continuity, but sending the
    same text repeatedly to the LLM reduces answer quality. Keep the highest
    ranked representative of each duplicate text block.
    """
    deduplicated: list[dict[str, Any]] = []
    seen_texts: list[set[str]] = []
    for item in results:
        text = re.sub(r"\s+", " ", (item.get("chunk").text or "")).strip().lower()
        tokens = set(_tokenize(text))
        if not tokens:
            continue
        is_duplicate = text in {re.sub(r"\s+", " ", (existing.get("chunk").text or "")).strip().lower() for existing in deduplicated}
        if not is_duplicate:
            for previous_tokens in seen_texts:
                overlap = len(tokens & previous_tokens) / max(1, len(tokens | previous_tokens))
                if overlap >= 0.90:
                    is_duplicate = True
                    break
        if not is_duplicate:
            deduplicated.append(item)
            seen_texts.append(tokens)
    return deduplicated


def keyword_search(query: str, chunks: list[DocumentChunk], top_k: int = 5) -> list[dict[str, Any]]:
    """Return keyword-overlap matches from indexed chunks."""
    query_terms = set(_tokenize(normalize_query(query)))
    if not query_terms:
        return []

    scored: list[dict[str, Any]] = []
    for chunk in chunks:
        chunk_text = chunk.text or chunk.chunk_text or ""
        overlap = _score_keyword_overlap(query, chunk_text)
        if overlap <= 0:
            continue
        scored.append({
            "chunk": chunk,
            "similarity_score": 0.0,
            "keyword_score": overlap,
            "hybrid_score": overlap,
            "rank": 0,
            "metadata": {},
        })

    scored.sort(key=lambda item: (item["keyword_score"], item["similarity_score"]), reverse=True)
    return scored[:top_k]


def validate_relevance(item: dict[str, Any] | VectorSearchResult, threshold: float = 0.55) -> bool:
    """Return True only when a retrieved result passes the configured KB relevance gate."""
    if isinstance(item, VectorSearchResult):
        metadata = item.metadata or {}
        score = float(metadata.get("hybrid_score", metadata.get("relevance_score", item.similarity_score)))
        valid = score >= threshold
        metadata["relevance_valid"] = valid
        return valid

    score = float(item.get("hybrid_score", item.get("relevance_score", item.get("similarity_score", 0.0)) or 0.0))
    valid = score >= threshold
    item["relevance_valid"] = valid
    return valid


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
    # 0.35 keeps short single-term searches ("MFA", "Authenticator", "QR code")
    # reachable via hybrid scoring even when raw cosine is modest for
    # text-embedding-3-large reduced to 1536 dims.
    relevance_threshold: float = 0.35
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
    """FAISS-based retriever implementation with hybrid semantic + keyword retrieval."""

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
        """Retrieve relevant context for a query using normalized synonyms, keyword search, and hybrid ranking."""
        effective_config = config or self.config
        query_variants = expand_query_variants(query)
        semantic_results: list[VectorSearchResult] = []
        seen_ids: set[str] = set()

        for variant in query_variants:
            embedding_result = self.embedding_provider.embed(variant)
            candidates = self.vector_store.search(
                embedding_result.embedding,
                # Retrieve a broad candidate pool before hybrid reranking.
                top_k=max(effective_config.top_k, 20),
                filter_metadata=effective_config.filter_metadata,
            )
            for candidate in candidates:
                if candidate.chunk.chunk_id in seen_ids:
                    continue
                seen_ids.add(candidate.chunk.chunk_id)
                semantic_results.append(candidate)

        chunks = list(getattr(self.vector_store, "_chunks", {}).values()) if hasattr(self.vector_store, "_chunks") else []
        keyword_matches = []
        for variant in query_variants:
            keyword_matches.extend(keyword_search(variant, chunks, top_k=max(effective_config.top_k, 20)))

        merged: dict[str, dict[str, Any]] = {}
        for result in semantic_results:
            merged[result.chunk.chunk_id] = {
                "chunk": result.chunk,
                "similarity_score": float(result.similarity_score or 0.0),
                "keyword_score": 0.0,
                "hybrid_score": float(result.similarity_score or 0.0),
                "rank": result.rank,
                "metadata": result.metadata or {},
            }

        for result in keyword_matches:
            chunk_id = result["chunk"].chunk_id
            item = merged.setdefault(
                chunk_id,
                {
                    "chunk": result["chunk"],
                    "similarity_score": 0.0,
                    "keyword_score": 0.0,
                    "hybrid_score": 0.0,
                    "rank": result["rank"],
                    "metadata": result.get("metadata") or {},
                },
            )
            item["keyword_score"] = max(item["keyword_score"], float(result.get("keyword_score", 0.0)))
            item["hybrid_score"] = 0.65 * item["similarity_score"] + 0.35 * item["keyword_score"]

        for chunk_id, item in merged.items():
            if item["keyword_score"] <= 0 and item["similarity_score"] > 0:
                item["hybrid_score"] = 0.65 * item["similarity_score"] + 0.35 * 0.0

        ranked = rank_hybrid_results(query, list(merged.values()))
        ranked = _deduplicate_ranked_results(ranked)
        filtered = [item for item in ranked if validate_relevance(item, threshold=effective_config.relevance_threshold)]
        results = [
            VectorSearchResult(
                chunk=item["chunk"],
                similarity_score=float(item["similarity_score"]),
                rank=item["rank"],
                metadata={**(item.get("metadata") or {}), "keyword_score": item["keyword_score"], "hybrid_score": item["hybrid_score"], "relevance_valid": True},
            )
            for item in filtered[: effective_config.top_k]
        ]

        if not results:
            return RetrievedContext(chunks=[], search_results=[], total_retrieved=0, filter_applied=effective_config.filter_metadata, metadata={"expanded_query": query_variants, "relevance_threshold": effective_config.relevance_threshold, "hybrid_scores": [item["hybrid_score"] for item in ranked]})

        return RetrievedContext(
            chunks=[result.chunk for result in results],
            search_results=results,
            total_retrieved=len(results),
            filter_applied=effective_config.filter_metadata,
            metadata={
                "top_k": effective_config.top_k,
                "similarity_threshold": effective_config.similarity_threshold,
                "relevance_threshold": effective_config.relevance_threshold,
                "expanded_query": query_variants,
                "scores": [round(result.metadata.get("hybrid_score", result.similarity_score), 4) for result in results],
                "candidate_count": len(ranked),
                "reranked": True,
            },
        )

    def retrieve_with_embedding(
        self,
        query_embedding: list[float],
        config: Optional[RetrievalConfig] = None,
    ) -> RetrievedContext:
        """Retrieve relevant context using a pre-computed query embedding."""
        effective_config = config or self.config
        start_time = time.perf_counter()
        search_results = self.vector_store.search(
            query_embedding,
            top_k=max(effective_config.top_k, 20),
            filter_metadata=effective_config.filter_metadata,
        )
        if not search_results:
            return RetrievedContext(chunks=[], search_results=[], total_retrieved=0, filter_applied=effective_config.filter_metadata, metadata={"query_embedding_length": len(query_embedding), "latency_ms": round((time.perf_counter() - start_time) * 1000, 2)})

        merged_candidates: list[dict[str, Any]] = []
        for candidate in search_results:
            text = candidate.chunk.text or candidate.chunk.chunk_text or ""
            keyword_score = _score_keyword_overlap(" ".join(str(v) for v in query_embedding), text)
            hybrid_score = 0.65 * float(candidate.similarity_score or 0.0) + 0.35 * keyword_score
            candidate.metadata["keyword_score"] = keyword_score
            candidate.metadata["hybrid_score"] = hybrid_score
            merged_candidates.append({
                "chunk": candidate.chunk,
                "similarity_score": float(candidate.similarity_score or 0.0),
                "keyword_score": keyword_score,
                "hybrid_score": hybrid_score,
                "rank": candidate.rank,
                "metadata": candidate.metadata,
            })

        ranked = rank_hybrid_results("", merged_candidates)
        ranked = _deduplicate_ranked_results(ranked)
        filtered = [item for item in ranked if validate_relevance(item, threshold=effective_config.relevance_threshold)]
        results = [
            VectorSearchResult(
                chunk=item["chunk"],
                similarity_score=float(item["similarity_score"]),
                rank=item["rank"],
                metadata={**(item.get("metadata") or {}), "keyword_score": item["keyword_score"], "hybrid_score": item["hybrid_score"], "relevance_valid": True},
            )
            for item in filtered[: effective_config.top_k]
        ]

        return RetrievedContext(
            chunks=[result.chunk for result in results],
            search_results=results,
            total_retrieved=len(results),
            filter_applied=effective_config.filter_metadata,
            metadata={
                "top_k": effective_config.top_k,
                "similarity_threshold": effective_config.similarity_threshold,
                "relevance_threshold": effective_config.relevance_threshold,
                "query_embedding_length": len(query_embedding),
                "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
                "scores": [round(result.metadata.get("hybrid_score", result.similarity_score), 4) for result in results],
                "candidate_count": len(ranked),
                "reranked": True,
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
