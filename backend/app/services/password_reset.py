"""Password Reset Service.

Provides cryptographically secure password reset token generation, validation,
and password reset functionality. Uses SHA-256 for hashing reset tokens (separate
from bcrypt which is reserved for user passwords).

The raw reset token is returned by generate_reset_token() so it can be used
for development/testing or plugged into an email service later without changing
the business logic.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth.security import hash_password as hash_user_password
from app.config.settings import get_settings

logger = logging.getLogger(__name__)


def _hash_token(token: str) -> str:
    """Hash a reset token using SHA-256.

    We use SHA-256 (not bcrypt) for token hashing to keep bcrypt exclusively
    for user password hashing.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class PasswordResetService:
    """Service for handling password reset flows.

    The raw token is returned from generate_reset_token() so it can be
    delivered to the user via email or other channels as a future integration.
    """

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def generate_reset_token(self, email: str) -> Optional[str]:
        """Generate a cryptographically secure password reset token for the given email.

        This method always executes the same logic regardless of whether the email
        exists, to prevent user enumeration attacks. If the email does not exist,
        the token is generated and discarded (never stored).

        Args:
            email: The email address to generate a reset token for.

        Returns:
            The raw reset token if the email exists, or None if the email does not exist.
            The raw token should be delivered to the user via email.
        """
        settings = get_settings()
        token = secrets.token_urlsafe(32)
        token_hash = _hash_token(token)
        now = datetime.utcnow()
        expiry = now + timedelta(minutes=settings.reset_token_expire_minutes)

        # Always perform the same lookup to avoid timing differences
        user = await self.db.users.find_one(
            {"email": email, "deleted": {"$ne": True}}
        )

        if user is None:
            logger.info("Password reset requested for non-existent email: %s", email)
            return None

        # Hash and store the token
        await self.db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "reset_token_hash": token_hash,
                    "reset_token_expiry": expiry.isoformat(),
                    "updated_at": now,
                }
            },
        )

        logger.info(
            "Password reset token generated for user %s (expires: %s)",
            user["_id"],
            expiry.isoformat(),
        )
        return token

    async def validate_reset_token(self, email: str, token: str) -> bool:
        """Validate a password reset token.

        Args:
            email: The email address associated with the token.
            token: The raw reset token to validate.

        Returns:
            True if the token is valid and not expired, False otherwise.
        """
        user = await self.db.users.find_one(
            {"email": email, "deleted": {"$ne": True}}
        )

        if user is None:
            return False

        stored_hash = user.get("reset_token_hash")
        expiry_str = user.get("reset_token_expiry")

        if not stored_hash or not expiry_str:
            return False

        # Check expiry
        try:
            expiry = datetime.fromisoformat(expiry_str)
            if datetime.utcnow() > expiry:
                logger.info("Expired reset token attempted for user %s", user["_id"])
                return False
        except (ValueError, TypeError):
            logger.warning("Invalid reset_token_expiry format for user %s", user["_id"])
            return False

        # Verify token hash
        token_hash = _hash_token(token)
        if not secrets.compare_digest(token_hash, stored_hash):
            return False

        return True

    async def reset_password(
        self, email: str, token: str, new_password: str
    ) -> bool:
        """Reset a user's password after validating the reset token.

        This method validates the token, hashes the new password using the same
        password hashing used throughout the application, updates the user's
        password, and clears the reset token fields (making the token single-use).

        Args:
            email: The email address of the user.
            token: The raw reset token.
            new_password: The new password to set.

        Returns:
            True if the password was successfully reset, False if the token
            is invalid or expired.
        """
        # Validate token first
        if not await self.validate_reset_token(email, token):
            return False

        user = await self.db.users.find_one(
            {"email": email, "deleted": {"$ne": True}}
        )
        if user is None:
            return False

        now = datetime.utcnow()
        new_hashed_password = hash_user_password(new_password)

        # Update password and clear reset token fields (single-use invalidation)
        await self.db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "hashed_password": new_hashed_password,
                    "updated_at": now,
                },
                "$unset": {
                    "reset_token_hash": "",
                    "reset_token_expiry": "",
                },
            },
        )

        logger.info(
            "Password successfully reset for user %s", user["_id"]
        )
        return True

