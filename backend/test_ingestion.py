import asyncio
from pathlib import Path
from datetime import datetime
import json
from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import get_settings
from app.services.embedding_service import EmbeddingService
from app.rag.document_loader import FileDocumentLoader
from app.rag.text_extractor import TextExtractorRegistry, TXTTextExtractor

async def test_ingestion():
    print("=== Step 1: Initialize settings ===")
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.database_name]
    print(f"Connected to MongoDB database: {settings.database_name}")
    
    print("\n=== Step 2: Test document loader ===")
    test_file = Path("test_document.txt")
    loader = FileDocumentLoader()
    loaded_doc = loader.load(test_file)
    print("Document loaded successfully!")
    print(f"   File name: {loaded_doc.metadata.file_name}")
    print(f"   File size: {loaded_doc.metadata.file_size} bytes")
    
    print("\n=== Step 3: Test text extraction ===")
    registry = TextExtractorRegistry()
    registry.register_extractor(TXTTextExtractor())
    extractor = registry.get_extractor(loaded_doc)
    if extractor is None:
        print("No text extractor found")
        return
    extracted = extractor.extract(loaded_doc)
    print("Text extracted successfully!")
    print(f"   Extracted text length: {len(extracted.text)}")
    print(f"   Extracted text snippet: {repr(extracted.text[:100])}")
    
    print("\n=== Step 4: Initialize Embedding Service ===")
    service = EmbeddingService(db)
    print("Embedding service initialized successfully!")
    print(f"   Chunk size: {service.chunk_size}")
    print(f"   Chunk overlap: {service.chunk_overlap}")
    
    print("\n=== Step 5: Create test database entry ===")
    test_doc_id = await db["knowledge_documents"].count_documents({}) + 1
    class DocObj:
        id = test_doc_id
    db_doc = {
        "_id": test_doc_id,
        "title": "Test Document",
        "filename": "test_document.txt",
        "file_type": ".txt",
        "category": "Test",
        "tags": ["test"],
        "uploaded_by": "system",
        "uploaded_at": datetime.utcnow().isoformat(),
        "status": "processing",
        "file_path": str(test_file),
        "file_size": test_file.stat().st_size,
    }
    await db["knowledge_documents"].insert_one(db_doc)
    print("Test database entry created!")
    print(f"   Document ID: {test_doc_id}")
    
    print("\n=== Step 6: Index document ===")
    chunks = await service.index_document(DocObj(), test_file)
    print("Document indexed!")
    print(f"   Number of chunks: {len(chunks)}")
    for i, chunk in enumerate(chunks, 1):
        print(f"   Chunk {i}: {len(chunk.text)} characters, embedding length: {len(chunk.embedding)}")
    
    print("\n=== Step 7: Save FAISS index ===")
    service.save_index()
    print("FAISS index saved!")
    
    print("\n=== Step 8: Check database for chunks ===")
    chunk_count = await db["document_chunks"].count_documents({"document_id": test_doc_id})
    print(f"Chunks in database: {chunk_count}")
    
    print("\n=== Step 9: Update document status to processed ===")
    await db["knowledge_documents"].update_one(
        {"_id": test_doc_id},
        {"$set": {"status": "processed"}}
    )
    print("Document status updated!")
    
    print("\n=== Ingestion test PASSED! ===")

if __name__ == "__main__":
    asyncio.run(test_ingestion())
