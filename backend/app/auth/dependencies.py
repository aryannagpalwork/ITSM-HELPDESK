from collections.abc import Iterable
from typing import Annotated
import logging

from fastapi import Depends, HTTPException, status, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth.security import decode_token

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(
    scheme_name="Bearer",
    description="Enter JWT token",
    auto_error=False
)

# Role mappings for consistent use
INTERNAL_TO_FRONTEND = {
    "end_user": "Employee",
    "agent": "Agent",
    "admin": "Administrator"
}
FRONTEND_TO_INTERNAL = {v: k for k, v in INTERNAL_TO_FRONTEND.items()}

# Lazy import of get_database to avoid circular import issues
def _get_db() -> AsyncIOMotorDatabase:
    from app.database.mongodb import get_database
    return get_database()


from app.schemas.user import UserStatus

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer_scheme)],
    db: Annotated[AsyncIOMotorDatabase, Depends(_get_db)]
) -> dict:
    logger.debug(f"get_current_user: Step1 - Received credentials: {credentials}")
    if credentials is None:
        logger.warning("get_current_user: No credentials found in request")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.debug(f"get_current_user: Step2 - Creds scheme: {credentials.scheme}, token: {credentials.credentials[:20]}...")

    try:
        payload = decode_token(credentials.credentials)
        logger.debug(f"get_current_user: Step3 - Decoded payload: {payload}")
    except Exception as exc:
        logger.error(f"get_current_user: Failed to decode token - {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if payload.get("type") != "access":
        logger.error(f"get_current_user: Token type {payload.get('type')} is not 'access'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    jwt_role = payload.get("role")
    logger.debug(f"get_current_user: Step4 - Looking up user with id: {user_id}, JWT role claim: {jwt_role}")
    user = await db.users.find_one({"_id": user_id, "deleted": {"$ne": True}})
    logger.debug(f"get_current_user: Step5 - User found in DB: {user}")

    if user is None:
        logger.error("get_current_user: User not found in DB")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is inactive, disabled, or missing.")
    
    if not user.get("is_active"):
        logger.error("get_current_user: User is inactive (is_active=False)")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is inactive, disabled, or missing.")
    
    if user.get("status") == UserStatus.DISABLED.value:
        logger.error("get_current_user: User status is DISABLED")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is inactive, disabled, or missing.")
    
    # Block PENDING and REJECTED users — they have not been approved yet
    if user.get("status") == UserStatus.PENDING.value:
        logger.error("get_current_user: User status is PENDING")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account pending admin approval.")
    if user.get("status") == UserStatus.REJECTED.value:
        logger.error("get_current_user: User status is REJECTED")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account registration was rejected.")
    
    # Map user
    mapped_user = user.copy()
    mapped_user["id"] = mapped_user["_id"]
    mapped_user["internal_role"] = mapped_user["role"]
    mapped_user["role"] = INTERNAL_TO_FRONTEND.get(mapped_user["role"], mapped_user["role"])
    logger.debug(f"get_current_user: Step6 - Returning mapped user. "
                 f"DB role='{user.get('role')}', internal_role='{mapped_user.get('internal_role')}', "
                 f"frontend_role='{mapped_user.get('role')}'")
    
    return mapped_user


def require_roles(allowed_roles: Iterable[str]):
    logger.debug(f"require_roles: Allowed roles list: {allowed_roles}")
    allowed_internal = set()
    for role in allowed_roles:
        if role in FRONTEND_TO_INTERNAL:
            allowed_internal.add(FRONTEND_TO_INTERNAL[role])
        else:
            allowed_internal.add(role)
    
    logger.debug(f"require_roles: Allowed internal roles: {allowed_internal}")

    async def dependency(current_user: Annotated[dict, Depends(get_current_user)]) -> dict:
        logger.debug(f"require_roles: Checking role - current internal role: {current_user.get('internal_role')}")
        if current_user.get("internal_role") not in allowed_internal:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role privileges.",
            )
        logger.debug("require_roles: Role check passed")
        return current_user

    return dependency
