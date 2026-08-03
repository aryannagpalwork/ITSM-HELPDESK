from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.config.logging import configure_logging
from app.config.settings import get_settings
from app.database.mongodb import get_database, close_connection, ensure_indexes, reconcile_agent_workloads
from app.database.seed import seed_demo_data

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
        await reconcile_agent_workloads(db)
        logger.info("Demo data seeded successfully")
    except Exception as e:
        logger.error("Error seeding demo data: %s", e, exc_info=True)
    
    yield
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
