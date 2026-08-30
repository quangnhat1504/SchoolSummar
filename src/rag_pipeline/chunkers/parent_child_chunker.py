"""
Hierarchical / Parent-Child Chunker.
Generates small child chunks (e.g., 128 tokens) for vector search accuracy,
linked to parent chunks (e.g., 512+ tokens) for rich LLM context feed.
"""
from typing import List, Dict, Any, Optional
import uuid
from src.rag_pipeline.chunkers.base import BaseChunker
from src.rag_pipeline.chunkers.recursive_chunker import RecursiveChunker
from src.rag_pipeline.schema import Chunk, DocumentNode

class ParentChildChunker(BaseChunker):
    """
    Hierarchical chunker that splits document into Parent chunks and Child chunks.
    """
    def __init__(
        self,
        parent_chunk_size: int = 512,
        child_chunk_size: int = 128,
        child_overlap: int = 32
    ):
        super().__init__(name="Parent_Child_Hierarchical", chunk_size=child_chunk_size)
        self.parent_chunk_size = parent_chunk_size
        self.child_chunk_size = child_chunk_size
        self.child_overlap = child_overlap
        
        self.parent_splitter = RecursiveChunker(chunk_size=parent_chunk_size, chunk_overlap=64)
        self.child_splitter = RecursiveChunker(chunk_size=child_chunk_size, chunk_overlap=child_overlap)

    def chunk(
        self,
        text: str,
        nodes: Optional[List[DocumentNode]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[Chunk]:
        base_meta = metadata or {}
        
        # 1. Generate Parent chunks
        parent_chunks = self.parent_splitter.chunk(text, nodes=nodes, metadata=base_meta)
        
        all_child_chunks: List[Chunk] = []
        
        # 2. Subdivide each parent chunk into child chunks
        for p_idx, p_chunk in enumerate(parent_chunks):
            parent_id = str(uuid.uuid4())
            p_chunk.id = parent_id
            
            children = self.child_splitter.chunk(p_chunk.text, metadata=base_meta)
            for c_idx, c_chunk in enumerate(children):
                c_chunk.parent_id = parent_id
                c_chunk.parent_text = p_chunk.text
                c_chunk.metadata.update({
                    "strategy": self.name,
                    "parent_id": parent_id,
                    "parent_index": p_idx,
                    "child_index": c_idx,
                    "is_child": True
                })
                all_child_chunks.append(c_chunk)

        return all_child_chunks
