"""Document loading interface for RAG pipeline."""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Iterator, Optional
from dataclasses import dataclass, field
from datetime import datetime
import os


@dataclass
class DocumentMetadata:
    """Metadata for loaded documents."""
    file_path: Path
    file_name: str
    file_extension: str
    file_size: int
    created_at: datetime
    modified_at: datetime
    source: str
    category: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    additional_metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class LoadedDocument:
    """Container for loaded document content and metadata."""
    content: str
    metadata: DocumentMetadata
    raw_data: Optional[Any] = None


class DocumentLoader(ABC):
    """Abstract base class for document loaders."""
    
    @abstractmethod
    def supports(self, file_path: Path) -> bool:
        """Check if this loader supports the given file type.
        
        Args:
            file_path: Path to the document file.
            
        Returns:
            True if the loader can process this file, False otherwise.
        """
        pass
    
    @abstractmethod
    def load(self, file_path: Path) -> LoadedDocument:
        """Load a single document from file.
        
        Args:
            file_path: Path to the document file.
            
        Returns:
            LoadedDocument containing content and metadata.
            
        Raises:
            DocumentLoadError: If document loading fails.
        """
        pass
    
    def load_batch(self, file_paths: list[Path]) -> list[LoadedDocument]:
        """Load multiple documents in batch.
        
        Args:
            file_paths: List of paths to document files.
            
        Returns:
            List of LoadedDocument objects.
            
        Raises:
            DocumentLoadError: If any document loading fails.
        """
        results = []
        errors = []
        for path in file_paths:
            try:
                results.append(self.load(path))
            except Exception as e:
                errors.append((path, e))
        
        if errors:
            raise DocumentLoadError(
                f"Failed to load {len(errors)} documents: {errors}"
            )
        return results
    
    def load_directory(self, directory_path: Path, recursive: bool = True) -> Iterator[LoadedDocument]:
        """Load all documents from a directory.
        
        Args:
            directory_path: Path to the directory.
            recursive: If True, search subdirectories recursively.
            
        Yields:
            LoadedDocument objects for each supported file.
        """
        if not directory_path.exists() or not directory_path.is_dir():
            raise DocumentLoadError(f"Directory not found or not a directory: {directory_path}")
        
        pattern = "**/*" if recursive else "*"
        for file_path in directory_path.glob(pattern):
            if file_path.is_file() and self.supports(file_path):
                try:
                    yield self.load(file_path)
                except Exception as e:
                    continue  # Skip failed files


class DocumentLoadError(Exception):
    """Exception raised when document loading fails."""
    pass


class DocumentLoaderRegistry:
    """Registry for managing document loaders."""
    
    def __init__(self):
        self._loaders: list[DocumentLoader] = []
    
    def register_loader(self, loader: DocumentLoader) -> None:
        """Register a document loader.
        
        Args:
            loader: DocumentLoader instance to register.
        """
        self._loaders.append(loader)
    
    def get_loader(self, file_path: Path) -> Optional[DocumentLoader]:
        """Get a loader that supports the given file.
        
        Args:
            file_path: Path to the document file.
            
        Returns:
            DocumentLoader instance if found, None otherwise.
        """
        for loader in self._loaders:
            if loader.supports(file_path):
                return loader
        return None
    
    def get_all_loaders(self) -> list[DocumentLoader]:
        """Get all registered loaders.
        
        Returns:
            List of registered DocumentLoader instances.
        """
        return list(self._loaders)


class FileDocumentLoader(DocumentLoader):
    """Concrete document loader for loading files from the filesystem."""
    
    SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}
    
    def supports(self, file_path: Path) -> bool:
        """Check if this loader supports the given file type."""
        return file_path.suffix.lower() in self.SUPPORTED_EXTENSIONS
    
    def load(self, file_path: Path) -> LoadedDocument:
        """Load a single document from file."""
        if not file_path.exists():
            raise DocumentLoadError(f"File not found: {file_path}")
        if not file_path.is_file():
            raise DocumentLoadError(f"Path is not a file: {file_path}")
        
        # Get basic filesystem metadata
        stat = file_path.stat()
        metadata = DocumentMetadata(
            file_path=file_path,
            file_name=file_path.name,
            file_extension=file_path.suffix.lower(),
            file_size=stat.st_size,
            created_at=datetime.fromtimestamp(stat.st_ctime),
            modified_at=datetime.fromtimestamp(stat.st_mtime),
            source=str(file_path),
        )
        
        # Load raw content
        raw_data = None
        if file_path.suffix.lower() == ".pdf":
            import fitz
            raw_data = fitz.open(file_path)
        elif file_path.suffix.lower() == ".docx":
            from docx import Document
            raw_data = Document(file_path)
        
        # Load basic text content for simple formats
        content = ""
        if file_path.suffix.lower() in {".txt", ".md"}:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
            except UnicodeDecodeError:
                with open(file_path, "r", encoding="latin-1") as f:
                    content = f.read()
        
        return LoadedDocument(
            content=content,
            metadata=metadata,
            raw_data=raw_data
        )
