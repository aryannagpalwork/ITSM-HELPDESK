"""Metadata extractor interface and implementations for documents."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional
from datetime import datetime

from app.rag.document_loader import LoadedDocument, FileDocumentLoader


@dataclass
class ExtractedMetadata:
    """Container for extracted document metadata."""
    title: Optional[str] = None
    author: Optional[str] = None
    subject: Optional[str] = None
    keywords: list[str] = None
    creator: Optional[str] = None
    producer: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    page_count: Optional[int] = None
    language: Optional[str] = None
    additional: dict[str, Any] = None
    
    def __post_init__(self):
        if self.keywords is None:
            self.keywords = []
        if self.additional is None:
            self.additional = {}


class MetadataExtractor(ABC):
    """Abstract base class for metadata extractors."""
    
    @abstractmethod
    def supports(self, document: LoadedDocument) -> bool:
        """Check if this extractor supports the given document."""
        pass
    
    @abstractmethod
    def extract(self, document: LoadedDocument) -> ExtractedMetadata:
        """Extract metadata from a loaded document."""
        pass
    
    def extract_from_path(self, file_path: Path) -> ExtractedMetadata:
        """Extract metadata directly from a file path."""
        loader = FileDocumentLoader()
        doc = loader.load(file_path)
        return self.extract(doc)


class MetadataExtractionError(Exception):
    """Exception raised when metadata extraction fails."""
    pass


class PDFMetadataExtractor(MetadataExtractor):
    """Metadata extractor for PDF documents."""
    
    def supports(self, document: LoadedDocument) -> bool:
        return document.metadata.file_extension == ".pdf"
    
    def extract(self, document: LoadedDocument) -> ExtractedMetadata:
        try:
            import fitz
            
            doc = document.raw_data
            if doc is None:
                doc = fitz.open(document.metadata.file_path)
            
            metadata = doc.metadata
            page_count = len(doc)
            
            # Parse dates
            created_at = None
            modified_at = None
            
            if metadata.get("creationDate"):
                try:
                    created_at = self._parse_pdf_date(metadata["creationDate"])
                except Exception:
                    pass
            
            if metadata.get("modDate"):
                try:
                    modified_at = self._parse_pdf_date(metadata["modDate"])
                except Exception:
                    pass
            
            # Parse keywords
            keywords = []
            if metadata.get("keywords"):
                keywords = [k.strip() for k in metadata["keywords"].split(",") if k.strip()]
            
            return ExtractedMetadata(
                title=metadata.get("title"),
                author=metadata.get("author"),
                subject=metadata.get("subject"),
                keywords=keywords,
                creator=metadata.get("creator"),
                producer=metadata.get("producer"),
                created_at=created_at,
                modified_at=modified_at,
                page_count=page_count,
                additional={
                    "format": metadata.get("format"),
                    "encryption": metadata.get("encryption"),
                }
            )
        except Exception as e:
            raise MetadataExtractionError(f"Failed to extract PDF metadata: {str(e)}") from e
    
    def _parse_pdf_date(self, date_str: str) -> Optional[datetime]:
        """Parse PDF date string to datetime."""
        # PDF date format: D:YYYYMMDDHHmmSSOHH'mm'
        try:
            from datetime import datetime
            import re
            
            date_str = date_str.strip()
            if date_str.startswith("D:"):
                date_str = date_str[2:]
            
            # Extract basic components
            match = re.match(r"(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?", date_str)
            if match:
                year = int(match.group(1))
                month = int(match.group(2))
                day = int(match.group(3))
                hour = int(match.group(4)) if match.group(4) else 0
                minute = int(match.group(5)) if match.group(5) else 0
                second = int(match.group(6)) if match.group(6) else 0
                return datetime(year, month, day, hour, minute, second)
        except Exception:
            pass
        return None


class DOCXMetadataExtractor(MetadataExtractor):
    """Metadata extractor for DOCX documents."""
    
    def supports(self, document: LoadedDocument) -> bool:
        return document.metadata.file_extension == ".docx"
    
    def extract(self, document: LoadedDocument) -> ExtractedMetadata:
        try:
            from docx import Document
            
            doc = document.raw_data
            if doc is None:
                doc = Document(document.metadata.file_path)
            
            core_props = doc.core_properties
            
            # Parse keywords
            keywords = []
            if core_props.keywords:
                keywords = [k.strip() for k in core_props.keywords.split(",") if k.strip()]
            
            return ExtractedMetadata(
                title=core_props.title,
                author=core_props.author,
                subject=core_props.subject,
                keywords=keywords,
                creator=core_props.last_modified_by,
                created_at=core_props.created,
                modified_at=core_props.modified,
                language=core_props.language,
                additional={
                    "category": core_props.category,
                    "content_status": core_props.content_status,
                    "identifier": core_props.identifier,
                    "version": core_props.version,
                    "revision": core_props.revision,
                }
            )
        except Exception as e:
            raise MetadataExtractionError(f"Failed to extract DOCX metadata: {str(e)}") from e


class TXTMetadataExtractor(MetadataExtractor):
    """Metadata extractor for TXT documents."""
    
    def supports(self, document: LoadedDocument) -> bool:
        return document.metadata.file_extension == ".txt"
    
    def extract(self, document: LoadedDocument) -> ExtractedMetadata:
        try:
            # For TXT files, use filesystem metadata
            return ExtractedMetadata(
                title=document.metadata.file_name,
                created_at=document.metadata.created_at,
                modified_at=document.metadata.modified_at,
                additional={
                    "file_size": document.metadata.file_size,
                }
            )
        except Exception as e:
            raise MetadataExtractionError(f"Failed to extract TXT metadata: {str(e)}") from e


class MarkdownMetadataExtractor(MetadataExtractor):
    """Metadata extractor for Markdown documents (supports YAML frontmatter)."""
    
    def supports(self, document: LoadedDocument) -> bool:
        return document.metadata.file_extension == ".md"
    
    def extract(self, document: LoadedDocument) -> ExtractedMetadata:
        try:
            import re
            
            metadata = ExtractedMetadata(
                title=document.metadata.file_name,
                created_at=document.metadata.created_at,
                modified_at=document.metadata.modified_at,
                additional={
                    "file_size": document.metadata.file_size,
                }
            )
            
            # Try to extract YAML frontmatter
            text = document.content
            frontmatter_match = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
            if frontmatter_match:
                try:
                    import yaml
                    frontmatter = yaml.safe_load(frontmatter_match.group(1))
                    if isinstance(frontmatter, dict):
                        if "title" in frontmatter:
                            metadata.title = frontmatter["title"]
                        if "author" in frontmatter:
                            metadata.author = frontmatter["author"]
                        if "tags" in frontmatter:
                            if isinstance(frontmatter["tags"], list):
                                metadata.keywords = frontmatter["tags"]
                            elif isinstance(frontmatter["tags"], str):
                                metadata.keywords = [t.strip() for t in frontmatter["tags"].split(",")]
                        if "keywords" in frontmatter:
                            if isinstance(frontmatter["keywords"], list):
                                metadata.keywords.extend(frontmatter["keywords"])
                            elif isinstance(frontmatter["keywords"], str):
                                metadata.keywords.extend([t.strip() for t in frontmatter["keywords"].split(",")])
                        # Add other frontmatter to additional
                        for key, value in frontmatter.items():
                            if key not in ["title", "author", "tags", "keywords"]:
                                metadata.additional[key] = value
                except ImportError:
                    pass
                except Exception:
                    pass
            
            return metadata
        except Exception as e:
            raise MetadataExtractionError(f"Failed to extract Markdown metadata: {str(e)}") from e


class MetadataExtractorRegistry:
    """Registry for managing metadata extractors."""
    
    def __init__(self):
        self._extractors: list[MetadataExtractor] = []
    
    def register_extractor(self, extractor: MetadataExtractor) -> None:
        """Register a metadata extractor."""
        self._extractors.append(extractor)
    
    def get_extractor(self, document: LoadedDocument) -> Optional[MetadataExtractor]:
        """Get an extractor that supports the given document."""
        for extractor in self._extractors:
            if extractor.supports(document):
                return extractor
        return None
    
    def get_all_extractors(self) -> list[MetadataExtractor]:
        """Get all registered extractors."""
        return list(self._extractors)
