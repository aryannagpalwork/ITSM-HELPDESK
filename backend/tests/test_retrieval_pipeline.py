import pytest

from app.api.chat import has_sufficient_retrieval_context
from app.rag.chunker import DocumentChunk
from app.rag.retriever import (
    HybridReranker,
    QueryNormalizer,
    RetrievedContext,
    expand_query_variants,
    normalize_query,
    rank_hybrid_results,
    validate_relevance,
)
from app.rag.vector_store import VectorSearchResult


def test_query_normalization_maps_printer_synonyms():
    normalized = normalize_query("My photocopy machine isn't working")
    assert "printer" in normalized
    assert "photocopier" in normalized or "photocopy" in normalized


def test_query_normalization_maps_mfa_synonyms():
    normalized = normalize_query("I got a new company account")
    assert "mfa" in normalized or "authenticator" in normalized


def test_hybrid_ranking_and_relevance_validation():
    candidate = [
        {"chunk_text": "Printer troubleshooting steps for photocopier issues and machine setup.", "similarity_score": 0.82, "keyword_score": 0.91},
        {"chunk_text": "MFA enrollment guide for company account security and authenticator setup.", "similarity_score": 0.41, "keyword_score": 0.15},
    ]
    ranked = rank_hybrid_results("photocopier printer guide", candidate)
    assert ranked[0]["chunk_text"].lower().startswith("printer")
    assert validate_relevance(ranked[0], threshold=0.55) is True
    assert validate_relevance(ranked[1], threshold=0.55) is False


def test_hybrid_reranker_prioritizes_query_relevant_chunks():
    reranker = HybridReranker()
    results = [
        VectorSearchResult(
            chunk=DocumentChunk(chunk_id="menu", text="Office lunch menu and catering schedule for this week.", metadata={}),
            similarity_score=0.62,
            rank=1,
            metadata={},
        ),
        VectorSearchResult(
            chunk=DocumentChunk(chunk_id="mfa", text="Set up MFA for your company account using the authenticator app and security verification.", metadata={}),
            similarity_score=0.78,
            rank=2,
            metadata={},
        ),
    ]

    reranked = reranker.rerank("How do I set up MFA for my company account?", results, min_score=0.3)

    assert [item.chunk.chunk_id for item in reranked[:2]] == ["mfa", "menu"]
    assert reranked[0].metadata["relevance_score"] >= reranked[1].metadata["relevance_score"]


def test_hybrid_reranker_filters_irrelevant_context():
    reranker = HybridReranker()
    results = [
        VectorSearchResult(
            chunk=DocumentChunk(chunk_id="irrelevant", text="Weekly cafeteria menu and team social events.", metadata={}),
            similarity_score=0.44,
            rank=1,
            metadata={},
        ),
        VectorSearchResult(
            chunk=DocumentChunk(chunk_id="printer", text="Troubleshoot your printer by restarting the queue and verifying the print spooler service.", metadata={}),
            similarity_score=0.76,
            rank=2,
            metadata={},
        ),
    ]

    filtered = reranker.rerank("Printer queue stuck and not printing", results, min_score=0.55)

    assert [item.chunk.chunk_id for item in filtered] == ["printer"]


def test_hallucination_prevention_accepts_strong_retrieval():
    context = RetrievedContext(
        chunks=[DocumentChunk(chunk_id="kb-1", text="Reset MFA by opening the authenticator app and verifying the company account.", metadata={})],
        search_results=[
            VectorSearchResult(
                chunk=DocumentChunk(chunk_id="kb-1", text="Reset MFA by opening the authenticator app and verifying the company account.", metadata={}),
                similarity_score=0.88,
                rank=1,
                metadata={"relevance_score": 0.86, "relevance_valid": True},
            )
        ],
        total_retrieved=1,
    )

    assert has_sufficient_retrieval_context(context, "How do I reset MFA for my company account?") is True


def test_hallucination_prevention_rejects_weak_retrieval():
    context = RetrievedContext(
        chunks=[DocumentChunk(chunk_id="kb-weak", text="Office lunch menu for this week.", metadata={})],
        search_results=[
            VectorSearchResult(
                chunk=DocumentChunk(chunk_id="kb-weak", text="Office lunch menu for this week.", metadata={}),
                similarity_score=0.31,
                rank=1,
                metadata={"relevance_score": 0.22, "relevance_valid": False},
            )
        ],
        total_retrieved=1,
    )

    assert has_sufficient_retrieval_context(context, "Reset MFA for my company account") is False


def test_hallucination_prevention_rejects_no_retrieval():
    context = RetrievedContext(chunks=[], search_results=[], total_retrieved=0)
    assert has_sufficient_retrieval_context(context, "Reset MFA for my company account") is False


def test_hallucination_prevention_rejects_irrelevant_chunks():
    context = RetrievedContext(
        chunks=[DocumentChunk(chunk_id="irrelevant", text="Office cafeteria schedule and employee announcements.", metadata={})],
        search_results=[
            VectorSearchResult(
                chunk=DocumentChunk(chunk_id="irrelevant", text="Office cafeteria schedule and employee announcements.", metadata={}),
                similarity_score=0.54,
                rank=1,
                metadata={"relevance_score": 0.18, "relevance_valid": False},
            )
        ],
        total_retrieved=1,
    )

    assert has_sufficient_retrieval_context(context, "Printer not connecting to WiFi") is False
