from app.services.tickets import (
    classify_duplicate_match,
    normalize_ticket_text,
    ticket_similarity_score,
)


def test_normalize_ticket_text_removes_noise_and_standardizes_spacing():
    text = "  VPN Login  -  Office Laptop   cannot   connect!!!  "
    normalized = normalize_ticket_text(text)

    assert normalized == "vpn login office laptop cannot connect"


def test_exact_duplicate_has_full_match_score():
    score = ticket_similarity_score(
        "Cannot access VPN from laptop",
        "Cannot access VPN from laptop",
    )

    assert score == 1.0


def test_same_issue_with_different_words_is_possible_duplicate():
    score = ticket_similarity_score(
        "Laptop cannot connect to the company VPN",
        "My workstation cannot log in to the corporate virtual private network",
    )

    assert score > 0.6
    assert classify_duplicate_match(score, "title", "desc") == "possible"


def test_unrelated_issue_is_not_flagged_as_duplicate():
    score = ticket_similarity_score(
        "Password reset for user account",
        "New monitor is flickering on my desk",
    )

    assert score < 0.45
    assert classify_duplicate_match(score, "title", "desc") == "none"
