from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.config.logging import configure_logging
from app.config.settings import get_settings
from app.database.mongodb import (
    close_connection,
    ensure_indexes,
    get_database,
    normalize_ticket_statuses,
    reconcile_agent_workloads,
)
from app.database.seed import seed_demo_data
from app.services.anomaly_scheduler import start_scheduler, stop_scheduler
from app.services.sla import load_sla_config_from_db

settings = get_settings()
configure_logging(settings)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s", settings.app_name)

    db = get_database()
    try:
        await ensure_indexes(db)
        await seed_demo_data(db)
        await normalize_ticket_statuses(db)
        await reconcile_agent_workloads(db)
        await load_sla_config_from_db(db)
        logger.info("Demo data seeded successfully")
    except Exception as e:
        logger.error("Error seeding demo data: %s", e, exc_info=True)

    start_scheduler()
    yield
    stop_scheduler()
    await close_connection()
    logger.info("Stopping %s", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
)


# ---------------------------------------------------------
# CORS CONFIGURATION
# ---------------------------------------------------------

# Start with origins configured in your application settings
cors_origins = list(settings.cors_origins or [])

# Add production frontend URL from Render environment variable
frontend_url = os.getenv("itsm-six.vercel.app")

if frontend_url:
    frontend_url = frontend_url.rstrip("/")
    if frontend_url not in cors_origins:
        cors_origins.append(frontend_url)

# Local development origins
local_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

for origin in local_origins:
    if origin not in cors_origins:
        cors_origins.append(origin)


logger.info("CORS allowed origins: %s", cors_origins)


app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=(
        r"https?://"
        r"(localhost|127\.0\.0\.1|\[::1\]|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"10\.\d{1,3}\.\d{1,3})"
        r"(:\d+)?$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(api_router)