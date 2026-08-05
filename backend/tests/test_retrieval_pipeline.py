import pytest

from app.rag.retriever import (
    QueryNormalizer,
    expand_query_variants,
    normalize_query,
    rank_hybrid_results,
    validate_relevance,
)


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
