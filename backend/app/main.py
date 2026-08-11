from contextlib import asynccontextmanager
import logging

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
    
    # Seed demo data
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3})(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
