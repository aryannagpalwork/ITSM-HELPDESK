"""Document parser orchestrator that combines all parsing components."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional, Iterator
from datetime import datetime

from app.rag.document_loader import (
    DocumentLoader,
    FileDocumentLoader,
    DocumentLoaderRegistry,
    LoadedDocument,
    DocumentMetadata,
    DocumentLoadError,
)
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


@dataclass
class ParsedDocument:
    """Container for a fully parsed document."""
    file_path: Path
    loaded_document: LoadedDocument
    extracted_text: ExtractedText
    extracted_metadata: ExtractedMetadata
    parsed_at: datetime = field(default_factory=datetime.utcnow)
    
    @property
    def text(self) -> str:
        """Get the extracted text."""
        return self.extracted_text.text
    
    @property
    def metadata(self) -> dict[str, Any]:
        """Get combined metadata."""
        meta = {
            "file_path": str(self.file_path),
            "file_name": self.loaded_document.metadata.file_name,
            "file_extension": self.loaded_document.metadata.file_extension,
            "file_size": self.loaded_document.metadata.file_size,
            "source": self.loaded_document.metadata.source,
        }
        
        # Add extracted metadata
        if self.extracted_metadata.title:
            meta["title"] = self.extracted_metadata.title
        if self.extracted_metadata.author:
            meta["author"] = self.extracted_metadata.author
        if self.extracted_metadata.subject:
            meta["subject"] = self.extracted_metadata.subject
        if self.extracted_metadata.keywords:
            meta["keywords"] = self.extracted_metadata.keywords
        if self.extracted_metadata.page_count:
            meta["page_count"] = self.extracted_metadata.page_count
        
        # Add additional metadata
        meta.update(self.extracted_metadata.additional)
        meta.update(self.loaded_document.metadata.additional_metadata)
        
        return meta


class DocumentParser:
    """Orchestrator for parsing documents end-to-end."""
    
    def __init__(self):
        # Initialize registries
        self.document_loader_registry = DocumentLoaderRegistry()
        self.text_extractor_registry = TextExtractorRegistry()
        self.metadata_extractor_registry = MetadataExtractorRegistry()
        
        # Register default components
        self._register_defaults()
    
    def _register_defaults(self):
        """Register default loaders and extractors."""
        # Document loaders
        self.document_loader_registry.register_loader(FileDocumentLoader())
        
        # Text extractors
        self.text_extractor_registry.register_extractor(PDFTextExtractor())
        self.text_extractor_registry.register_extractor(DOCXTextExtractor())
        self.text_extractor_registry.register_extractor(TXTTextExtractor())
        self.text_extractor_registry.register_extractor(MarkdownTextExtractor())
        
        # Metadata extractors
        self.metadata_extractor_registry.register_extractor(PDFMetadataExtractor())
        self.metadata_extractor_registry.register_extractor(DOCXMetadataExtractor())
        self.metadata_extractor_registry.register_extractor(TXTMetadataExtractor())
        self.metadata_extractor_registry.register_extractor(MarkdownMetadataExtractor())
    
    def parse(self, file_path: Path) -> ParsedDocument:
        """Parse a single document from a file path.
        
        Args:
            file_path: Path to the document to parse.
            
        Returns:
            ParsedDocument with all extracted content and metadata.
            
        Raises:
            DocumentParserError: If parsing fails at any step.
        """
        try:
            # Step 1: Load the document
            loader = self.document_loader_registry.get_loader(file_path)
            if not loader:
                raise DocumentParserError(f"No document loader found for {file_path}")
            
            loaded_doc = loader.load(file_path)
            
            # Step 2: Extract text
            text_extractor = self.text_extractor_registry.get_extractor(loaded_doc)
            if not text_extractor:
                raise DocumentParserError(f"No text extractor found for {file_path}")
            
            extracted_text = text_extractor.extract(loaded_doc)
            
            # Step 3: Extract metadata
            metadata_extractor = self.metadata_extractor_registry.get_extractor(loaded_doc)
            if not metadata_extractor:
                raise DocumentParserError(f"No metadata extractor found for {file_path}")
            
            extracted_metadata = metadata_extractor.extract(loaded_doc)
            
            # Return combined parsed document
            return ParsedDocument(
                file_path=file_path,
                loaded_document=loaded_doc,
                extracted_text=extracted_text,
                extracted_metadata=extracted_metadata
            )
        except Exception as e:
            if isinstance(e, DocumentParserError):
                raise
            raise DocumentParserError(f"Failed to parse {file_path}: {str(e)}") from e
    
    def parse_directory(
        self,
        directory_path: Path,
        recursive: bool = True,
        skip_errors: bool = True
    ) -> Iterator[ParsedDocument]:
        """Parse all documents in a directory.
        
        Args:
            directory_path: Path to the directory containing documents.
            recursive: Whether to parse subdirectories recursively.
            skip_errors: Whether to skip files that fail to parse.
            
        Yields:
            ParsedDocument objects for each successfully parsed file.
        """
        loader = FileDocumentLoader()
        
        for file_path in directory_path.glob("**/*" if recursive else "*"):
            if file_path.is_file() and loader.supports(file_path):
                try:
                    yield self.parse(file_path)
                except Exception as e:
                    if not skip_errors:
                        raise
    
    def parse_batch(
        self,
        file_paths: list[Path],
        skip_errors: bool = True
    ) -> list[ParsedDocument]:
        """Parse multiple documents in batch.
        
        Args:
            file_paths: List of file paths to parse.
            skip_errors: Whether to skip files that fail to parse.
            
        Returns:
            List of ParsedDocument objects.
        """
        results = []
        for file_path in file_paths:
            try:
                results.append(self.parse(file_path))
            except Exception as e:
                if not skip_errors:
                    raise
        return results


class DocumentParserError(Exception):
    """Exception raised when document parsing fails."""
    pass
