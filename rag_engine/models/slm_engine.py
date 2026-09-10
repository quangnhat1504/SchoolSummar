"""
Local Small Language Model (SLM) Engine for RAG inference.
Optimized for CUDA (RTX 5070 Ti 16GB) with bfloat16 / float16.
"""
from typing import Dict, Any, List, Optional
import time
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

RAG_SYSTEM_PROMPT = """You are a strictly grounded AI research assistant.
Your job is to answer the user's question accurately based EXCLUSIVELY on the provided Context.

RULES:
1. Base your answer ONLY on the explicit facts mentioned in the Context.
2. If the Context does not contain sufficient information to answer the question, you MUST respond EXACTLY with:
"INFORMATION_NOT_AVAILABLE"
3. Do NOT assume, extrapolate, or bring in external knowledge not present in the Context.
4. Be clear, concise, and factual.
"""

class SmallLLMEngine:
    """
    Engine to load and run Small Language Models locally on GPU.
    """
    def __init__(
        self,
        model_id: str = "Qwen/Qwen2.5-3B-Instruct",
        device: Optional[str] = None,
        torch_dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
        max_new_tokens: int = 512,
        temperature: float = 0.0
    ):
        self.model_id = model_id
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.torch_dtype = torch_dtype
        self.max_new_tokens = max_new_tokens
        self.temperature = temperature

        print(f"Loading Small LLM [{model_id}] on {self.device} with {self.torch_dtype}...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype=self.torch_dtype,
            device_map="auto" if self.device == "cuda" else None,
            trust_remote_code=True
        )
        if self.device == "cuda" and not hasattr(self.model, "hf_device_map"):
            self.model = self.model.to(self.device)
        self.model.eval()

    def generate_rag_response(
        self,
        query: str,
        context_chunks: List[str],
        custom_system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate answer for query given a list of context chunks.
        """
        system_prompt = custom_system_prompt or RAG_SYSTEM_PROMPT
        
        # Build context block
        context_str = "\n\n---\n\n".join([f"Context [{i+1}]:\n{c}" for i, c in enumerate(context_chunks)])
        user_message = f"Context:\n{context_str}\n\nQuestion: {query}\nAnswer:"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]

        formatted_prompt = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )

        inputs = self.tokenizer(
            formatted_prompt,
            return_tensors="pt",
            max_length=2048,
            truncation=True
        ).to(self.device)
        input_token_len = inputs.input_ids.shape[1]

        start_time = time.perf_counter()
        with torch.no_grad():
            gen_tokens = self.model.generate(
                **inputs,
                max_new_tokens=self.max_new_tokens,
                temperature=self.temperature if self.temperature > 0 else None,
                do_sample=False if self.temperature == 0.0 else True,
                pad_token_id=self.tokenizer.eos_token_id
            )
        elapsed_sec = time.perf_counter() - start_time

        output_tokens = gen_tokens[0][input_token_len:]
        response_text = self.tokenizer.decode(output_tokens, skip_special_tokens=True).strip()
        num_generated_tokens = len(output_tokens)
        throughput = num_generated_tokens / elapsed_sec if elapsed_sec > 0 else 0.0
        
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        return {
            "query": query,
            "response": response_text,
            "input_tokens": input_token_len,
            "output_tokens": num_generated_tokens,
            "latency_sec": elapsed_sec,
            "throughput_tok_per_sec": throughput,
            "model_id": self.model_id
        }
