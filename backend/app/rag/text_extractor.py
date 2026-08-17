"""Text extraction interface for RAG pipeline."""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional
from pathlib import Path
import re

from app.rag.document_loader import LoadedDocument, DocumentLoader, FileDocumentLoader

logger = logging.getLogger(__name__)


@dataclass
class ExtractedText:
    """Container for extracted text and metadata."""
    text: str
    structure: Optional[dict[str, Any]] = None
    headings: list[str] = field(default_factory=list)
    tables: list[dict[str, Any]] = field(default_factory=list)
    images: list[dict[str, Any]] = field(default_factory=list)
    links: list[dict[str, str]] = field(default_factory=list)


class TextExtractor(ABC):
    """Abstract base class for text extractors."""
    
    @abstractmethod
    def supports(self, document: LoadedDocument) -> bool:
        """Check if this extractor supports the given document.
        
        Args:
            document: LoadedDocument instance.
            
        Returns:
            True if the extractor can process this document, False otherwise.
        """
        pass
    
    @abstractmethod
    def extract(self, document: LoadedDocument) -> ExtractedText:
        """Extract text from a loaded document.
        
        Args:
            document: LoadedDocument instance.
            
        Returns:
            ExtractedText containing text and structural metadata.
            
        Raises:
            TextExtractionError: If text extraction fails.
        """
        pass
    
    def extract_from_path(self, file_path: Path) -> ExtractedText:
        """Extract text directly from a file path.
        
        Args:
            file_path: Path to the document file.
            
        Returns:
            ExtractedText containing text and structural metadata.
            
        Raises:
            TextExtractionError: If text extraction fails.
        """
        loader = FileDocumentLoader()
        doc = loader.load(file_path)
        return self.extract(doc)
    
    def normalize_text(self, text: str) -> str:
        """Normalize text formatting.
        
        Args:
            text: Raw text to normalize.
            
        Returns:
            Normalized text.
        """
        if not text:
            return ""
        
        # Normalize line endings
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        # Remove common extraction artifacts before chunking. Consecutive
        # duplicate lines are frequently produced by OCR/PDF text layers;
        # preserving the first occurrence keeps document structure intact.
        text = text.replace("\x00", "").replace("\f", "\n")
        cleaned_lines: list[str] = []
        previous_line = None
        for line in text.split("\n"):
            normalized_line = re.sub(r"[ \t]+", " ", line).strip()
            if normalized_line and normalized_line == previous_line:
                continue
            cleaned_lines.append(normalized_line)
            previous_line = normalized_line if normalized_line else previous_line
        text = "\n".join(cleaned_lines)
        
        # Remove excessive whitespace
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"[ \t]+", " ", text)
        
        # Trim whitespace
        text = text.strip()
        
        return text


class TextExtractionError(Exception):
    """Exception raised when text extraction fails."""
    pass


class TextExtractorRegistry:
    """Registry for managing text extractors."""
    
    def __init__(self):
        self._extractors: list[TextExtractor] = []
    
    def register_extractor(self, extractor: TextExtractor) -> None:
        """Register a text extractor.
        
        Args:
            extractor: TextExtractor instance to register.
        """
        self._extractors.append(extractor)
    
    def get_extractor(self, document: LoadedDocument) -> Optional[TextExtractor]:
        """Get an extractor that supports the given document.
        
        Args:
            document: LoadedDocument instance.
            
        Returns:
            TextExtractor instance if found, None otherwise.
        """
        for extractor in self._extractors:
            if extractor.supports(document):
                return extractor
        return None
    
    def get_all_extractors(self) -> list[TextExtractor]:
        """Get all registered extractors.
        
        Returns:
            List of registered TextExtractor instances.
        """
        return list(self._extractors)


