import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import get_settings

async def clear_db():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.database_name]
    
    await db["knowledge_documents"].delete_many({})
    await db["document_chunks"].delete_many({})
    
    print("Database cleared!")

if __name__ == "__main__":
    asyncio.run(clear_db())
