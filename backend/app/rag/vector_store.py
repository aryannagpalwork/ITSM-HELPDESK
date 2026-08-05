"""Vector store interface for RAG pipeline."""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional
from pathlib import Path
from datetime import datetime
import pickle
import numpy as np

from app.rag.chunker import DocumentChunk

logger = logging.getLogger(__name__)


@dataclass
class VectorSearchResult:
    """Result of a vector similarity search."""
    chunk: DocumentChunk
    similarity_score: float
    rank: int
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class VectorStoreStats:
    """Statistics about the vector store."""
    total_chunks: int
    total_documents: int
    embedding_dimension: int
    last_updated: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


class VectorStore(ABC):
    """Abstract base class for vector stores."""
    
    @abstractmethod
    def initialize(self) -> None:
        """Initialize the vector store."""
        pass
    
    @abstractmethod
    def add_chunk(self, chunk: DocumentChunk) -> None:
        """Add a single chunk to the vector store."""
        pass
    
    @abstractmethod
    def add_chunks(self, chunks: list[DocumentChunk]) -> None:
        """Add multiple chunks to the vector store in batch."""
        pass
    
    @abstractmethod
    def search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        filter_metadata: Optional[dict[str, Any]] = None,
    ) -> list[VectorSearchResult]:
        """Search for similar chunks using a query embedding."""
        pass
    
    @abstractmethod
    def get_chunk(self, chunk_id: str) -> Optional[DocumentChunk]:
        """Get a chunk by its ID."""
        pass
    
    @abstractmethod
    def delete_chunk(self, chunk_id: str) -> None:
        """Delete a chunk from the vector store."""
        pass
    
    @abstractmethod
    def delete_document(self, document_id: int) -> None:
        """Delete all chunks belonging to a document."""
        pass
    
    @abstractmethod
    def clear(self) -> None:
        """Clear all chunks from the vector store."""
        pass
    
    @abstractmethod
    def get_stats(self) -> VectorStoreStats:
        """Get statistics about the vector store."""
        pass
    
    @abstractmethod
    def save(self, path: Optional[Path] = None) -> None:
        """Save the vector store to disk."""
        pass
    
    @abstractmethod
    def load(self, path: Optional[Path] = None) -> None:
        """Load the vector store from disk."""
        pass


class VectorStoreError(Exception):
    """Exception raised when vector store operations fail."""
    pass


