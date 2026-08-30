#!/usr/bin/env python3
"""
Unified Reproducibility Suite for:
1. Model Layout Detection (Heron-101 on DocBank arXiv papers)
2. Layout-Guided OCR & Reading Order Formatting
3. Vector Retrieval & 5 Chunking Strategies (BGE-Large-en-v1.5 + FAISS FlatIP)
4. Small Language Model (SLM) Groundedness & Fact Recall (Qwen2.5 1.5B, 3B, 7B)
"""

import sys
import os
import argparse
import subprocess
import time
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

def print_header(title: str):
    print("\n" + "=" * 90)
    print(f"  🚀 [REPRODUCE SUITE] {title}")
    print("=" * 90)

def run_step_layout():
    print_header("Step 1: Layout Detection Benchmark (Heron-101 on DocBank)")
    script = PROJECT_ROOT / "benchmark" / "reports" / "heron101_science_eval" / "run_benchmark.py"
    if not script.exists():
        script = PROJECT_ROOT / "tools" / "run_heron101_science_benchmark.py"
    cmd = [sys.executable, str(script), "--seed", "42", "--num-samples", "100"]
    print(f"Executing: {' '.join(cmd)}")
    res = subprocess.run(cmd, cwd=str(PROJECT_ROOT))
    if res.returncode != 0:
        print(f"⚠️ Warning: Layout benchmark exited with code {res.returncode}")

def run_step_ocr():
    print_header("Step 2: Layout-Guided OCR & Reading Order Extraction")
    script = PROJECT_ROOT / "benchmark" / "reports" / "heron101_science_eval" / "ocr_inference_example.py"
    cmd = [sys.executable, str(script)]
    print(f"Executing: {' '.join(cmd)}")
    res = subprocess.run(cmd, cwd=str(PROJECT_ROOT))
    if res.returncode != 0:
        print(f"⚠️ Warning: OCR extraction script exited with code {res.returncode}")

def run_step_retrieval(num_pdfs: int = 30):
    print_header(f"Step 3: Document Chunking & Vector Retrieval Benchmark ({num_pdfs} PDFs)")
    script = PROJECT_ROOT / "src" / "rag_pipeline" / "benchmarks" / "multi_doc_benchmark_50.py"
    cmd = [sys.executable, str(script), "--num_pdfs", str(num_pdfs), "--models", "Qwen/Qwen2.5-1.5B-Instruct"]
    print(f"Executing: {' '.join(cmd)}")
    res = subprocess.run(cmd, cwd=str(PROJECT_ROOT))
    if res.returncode != 0:
        print(f"⚠️ Warning: Retrieval benchmark exited with code {res.returncode}")

def run_step_llm(num_pdfs: int = 30, models=None):
    print_header(f"Step 4: End-to-End Small LLM Groundedness & Evaluation ({num_pdfs} PDFs)")
    if models is None:
        models = [
            "Qwen/Qwen2.5-1.5B-Instruct",
            "Qwen/Qwen2.5-3B-Instruct",
            "Qwen/Qwen2.5-7B-Instruct"
        ]
    script = PROJECT_ROOT / "src" / "rag_pipeline" / "benchmarks" / "multi_doc_benchmark_50.py"
    cmd = [sys.executable, str(script), "--num_pdfs", str(num_pdfs), "--models"] + models
    print(f"Executing: {' '.join(cmd)}")
    res = subprocess.run(cmd, cwd=str(PROJECT_ROOT))
    if res.returncode != 0:
        print(f"⚠️ Warning: LLM benchmark exited with code {res.returncode}")

def main():
    parser = argparse.ArgumentParser(description="Master Reproduction CLI for Layout, OCR, Retrieval, and LLM Pipelines")
    parser.add_argument("--step", choices=["layout", "ocr", "retrieval", "llm", "all"], default="all",
                        help="Choose specific pipeline step to reproduce (default: all)")
    parser.add_argument("--num_pdfs", type=int, default=30, help="Number of PDFs for RAG evaluation (default: 30)")
    parser.add_argument("--models", nargs="+", default=None, help="Custom list of HuggingFace SLM models for evaluation")
    args = parser.parse_args()

    start_t = time.perf_counter()
    print_header("STARTING UNIFIED REPRODUCIBILITY SUITE")
    print(f"Selected Step: {args.step.upper()}")
    print(f"Python Executable: {sys.executable}")
    print(f"Working Directory: {PROJECT_ROOT}")

    if args.step in ["layout", "all"]:
        run_step_layout()
    if args.step in ["ocr", "all"]:
        run_step_ocr()
    if args.step in ["retrieval"]:
        run_step_retrieval(num_pdfs=args.num_pdfs)
    if args.step in ["llm", "all"]:
        run_step_llm(num_pdfs=args.num_pdfs, models=args.models)

    elapsed = time.perf_counter() - start_t
    print_header(f"REPRODUCIBILITY RUN FINISHED IN {elapsed:.2f}s")

if __name__ == "__main__":
    main()
