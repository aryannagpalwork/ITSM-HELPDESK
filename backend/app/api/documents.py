
import hashlib
import os
from pathlib import Path
from typing import Annotated
from uuid import uuid4
import json
from datetime import datetime
from fastapi import APIRouter, Depends, File, HTTPException, Query, status, UploadFile, Form
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.api.deps import DatabaseSession
from app.auth.dependencies import get_current_user, require_roles
from app.schemas.knowledge_document import (
    KnowledgeDocumentRead,
    SearchRequest,
    SearchResponse,
    SearchResultItem,
    SearchResultChunk,
)
from app.config.settings import get_settings
from app.services.search_service import SearchService
from app.auth.dependencies import require_roles
from app.auth.dependencies import require_roles
from app.auth.dependencies import require_roles
from app.services.embedding_service import EmbeddingService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

settings = get_settings()
UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}


def get_file_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return "PDF"
    elif ext == ".docx":
        return "DOCX"
    elif ext == ".txt":
        return "TXT"
    elif ext == ".md":
        return "Markdown"
    return "Unknown"


@router.get("", response_model=list[KnowledgeDocumentRead])
async def list_documents(
    db: DatabaseSession,
    search: Annotated[str | None, Query(description="Search term for title")] = None,
    category: Annotated[str | None, Query(description="Filter by category")] = None,
    current_user: dict = Depends(get_current_user),
) -> list[KnowledgeDocumentRead]:
    query = {"status": {"$ne": "deleted"}}
    if search:
        query["title"] = {"$regex": search, "$options": "i"}
    if category:
        query["category"] = category
    docs = await db["knowledge_documents"].find(query).sort("uploaded_at", -1).to_list(length=None)
    result = []
    for doc in docs:
        doc["id"] = doc["_id"]
        result.append(doc)
    return result


@router.get("/{document_id}", response_model=KnowledgeDocumentRead)
async def get_document(
    document_id: int,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
) -> KnowledgeDocumentRead:
    doc = await db["knowledge_documents"].find_one({"_id": document_id})
    if not doc or doc.get("status") == "deleted":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    doc["id"] = doc["_id"]
    return doc


@router.post("/upload", response_model=KnowledgeDocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_document(
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Administrator", "Agent"])),
    file: UploadFile = File(...),
    title: str | None = Form(None),
    category: str | None = Form(None),
    tags: str | None = Form(None),  # Comma-separated tags
) -> KnowledgeDocumentRead:
    # Validate extension
    filename = file.filename or f"unknown_{uuid4()}"
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {ext}. Supported types: {', '.join(SUPPORTED_EXTENSIONS)}"
        )

    # Save file
    saved_filename = f"{uuid4()}_{filename}"
    file_path = UPLOAD_DIR / saved_filename
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    file_size = os.path.getsize(file_path)

    # Parse tags
    tag_list = []
    if tags:
        tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()]

    # Create DB record
    doc_id = await db["knowledge_documents"].count_documents({}) + 1
    doc_title = title or Path(filename).stem
    now = datetime.utcnow().isoformat()

    db_doc = {
        "_id": doc_id,
        "title": doc_title,
        "filename": filename,
        "file_type": get_file_type(filename),
        "category": category,
        "tags": tag_list,
        "uploaded_by": current_user.get("full_name") or current_user.get("email"),
        "uploaded_at": now,
        "status": "processing",
        "file_path": str(saved_filename),
        "file_size": file_size,
        "created_at": now,
        "updated_at": now,
    }
    await db["knowledge_documents"].insert_one(db_doc)
    db_doc["id"] = db_doc["_id"]

    # Process and index
    try:
        # Compatibility object with .id
        class DocObj:
            id = doc_id

        embedding_service = EmbeddingService(db=db)
        await embedding_service.index_document(DocObj(), file_path)
        embedding_service.save_index()
        # Update status to processed
        await db["knowledge_documents"].update_one(
            {"_id": doc_id},
            {"$set": {"status": "processed", "updated_at": datetime.utcnow().isoformat()}}
        )
        db_doc["status"] = "processed"
    except Exception as e:
        logger.error(f"Error processing document {doc_id}: {e}")
        await db["knowledge_documents"].update_one(
            {"_id": doc_id},
            {"$set": {"status": "error", "updated_at": datetime.utcnow().isoformat()}}
        )
        db_doc["status"] = "error"

    return db_doc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Administrator"])),
) -> None:
    doc = await db["knowledge_documents"].find_one({"_id": document_id})
    if not doc or doc.get("status") == "deleted":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    # Delete file
    file_location = UPLOAD_DIR / doc["file_path"]
    if file_location.exists():
        file_location.unlink()

    # Delete from index and DB
    embedding_service = EmbeddingService(db=db)
    await embedding_service.delete_document(document_id)
    embedding_service.save_index()

    await db["knowledge_documents"].update_one(
        {"_id": document_id},
        {"$set": {"status": "deleted", "updated_at": datetime.utcnow().isoformat()}}
    )


@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
) -> FileResponse:
    doc = await db["knowledge_documents"].find_one({"_id": document_id})
    if not doc or doc.get("status") == "deleted":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    file_path = UPLOAD_DIR / doc["file_path"]
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    return FileResponse(
        path=file_path,
        filename=doc["filename"],
        media_type=f"application/{doc['file_type'].lower()}" if doc['file_type'].lower() in ['pdf', 'docx'] else "text/plain",
    )


@router.get("/{document_id}/preview")
async def preview_document(
    document_id: int,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
) -> FileResponse:
    return await download_document(document_id, db, current_user)


@router.post("/search", response_model=SearchResponse)
async def semantic_search(
    request: SearchRequest,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
) -> SearchResponse:
    search_service = SearchService(db=db)
    retrieved_context = search_service.search(
        query=request.query,
        top_k=request.top_k,
        similarity_threshold=request.similarity_threshold,
    )

    results: list[SearchResultItem] = []
    for search_result in retrieved_context.search_results:
        chunk = search_result.chunk
        results.append(
            SearchResultItem(
                chunk=SearchResultChunk(
                    chunk_id=chunk.chunk_id,
                    text=chunk.text,
                    chunk_text=chunk.chunk_text,
                    page_number=chunk.page_number,
                    heading=chunk.heading,
                    section=chunk.section,
                    chunk_number=chunk.chunk_number,
                    start_index=chunk.start_index,
                    end_index=chunk.end_index,
                    document_id=chunk.document_id,
                    metadata=chunk.metadata.additional_metadata if chunk.metadata else {},
                ),
                similarity_score=search_result.similarity_score,
                rank=search_result.rank,
                metadata=search_result.metadata,
            )
        )

    return SearchResponse(
        query=request.query,
        total_retrieved=retrieved_context.total_retrieved,
        results=results,
        metadata=retrieved_context.metadata,
    )

