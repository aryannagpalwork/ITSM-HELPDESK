import json
import logging
from datetime import timedelta, datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import DatabaseSession
from app.auth.security import create_token, decode_token, verify_password, hash_password
from app.auth.dependencies import require_roles
from app.auth.dependencies import get_current_user
from app.config.settings import get_settings
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LogoutResponse,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
    TokenResponse,
)
from app.schemas.user import UserStatus
from app.auth.dependencies import FRONTEND_TO_INTERNAL
from app.services.email_service import PasswordResetEmailService
from app.services.password_reset import PasswordResetService
from app.auth.security import verify_password, hash_password
from app.schemas.auth import ChangePasswordRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def _build_token_response(user: dict) -> TokenResponse:
    settings = get_settings()
    access_delta = timedelta(minutes=settings.access_token_expire_minutes)
    refresh_delta = timedelta(days=settings.refresh_token_expire_days)
    
    # Map internal roles to frontend roles expected by the frontend
    from app.auth.dependencies import INTERNAL_TO_FRONTEND
    role_mapping = INTERNAL_TO_FRONTEND
    
    # Prepare user dict for UserRead
    mapped_user = {
        "id": user["_id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role": role_mapping.get(user["role"], user["role"]),
        "department": user.get("department"),
        "is_active": user["is_active"],
        "status": user.get("status", UserStatus.ACTIVE.value),
        "created_by": user.get("created_by"),
        "created_at": user["created_at"],
        "updated_at": user.get("updated_at"),
        "last_login": user.get("last_login"),
        "invitation_token": user.get("invitation_token"),
        "invitation_expiry": user.get("invitation_expiry"),
        "email_verified": user.get("email_verified", False),
        "first_login_completed": user.get("first_login_completed", False),
        "deleted": user.get("deleted", False),
    }
    
    return TokenResponse(
        access_token=create_token(
            subject=user["_id"],
            role=user["role"],
            token_type="access",
            expires_delta=access_delta,
        ),
        refresh_token=create_token(
            subject=user["_id"],
            role=user["role"],
            token_type="refresh",
            expires_delta=refresh_delta,
        ),
        expires_in=int(access_delta.total_seconds()),
        user=mapped_user,
    )


@router.post("/register", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(["admin"]))])
async def register(payload: RegisterRequest, db: DatabaseSession) -> dict:
    # Normalize inputs
    email = payload.email.lower().strip()
    full_name = payload.full_name.strip()
    role = payload.role.strip()
    
    # Check if email already exists
    existing_user = await db.users.find_one({"email": email, "deleted": {"$ne": True}})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered.",
        )
    
    # Map role to internal role
    internal_role = FRONTEND_TO_INTERNAL.get(role, role.lower())
    
    # Hash password
    hashed_password = hash_password(payload.password)
    
    # Create user with PENDING status — requires admin approval before login
    now = datetime.utcnow()
    user_id = str(uuid4())
    new_user = {
        "_id": user_id,
        "email": email,
        "full_name": full_name,
        "role": internal_role,
        "hashed_password": hashed_password,
        "department": None,
        "status": UserStatus.PENDING.value,
        "is_active": False,
        "created_by": None,
        "created_at": now,
        "updated_at": now,
        "last_login": None,
        "invitation_token": None,
        "invitation_expiry": None,
        "email_verified": False,
        "first_login_completed": True,
        "deleted": False,
    }
    
    await db.users.insert_one(new_user)
    
    return {"detail": "Account created successfully. Please wait for admin approval."}


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: DatabaseSession) -> TokenResponse:
    user = await db.users.find_one({"email": payload.email.lower().strip(), "deleted": {"$ne": True}})
    if user is None or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    # Check user status for approval workflow
    user_status = user.get("status")
    if user_status == UserStatus.PENDING.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account pending admin approval.")
    if user_status == UserStatus.REJECTED.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account registration was rejected.")
    if not user.get("is_active") or user_status == UserStatus.DISABLED.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive or disabled.")
    
    # Update last_login
    now = datetime.utcnow()
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": now.isoformat(), "updated_at": now}}
    )
    user["last_login"] = now.isoformat()
    user["updated_at"] = now
    
    return _build_token_response(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(payload: RefreshTokenRequest, db: DatabaseSession) -> TokenResponse:
    try:
        claims = decode_token(payload.refresh_token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.") from exc

    if claims.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token required.")

    user = await db.users.find_one({"_id": claims.get("sub"), "deleted": {"$ne": True}})
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is inactive, disabled, or missing.")
    
    user_status = user.get("status")
    if user_status == UserStatus.PENDING.value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account pending admin approval.")
    if user_status == UserStatus.REJECTED.value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account registration was rejected.")
    if not user.get("is_active") or user_status == UserStatus.DISABLED.value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is inactive, disabled, or missing.")
    return _build_token_response(user)


@router.post("/logout", response_model=LogoutResponse)
async def logout() -> LogoutResponse:
    return LogoutResponse(detail="Logged out successfully.")


async def _write_audit_log(
    db: AsyncIOMotorDatabase,
    *,
    action: str,
    user_id: str | None,
    entity_id: str | None,
    metadata: dict | None = None,
) -> None:
    """Write an audit log entry to the database."""
    audit_log = {
        "_id": str(uuid4()),
        "user_id": user_id,
        "action": action,
        "entity_type": "user",
        "entity_id": entity_id,
        "metadata_json": json.dumps(metadata) if metadata else None,
        "reason": None,
        "created_at": datetime.utcnow(),
    }
    await db.audit_logs.insert_one(audit_log)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: DatabaseSession,
) -> ForgotPasswordResponse:
    """Request a password reset token.

    Always returns a generic success response to prevent user enumeration.
    If the email exists, a reset token is generated and stored. The raw token
    is returned in the response for development/testing purposes. In production,
    this token should be delivered via email.
    """
    service = PasswordResetService(db)
    raw_token = await service.generate_reset_token(payload.email.strip().lower())

    # Always return the same generic response
    detail = (
        "If an account with that email exists, a password reset link has been "
        "generated. Please check your email for further instructions."
    )

    if raw_token:
        logger.info("Password reset token generated for email: %s", payload.email)
        email_service = PasswordResetEmailService()
        reset_link = f"http://localhost:3000/#/reset-password?token={raw_token}&email={payload.email.strip().lower()}"
        email_service.send_password_reset_email(
            recipient_email=payload.email.strip().lower(),
            recipient_name=payload.email.strip().lower(),
            reset_link=reset_link,
        )
    else:
        logger.info(
            "Password reset requested for non-existent email: %s", payload.email
        )

    reset_link = None
    settings = get_settings()
    if raw_token and settings.email_provider.lower() != "graph":
        reset_link = f"http://localhost:3000/#/reset-password?token={raw_token}&email={payload.email.strip().lower()}"

    return ForgotPasswordResponse(
        detail=detail,
        reset_token=raw_token,
        reset_link=reset_link,
    )


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    payload: ResetPasswordRequest,
    db: DatabaseSession,
) -> ResetPasswordResponse:
    """Reset a user's password using a valid reset token.

    Validates the token and expiry, hashes the new password, updates the user's
    password, and invalidates the token (single-use). The token is cleared
    regardless of success to prevent replay attacks.
    """
    email = payload.email.strip().lower()
    token = payload.token.strip()
    new_password = payload.new_password

    # Password validation
    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long.",
        )

    service = PasswordResetService(db)
    success = await service.reset_password(email, token, new_password)

    if not success:
        # Attempt to clean up potentially stale token to prevent accumulation
        try:
            await db.users.update_one(
                {"email": email, "deleted": {"$ne": True}},
                {
                    "$unset": {
                        "reset_token_hash": "",
                        "reset_token_expiry": "",
                    }
                },
            )
        except Exception:
            pass

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token. Please request a new password reset.",
        )

    # Audit log
    user = await db.users.find_one({"email": email, "deleted": {"$ne": True}})
    if user:
        await _write_audit_log(
            db,
            action="password.reset",
            user_id=user["_id"],
            entity_id=user["_id"],
            metadata={"email": email},
        )

    return ResetPasswordResponse(
        detail="Password has been reset successfully. You can now log in with your new password."
    )


@router.post("/change-password", response_model=ResetPasswordResponse)
async def change_password(
    payload: ChangePasswordRequest,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
) -> ResetPasswordResponse:
    """Change the authenticated user's password.

    Expects current_password and new_password (with confirmation).
    """
    # Validate new password
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New passwords do not match.")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters long.")

    # Load user from DB to check current password
    user = await db.users.find_one({"_id": current_user["id"], "deleted": {"$ne": True}})
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if not verify_password(payload.current_password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")

    new_hashed = hash_password(payload.new_password)
    now = datetime.utcnow()
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"hashed_password": new_hashed, "updated_at": now}})

    return ResetPasswordResponse(detail="Password changed successfully.")
