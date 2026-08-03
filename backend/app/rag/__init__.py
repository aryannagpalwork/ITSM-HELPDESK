"""Retrieval augmented generation package."""

# Config
from app.rag.config import RAGSettings, get_rag_settings

# Document loading
from app.rag.document_loader import (
    DocumentLoader,
    DocumentLoaderRegistry,
    LoadedDocument,
    DocumentMetadata,
    DocumentLoadError,
    FileDocumentLoader,
)

# Text extraction
from app.rag.text_extractor import (
    TextExtractor,
    TextExtractorRegistry,
    ExtractedText,
    TextExtractionError,
    PDFTextExtractor,
    DOCXTextExtractor,
    TXTTextExtractor,
    MarkdownTextExtractor,
)

# Metadata extraction
from app.rag.metadata_extractor import (
    MetadataExtractor,
    MetadataExtractorRegistry,
    ExtractedMetadata,
    MetadataExtractionError,
    PDFMetadataExtractor,
    DOCXMetadataExtractor,
    TXTMetadataExtractor,
    MarkdownMetadataExtractor,
)

# Chunking
from app.rag.chunker import (
    Chunker,
    ChunkerRegistry,
    DocumentChunk as RagDocumentChunk,
    ChunkingError,
    RecursiveCharacterTextSplitter,
)

# Embedding
from app.rag.embedding_provider import (
    EmbeddingProvider,
    EmbeddingProviderFactory,
    EmbeddingResult,
    BatchEmbeddingResult,
    EmbeddingError,
    SentenceTransformersEmbeddingProvider,
)

# Vector store
from app.rag.vector_store import (
    VectorStore,
    VectorStoreFactory,
    VectorSearchResult,
    VectorStoreStats,
    VectorStoreError,
    FAISSVectorStore,
)

# Retrieval
from app.rag.retriever import (
    Retriever,
    RetrieverFactory,
    Reranker,
    RetrievedContext,
    RetrievalConfig,
    RetrievalError,
    RerankingError,
)

# Prompt building
from app.rag.prompt_builder import (
    PromptBuilder,
    PromptBuilderFactory,
    ChatMessage,
    MessageRole,
    PromptTemplate,
    BuiltPrompt,
    PromptBuildingError,
    RAGPromptBuilder,
)

# Citations
from app.rag.citation_service import (
    CitationService,
    CitationServiceFactory,
    Citation,
    CitationFormat,
    CitedResponse,
    CitationError,
)

# Pipeline
from app.rag.rag_pipeline import (
    RAGPipeline,
    RAGPipelineFactory,
    RAGQueryResult,
    IndexingProgress,
    RAGPipelineError,
)

# Document parser
from app.rag.document_parser import (
    DocumentParser,
    ParsedDocument,
    DocumentParserError,
)

__all__ = [
    # Config
    "RAGSettings",
    "get_rag_settings",
    # Document loading
    "DocumentLoader",
    "DocumentLoaderRegistry",
    "LoadedDocument",
    "DocumentMetadata",
    "DocumentLoadError",
    "FileDocumentLoader",
    # Text extraction
    "TextExtractor",
    "TextExtractorRegistry",
    "ExtractedText",
    "TextExtractionError",
    "PDFTextExtractor",
    "DOCXTextExtractor",
    "TXTTextExtractor",
    "MarkdownTextExtractor",
    # Metadata extraction
    "MetadataExtractor",
    "MetadataExtractorRegistry",
    "ExtractedMetadata",
    "MetadataExtractionError",
    "PDFMetadataExtractor",
    "DOCXMetadataExtractor",
    "TXTMetadataExtractor",
    "MarkdownMetadataExtractor",
    # Chunking
    "Chunker",
    "ChunkerRegistry",
    "RagDocumentChunk",
    "ChunkingError",
    "RecursiveCharacterTextSplitter",
    # Embedding
    "EmbeddingProvider",
    "EmbeddingProviderFactory",
    "EmbeddingResult",
    "BatchEmbeddingResult",
    "EmbeddingError",
    "SentenceTransformersEmbeddingProvider",
    # Vector store
    "VectorStore",
    "VectorStoreFactory",
    "VectorSearchResult",
    "VectorStoreStats",
    "VectorStoreError",
    "FAISSVectorStore",
    # Retrieval
    "Retriever",
    "RetrieverFactory",
    "Reranker",
    "RetrievedContext",
    "RetrievalConfig",
    "RetrievalError",
    "RerankingError",
    # Prompt building
    "PromptBuilder",
    "PromptBuilderFactory",
    "ChatMessage",
    "MessageRole",
    "PromptTemplate",
    "BuiltPrompt",
    "PromptBuildingError",
    "RAGPromptBuilder",
    # Citations
    "CitationService",
    "CitationServiceFactory",
    "Citation",
    "CitationFormat",
    "CitedResponse",
    "CitationError",
    # Pipeline
    "RAGPipeline",
    "RAGPipelineFactory",
    "RAGQueryResult",
    "IndexingProgress",
    "RAGPipelineError",
    # Document parser
    "DocumentParser",
    "ParsedDocument",
    "DocumentParserError",
]

