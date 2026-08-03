from datetime import datetime

from app.auth.security import hash_password
from app.schemas.user import UserStatus
from motor.motor_asyncio import AsyncIOMotorDatabase

DEMO_PASSWORD = "Password@123"


async def seed_demo_data(db: AsyncIOMotorDatabase) -> None:
    """Seed demo data into the database. Idempotent - won't create duplicates."""
    # Define demo users with all new fields
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
            "created_by": None,  # demo user, no creator
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

    # Create or update users
    for user_data in demo_users:
        existing = await db.users.find_one({"_id": user_data["_id"]})
        if not existing:
            existing = await db.users.find_one({"email": user_data["email"]})
        
        if existing:
            # Update existing user
            await db.users.update_one(
                {"_id": existing["_id"]},
                {"$set": user_data}
            )
        else:
            # Insert new user
            await db.users.insert_one(user_data)

    # Define demo tickets
    demo_tickets = [
        {
            "_id": "4fef17cf-e98e-48ec-9c70-7b3c5a3c3c01",
            "ticket_number": "INC-2026-000412",
            "title": "VPN connection drops periodically every 30 minutes",
            "description": "My GlobalProtect VPN connection terminates automatically every 30 minutes. It requires me to re-authenticate and complete Okta MFA each time, which interrupts my active database sessions and ssh connections. I am running macOS Sonoma on an M3 MacBook Pro.",
            "category": "Network",
            "priority": "High",
            "status": "Open",
            "assigned_to": "USR002",
            "created_by": "USR001",
            "ai_summary": "User experiencing recurring disconnection issues on GlobalProtect VPN every 30 minutes, necessitating constant Okta re-authentication. Active SSH sessions disrupted.",
            "resolution": "Verify if the Okta token lifetime policy for GlobalProtect is set to 30 minutes instead of the standard 8 hours. Check Palo Alto gateway logs for idle-timeout parameters or keep-alive packet blocks.",
            "created_at": datetime.fromisoformat("2026-06-29T14:22:00"),
            "updated_at": datetime.fromisoformat("2026-06-30T09:15:00"),
            "comments": []
        },
        {
            "_id": "244e3992-130c-46ce-bb11-5c23e178c415",
            "ticket_number": "INC-2026-000415",
            "title": "Staging environment database connection timed out",
            "description": "All services in the staging Kubernetes cluster are receiving connection timeouts when trying to write to the staging PostgreSQL database. The database is hosted in AWS RDS, and we verified that the database instance is healthy and running.",
            "category": "Database",
            "priority": "Critical",
            "status": "In Progress",
            "assigned_to": "USR002",
            "created_by": "USR001",
            "ai_summary": "Critical database connection timeout issue affecting Kubernetes staging microservices connecting to AWS RDS Postgres. DB instance itself is reporting healthy status.",
            "resolution": "Investigate VPC security group settings. Check if a recent network security update removed the CIDR block permission of the Kubernetes node subnet from the RDS inbound rule list.",
            "created_at": datetime.fromisoformat("2026-06-30T08:45:00"),
            "updated_at": datetime.fromisoformat("2026-06-30T10:00:00"),
            "comments": []
        },
        {
            "_id": "b104f18a-6136-44e9-a863-53186ddc0391",
            "ticket_number": "INC-2026-000391",
            "title": "Okta MFA device synchronization error",
            "description": "I replaced my mobile phone yesterday and restored from backup. Now, when I try to log in to Okta, the push notification says 'Invalid token' or does not arrive. I need to reset my MFA device enrollment.",
            "category": "Authentication",
            "priority": "Medium",
            "status": "Resolved",
            "assigned_to": "USR002",
            "created_by": "USR001",
            "ai_summary": "Okta Multi-Factor Authentication push failure triggered by phone upgrade and backup restore. Device token mismatch.",
            "resolution": "Temporarily bypassed MFA using an administrator security bypass code, deleted the user's stale phone token in the Okta Admin dashboard, and sent a fresh QR enrollment link.",
            "created_at": datetime.fromisoformat("2026-06-25T11:10:00"),
            "updated_at": datetime.fromisoformat("2026-06-26T15:30:00"),
            "comments": []
        },
        {
            "_id": "cfb93bc6-423d-42e4-9aa7-2f0efe570350",
            "ticket_number": "INC-2026-000350",
            "title": "Request for secondary 27 inch Dell Monitor",
            "description": "I need a secondary monitor for my home office setup to increase productivity when doing code reviews. My department lead has already approved the budget.",
            "category": "Procurement",
            "priority": "Low",
            "status": "Closed",
            "assigned_to": "USR003",
            "created_by": "USR001",
            "ai_summary": "Standard peripheral request for an additional 27 inch Dell Monitor. Budget approved by manager.",
            "resolution": "Procurement order placed. Shipped via FedEx tracking number: FDX-994110. Delivered on June 22, 2026.",
            "created_at": datetime.fromisoformat("2026-06-18T10:00:00"),
            "updated_at": datetime.fromisoformat("2026-06-22T16:00:00"),
            "comments": []
        },
    ]

    # Create or update tickets
    for ticket_data in demo_tickets:
        existing_ticket = await db.tickets.find_one({"_id": ticket_data["_id"]})
        if not existing_ticket:
            await db.tickets.insert_one(ticket_data)
    
    # Add comments
    demo_comments = [
        {
            "_id": "44d4a88e-8d47-437f-a27f-565611a9c001",
            "ticket_id": "4fef17cf-e98e-48ec-9c70-7b3c5a3c3c01",
            "author_id": "USR002",
            "content": "Hi Alex, I checked the firewall and Okta logs. I do see a disconnect event every exactly 30 minutes. Are you using a wired dock connection or pure Wi-Fi?",
            "is_internal": False,
            "created_at": datetime.fromisoformat("2026-06-29T16:40:00"),
        },
        {
            "_id": "44d4a88e-8d47-437f-a27f-565611a9c002",
            "ticket_id": "4fef17cf-e98e-48ec-9c70-7b3c5a3c3c01",
            "author_id": "USR001",
            "content": "Hi Sarah, I am using the CalDigit TS4 Thunderbolt dock over a wired ethernet connection. I checked and the same drops occur even when connected directly over Wi-Fi.",
            "is_internal": False,
            "created_at": datetime.fromisoformat("2026-06-29T17:12:00"),
        },
        {
            "_id": "44d4a88e-8d47-437f-a27f-565611a9c003",
            "ticket_id": "4fef17cf-e98e-48ec-9c70-7b3c5a3c3c01",
            "author_id": "USR002",
            "content": "Internal Note: Checked the Palo Alto Gateway settings. The GlobalProtect user portal session timeout parameter is set to 1800 seconds for users assigned to the engineering security group.",
            "is_internal": True,
            "created_at": datetime.fromisoformat("2026-06-30T09:15:00"),
        },
        {
            "_id": "44d4a88e-8d47-437f-a27f-565611a9c004",
            "ticket_id": "244e3992-130c-46ce-bb11-5c23e178c415",
            "author_id": "USR002",
            "content": "Urgent update: The security group rule change was verified. Terraform apply had run at 08:30 UTC which modified RDS ingress rules. I am restoring the inbound permission now.",
            "is_internal": False,
            "created_at": datetime.fromisoformat("2026-06-30T09:55:00"),
        },
        {
            "_id": "44d4a88e-8d47-437f-a27f-565611a9c005",
            "ticket_id": "244e3992-130c-46ce-bb11-5c23e178c415",
            "author_id": "USR001",
            "content": "Verified. Staging databases are responding again, and the k8s pods have successfully completed their connection pool health checks. Thank you!",
            "is_internal": False,
            "created_at": datetime.fromisoformat("2026-06-30T10:00:00"),
        },
    ]

    for comment_data in demo_comments:
        existing = await db.ticket_comments.find_one({"_id": comment_data["_id"]})
        if not existing:
            await db.ticket_comments.insert_one(comment_data)
            await db.tickets.update_one(
                {"_id": comment_data["ticket_id"]},
                {"$push": {"comments": comment_data["_id"]}}
            )
