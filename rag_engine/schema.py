"""
Data schemas for the RAG pipeline.
"""
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
import uuid

@dataclass
class DocumentNode:
    """Represents a structural element parsed from document (section, paragraph, table)."""
    text: str
    element_type: str  # 'heading', 'paragraph', 'table', 'code', 'list'
    page_number: int = 1
    metadata: Dict[str, Any] = field(default_factory=dict)
    section_hierarchy: List[str] = field(default_factory=list)

@dataclass
class Chunk:
    """Standard chunk representation."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    text: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    token_count: int = 0
    parent_id: Optional[str] = None
    parent_text: Optional[str] = None
    embedding: Optional[List[float]] = None

@dataclass
class RetrievalItem:
    """Individual retrieved chunk with score."""
    chunk: Chunk
    score: float
    rank: int

@dataclass
class RetrievalResult:
    """Aggregated retrieval result for a query."""
    query: str
    results: List[RetrievalItem]
    latency_ms: float = 0.0

@dataclass
class EvaluationSample:
    """Sample case for RAG benchmark evaluation."""
    id: str
    query: str
    ground_truth: str
    context_chunks: List[str]
    category: str = "general"  # 'direct', 'multi-hop', 'negative_rejection', 'noise'
    metadata: Dict[str, Any] = field(default_factory=dict)
