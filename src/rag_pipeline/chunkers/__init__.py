"""
Chunkers module registry.
"""
from src.rag_pipeline.chunkers.base import BaseChunker
from src.rag_pipeline.chunkers.recursive_chunker import RecursiveChunker
from src.rag_pipeline.chunkers.docling_chunker import DoclingStructureChunker
from src.rag_pipeline.chunkers.semantic_chunker import SemanticChunker
from src.rag_pipeline.chunkers.parent_child_chunker import ParentChildChunker
from src.rag_pipeline.chunkers.sentence_window_chunker import SentenceWindowChunker

__all__ = [
    "BaseChunker",
    "RecursiveChunker",
    "DoclingStructureChunker",
    "SemanticChunker",
    "ParentChildChunker",
    "SentenceWindowChunker",
]
