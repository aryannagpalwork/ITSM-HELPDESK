from app.api.chat import (
    _is_positive_response,
    _is_negative_response,
    _should_offer_ticket,
    _should_prompt_satisfaction,
)
from app.rag.prompt_builder import ChatMessage, MessageRole
from app.services.llm.openai_service import _build_conversation_summary


def test_positive_response_detection():
    assert _is_positive_response("That fixed it") is True
    assert _is_positive_response("Working now") is True
    assert _is_positive_response("Perfect") is True


def test_negative_response_detection():
    assert _is_negative_response("Still not working") is True
    assert _is_negative_response("Issue persists") is True
    assert _is_negative_response("Didn't help") is True


def test_ticket_offer_only_after_three_failures():
    assert _should_offer_ticket(0) is False
    assert _should_offer_ticket(2) is False
    assert _should_offer_ticket(3) is True


def test_satisfaction_prompt_only_after_positive_resolution():
    assert _should_prompt_satisfaction("Resolved") is True
    assert _should_prompt_satisfaction("Still not working") is False


def test_conversation_summary_includes_requester_and_copilot_context():
    summary = _build_conversation_summary([
        ChatMessage(role=MessageRole.USER, content="I cannot authenticate to the office Wi-Fi."),
        ChatMessage(role=MessageRole.ASSISTANT, content="I asked the user to forget the network and re-enter credentials."),
    ])

    assert "User reported: I cannot authenticate to the office Wi-Fi." in summary
    assert "AI Copilot response: I asked the user to forget the network" in summary
