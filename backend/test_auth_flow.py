import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.api.auth import _build_token_response
from app.auth.security import create_token
from app.config.settings import get_settings
from app.database.mongodb import get_database
from app.database.seed import seed_demo_data
import asyncio
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("test_auth")

async def test_flow():
    settings = get_settings()
    db = get_database()
    
    logger.debug("Seeding demo data...")
    await seed_demo_data(db)
    
    logger.debug("Getting demo admin user...")
    admin_user = await db.users.find_one({"email": "admin@enterprise.com"})
    logger.debug(f"Admin user found: {admin_user}")
    
    logger.debug("Creating access token...")
    access_token = create_token(
        subject=admin_user["_id"],
        role=admin_user["role"],
        token_type="access",
        expires_delta=settings.access_token_expire_minutes,
    )
    logger.debug(f"Generated access token: {access_token}")
    
    return {"access_token": access_token, "user": admin_user}


if __name__ == "__main__":
    asyncio.run(test_flow())
