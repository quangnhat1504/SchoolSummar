"""
Recursive Character Chunker.
Splits text hierarchically by paragraphs, newlines, sentences, and spaces.
"""
from typing import List, Dict, Any, Optional
from src.rag_pipeline.chunkers.base import BaseChunker
from src.rag_pipeline.schema import Chunk, DocumentNode

class RecursiveChunker(BaseChunker):
    """
    Standard Recursive Character Chunking strategy.
    """
    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 64,
        separators: Optional[List[str]] = None
    ):
        super().__init__(name="Recursive_Fixed", chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        self.separators = separators or ["\n\n", "\n", ". ", "? ", "! ", " ", ""]

    def _split_text(self, text: str, separators: List[str]) -> List[str]:
        final_chunks = []
        separator = separators[-1]
        new_separators = []

        for i, _s in enumerate(separators):
            if _s == "":
                separator = _s
                break
            if _s in text:
                separator = _s
                new_separators = separators[i + 1:]
                break

        splits = text.split(separator) if separator != "" else list(text)
        good_splits = []
        
        for s in splits:
            if not s.strip():
                continue
            if self.count_tokens(s) < self.chunk_size:
                good_splits.append(s)
            else:
                if good_splits:
                    merged = self._merge_splits(good_splits, separator)
                    final_chunks.extend(merged)
                    good_splits = []
                if not new_separators:
                    final_chunks.append(s)
                else:
                    other_chunks = self._split_text(s, new_separators)
                    final_chunks.extend(other_chunks)
                    
        if good_splits:
            merged = self._merge_splits(good_splits, separator)
            final_chunks.extend(merged)

        return final_chunks

    def _merge_splits(self, splits: List[str], separator: str) -> List[str]:
        docs = []
        current_doc = []
        total_tokens = 0

        for d in splits:
            d_len = self.count_tokens(d)
            if total_tokens + d_len > self.chunk_size:
                if current_doc:
                    doc_text = separator.join(current_doc).strip()
                    if doc_text:
                        docs.append(doc_text)
                    
                    # Apply overlap
                    while total_tokens > self.chunk_overlap and len(current_doc) > 1:
                        total_tokens -= self.count_tokens(current_doc[0])
                        current_doc.pop(0)
                        
                current_doc.append(d)
                total_tokens = sum(self.count_tokens(x) for x in current_doc)
            else:
                current_doc.append(d)
                total_tokens += d_len

        if current_doc:
            doc_text = separator.join(current_doc).strip()
            if doc_text:
                docs.append(doc_text)

        return docs

    def chunk(self, text: str, nodes: Optional[List[DocumentNode]] = None, metadata: Optional[Dict[str, Any]] = None) -> List[Chunk]:
        base_meta = metadata or {}
        raw_chunks = self._split_text(text, self.separators)
        
        chunks = []
        for i, c_text in enumerate(raw_chunks):
            chunk_meta = dict(base_meta)
            chunk_meta["chunk_index"] = i
            chunk_meta["strategy"] = self.name
            
            chunk = Chunk(
                text=c_text,
                metadata=chunk_meta,
                token_count=self.count_tokens(c_text)
            )
            chunks.append(chunk)
            
        return chunks
