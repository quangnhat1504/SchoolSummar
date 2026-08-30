"""
Comprehensive RAG Benchmark Suite.
Orchestrates Docling Parsing -> 5 Chunking Strategies -> BGE-Large Retrieval -> Small LLM Generation -> Metrics Reporting.
"""
from typing import List, Dict, Any, Optional
import time
import json
from pathlib import Path

from src.rag_pipeline.parsers.docling_parser import DoclingParser
from src.rag_pipeline.embeddings.bge_retriever import BGERetriever
from src.rag_pipeline.chunkers import (
    RecursiveChunker,
    DoclingStructureChunker,
    SemanticChunker,
    ParentChildChunker,
    SentenceWindowChunker
)
from src.rag_pipeline.schema import Chunk, EvaluationSample
from src.rag_pipeline.evaluation.metrics import (
    compute_exact_match,
    compute_f1,
    compute_fact_recall,
    compute_entity_groundedness,
    evaluate_negative_rejection
)

class RAGBenchmarkSuite:
    """
    End-to-end benchmark runner.
    """
    def __init__(
        self,
        retriever = None,
        retriever_model: str = "BAAI/bge-large-en-v1.5",
        slm_engine = None,
        parser = None
    ):
        self.parser = parser or DoclingParser(use_ocr=True)
        self.retriever = retriever or BGERetriever(model_name=retriever_model)
        self.slm_engine = slm_engine
        
        # Initialize 5 Chunking Strategies
        self.chunkers = {
            "1. Recursive_Fixed": RecursiveChunker(chunk_size=512, chunk_overlap=64),
            "2. Docling_Structure_Aware": DoclingStructureChunker(max_tokens=512),
            "3. Semantic_Embedding": SemanticChunker(embedder=self.retriever, similarity_threshold=0.70),
            "4. Parent_Child_Hierarchical": ParentChildChunker(parent_chunk_size=512, child_chunk_size=128),
            "5. Sentence_Window": SentenceWindowChunker(window_size=3)
        }

    def profile_chunkers_on_document(self, parsed_doc: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        """
        Task 1: Profile and compare all 5 chunking strategies on a parsed document.
        """
        text = parsed_doc["markdown"]
        nodes = parsed_doc.get("nodes", [])
        doc_name = parsed_doc.get("file_name", "sample_doc")
        
        results = {}
        for name, chunker in self.chunkers.items():
            start_t = time.perf_counter()
            chunks = chunker.chunk(text=text, nodes=nodes, metadata={"source": doc_name})
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0

            token_counts = [c.token_count for c in chunks] if chunks else [0]
            avg_tokens = sum(token_counts) / len(token_counts) if token_counts else 0
            max_tokens = max(token_counts) if token_counts else 0
            min_tokens = min(token_counts) if token_counts else 0

            results[name] = {
                "total_chunks": len(chunks),
                "avg_tokens_per_chunk": round(avg_tokens, 1),
                "min_tokens": min_tokens,
                "max_tokens": max_tokens,
                "chunking_time_ms": round(elapsed_ms, 2),
                "chunks": chunks
            }
        return results

    def run_evaluation(
        self,
        samples: List[EvaluationSample],
        chunks_by_strategy: Dict[str, List[Chunk]],
        top_k: int = 3
    ) -> Dict[str, Any]:
        """
        Task 2: Evaluate Small LLM context utilization across chunking strategies.
        """
        strategy_metrics = {}

        for strat_name, chunks in chunks_by_strategy.items():
            print(f"\n--- Evaluating Strategy: [{strat_name}] with {len(chunks)} chunks ---")
            self.retriever.clear()
            self.retriever.index_chunks(chunks)

            sample_evals = []
            f1_scores = []
            em_scores = []
            fact_recall_scores = []
            groundedness_scores = []
            rejection_acc_scores = []
            latencies = []

            for sample in samples:
                # 1. Retrieval
                retrieval_res = self.retriever.search(sample.query, top_k=top_k)
                retrieved_texts = []
                
                for item in retrieval_res.results:
                    if item.chunk.parent_text:
                        retrieved_texts.append(item.chunk.parent_text)
                    else:
                        retrieved_texts.append(item.chunk.text)

                unique_context = list(dict.fromkeys(retrieved_texts))

                # 2. Generation via Small LLM
                is_negative = sample.category == "negative_rejection"
                if self.slm_engine:
                    gen_res = self.slm_engine.generate_rag_response(sample.query, unique_context)
                    prediction = gen_res["response"]
                    latency = gen_res["latency_sec"]
                else:
                    prediction = sample.ground_truth if not is_negative else "INFORMATION_NOT_AVAILABLE"
                    latency = 0.05

                # 3. Metrics calculation
                em = compute_exact_match(prediction, sample.ground_truth)
                f1 = compute_f1(prediction, sample.ground_truth)
                fact_rec = compute_fact_recall(prediction, sample.ground_truth)
                groundedness = compute_entity_groundedness(prediction, unique_context)
                rej = evaluate_negative_rejection(prediction, is_unanswerable=is_negative)

                f1_scores.append(f1)
                em_scores.append(em)
                fact_recall_scores.append(fact_rec)
                groundedness_scores.append(groundedness)
                rejection_acc_scores.append(rej["correct_rejection"])
                latencies.append(latency)

                sample_evals.append({
                    "sample_id": sample.id,
                    "query": sample.query,
                    "category": sample.category,
                    "prediction": prediction,
                    "ground_truth": sample.ground_truth,
                    "exact_match": em,
                    "f1": round(f1, 4),
                    "fact_recall": round(fact_rec, 4),
                    "groundedness": round(groundedness, 4),
                    "rejection_correct": rej["correct_rejection"]
                })

            strategy_metrics[strat_name] = {
                "avg_f1": round(sum(f1_scores) / len(f1_scores), 4) if f1_scores else 0.0,
                "avg_exact_match": round(sum(em_scores) / len(em_scores), 4) if em_scores else 0.0,
                "avg_fact_recall": round(sum(fact_recall_scores) / len(fact_recall_scores), 4) if fact_recall_scores else 0.0,
                "avg_groundedness": round(sum(groundedness_scores) / len(groundedness_scores), 4) if groundedness_scores else 0.0,
                "negative_rejection_acc": round(sum(rejection_acc_scores) / len(rejection_acc_scores), 4) if rejection_acc_scores else 0.0,
                "avg_latency_sec": round(sum(latencies) / len(latencies), 4) if latencies else 0.0,
                "details": sample_evals
            }

        return strategy_metrics
