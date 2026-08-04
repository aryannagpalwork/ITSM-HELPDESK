from app.services.email_service import PasswordResetEmailService


def test_send_password_reset_email_uses_graph_transport(monkeypatch):
    service = PasswordResetEmailService()
    service.settings.email_provider = "graph"
    service.settings.graph_mailbox = "sender@contoso.com"

    async def fake_send_graph_mail(*, recipient_email, subject, body_text, body_html):
        assert recipient_email == "user@example.com"
        assert subject == "Reset your ITSM Helpdesk password"
        assert "user@example.com" not in body_text
        return True

    monkeypatch.setattr(service, "_send_graph_mail", fake_send_graph_mail)

    assert service.send_password_reset_email(
        recipient_email="user@example.com",
        recipient_name="Test User",
        reset_link="https://example.test/reset",
    ) is True
