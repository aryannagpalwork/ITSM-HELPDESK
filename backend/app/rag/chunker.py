"""Text chunking interface for RAG pipeline."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional, List
from datetime import datetime
import re
import uuid

from app.rag.document_loader import DocumentMetadata
from app.rag.text_extractor import ExtractedText


@dataclass
class DocumentChunk:
    """Container for a text chunk and its metadata."""
    chunk_id: str
    text: str
    metadata: DocumentMetadata
    chunk_metadata: dict[str, Any] = field(default_factory=dict)
    start_index: int = 0
    end_index: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    embedding: Optional[list[float]] = None
    # New fields per requirements
    document_id: Optional[int] = None
    page_number: Optional[int] = None
    heading: Optional[str] = None
    section: Optional[str] = None
    chunk_number: int = 0
    chunk_text: str = ""  # Alias for text


class Chunker(ABC):
    """Abstract base class for text chunkers."""
    
    @abstractmethod
    def chunk(self, text: str, metadata: DocumentMetadata) -> list[DocumentChunk]:
        """Split text into chunks.
        
        Args:
            text: Text to split into chunks.
            metadata: Document metadata to attach to chunks.
            
        Returns:
            List of DocumentChunk objects.
            
        Raises:
            ChunkingError: If chunking fails.
        """
        pass
    
    @abstractmethod
    def chunk_extracted(self, extracted_text: ExtractedText, metadata: DocumentMetadata) -> list[DocumentChunk]:
        """Split extracted text (with structure) into chunks.
        
        Args:
            extracted_text: ExtractedText containing text and structure.
            metadata: Document metadata to attach to chunks.
            
        Returns:
            List of DocumentChunk objects.
            
        Raises:
            ChunkingError: If chunking fails.
        """
        pass


class ChunkingError(Exception):
    """Exception raised when text chunking fails."""
    pass


class ChunkerRegistry:
    """Registry for managing chunkers."""
    
    def __init__(self):
        self._chunkers: list[Chunker] = []
    
    def register_chunker(self, chunker: Chunker) -> None:
        """Register a text chunker.
        
        Args:
            chunker: Chunker instance to register.
        """
        self._chunkers.append(chunker)
    
    def get_chunker(self, strategy: str) -> Optional[Chunker]:
        """Get a chunker by strategy name.
        
        Args:
            strategy: Chunking strategy name.
            
        Returns:
            Chunker instance if found, None otherwise.
        """
        for chunker in self._chunkers:
            if hasattr(chunker, 'strategy') and chunker.strategy == strategy:
                return chunker
        return None
    
    def get_all_chunkers(self) -> list[Chunker]:
        """Get all registered chunkers.
        
        Returns:
            List of registered Chunker instances.
        """
        return list(self._chunkers)


class RecursiveCharacterTextSplitter(Chunker):
    """Recursive character-based text splitter that splits text recursively."""
    strategy = "recursive"
    
    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        separators: Optional[List[str]] = None
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", " ", ""]
    
    def chunk(self, text: str, metadata: DocumentMetadata) -> list[DocumentChunk]:
        chunks_text = self._split_text(text)
        document_chunks = []
        cursor = 0
        for i, chunk_text in enumerate(chunks_text):
            start_idx, end_idx, cursor = self._locate_chunk(text, chunk_text, cursor)
            chunk = DocumentChunk(
                chunk_id=str(uuid.uuid4()),
                text=chunk_text,
                chunk_text=chunk_text,
                metadata=metadata,
                chunk_number=i + 1,
                start_index=start_idx,
                end_index=end_idx,
            )
            document_chunks.append(chunk)
        return document_chunks

    def chunk_extracted(
        self, extracted_text: ExtractedText, metadata: DocumentMetadata
    ) -> list[DocumentChunk]:
        text = extracted_text.text

        # Locate each heading's real position in the document (instead of
        # guessing a heading per-chunk via substring search after the fact).
        located_headings = self._locate_headings(text, extracted_text.headings or [])

        # Split the document into sections BEFORE running the recursive
        # character splitter. This is the key fix: a short section like
        # "Contraindications\nNone known." must never be merged with the
        # next section's content just because it's small. Splitting by
        # section first guarantees section boundaries are structural, not
        # incidental to how chunk_size happens to fall.
        sections = self._split_into_sections(text, located_headings)

        enhanced_chunks: list[DocumentChunk] = []
        chunk_counter = 0
        for section in sections:
            section_text = section["text"]
            if not section_text.strip():
                continue

            piece_texts = self._split_text(section_text)
            cursor = section["start"]
            for piece in piece_texts:
                if not piece.strip():
                    continue
                start_idx, end_idx, cursor = self._locate_chunk(text, piece, cursor)
                chunk_counter += 1
                chunk = DocumentChunk(
                    chunk_id=str(uuid.uuid4()),
                    text=piece,
                    chunk_text=piece,
                    metadata=metadata,
                    chunk_number=chunk_counter,
                    start_index=start_idx,
                    end_index=end_idx,
                    heading=section["heading"],
                    section=section["heading"] or "General",
                )
                enhanced_chunks.append(chunk)

        return enhanced_chunks

    def _locate_headings(self, text: str, headings: List[str]) -> List[tuple]:
        """Find each heading's actual position in the document text.

        Headings are matched sequentially (each search starts after the
        previous match) so that repeated heading titles resolve to distinct
        occurrences in document order, rather than always pointing at the
        first occurrence in the whole document.
        """
        located = []
        search_from = 0
        for heading in headings:
            if not heading or not heading.strip():
                continue
            idx = text.find(heading, search_from)
            if idx == -1:
                # Heading text may appear earlier than our cursor (out-of-order
                # input); fall back to a full-document search rather than
                # silently dropping the heading.
                idx = text.find(heading)
            if idx != -1:
                located.append((idx, heading))
                search_from = idx + len(heading)
        located.sort(key=lambda pair: pair[0])
        return located

    def _split_into_sections(self, text: str, located_headings: List[tuple]) -> List[dict]:
        """Split text into contiguous sections at heading positions.

        Each section runs from one heading's start to the next heading's
        start (or end of document), so a chunk built from a section's text
        can only ever be labeled with that section's own heading.
        """
        if not located_headings:
            return [{"start": 0, "end": len(text), "heading": None, "text": text}]

        sections = []
        first_pos = located_headings[0][0]
        if first_pos > 0:
            # Preamble text before the first heading (e.g. title page, intro).
            sections.append({
                "start": 0,
                "end": first_pos,
                "heading": None,
                "text": text[0:first_pos],
            })

        for i, (pos, heading) in enumerate(located_headings):
            end = located_headings[i + 1][0] if i + 1 < len(located_headings) else len(text)
            sections.append({
                "start": pos,
                "end": end,
                "heading": heading,
                "text": text[pos:end],
            })

        return sections

    def _locate_chunk(self, text: str, chunk_text: str, cursor: int) -> tuple:
        """Find a chunk's start/end index, searching forward from `cursor`.

        Using a moving cursor (instead of a bare text.find(chunk_text)) avoids
        anchoring every chunk to the FIRST occurrence of its text anywhere in
        the document, which breaks whenever similar phrasing repeats (common
        in manuals with repeated warnings/table headers).
        """
        idx = text.find(chunk_text, cursor)
        if idx == -1:
            idx = text.find(chunk_text)
        if idx == -1:
            # Chunk text was transformed (e.g. via overlap-prepending) and no
            # longer appears verbatim; keep cursor stable rather than
            # collapsing indices to 0.
            return cursor, cursor + len(chunk_text), cursor
        end_idx = idx + len(chunk_text)
        return idx, end_idx, end_idx
    
    def _split_text(self, text: str) -> List[str]:
        # Recursively split the text using the separators
        return self._recursive_split(text, self.separators)
    
    def _recursive_split(self, text: str, separators: List[str]) -> List[str]:
        separator = separators[0]
        new_separators = separators[1:] if len(separators) > 1 else [""]
        
        splits = text.split(separator)
        good_splits = []
        
        for s in splits:
            if len(s) <= self.chunk_size:
                good_splits.append(s)
            else:
                if new_separators:
                    good_splits.extend(self._recursive_split(s, new_separators))
                else:
                    # If no more separators, just split by characters
                    good_splits.extend(self._split_by_char(s))
        
        # Final merge
        final_chunks = self._merge_splits(good_splits, separator)
        return final_chunks
    
    def _merge_splits(self, splits: List[str], separator: str) -> List[str]:
        chunks = []
        current_chunk = ""
        # Use a reasonable separator for overlaps if current one is empty
        overlap_sep = separator if separator else " "
        
        for s in splits:
            if not s:
                continue
                
            if len(current_chunk) + len(s) + len(separator) <= self.chunk_size:
                    if current_chunk:
                        current_chunk += separator + s
                    else:
                        current_chunk = s
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                # Check if overlap is needed
                if len(s) > self.chunk_size:
                    # Handle oversized s
                    chunks.extend(self._split_oversized(s, self.separators))
                    current_chunk = ""
                else:
                    current_chunk = s
        
        if current_chunk:
            chunks.append(current_chunk)
        
        # Now add overlaps
        final_chunks = []
        for i in range(len(chunks)):
            final_chunk = chunks[i]
            if i > 0 and self.chunk_overlap > 0:
                # Overlap with previous chunk
                prev_chunk = chunks[i-1]
                # Take overlap from end of previous chunk
                overlap_start = max(0, len(prev_chunk) - self.chunk_overlap)
                overlap = prev_chunk[overlap_start:].lstrip()  # Clean up
                if overlap and len(overlap) + len(overlap_sep) + len(final_chunk) <= self.chunk_size:
                    final_chunk = overlap + overlap_sep + final_chunk
            final_chunks.append(final_chunk)
                
        return final_chunks
    
    def _split_by_char(self, text: str) -> List[str]:
        return [text[i:i+self.chunk_size] for i in range(0, len(text), self.chunk_size)]
    
    def _split_oversized(self, text: str, separators: List[str]) -> List[str]:
        # Simple fallback for too long text
        return [text[i:i+self.chunk_size] for i in range(0, len(text), max(self.chunk_size - self.chunk_overlap, 1))]