class PDFTextExtractor(TextExtractor):
    """Text extractor for PDF documents using PyMuPDF (fitz)."""
    
    def supports(self, document: LoadedDocument) -> bool:
        return document.metadata.file_extension == ".pdf"
    
    def extract(self, document: LoadedDocument) -> ExtractedText:
        try:
            import fitz
            
            doc = document.raw_data
            if doc is None:
                doc = fitz.open(document.metadata.file_path)
            
            text_parts = []
            headings = []
            links = []
            images = []
            
            for page_num, page in enumerate(doc):
                # Extract text
                page_text = page.get_text()
                text_parts.append(page_text)

                # Extract headings (simplified). This is supplementary
                # structure metadata, not the core extracted text (that's
                # page_text above) -- a single malformed span must never
                # abort extraction for the whole document.
                try:
                    blocks = page.get_text("dict")["blocks"]
                    for block in blocks:
                        if block["type"] == 0:  # Text block
                            for line in block["lines"]:
                                for span in line["spans"]:
                                    # Check for bold/large text as headings
                                    if span["size"] > 14 or span["flags"] & 16:  # Bold flag
                                        heading_text = span["text"].strip()
                                        if heading_text:
                                            headings.append(heading_text)
                except Exception:
                    logger.warning(
                        "Failed to extract headings on page %d; continuing without them",
                        page_num, exc_info=True,
                    )

                # Extract links. PyMuPDF's get_links() uses "from" for the
                # bounding rect, not "rect" -- and link metadata is
                # supplementary (not needed for retrieval), so any
                # unexpected link shape is skipped rather than failing the
                # whole document.
                try:
                    page_links = page.get_links()
                    for link in page_links:
                        if "uri" in link:
                            try:
                                links.append({
                                    "page": page_num,
                                    "uri": link["uri"],
                                    "rect": str(link.get("from", "")),
                                })
                            except Exception:
                                logger.warning(
                                    "Skipping malformed PDF link on page %d",
                                    page_num, exc_info=True,
                                )
                except Exception:
                    logger.warning(
                        "Failed to extract links on page %d; continuing without them",
                        page_num, exc_info=True,
                    )

                # Extract images (info only)
                try:
                    image_list = page.get_images()
                    for img_idx, img in enumerate(image_list):
                        images.append({
                            "page": page_num,
                            "index": img_idx,
                            "xref": img[0]
                        })
                except Exception:
                    logger.warning(
                        "Failed to extract image info on page %d; continuing without it",
                        page_num, exc_info=True,
                    )
            
            full_text = "\n\n".join(text_parts)
            normalized_text = self.normalize_text(full_text)
            
            return ExtractedText(
                text=normalized_text,
                headings=headings,
                links=links,
                images=images
            )
        except Exception as e:
            raise TextExtractionError(f"Failed to extract PDF text: {str(e)}") from e


class DOCXTextExtractor(TextExtractor):
    """Text extractor for DOCX documents using python-docx."""
    
    def supports(self, document: LoadedDocument) -> bool:
        return document.metadata.file_extension == ".docx"
    
    def extract(self, document: LoadedDocument) -> ExtractedText:
        try:
            from docx import Document
            from docx.oxml.text.paragraph import CT_P
            from docx.oxml.table import CT_Tbl
            from docx.table import Table
            from docx.text.paragraph import Paragraph
            
            doc = document.raw_data
            if doc is None:
                doc = Document(document.metadata.file_path)
            
            text_parts = []
            headings = []
            tables = []
            
            # Iterate through document elements
            for element in doc.element.body:
                if isinstance(element, CT_P):
                    para = Paragraph(element, doc)
                    text = para.text.strip()
                    
                    if text:
                        # Check for headings
                        if para.style.name.startswith("Heading"):
                            headings.append(text)
                        text_parts.append(text)
                
                elif isinstance(element, CT_Tbl):
                    table = Table(element, doc)
                    table_data = []
                    for row in table.rows:
                        row_data = [cell.text.strip() for cell in row.cells]
                        table_data.append(row_data)
                    tables.append({
                        "rows": len(table_data),
                        "cols": len(table_data[0]) if table_data else 0,
                        "data": table_data
                    })
                    # Add table text to main text
                    for row in table_data:
                        text_parts.append(" | ".join(row))
            
            full_text = "\n\n".join(text_parts)
            normalized_text = self.normalize_text(full_text)
            
            return ExtractedText(
                text=normalized_text,
                headings=headings,
                tables=tables
            )
        except Exception as e:
            raise TextExtractionError(f"Failed to extract DOCX text: {str(e)}") from e


class TXTTextExtractor(TextExtractor):
    """Text extractor for TXT documents."""
    
    def supports(self, document: LoadedDocument) -> bool:
        return document.metadata.file_extension == ".txt"
    
    def extract(self, document: LoadedDocument) -> ExtractedText:
        try:
            text = document.content
            normalized_text = self.normalize_text(text)
            return ExtractedText(text=normalized_text)
        except Exception as e:
            raise TextExtractionError(f"Failed to extract TXT text: {str(e)}") from e


class MarkdownTextExtractor(TextExtractor):
    """Text extractor for Markdown documents."""
    
    def supports(self, document: LoadedDocument) -> bool:
        return document.metadata.file_extension == ".md"
    
    def extract(self, document: LoadedDocument) -> ExtractedText:
        try:
            text = document.content
            normalized_text = self.normalize_text(text)
            
            # Extract headings
            headings = []
            lines = text.split("\n")
            for line in lines:
                line = line.strip()
                if line.startswith("#"):
                    heading = line.lstrip("#").strip()
                    if heading:
                        headings.append(heading)
            
            return ExtractedText(
                text=normalized_text,
                headings=headings
            )
        except Exception as e:
            raise TextExtractionError(f"Failed to extract Markdown text: {str(e)}") from e