class FAISSVectorStore(VectorStore):
    """FAISS-based vector store implementation."""
    
    def __init__(self, dimension: int, storage_path: Path):
        self.dimension = dimension
        self.storage_path = storage_path
        self._index = None
        self._chunks: dict[str, DocumentChunk] = {}
        self._id_to_index: dict[str, int] = {}
        self._index_to_id: dict[int, str] = {}
        self._doc_to_chunk_ids: dict[int, list[str]] = {}
        self._last_updated: Optional[datetime] = None
    
    def initialize(self) -> None:
        """Initialize the FAISS index."""
        try:
            import faiss
            self._index = faiss.IndexFlatL2(self.dimension)
            self._chunks = {}
            self._id_to_index = {}
            self._index_to_id = {}
            self._doc_to_chunk_ids = {}
        except ImportError:
            raise VectorStoreError("FAISS is not installed. Install with 'pip install faiss-cpu'")
        except Exception as e:
            raise VectorStoreError(f"Failed to initialize FAISS index: {str(e)}") from e
    
    def add_chunk(self, chunk: DocumentChunk) -> None:
        """Add a single chunk to the vector store."""
        if chunk.embedding is None:
            raise VectorStoreError("Chunk must have an embedding")
        self.add_chunks([chunk])
    
    def add_chunks(self, chunks: list[DocumentChunk]) -> None:
        """Add multiple chunks to the vector store in batch."""
        if not chunks:
            return
        
        embeddings = []
        chunk_ids = []
        
        for chunk in chunks:
            if chunk.embedding is None:
                raise VectorStoreError(f"Chunk {chunk.chunk_id} has no embedding")
            
            embeddings.append(chunk.embedding)
            chunk_ids.append(chunk.chunk_id)
            
            # Store chunk data
            self._chunks[chunk.chunk_id] = chunk
            
            # Map document to chunk IDs
            if chunk.document_id is not None:
                if chunk.document_id not in self._doc_to_chunk_ids:
                    self._doc_to_chunk_ids[chunk.document_id] = []
                self._doc_to_chunk_ids[chunk.document_id].append(chunk.chunk_id)
        
        # Add vectors to FAISS
        if self._index is None:
            self.initialize()
        
        import faiss
        vectors = np.array(embeddings).astype('float32')
        
        # Normalize vectors for cosine similarity
        faiss.normalize_L2(vectors)
        
        # Add to index
        start_idx = self._index.ntotal
        self._index.add(vectors)
        
        # Update ID mappings
        for i, chunk_id in enumerate(chunk_ids):
            idx = start_idx + i
            self._id_to_index[chunk_id] = idx
            self._index_to_id[idx] = chunk_id
        
        self._last_updated = datetime.utcnow()
    
    def search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        filter_metadata: Optional[dict[str, Any]] = None,
    ) -> list[VectorSearchResult]:
        """Search for similar chunks using a query embedding."""
        if self._index is None or self._index.ntotal == 0:
            return []
        
        import faiss
        
        # Prepare query
        query_vec = np.array([query_embedding]).astype('float32')
        if query_vec.shape[1] != self._index.d:
            raise VectorStoreError(
                "Embedding dimension mismatch: "
                f"query={query_vec.shape[1]}, index={self._index.d}. "
                "Re-index the knowledge base with the configured embedding model."
            )
        faiss.normalize_L2(query_vec)
        
        # Calculate how many results to retrieve (adjust for filter)
        search_k = min(top_k * 2, self._index.ntotal)
        if search_k == 0:
            return []
        
        # Search
        distances, indices = self._index.search(query_vec, search_k)
        
        # Process results
        results = []
        for i in range(len(indices[0])):
            idx = indices[0][i]
            if idx == -1:
                continue
            
            chunk_id = self._index_to_id.get(idx)
            if chunk_id is None or chunk_id not in self._chunks:
                continue
            
            chunk = self._chunks[chunk_id]
            
            # Apply metadata filter if provided
            if filter_metadata:
                match = True
                for key, value in filter_metadata.items():
                    if hasattr(chunk, key) and getattr(chunk, key) != value:
                        match = False
                        break
                    if chunk.metadata and key in chunk.metadata and chunk.metadata[key] != value:
                        match = False
                        break
                if not match:
                    continue
            
            # Convert L2 distance to similarity
            # For normalized vectors, L2 distance squared = 2 - 2*cosine
            # So cosine similarity = 1 - (distance²)/2
            similarity = 1 - (distances[0][i] ** 2) / 2
            
            results.append(VectorSearchResult(
                chunk=chunk,
                similarity_score=float(similarity),
                rank=len(results) + 1,
            ))
            
            if len(results) >= top_k:
                break
        
        return results
    
    def get_chunk(self, chunk_id: str) -> Optional[DocumentChunk]:
        """Get a chunk by its ID."""
        return self._chunks.get(chunk_id)
    
    def delete_chunk(self, chunk_id: str) -> None:
        """Delete a chunk from the vector store."""
        if chunk_id not in self._chunks:
            return
        
        # Get the index
        idx = self._id_to_index.get(chunk_id)
        if idx is None:
            return
        
        # Remove chunk from data structures
        del self._chunks[chunk_id]
        del self._id_to_index[chunk_id]
        
        # Remove from document mapping
        chunk = self._chunks.get(chunk_id)
        if chunk and chunk.document_id in self._doc_to_chunk_ids:
            self._doc_to_chunk_ids[chunk.document_id].remove(chunk_id)
            if not self._doc_to_chunk_ids[chunk.document_id]:
                del self._doc_to_chunk_ids[chunk.document_id]
        
        # Rebuild index (FAISS doesn't support deletions easily)
        self._rebuild_index()
        self._last_updated = datetime.utcnow()
    
    def delete_document(self, document_id: int) -> None:
        """Delete all chunks belonging to a document."""
        chunk_ids = self._doc_to_chunk_ids.get(document_id, [])
        
        for chunk_id in chunk_ids:
            if chunk_id in self._chunks:
                del self._chunks[chunk_id]
                idx = self._id_to_index.get(chunk_id)
                if idx is not None:
                    del self._id_to_index[chunk_id]
                    del self._index_to_id[idx]
        
        if document_id in self._doc_to_chunk_ids:
            del self._doc_to_chunk_ids[document_id]
        
        self._rebuild_index()
        self._last_updated = datetime.utcnow()
    
    def _rebuild_index(self) -> None:
        """Rebuild the FAISS index from existing chunks."""
        import faiss
        
        if not self._chunks:
            self._index = faiss.IndexFlatL2(self.dimension)
            self._id_to_index = {}
            self._index_to_id = {}
            return
        
        # Collect all vectors and chunks
        vectors = []
        chunk_ids = []
        
        for chunk_id, chunk in self._chunks.items():
            if chunk.embedding is not None:
                vectors.append(chunk.embedding)
                chunk_ids.append(chunk_id)
        
        # Rebuild index
        self._index = faiss.IndexFlatL2(self.dimension)
        if vectors:
            vec_array = np.array(vectors).astype('float32')
            faiss.normalize_L2(vec_array)
            self._index.add(vec_array)
        
        # Rebuild ID mappings
        self._id_to_index = {}
        self._index_to_id = {}
        for i, chunk_id in enumerate(chunk_ids):
            self._id_to_index[chunk_id] = i
            self._index_to_id[i] = chunk_id
    
    def clear(self) -> None:
        """Clear all chunks from the vector store."""
        import faiss
        self._index = faiss.IndexFlatL2(self.dimension)
        self._chunks = {}
        self._id_to_index = {}
        self._index_to_id = {}
        self._doc_to_chunk_ids = {}
        self._last_updated = datetime.utcnow()
    
    def get_stats(self) -> VectorStoreStats:
        """Get statistics about the vector store."""
        return VectorStoreStats(
            total_chunks=len(self._chunks),
            total_documents=len(self._doc_to_chunk_ids),
            embedding_dimension=self.dimension,
            last_updated=self._last_updated.isoformat() if self._last_updated else None,
        )
    
    def save(self, path: Optional[Path] = None) -> None:
        """Save the vector store to disk."""
        save_path = path or self.storage_path
        save_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Save FAISS index
        import faiss
        if self._index is not None:
            faiss.write_index(self._index, str(save_path / "faiss.index"))
        
        # Save chunk data
        with open(save_path / "chunks.pkl", "wb") as f:
            pickle.dump({
                "chunks": self._chunks,
                "id_to_index": self._id_to_index,
                "index_to_id": self._index_to_id,
                "doc_to_chunk_ids": self._doc_to_chunk_ids,
                "dimension": self.dimension,
                "last_updated": self._last_updated,
            }, f)
    
    def load(self, path: Optional[Path] = None) -> None:
        """Load the vector store from disk.

        On dimension mismatch (stored index width != configured embedding width),
        log a warning and reset the in-memory state to an empty index instead of
        crashing the caller. The admin can re-upload / re-index documents to
        rebuild the vector store at the new dimension.
        """
        load_path = path or self.storage_path

        if not (load_path / "faiss.index").exists():
            logger.info(
                "No persisted FAISS index found at %s. Initializing empty vector store.",
                load_path,
            )
            self.initialize()
            return

        try:
            import faiss
            self._index = faiss.read_index(str(load_path / "faiss.index"))

            if self._index.d != self.dimension:
                logger.warning(
                    "FAISS index dimension mismatch: stored index=%d, configured=%d. "
                    "Resetting to empty index — re-upload / re-index the Knowledge Base "
                    "to rebuild embeddings with the current model.",
                    self._index.d,
                    self.dimension,
                )
                # Back up the stale files so an admin can inspect them, then reset.
                try:
                    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                    (load_path / "faiss.index").replace(load_path / f"faiss.index.{ts}.stale")
                    (load_path / "chunks.pkl").replace(load_path / f"chunks.pkl.{ts}.stale")
                except OSError:
                    pass
                self.initialize()
                return

            with open(load_path / "chunks.pkl", "rb") as f:
                data = pickle.load(f)
                self._chunks = data["chunks"]
                self._id_to_index = data["id_to_index"]
                self._index_to_id = data["index_to_id"]
                self._doc_to_chunk_ids = data["doc_to_chunk_ids"]
                self._last_updated = data.get("last_updated")

            logger.info(
                "Loaded FAISS vector store: chunks=%d, documents=%d, dimension=%d.",
                len(self._chunks),
                len(self._doc_to_chunk_ids),
                self.dimension,
            )
        except Exception as e:
            logger.warning(
                "Failed to load FAISS vector store from %s: %s. Resetting to empty index.",
                load_path,
                str(e),
            )
            self.initialize()


class VectorStoreFactory:
    """Factory for creating vector store instances."""
    
    @staticmethod
    def create(provider_name: str, **kwargs) -> VectorStore:
        """Create a vector store instance."""
        if provider_name.lower() == "faiss":
            return FAISSVectorStore(**kwargs)
        raise ValueError(f"Vector store provider '{provider_name}' not implemented")
