"""Embedding provider interface for RAG pipeline."""

import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


@dataclass
class EmbeddingResult:
    """Result of an embedding operation."""
    embedding: list[float]
    model: str
    token_count: Optional[int] = None
    metadata: dict[str, Any] | None = None


@dataclass
class BatchEmbeddingResult:
    """Result of a batch embedding operation."""
    embeddings: list[list[float]]
    model: str
    total_tokens: Optional[int] = None
    metadata: dict[str, Any] | None = None


class EmbeddingProvider(ABC):
    """Abstract base class for embedding providers."""
    
    @abstractmethod
    def embed(self, text: str) -> EmbeddingResult:
        """Generate embedding for a single text.
        
        Args:
            text: Text to embed.
            
        Returns:
            EmbeddingResult containing the embedding vector.
            
        Raises:
            EmbeddingError: If embedding generation fails.
        """
        pass
    
    @abstractmethod
    def embed_batch(self, texts: list[str]) -> BatchEmbeddingResult:
        """Generate embeddings for multiple texts in batch.
        
        Args:
            texts: List of texts to embed.
            
        Returns:
            BatchEmbeddingResult containing embedding vectors.
            
        Raises:
            EmbeddingError: If embedding generation fails.
        """
        pass
    
    @abstractmethod
    def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings produced by this provider.
        
        Returns:
            Integer dimension of embedding vectors.
        """
        pass
    
    @abstractmethod
    def get_model_name(self) -> str:
        """Get the name of the embedding model being used.
        
        Returns:
            String model name.
        """
        pass


class EmbeddingError(Exception):
    """Exception raised when embedding generation fails."""
    pass


class SentenceTransformersEmbeddingProvider(EmbeddingProvider):
    """Embedding provider using sentence-transformers."""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._model = None
        self._dimension = None
    
    def _lazy_load_model(self):
        """Lazy load the sentence-transformers model."""
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer(self.model_name)
                self._dimension = self._model.get_sentence_embedding_dimension()
            except Exception as e:
                raise EmbeddingError(f"Failed to load model {self.model_name}: {str(e)}") from e
    
    def embed(self, text: str) -> EmbeddingResult:
        """Generate embedding for a single text."""
        self._lazy_load_model()
        try:
            embedding = self._model.encode(text, convert_to_numpy=True).tolist()
            return EmbeddingResult(
                embedding=embedding,
                model=self.model_name,
                token_count=len(text.split()),  # Approximate token count
            )
        except Exception as e:
            raise EmbeddingError(f"Failed to embed text: {str(e)}") from e
    
    def embed_batch(self, texts: list[str]) -> BatchEmbeddingResult:
        """Generate embeddings for multiple texts in batch."""
        self._lazy_load_model()
        try:
            embeddings = self._model.encode(texts, convert_to_numpy=True).tolist()
            total_tokens = sum(len(t.split()) for t in texts)
            return BatchEmbeddingResult(
                embeddings=embeddings,
                model=self.model_name,
                total_tokens=total_tokens,
            )
        except Exception as e:
            raise EmbeddingError(f"Failed to embed batch: {str(e)}") from e
    
    def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings."""
        self._lazy_load_model()
        return self._dimension
    
    def get_model_name(self) -> str:
        """Get the model name."""
        return self.model_name


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """Embedding provider using OpenAI's embedding models."""
    
    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        settings = get_settings()
        self.api_key = api_key or settings.openai_api_key
        self.model_name = model_name or settings.embedding_model
        # Keep the embedding width aligned with the persisted FAISS index.
        # text-embedding-3-* supports dimensionality reduction; the existing
        # index was built with 1536-dimensional vectors.
        self.dimensions = int(os.getenv("EMBEDDING_DIMENSION", "1536"))
        
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY must be set.")
        
        try:
            from openai import OpenAI
            self.client = OpenAI(api_key=self.api_key)
        except ImportError:
            raise EmbeddingError("OpenAI package is not installed. Install it with 'pip install openai'")
        
        self._dimension = None
    
    def embed(self, text: str) -> EmbeddingResult:
        """Generate embedding for a single text using OpenAI."""
        start_time = time.time()
        try:
            request = {"model": self.model_name, "input": text}
            if self.model_name.startswith("text-embedding-3-"):
                request["dimensions"] = self.dimensions
            response = self.client.embeddings.create(**request)
            embedding = response.data[0].embedding
            token_count = response.usage.total_tokens
            
            logger.info(
                "Generated embedding. Model: %s, Tokens: %d, Time: %.2fs",
                self.model_name,
                token_count,
                time.time() - start_time
            )
            
            return EmbeddingResult(
                embedding=embedding,
                model=self.model_name,
                token_count=token_count,
            )
        except Exception as e:
            logger.error("OpenAI embedding error: %s", str(e))
            raise EmbeddingError(f"Failed to embed text: {str(e)}") from e
    
    def embed_batch(self, texts: list[str]) -> BatchEmbeddingResult:
        """Generate embeddings for multiple texts in batch using OpenAI."""
        start_time = time.time()
        try:
            request = {"model": self.model_name, "input": texts}
            if self.model_name.startswith("text-embedding-3-"):
                request["dimensions"] = self.dimensions
            response = self.client.embeddings.create(**request)
            embeddings = [item.embedding for item in response.data]
            total_tokens = response.usage.total_tokens
            
            logger.info(
                "Generated batch embeddings. Model: %s, Total tokens: %d, Texts: %d, Time: %.2fs",
                self.model_name,
                total_tokens,
                len(texts),
                time.time() - start_time
            )
            
            return BatchEmbeddingResult(
                embeddings=embeddings,
                model=self.model_name,
                total_tokens=total_tokens,
            )
        except Exception as e:
            logger.error("OpenAI batch embedding error: %s", str(e))
            raise EmbeddingError(f"Failed to embed batch: {str(e)}") from e
    
    def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings produced by the model."""
        if self._dimension is None:
            result = self.embed("test")
            self._dimension = len(result.embedding)
        return self._dimension
    
    def get_model_name(self) -> str:
        """Get the name of the embedding model."""
        return self.model_name


class EmbeddingProviderFactory:
    """Factory for creating embedding provider instances."""
    
    @staticmethod
    def create(provider_name: str, **kwargs) -> EmbeddingProvider:
        """Create an OpenAI embedding provider instance."""
        return OpenAIEmbeddingProvider(**kwargs)
