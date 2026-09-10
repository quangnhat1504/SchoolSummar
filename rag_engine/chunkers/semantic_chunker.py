"""
Semantic Chunker.
Splits sentences based on embedding distance/similarity drops between adjacent sentences.
"""
from typing import List, Dict, Any, Optional
import re
import numpy as np
from rag_engine.chunkers.base import BaseChunker
from rag_engine.schema import Chunk, DocumentNode

class SemanticChunker(BaseChunker):
    """
    Semantic chunker based on embedding similarity drops between consecutive sentences.
    """
    def __init__(
        self,
        embedder = None,
        similarity_threshold: float = 0.70,
        min_chunk_size: int = 64,
        max_chunk_size: int = 512
    ):
        super().__init__(name="Semantic_Embedding_Split", chunk_size=max_chunk_size)
        self.embedder = embedder
        self.similarity_threshold = similarity_threshold
        self.min_chunk_size = min_chunk_size

    def _split_into_sentences(self, text: str) -> List[str]:
        # Split by newlines, double newlines, periods, and multilingual punctuation
        raw_paras = re.split(r'\n{2,}|\n', text)
        sentences = []
        for p in raw_paras:
            if not p.strip():
                continue
            sub_sents = re.split(r'(?<=[.!?。；;])\s+', p)
            for s in sub_sents:
                s_clean = s.strip()
                if s_clean:
                    # If sentence is extremely long (>512 tokens), sub-split it
                    if len(s_clean.split()) > 200:
                        words = s_clean.split()
                        for k in range(0, len(words), 150):
                            sentences.append(" ".join(words[k:k+150]))
                    else:
                        sentences.append(s_clean)
        return sentences if sentences else [text]

    def chunk(
        self,
        text: str,
        nodes: Optional[List[DocumentNode]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[Chunk]:
        base_meta = metadata or {}
        sentences = self._split_into_sentences(text)
        
        if len(sentences) <= 1 or self.embedder is None:
            # Enforce max chunk size even for single sentence
            tokens = self.count_tokens(text)
            if tokens <= self.chunk_size:
                return [Chunk(
                    text=text,
                    metadata={**base_meta, "strategy": self.name, "chunk_index": 0},
                    token_count=tokens
                )]
            else:
                # Sub-chunk by word limits
                words = text.split()
                chunks = []
                for idx, k in enumerate(range(0, len(words), 300)):
                    c_text = " ".join(words[k:k+300])
                    chunks.append(Chunk(
                        text=c_text,
                        metadata={**base_meta, "strategy": self.name, "chunk_index": idx},
                        token_count=self.count_tokens(c_text)
                    ))
                return chunks

        # Encode all sentences
        embeddings = self.embedder.encode_passages(sentences)  # Normalized embeddings

        # Calculate cosine similarities between sentence[i] and sentence[i+1]
        similarities = []
        for i in range(len(embeddings) - 1):
            sim = np.dot(embeddings[i], embeddings[i+1])
            similarities.append(float(sim))

        chunks: List[Chunk] = []
        current_sentences = [sentences[0]]
        current_tokens = self.count_tokens(sentences[0])

        for i, sim in enumerate(similarities):
            next_sent = sentences[i+1]
            next_tokens = self.count_tokens(next_sent)

            # Split condition: similarity drops below threshold OR chunk reaches max tokens
            should_split = (sim < self.similarity_threshold and current_tokens >= self.min_chunk_size) or \
                           (current_tokens + next_tokens > self.chunk_size)

            if should_split:
                chunk_text = " ".join(current_sentences).strip()
                chunks.append(Chunk(
                    text=chunk_text,
                    metadata={**base_meta, "chunk_index": len(chunks), "strategy": self.name},
                    token_count=self.count_tokens(chunk_text)
                ))
                current_sentences = [next_sent]
                current_tokens = next_tokens
            else:
                current_sentences.append(next_sent)
                current_tokens += next_tokens

        if current_sentences:
            chunk_text = " ".join(current_sentences).strip()
            chunks.append(Chunk(
                text=chunk_text,
                metadata={**base_meta, "chunk_index": len(chunks), "strategy": self.name},
                token_count=self.count_tokens(chunk_text)
            ))

        return chunks
