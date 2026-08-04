from datetime import datetime

from app.auth.security import hash_password
from app.schemas.user import UserStatus
from motor.motor_asyncio import AsyncIOMotorDatabase

DEMO_PASSWORD = "Password@123"


async def seed_demo_data(db: AsyncIOMotorDatabase) -> None:
    """Seed only the development users; tickets are created through the API."""
    removed_demo_ticket_ids = [
        "4fef17cf-e98e-48ec-9c70-7b3c5a3c3c01",
        "244e3992-130c-46ce-bb11-5c23e178c415",
        "b104f18a-6136-44e9-a863-53186ddc0391",
        "cfb93bc6-423d-42e4-9aa7-2f0efe570350",
    ]
    # Remove only the historical demo records introduced by the old seed.
    # User-created tickets and all runtime ticket behavior are untouched.
    await db.ticket_comments.delete_many({"ticket_id": {"$in": removed_demo_ticket_ids}})
    await db.tickets.delete_many({"_id": {"$in": removed_demo_ticket_ids}})

    demo_users = [
        {
            "_id": "USR001",
            "full_name": "Alex Mercer",
            "email": "employee@enterprise.com",
            "role": "end_user",
            "department": "Engineering",
            "hashed_password": hash_password(DEMO_PASSWORD),
            "is_active": True,
            "status": UserStatus.ACTIVE.value,
            "created_by": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "last_login": None,
            "invitation_token": None,
            "invitation_expiry": None,
            "email_verified": True,
            "first_login_completed": True,
            "deleted": False,
        },
        {
            "_id": "USR002",
            "full_name": "Sarah Jenkins",
            "email": "agent@enterprise.com",
            "role": "agent",
            "department": "Information Technology",
            "specialization": ["IT Infrastructure", "Network", "Infrastructure"],
            "availability": "Available",
            "max_capacity": 10,
            "active_ticket_count": 0,
            "total_assigned": 0,
            "total_resolved": 0,
            "hashed_password": hash_password(DEMO_PASSWORD),
            "is_active": True,
            "status": UserStatus.ACTIVE.value,
            "created_by": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "last_login": None,
            "invitation_token": None,
            "invitation_expiry": None,
            "email_verified": True,
            "first_login_completed": True,
            "deleted": False,
        },
        {
            "_id": "USR003",
            "full_name": "Marcus Vance",
            "email": "admin@enterprise.com",
            "role": "admin",
            "department": "Information Technology",
            "specialization": "IT Infrastructure",
            "hashed_password": hash_password(DEMO_PASSWORD),
            "is_active": True,
            "status": UserStatus.ACTIVE.value,
            "created_by": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "last_login": None,
            "invitation_token": None,
            "invitation_expiry": None,
            "email_verified": True,
            "first_login_completed": True,
            "deleted": False,
        },
    ]

    for user_data in demo_users:
        existing = await db.users.find_one({"_id": user_data["_id"]})
        if not existing:
            existing = await db.users.find_one({"email": user_data["email"]})

        if existing:
            await db.users.update_one(
                {"_id": existing["_id"]},
                {"$set": user_data},
            )
        else:
            await db.users.insert_one(user_data)
