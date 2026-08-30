"""
BGE-Large Vector Retriever with FAISS Indexing.
Optimized for CUDA (RTX 5070 Ti) with normalized Cosine Similarity Search.
"""
from typing import List, Optional, Dict, Any
import time
import numpy as np
import torch
import faiss
from sentence_transformers import SentenceTransformer

from src.rag_pipeline.schema import Chunk, RetrievalItem, RetrievalResult

class BGERetriever:
    """
    Vector Retriever powered by BAAI/bge-large-en-v1.5 (or bge-m3) and FAISS FlatIP.
    """
    def __init__(
        self,
        model_name: str = "BAAI/bge-large-en-v1.5",
        device: Optional[str] = None,
        query_instruction: str = "Represent this sentence for searching relevant passages: "
    ):
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        self.model_name = model_name
        self.query_instruction = query_instruction
        print(f"Loading embedding model [{model_name}] on device: {self.device}...")
        self.model = SentenceTransformer(model_name, device=self.device)
        self.dimension = self.model.get_sentence_embedding_dimension()
        
        # FAISS Index for Inner Product (Cosine similarity with normalized vectors)
        self.index = faiss.IndexFlatIP(self.dimension)
        self.chunks: List[Chunk] = []

    def encode_passages(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """Encode passage texts into normalized vectors."""
        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=False,
            normalize_embeddings=True,
            convert_to_numpy=True
        )
        return embeddings.astype(np.float32)

    def encode_queries(self, queries: List[str], batch_size: int = 32) -> np.ndarray:
        """Encode query texts with BGE instruction prefix into normalized vectors."""
        prefixed = [f"{self.query_instruction}{q}" for q in queries]
        embeddings = self.model.encode(
            prefixed,
            batch_size=batch_size,
            show_progress_bar=False,
            normalize_embeddings=True,
            convert_to_numpy=True
        )
        return embeddings.astype(np.float32)

    def index_chunks(self, chunks: List[Chunk], batch_size: int = 32) -> int:
        """
        Add chunks to the FAISS index.
        """
        if not chunks:
            return 0
        
        texts = [c.text for c in chunks]
        embeddings = self.encode_passages(texts, batch_size=batch_size)
        
        for i, chunk in enumerate(chunks):
            chunk.embedding = embeddings[i].tolist()
            
        self.index.add(embeddings)
        self.chunks.extend(chunks)
        return len(chunks)

    def clear(self):
        """Reset the vector index and chunk storage."""
        self.index.reset()
        self.chunks = []

    def search(self, query: str, top_k: int = 5) -> RetrievalResult:
        """
        Perform top-k cosine similarity search for a query.
        """
        start_time = time.perf_counter()
        query_vec = self.encode_queries([query])  # Shape (1, dim)
        
        top_k = min(top_k, max(1, self.index.ntotal))
        if self.index.ntotal == 0:
            return RetrievalResult(query=query, results=[], latency_ms=0.0)

        scores, indices = self.index.search(query_vec, top_k)
        latency_ms = (time.perf_counter() - start_time) * 1000.0

        items = []
        for rank, (score, idx) in enumerate(zip(scores[0], indices[0]), start=1):
            if idx < len(self.chunks):
                chunk = self.chunks[idx]
                items.append(RetrievalItem(
                    chunk=chunk,
                    score=float(score),
                    rank=rank
                ))

        return RetrievalResult(
            query=query,
            results=items,
            latency_ms=latency_ms
        )
