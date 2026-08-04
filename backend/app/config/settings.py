from functools import lru_cache
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


class Settings(BaseModel):
    app_name: str = Field(default="Enterprise ITSM Helpdesk AI Copilot API")
    app_version: str = Field(default="0.1.0")
    environment: str = Field(default="development")
    debug: bool = Field(default=False)
    mongodb_uri: str = Field(default="mongodb://localhost:27017")
    database_name: str = Field(default="itsm_helpdesk")
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    log_level: str = Field(default="INFO")
    reset_token_expire_minutes: int = Field(default=15)
    jwt_secret_key: str = Field(default="change-me-in-local-env")
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=30)
    refresh_token_expire_days: int = Field(default=7)
    openai_api_key: str = Field(default="")
    llm_provider: str = Field(default="openai")
    chat_model: str = Field(default="gpt-5.5")
    embedding_provider: str = Field(default="openai")
    embedding_model: str = Field(default="text-embedding-3-small")


def _get_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def _get_list(name: str, default: list[str]) -> list[str]:
    value = os.getenv(name)
    if value is None:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    default_cors_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    configured_cors_origins = _get_list("CORS_ORIGINS", default_cors_origins)
    return Settings(
        app_name=os.getenv("APP_NAME", "Enterprise ITSM Helpdesk AI Copilot API"),
        app_version=os.getenv("APP_VERSION", "0.1.0"),
        environment=os.getenv("ENVIRONMENT", "development"),
        debug=_get_bool("DEBUG", False),
        mongodb_uri=os.getenv("MONGODB_URI", "mongodb://localhost:27017"),
        database_name=os.getenv("DATABASE_NAME", "itsm_helpdesk"),
        # Always include local development ports even if an old .env file has
        # a stale or malformed CORS_ORIGINS value.
        cors_origins=list(dict.fromkeys(configured_cors_origins + default_cors_origins)),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
        reset_token_expire_minutes=int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", 15)),
        jwt_secret_key=os.getenv("JWT_SECRET_KEY", "change-me-in-local-env"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        access_token_expire_minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30)),
        refresh_token_expire_days=int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 7)),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        llm_provider="openai",
        chat_model=os.getenv("OPENAI_CHAT_MODEL", "gpt-5.5"),
        embedding_provider=os.getenv("EMBEDDING_PROVIDER", "openai"),
        embedding_model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
    )
