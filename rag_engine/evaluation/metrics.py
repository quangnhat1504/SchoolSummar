"""
Fair and Standardized Evaluation Metrics for RAG and Small LLMs.
Includes:
1. Fact / Entity Recall (Containment without verbosity penalty)
2. Negative Abstention Accuracy (Detection of unanswerable questions)
3. Entity-Level Groundedness / Faithfulness (Checking if generated numbers/entities come from context)
4. Standard Token F1 and Exact Match
5. Retrieval Hit@K and MRR
"""
from typing import List, Dict, Any, Set
import re
from collections import Counter

def normalize_text(s: str) -> str:
    """Lower text and remove punctuation, articles and extra whitespace."""
    def remove_articles(text):
        return re.sub(r'\b(a|an|the)\b', ' ', text)

    def white_space_fix(text):
        return ' '.join(text.split())

    def remove_punc(text):
        return re.sub(r'[^\w\s]', '', text)

    return white_space_fix(remove_articles(remove_punc(s.lower())))

def compute_fact_recall(prediction: str, ground_truth: str) -> float:
    """
    Measures if the key facts/tokens in ground truth are successfully captured in prediction.
    Prevents penalizing models that provide thorough explanations.
    """
    norm_pred = normalize_text(prediction)
    norm_gt = normalize_text(ground_truth)
    
    if norm_gt in norm_pred:
        return 1.0

    gt_tokens = [t for t in norm_gt.split() if len(t) > 2]
    if not gt_tokens:
        return 1.0 if norm_pred == norm_gt else 0.0

    captured = sum(1 for tok in gt_tokens if tok in norm_pred)
    return captured / len(gt_tokens)

def compute_exact_match(prediction: str, ground_truth: str) -> float:
    """Compute exact match between normalized prediction and ground truth."""
    return 1.0 if normalize_text(prediction) == normalize_text(ground_truth) else 0.0

def compute_f1(prediction: str, ground_truth: str) -> float:
    """Compute standard token-level F1 score."""
    pred_tokens = normalize_text(prediction).split()
    gt_tokens = normalize_text(ground_truth).split()

    if not pred_tokens or not gt_tokens:
        return 1.0 if pred_tokens == gt_tokens else 0.0

    common = Counter(pred_tokens) & Counter(gt_tokens)
    num_same = sum(common.values())

    if num_same == 0:
        return 0.0

    precision = 1.0 * num_same / len(pred_tokens)
    recall = 1.0 * num_same / len(gt_tokens)
    f1 = (2 * precision * recall) / (precision + recall)
    return f1

def evaluate_negative_rejection(prediction: str, is_unanswerable: bool) -> Dict[str, float]:
    """
    Evaluates whether the model properly identifies missing information and abstains.
    """
    rejection_keywords = [
        "information_not_available",
        "not available",
        "not mentioned",
        "not provided",
        "does not contain",
        "cannot be determined",
        "no information",
        "not explicitly mentioned"
    ]
    norm_pred = prediction.lower()
    model_abstained = any(k in norm_pred for k in rejection_keywords)

    if is_unanswerable:
        correct = 1.0 if model_abstained else 0.0
    else:
        correct = 1.0 if not model_abstained else 0.0

    return {
        "correct_rejection": correct,
        "abstained": 1.0 if model_abstained else 0.0
    }

def compute_entity_groundedness(prediction: str, context_chunks: List[str]) -> float:
    """
    Extracts numerical entities and capitalized words from prediction and verifies
    whether they exist in the retrieved context (Strict Anti-Hallucination metric).
    """
    # Extract numbers and potential named entities
    entities = re.findall(r'\b(?:\d+(?:\.\d+)?|[A-Z][a-zA-Z0-9_-]+)\b', prediction)
    if not entities:
        return 1.0

    all_context = " ".join(context_chunks)
    grounded_count = 0

    for ent in entities:
        # Ignore common prompt keywords
        if ent.lower() in ["the", "this", "context", "question", "answer", "information_not_available"]:
            continue
        if ent in all_context:
            grounded_count += 1
        else:
            # Check case-insensitive match for words
            if ent.lower() in all_context.lower():
                grounded_count += 1

    valid_entities = [e for e in entities if e.lower() not in ["the", "this", "context", "question", "answer", "information_not_available"]]
    if not valid_entities:
        return 1.0

    return grounded_count / len(valid_entities)

def compute_retrieval_metrics(retrieved_chunk_ids: List[str], gold_chunk_ids: List[str], top_k: int = 5) -> Dict[str, float]:
    """
    Compute standard information retrieval metrics.
    """
    k_retrieved = retrieved_chunk_ids[:top_k]
    hits = sum(1 for cid in gold_chunk_ids if cid in k_retrieved)

    hit_at_k = 1.0 if hits > 0 else 0.0
    precision_at_k = hits / len(k_retrieved) if k_retrieved else 0.0
    recall_at_k = hits / len(gold_chunk_ids) if gold_chunk_ids else 0.0

    mrr = 0.0
    for rank, cid in enumerate(k_retrieved, start=1):
        if cid in gold_chunk_ids:
            mrr = 1.0 / rank
            break

    return {
        f"hit@{top_k}": hit_at_k,
        f"precision@{top_k}": precision_at_k,
        f"recall@{top_k}": recall_at_k,
        "mrr": mrr
    }
