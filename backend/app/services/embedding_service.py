
"""Service for managing embeddings and vector storage."""

from pathlib import Path
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.settings import get_settings
from app.rag.embedding_provider import (
    EmbeddingProvider,
    EmbeddingProviderFactory,
)
from app.rag.vector_store import (
    VectorStore,
    VectorStoreFactory,
    VectorSearchResult,
    VectorStoreStats,
)
from app.rag.chunker import DocumentChunk, RecursiveCharacterTextSplitter
from app.rag.document_parser import DocumentParser
from app.rag.text_extractor import TextExtractorRegistry
from app.rag.text_extractor import (
    PDFTextExtractor,
    DOCXTextExtractor,
    TXTTextExtractor,
    MarkdownTextExtractor,
)
from app.rag.chunker import RecursiveCharacterTextSplitter
import json
import logging

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for managing document embeddings and vector index."""
    
    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        embedding_provider: Optional[EmbeddingProvider] = None,
        vector_store: Optional[VectorStore] = None,
        storage_path: Optional[Path] = None,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ):
        self.db = db
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        settings = get_settings()
        
        # Initialize storage path
        self.storage_path = storage_path or Path(__file__).parent.parent.parent / "vector_store"
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        # Initialize embedding provider
        self.embedding_provider = embedding_provider or EmbeddingProviderFactory.create(settings.embedding_provider)
        
        # Initialize vector store
        dimension = self.embedding_provider.get_embedding_dimension()
        self.vector_store = vector_store or VectorStoreFactory.create(
            "faiss",
            dimension=dimension,
            storage_path=self.storage_path,
        )
        
        # Initialize text extractor registry
        self.text_extractor_registry = TextExtractorRegistry()
        self.text_extractor_registry.register_extractor(PDFTextExtractor())
        self.text_extractor_registry.register_extractor(DOCXTextExtractor())
        self.text_extractor_registry.register_extractor(TXTTextExtractor())
        self.text_extractor_registry.register_extractor(MarkdownTextExtractor())
        
        # Initialize chunker
        self.chunker = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
        )
        
        # Initialize index
        self.initialize_index()
    
    def initialize_index(self) -> None:
        """Initialize or load the vector index."""
        try:
            self.vector_store.load()
        except Exception:
            self.vector_store.initialize()
    
    async def index_document(self, db_doc, file_path: Path) -> List[DocumentChunk]:
        """Index a single document.
        
        Args:
            db_doc: Object with an id attribute
            file_path: Path to the document file
            
        Returns:
            List of processed document chunks
        """
        # Load document
        from app.rag.document_loader import FileDocumentLoader
        loader = FileDocumentLoader()
        logger.info("Knowledge-base parser selection: document_id=%s extension=%s", db_doc.id, file_path.suffix.lower())
        loaded_doc = loader.load(file_path)

        # Get text extractor
        text_extractor = self.text_extractor_registry.get_extractor(loaded_doc)
        if not text_extractor:
            raise ValueError(f"Unsupported document type: {file_path.suffix}")
        logger.info(
            "Knowledge-base parser selected: document_id=%s parser=%s",
            db_doc.id,
            type(text_extractor).__name__,
        )

        # Keep document metadata available to every persisted chunk.
        loaded_doc.metadata.category = getattr(db_doc, "category", None)
        loaded_doc.metadata.tags = list(getattr(db_doc, "tags", []) or [])
        loaded_doc.metadata.additional_metadata.update({
            "document_id": db_doc.id,
            "filename": getattr(db_doc, "filename", loaded_doc.metadata.file_name),
            "title": getattr(db_doc, "title", loaded_doc.metadata.file_name),
            "category": getattr(db_doc, "category", None),
            "uploaded_by": getattr(db_doc, "uploaded_by", None),
            "created_at": getattr(db_doc, "uploaded_at", None),
            "processing_status": "processing",
        })

        # Extract text
        extracted_text = text_extractor.extract(loaded_doc)
        extracted_length = len(extracted_text.text.strip())
        logger.info(
            "Knowledge-base text extracted: document_id=%s characters=%d",
            db_doc.id,
            extracted_length,
        )
        if extracted_length == 0:
            raise ValueError("Document text extraction returned no readable text")
        
        # Chunk document
        chunks = self.chunker.chunk_extracted(extracted_text, loaded_doc.metadata)
        logger.info("Knowledge-base chunks generated: document_id=%s count=%d", db_doc.id, len(chunks))
        if not chunks:
            raise ValueError("Document text could not be split into chunks")

        # Set document ID on chunks
        for chunk in chunks:
            chunk.document_id = db_doc.id

        # Generate embeddings
        texts = [chunk.text for chunk in chunks]
        if any(not text.strip() for text in texts):
            raise ValueError("Document contains an empty chunk")
        batch_embeddings = self.embedding_provider.embed_batch(texts)
        embedding_count = len(batch_embeddings.embeddings)
        logger.info(
            "Knowledge-base embeddings generated: document_id=%s count=%d",
            db_doc.id,
            embedding_count,
        )
        if embedding_count != len(chunks) or any(not embedding for embedding in batch_embeddings.embeddings):
            raise ValueError(
                f"Embedding count mismatch: chunks={len(chunks)}, embeddings={embedding_count}"
            )

        # Assign embeddings to chunks
        for i, chunk in enumerate(chunks):
            chunk.embedding = batch_embeddings.embeddings[i]
            chunk.chunk_text = chunk.text
        
        # Save to database
        await self._save_chunks_to_db(db_doc.id, chunks)
        
        # Add to vector store
        self.vector_store.add_chunks(chunks)
        logger.info(
            "Knowledge-base vectors inserted: document_id=%s count=%d",
            db_doc.id,
            len(chunks),
        )
        
        return chunks
    
    async def update_document(self, db_doc, file_path: Path) -> List[DocumentChunk]:
        """Re-index an existing document.
        
        Args:
            db_doc: Object with an id attribute
            file_path: Path to the document file
            
        Returns:
            List of processed document chunks
        """
        # Delete old chunks
        await self.delete_document(db_doc.id)
        
        # Index new version
        return await self.index_document(db_doc, file_path)
    
    async def delete_document(self, document_id: int) -> None:
        """Delete a document from the index and database.
        
        Args:
            document_id: Database ID of the document to delete
        """
        # Delete from vector store
        self.vector_store.delete_document(document_id)
        
        # Delete from database
        await self.db["document_chunks"].delete_many({"document_id": document_id})
    
    async def clear_index(self) -> None:
        """Clear all documents from the index."""
        self.vector_store.clear()
        await self.db["document_chunks"].delete_many({})
    
    def search(
        self,
        query: str,
        top_k: int = 5,
        document_id: Optional[int] = None,
    ) -> List[VectorSearchResult]:
        """Search for relevant chunks.
        
        Args:
            query: Query string to search
            top_k: Number of results to return
            document_id: Optional filter to search only within a specific document
            
        Returns:
            List of search results
        """
        # Generate query embedding
        query_embedding = self.embedding_provider.embed(query).embedding
        
        # Apply filter if document ID is provided
        filter_metadata = {"document_id": document_id} if document_id else None
        
        # Search
        results = self.vector_store.search(
            query_embedding=query_embedding,
            top_k=top_k,
            filter_metadata=filter_metadata,
        )
        
        return results
    
    def save_index(self, path: Optional[Path] = None) -> None:
        """Save the vector index to disk."""
        self.vector_store.save(path)
    
    def get_stats(self) -> VectorStoreStats:
        """Get statistics about the vector store."""
        return self.vector_store.get_stats()
    
    async def _save_chunks_to_db(self, document_id: int, chunks: List[DocumentChunk]) -> None:
        """Save processed chunks to the database."""
        # Delete existing chunks for this document
        await self.db["document_chunks"].delete_many({"document_id": document_id})
        
        # Add new chunks
        docs_to_insert = []
        for chunk in chunks:
            db_chunk = {
                "_id": chunk.chunk_id,
                "chunk_id": chunk.chunk_id,
                "document_id": document_id,
                "page_number": chunk.page_number,
                "heading": chunk.heading,
                "section": chunk.section,
                "chunk_number": chunk.chunk_number,
                "chunk_text": chunk.chunk_text,
                "text": chunk.text,
                "start_index": chunk.start_index,
                "end_index": chunk.end_index,
                "metadata_json": json.dumps(chunk.metadata.additional_metadata) if chunk.metadata.additional_metadata else None,
                "embedding_json": json.dumps(chunk.embedding) if chunk.embedding else None,
            }
            docs_to_insert.append(db_chunk)
        
        if docs_to_insert:
            await self.db["document_chunks"].insert_many(docs_to_insert)
            logger.info(
                "Knowledge-base chunks persisted: document_id=%s count=%d",
                document_id,
                len(docs_to_insert),
            )
        else:
            raise ValueError(f"No chunks generated for document {document_id}")
