"""Email delivery helpers for auth flows."""

from __future__ import annotations

import asyncio
import inspect
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import httpx
import msal

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


class PasswordResetEmailService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._graph_client: msal.ConfidentialClientApplication | None = None
        self._graph_access_token: str | None = None
        self._graph_token_expires_at: float = 0.0

    def is_graph_mode(self) -> bool:
        return self.settings.email_provider.lower() == "graph"

    def _get_graph_client(self) -> msal.ConfidentialClientApplication | None:
        if self._graph_client is not None:
            return self._graph_client

        if not self.settings.graph_tenant_id or not self.settings.graph_client_id or not self.settings.graph_client_secret:
            logger.warning("Microsoft Graph credentials are incomplete; password reset email will not be sent.")
            return None

        authority = f"https://login.microsoftonline.com/{self.settings.graph_tenant_id}"
        self._graph_client = msal.ConfidentialClientApplication(
            client_id=self.settings.graph_client_id,
            client_credential=self.settings.graph_client_secret,
            authority=authority,
        )
        return self._graph_client

    def _get_access_token(self) -> str | None:
        client = self._get_graph_client()
        if client is None:
            return None

        if self._graph_access_token and time.time() < self._graph_token_expires_at - 60:
            return self._graph_access_token

        scopes = ["https://graph.microsoft.com/.default"]
        token_result: dict[str, Any] | None = None

        try:
            token_result = client.acquire_token_silent(scopes, account=None)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.debug("Silent Graph token acquisition failed: %s", exc)

        if not token_result:
            token_result = client.acquire_token_for_client(scopes=scopes)

        if not token_result or "access_token" not in token_result:
            error_description = token_result.get("error_description") if token_result else None
            logger.error("Unable to acquire Microsoft Graph access token: %s", error_description or "unknown error")
            return None

        self._graph_access_token = token_result["access_token"]
        expires_in = int(token_result.get("expires_in", 3600))
        self._graph_token_expires_at = time.time() + expires_in
        return self._graph_access_token

    async def _send_graph_mail(self, *, recipient_email: str, subject: str, body_text: str, body_html: str) -> bool:
        if not self.settings.graph_mailbox:
            logger.warning("GRAPH_MAILBOX is not configured; password reset email will not be sent.")
            return False

        access_token = self._get_access_token()
        if not access_token:
            return False

        payload = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": body_html,
                },
                "toRecipients": [
                    {"emailAddress": {"address": recipient_email}},
                ],
            },
            "saveToSentItems": "false",
        }
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        url = f"https://graph.microsoft.com/v1.0/users/{self.settings.graph_mailbox}/sendMail"

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code >= 400:
                logger.error(
                    "Microsoft Graph email send failed for %s using mailbox %s: status=%s body=%s",
                    recipient_email,
                    self.settings.graph_mailbox,
                    response.status_code,
                    response.text,
                )
                if response.status_code == 404:
                    logger.error(
                        "The configured GRAPH_MAILBOX could not be resolved by Microsoft Graph. Verify that it is a valid mailbox/userPrincipalName in the tenant and that the app has Mail.Send permission for it."
                    )
                return False

            return True

    def _run_coroutine(self, coroutine: Any) -> Any:
        try:
            return asyncio.run(coroutine)
        except RuntimeError:
            with ThreadPoolExecutor(max_workers=1) as executor:
                return executor.submit(asyncio.run, coroutine).result()

    def send_password_reset_email(self, *, recipient_email: str, recipient_name: str, reset_link: str) -> bool:
        if not self.is_graph_mode():
            logger.info("Preview password reset link for %s: %s", recipient_email, reset_link)
            return False

        subject = "Reset your ITSM Helpdesk password"
        body_text = (
            f"Hello {recipient_name or 'there'},\n\n"
            f"Use this link to reset your password:\n{reset_link}\n\n"
            "This link expires soon and can only be used once.\n"
        )
        body_html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
            <p>Hello {recipient_name or 'there'},</p>
            <p>Use the button below to reset your password.</p>
            <p>
              <a href="{reset_link}" style="display:inline-block;padding:12px 18px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;">
                Reset password
              </a>
            </p>
            <p>If the button does not work, copy and paste this link into your browser:</p>
            <p><a href="{reset_link}">{reset_link}</a></p>
            <p>This link expires soon and can only be used once.</p>
          </body>
        </html>
        """

        try:
            result = self._send_graph_mail(
                recipient_email=recipient_email,
                subject=subject,
                body_text=body_text,
                body_html=body_html,
            )
            if inspect.isawaitable(result):
                result = self._run_coroutine(result)
        except httpx.HTTPError as exc:
            logger.exception("Failed to send password reset email to %s", recipient_email)
            return False

        if result:
            logger.info("Password reset email sent to %s", recipient_email)
            return True

        logger.warning("Password reset email was not sent to %s", recipient_email)
        return False
