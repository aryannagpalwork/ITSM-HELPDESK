from fastapi import APIRouter

from app.api.deps import DatabaseSession

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_check(db: DatabaseSession) -> dict[str, str]:
    try:
        await db.command("ping")
        return {"status": "ok", "database": "connected", "server": "running"}
    except Exception:
        # Keep health useful when the API process is alive but MongoDB is not.
        return {"status": "degraded", "database": "disconnected", "server": "running"}
