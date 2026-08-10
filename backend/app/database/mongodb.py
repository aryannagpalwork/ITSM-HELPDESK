from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config.settings import get_settings
from pymongo import ASCENDING, IndexModel

settings = get_settings()

# Global client instance
_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongodb_uri)
    return _client


def get_database() -> AsyncIOMotorDatabase:
    global _db
    if _db is None:
        _db = get_client()[settings.database_name]
    return _db


async def close_connection() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
        _db = None


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create operational indexes idempotently for the existing collections."""
    # Backfill only agent profile fields; admin and employee documents remain
    # untouched because every migration filter includes role=agent.
    agent_defaults = {
        "availability": "Available", "max_capacity": 10,
        "active_ticket_count": 0, "total_assigned": 0, "total_resolved": 0,
        "last_assigned_at": None, "specialization": [],
    }
    for field, value in agent_defaults.items():
        await db.users.update_many(
            {"role": "agent", field: {"$exists": False}}, {"$set": {field: value}}
        )
    # Preserve populated profiles, but make legacy department-only agents
    # eligible for routing using a conservative department-derived skill.
    legacy_agents = await db.users.find({
        "role": "agent", "$or": [
            {"specialization": {"$exists": False}}, {"specialization": None}, {"specialization": []}
        ]
    }, {"_id": 1, "department": 1}).to_list(length=None)
    for agent in legacy_agents:
        department = (agent.get("department") or "").strip()
        if not department:
            continue
        normalized = department.lower()
        skills = [department]
        if "network" in normalized:
            skills.extend(["Network", "Networking"])
        elif "infrastructure" in normalized:
            skills.extend(["Infrastructure", "Hardware"])
        await db.users.update_one({"_id": agent["_id"], "role": "agent"}, {"$set": {"specialization": list(dict.fromkeys(skills))}})
    await db.users.create_indexes([
        # Compound index supports the eligible-agent lookup and sorting.
        IndexModel(
            [("role", ASCENDING), ("specialization", ASCENDING),
             ("availability", ASCENDING), ("active_ticket_count", ASCENDING),
             ("last_assigned_at", ASCENDING)]
        ),
        IndexModel([("role", ASCENDING)]),
        IndexModel([("specialization", ASCENDING)]),
        IndexModel([("availability", ASCENDING)]),
    ])
    await db.tickets.create_indexes([
        IndexModel([("assigned_to", ASCENDING)]),
        IndexModel([("status", ASCENDING)]),
        IndexModel([("category", ASCENDING)]),
        IndexModel([("assigned_to", ASCENDING), ("status", ASCENDING)]),
    ])
    await db.alerts.create_indexes([
        IndexModel([("status", ASCENDING)]),
    ])
    await db.notifications.create_indexes([
        IndexModel([("user_id", ASCENDING), ("read", ASCENDING)]),
    ])
    await db.ticket_feedback.create_indexes([
        IndexModel([("ticket_id", ASCENDING)], unique=True),
    ])


async def reconcile_agent_workloads(db: AsyncIOMotorDatabase) -> None:
    """Repair counters from source-of-truth tickets after deploys/upgrades."""
    pipeline = [
        {"$match": {"assigned_to": {"$ne": None}}},
        {"$group": {
            "_id": "$assigned_to",
            "assigned": {"$sum": 1},
            "active": {"$sum": {"$cond": [{"$in": ["$status", ["Open", "In Progress", "Awaiting User Response"]]}, 1, 0]}},
            "resolved": {"$sum": {"$cond": [{"$in": ["$status", ["Resolved", "Closed"]]}, 1, 0]}},
        }},
    ]
    counts = {row["_id"]: row async for row in db.tickets.aggregate(pipeline)}
    agents = await db.users.find({"role": "agent"}, {"_id": 1}).to_list(length=None)
    for agent in agents:
        row = counts.get(agent["_id"], {})
        await db.users.update_one({"_id": agent["_id"], "role": "agent"}, {"$set": {
            "active_ticket_count": row.get("active", 0),
            "total_assigned": row.get("assigned", 0),
            "total_resolved": row.get("resolved", 0),
        }})
