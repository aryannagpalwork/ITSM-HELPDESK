import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import get_settings

async def update_status():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.database_name]
    
    result = await db["knowledge_documents"].update_one(
        {"_id": 1},
        {"$set": {"status": "processed"}}
    )
    print(f"Modified {result.modified_count} documents!")

if __name__ == "__main__":
    asyncio.run(update_status())
