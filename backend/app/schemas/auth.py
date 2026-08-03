from pydantic import BaseModel

from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    role: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead


class LogoutResponse(BaseModel):
    detail: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ForgotPasswordResponse(BaseModel):
    detail: str
    reset_token: str | None = None


class ResetPasswordRequest(BaseModel):
    email: str
    token: str
    new_password: str


class ResetPasswordResponse(BaseModel):
    detail: str
