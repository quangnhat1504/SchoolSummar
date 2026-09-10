"""
Cloudflare Workers AI BGE Embedding Provider.
Uses Cloudflare's serverless AI edge to generate BGE-Large embeddings (@cf/baai/bge-large-en-v1.5)
without needing a local GPU or PyTorch install.
"""
from typing import List, Optional, Dict, Any
import os
import json
import time
import urllib.request
import numpy as np


class CloudflareBGEEmbedder:
    """
    Cloudflare Workers AI client for BAAI/bge-large-en-v1.5.
    """
    def __init__(
        self,
        account_id: Optional[str] = None,
        api_token: Optional[str] = None,
        model: str = "@cf/baai/bge-large-en-v1.5",
        worker_url: Optional[str] = None,
        target_dimension: int = 1536
    ):
        self.account_id = account_id or os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
        self.api_token = api_token or os.environ.get("CLOUDFLARE_API_TOKEN", "")
        self.model = model or os.environ.get("CLOUDFLARE_EMBEDDING_MODEL", "@cf/baai/bge-large-en-v1.5")
        self.worker_url = worker_url or os.environ.get("CLOUDFLARE_WORKER_URL", "")
        self.target_dimension = target_dimension

        if self.worker_url:
            self.endpoint = self.worker_url
        else:
            self.endpoint = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/ai/run/{self.model}"

    @property
    def is_configured(self) -> bool:
        return bool(self.worker_url or (self.account_id and self.api_token))

    def encode(self, texts: List[str] | str, normalize_embeddings: bool = True) -> np.ndarray:
        """
        Encode text(s) into embeddings via Cloudflare Workers AI.
        """
        single_input = isinstance(texts, str)
        text_list = [texts] if single_input else list(texts)

        if not text_list:
            return np.empty((0, self.target_dimension), dtype=np.float32)

        if not self.is_configured:
            raise ValueError(
                "Cloudflare Workers AI is not configured. "
                "Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (or CLOUDFLARE_WORKER_URL) in .env"
            )

        headers = {"Content-Type": "application/json"}
        if not self.worker_url and self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"

        payload = json.dumps({"text": text_list}).encode("utf-8")
        req = urllib.request.Request(self.endpoint, data=payload, headers=headers)

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            raise RuntimeError(f"Failed to query Cloudflare Workers AI embedding: {str(e)}")

        # Extract data from response
        if "result" in data and isinstance(data["result"], dict) and "data" in data["result"]:
            vectors = np.array(data["result"]["data"], dtype=np.float32)
        elif "result" in data and isinstance(data["result"], list):
            vectors = np.array(data["result"], dtype=np.float32)
        elif "data" in data:
            vectors = np.array(data["data"], dtype=np.float32)
        else:
            raise RuntimeError(f"Unexpected Cloudflare response: {data}")

        # Normalize if requested
        if normalize_embeddings:
            norms = np.linalg.norm(vectors, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            vectors = vectors / norms

        # Pad to target dimension if needed (e.g. 1024 -> 1536)
        if vectors.shape[1] < self.target_dimension:
            pad_width = self.target_dimension - vectors.shape[1]
            vectors = np.pad(vectors, ((0, 0), (0, pad_width)), mode="constant")
        elif vectors.shape[1] > self.target_dimension:
            vectors = vectors[:, :self.target_dimension]

        return vectors[0] if single_input else vectors
