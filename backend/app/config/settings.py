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
    gemini_api_key: str = Field(default="")
    gemini_model: str = Field(default="gemini-2.5-flash")
    openai_api_key: str = Field(default="")
    llm_provider: str = Field(default="gemini")
    chat_model: str = Field(default="gemini-2.5-flash")
    embedding_provider: str = Field(default="gemini")
    embedding_model: str = Field(default="text-embedding-004")
    email_provider: str = Field(default="graph")
    graph_tenant_id: str = Field(default="")
    graph_client_id: str = Field(default="")
    graph_client_secret: str = Field(default="")
    graph_mailbox: str = Field(default="")
    alert_ticket_threshold: int = Field(default=5)
    alert_window_minutes: int = Field(default=60)


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
        "http://[::1]:3000",
        "http://[::1]:4173",
        "http://[::1]:5173",
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
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        llm_provider=os.getenv("LLM_PROVIDER", "gemini"),
        chat_model=os.getenv("CHAT_MODEL", "gemini-2.5-flash"),
        embedding_provider=os.getenv("EMBEDDING_PROVIDER", "gemini"),
        embedding_model=os.getenv("EMBEDDING_MODEL", "text-embedding-004"),
        email_provider=os.getenv("EMAIL_PROVIDER", "graph"),
        graph_tenant_id=os.getenv("GRAPH_TENANT_ID", ""),
        graph_client_id=os.getenv("GRAPH_CLIENT_ID", ""),
        graph_client_secret=os.getenv("GRAPH_CLIENT_SECRET", ""),
        graph_mailbox=os.getenv("GRAPH_MAILBOX", ""),
        alert_ticket_threshold=int(os.getenv("ALERT_TICKET_THRESHOLD", "5")),
        alert_window_minutes=int(os.getenv("ALERT_WINDOW_MINUTES", "60")),
    )
