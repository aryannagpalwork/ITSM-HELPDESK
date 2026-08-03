---
title: Automated Password Reset Workflow (Copilot)
department: IT
category: User Access
version: 1.0
author: IT Support Team
created: 2026-07-15
tags: password reset, forgot password, reset token, copilot, self-service
---

# Automated Password Reset Workflow (Copilot)

## Overview
The ITSM Helpdesk Copilot can handle password reset requests directly through conversation. This automated workflow replaces the need to manually search the knowledge base or create a support ticket for routine password resets.

The Copilot supports two flows:

1. **Forgot Password Flow** — When a user reports they have forgotten their password
2. **Reset Password Flow** — When a user has received a reset token and needs to set a new password

## Forgot Password Flow

### Trigger Phrases
Users may express this intent with phrases such as:
- "I forgot my password"
- "I cannot login because I forgot my password"
- "I need to reset my password"
- "Forgot password"
- "Cannot login"

### Steps
1. User says they forgot their password.
2. Copilot asks for the user's registered email address.
3. Copilot calls the `POST /auth/forgot-password` endpoint with the provided email.
4. A secure reset token is generated and returned (in production this would be emailed).
5. Copilot informs the user that a reset link/token has been sent and asks them to check their email.
6. Copilot asks if they have received the reset token/link.

## Reset Password Flow

### Trigger Phrases
Users may express this intent with phrases such as:
- "I received my reset token"
- "I have my reset link"
- "I have the token"
- "reset token"
- "I want to change my password"

### Steps
1. User indicates they have a reset token or link.
2. Copilot asks for the email address, the reset token, and the new password.
3. Copilot calls the `POST /auth/reset-password` endpoint with the email, token, and new password.
4. On success, Copilot confirms the password has been reset and instructs the user to log in with their new password.
5. On failure (invalid/expired token), Copilot informs the user and offers to generate a new token or create a support ticket.

## Error Handling

| Scenario | Copilot Response |
|---|---|
| Email not found | Inform user the email was not found and ask them to verify |
| Invalid/expired token | Offer to generate a new reset token or create a support ticket |
| Token reuse attempt | Token is single-use; inform user they need a new token |
| New password too weak | Inform user the password must be at least 8 characters |

## Ticket Escalation
If the user reports that the automated password reset failed or the token is repeatedly invalid/expired, the Copilot will recommend creating a support ticket. Normal password-reset conversations that complete successfully do **not** generate a support ticket.

## API Endpoints Used
- `POST /auth/forgot-password` — Generates a password reset token for the given email
- `POST /auth/reset-password` — Validates the token and updates the user's password

## Security Notes
- The reset token is cryptographically secure and single-use.
- Tokens expire after 15 minutes (configurable via `RESET_TOKEN_EXPIRE_MINUTES`).
- The system does not reveal whether an email exists in the database (prevents enumeration).

