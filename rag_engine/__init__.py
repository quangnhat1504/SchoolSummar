"""
RAG Engine Framework for SchoolSummar
Standardized Stack: Docling Structure-Aware Chunking + Qwen2.5-7B + BGE Retriever
"""
from rag_engine.chunkers.docling_chunker import DoclingStructureChunker
from rag_engine.chunkers.base import BaseChunker
from rag_engine.models.slm_engine import SmallLLMEngine
from rag_engine.embeddings.bge_retriever import BGERetriever
from rag_engine.parsers.docling_parser import DoclingParser
from rag_engine.storage.document_store import DocumentStore
from rag_engine.schema import Chunk, DocumentNode, EvaluationSample

__version__ = "0.2.0"

__all__ = [
    "DoclingStructureChunker",
    "BaseChunker",
    "SmallLLMEngine",
    "BGERetriever",
    "DoclingParser",
    "DocumentStore",
    "Chunk",
    "DocumentNode",
    "EvaluationSample",
]

