"""
Base Chunker class and utilities for token estimation.
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import tiktoken
from src.rag_pipeline.schema import Chunk, DocumentNode

class BaseChunker(ABC):
    """Abstract base class for all chunking strategies."""
    def __init__(self, name: str, chunk_size: int = 512, chunk_overlap: int = 64):
        self.name = name
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        try:
            self.tokenizer = tiktoken.get_encoding("cl100k_base")
        except Exception:
            self.tokenizer = None

    def count_tokens(self, text: str) -> int:
        """Count tokens using tiktoken (or fallback word estimation)."""
        if not text:
            return 0
        if self.tokenizer:
            return len(self.tokenizer.encode(text))
        return int(len(text.split()) * 1.3)

    @abstractmethod
    def chunk(self, text: str, nodes: Optional[List[DocumentNode]] = None, metadata: Optional[Dict[str, Any]] = None) -> List[Chunk]:
        """Split input document into a list of Chunk objects."""
        pass
