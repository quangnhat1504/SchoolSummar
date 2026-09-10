"""
Sentence Window Chunker.
Indexes individual target sentences for vector search while providing a surrounding
window of k sentences before and after to the LLM during generation.
"""
from typing import List, Dict, Any, Optional
import re
from rag_engine.chunkers.base import BaseChunker
from rag_engine.schema import Chunk, DocumentNode

class SentenceWindowChunker(BaseChunker):
    """
    Sentence-Window Chunking Strategy.
    """
    def __init__(self, window_size: int = 3):
        super().__init__(name="Sentence_Window", chunk_size=128)
        self.window_size = window_size

    def _split_sentences(self, text: str) -> List[str]:
        sentence_endings = re.compile(r'(?<=[.!?])\s+')
        sentences = [s.strip() for s in sentence_endings.split(text) if s.strip()]
        return sentences

    def chunk(
        self,
        text: str,
        nodes: Optional[List[DocumentNode]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[Chunk]:
        base_meta = metadata or {}
        sentences = self._split_sentences(text)
        
        chunks: List[Chunk] = []
        n = len(sentences)
        
        for i, sentence in enumerate(sentences):
            start_idx = max(0, i - self.window_size)
            end_idx = min(n, i + self.window_size + 1)
            window_context = " ".join(sentences[start_idx:end_idx]).strip()

            chunk_meta = dict(base_meta)
            chunk_meta.update({
                "strategy": self.name,
                "sentence_index": i,
                "window_size": self.window_size,
                "window_context": window_context
            })

            chunk = Chunk(
                text=sentence,
                metadata=chunk_meta,
                parent_text=window_context,
                token_count=self.count_tokens(sentence)
            )
            chunks.append(chunk)

        return chunks
