"""RAG module configuration settings."""

from functools import lru_cache
import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parents[3]
load_dotenv(BASE_DIR / ".env")


class RAGSettings(BaseModel):
    """RAG pipeline configuration settings."""
    
    # Embedding settings
    embedding_provider: Literal["openai", "huggingface", "ollama"] = Field(
        default="openai",
        description="Embedding provider to use"
    )
    embedding_model: str = Field(
        default="text-embedding-ada-002",
        description="Embedding model identifier"
    )
    embedding_dimension: int = Field(
        default=1536,
        description="Dimension of embedding vectors"
    )
    
    # Chunking settings
    chunk_size: int = Field(
        default=1000,
        description="Maximum characters per chunk"
    )
    chunk_overlap: int = Field(
        default=200,
        description="Overlap between consecutive chunks"
    )
    
    # Vector store settings
    vector_store_provider: Literal["faiss", "chroma", "pinecone"] = Field(
        default="faiss",
        description="Vector store implementation to use"
    )
    vector_store_path: Path = Field(
        default=BASE_DIR / "backend" / "vector_store",
        description="Path to vector store files"
    )
    
    # Retrieval settings
    top_k: int = Field(
        default=5,
        description="Number of top chunks to retrieve"
    )
    similarity_threshold: float = Field(
        default=0.7,
        description="Minimum similarity score for retrieved chunks"
    )
    
    # LLM settings
    llm_provider: Literal["openai", "ollama", "anthropic"] = Field(
        default="openai",
        description="LLM provider to use"
    )
    llm_model: str = Field(
        default="gpt-4",
        description="LLM model identifier"
    )
    llm_temperature: float = Field(
        default=0.7,
        description="LLM temperature parameter"
    )
    
    # Document settings
    knowledge_base_path: Path = Field(
        default=BASE_DIR / "knowledge_base",
        description="Path to knowledge base documents"
    )
    supported_file_types: list[str] = Field(
        default_factory=lambda: [".md", ".txt", ".pdf", ".docx"],
        description="Supported document file extensions"
    )
    
    # API keys
    openai_api_key: str | None = Field(
        default=None,
        description="OpenAI API key"
    )
    anthropic_api_key: str | None = Field(
        default=None,
        description="Anthropic API key"
    )
    pinecone_api_key: str | None = Field(
        default=None,
        description="Pinecone API key"
    )
    pinecone_environment: str | None = Field(
        default=None,
        description="Pinecone environment"
    )


@lru_cache
def get_rag_settings() -> RAGSettings:
    """Get cached RAG settings instance."""
    return RAGSettings(
        embedding_provider=os.getenv("EMBEDDING_PROVIDER", "openai"),
        embedding_model=os.getenv("EMBEDDING_MODEL", "text-embedding-ada-002"),
        embedding_dimension=int(os.getenv("EMBEDDING_DIMENSION", "1536")),
        chunk_size=int(os.getenv("CHUNK_SIZE", "1000")),
        chunk_overlap=int(os.getenv("CHUNK_OVERLAP", "200")),
        vector_store_provider=os.getenv("VECTOR_STORE_PROVIDER", "faiss"),
        vector_store_path=Path(os.getenv("VECTOR_STORE_PATH", str(BASE_DIR / "backend" / "vector_store"))),
        top_k=int(os.getenv("TOP_K", "5")),
        similarity_threshold=float(os.getenv("SIMILARITY_THRESHOLD", "0.7")),
        llm_provider=os.getenv("LLM_PROVIDER", "openai"),
        llm_model=os.getenv("LLM_MODEL", "gpt-4"),
        llm_temperature=float(os.getenv("LLM_TEMPERATURE", "0.7")),
        knowledge_base_path=Path(os.getenv("KNOWLEDGE_BASE_PATH", str(BASE_DIR / "knowledge_base"))),
        supported_file_types=[ext.strip() for ext in os.getenv("SUPPORTED_FILE_TYPES", ".md,.txt,.pdf,.docx").split(",")],
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
        pinecone_api_key=os.getenv("PINECONE_API_KEY"),
        pinecone_environment=os.getenv("PINECONE_ENVIRONMENT"),
    )
