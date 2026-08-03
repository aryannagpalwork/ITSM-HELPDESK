import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import get_settings

async def check_db():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.database_name]
    
    print("=== Knowledge Documents ===")
    docs = await db["knowledge_documents"].find().to_list(length=None)
    for doc in docs:
        print(f"  ID: {doc['_id']}")
        print(f"  Title: {doc['title']}")
        print(f"  Status: {doc['status']}")
        print(f"  File path: {doc.get('file_path')}")
        print()
        
    print("=== Document Chunks ===")
    chunks = await db["document_chunks"].find().to_list(length=None)
    for chunk in chunks:
        print(f"  Chunk ID: {chunk['_id']}")
        print(f"  Document ID: {chunk['document_id']}")
        print(f"  Text: {repr(chunk['text'][:100])}")
        print(f"  Has embedding: {'embedding_json' in chunk}")
        print()

if __name__ == "__main__":
    asyncio.run(check_db())
