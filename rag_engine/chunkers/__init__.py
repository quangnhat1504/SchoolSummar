"""
Chunkers module registry. Standardized on Docling Structure-Aware Chunking.
"""
from rag_engine.chunkers.base import BaseChunker
from rag_engine.chunkers.docling_chunker import DoclingStructureChunker

__all__ = [
    "BaseChunker",
    "DoclingStructureChunker",
]

