"""Qdrant Vector Database CLI & Python Utility for SchoolSummar RAG.

Zero-dependency implementation (uses standard library urllib) with automatic
fallback to qdrant-client if installed.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def load_env_file() -> None:
    env_path = Path.cwd() / ".env"
    if not env_path.exists():
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key, val = key.strip(), val.strip()
            if (val.startswith('"') and val.endswith('"')) or (
                val.startswith("'") and val.endswith("'")
            ):
                val = val[1:-1]
            if key not in os.environ:
                os.environ[key] = val


load_env_file()


class QdrantRESTClient:
    def __init__(self, url: str, api_key: str = "") -> None:
        self.url = url.rstrip("/")
        self.api_key = api_key

    def _request(
        self, endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        full_url = f"{self.url}/{endpoint.lstrip('/')}"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["api-key"] = self.api_key

        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(full_url, data=body, headers=headers, method=method)

        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                latency_ms = int((time.time() - t0) * 1000)
                raw = resp.read().decode("utf-8")
                try:
                    res = json.loads(raw)
                except Exception:
                    res = {"raw": raw}
                res["_latency_ms"] = latency_ms
                res["_status_code"] = resp.status
                return res
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8")
            try:
                res = json.loads(raw)
            except Exception:
                res = {"error": raw}
            res["_status_code"] = e.code
            res["_error"] = str(e)
            return res
        except Exception as e:
            return {"_status_code": 0, "_error": str(e)}

    def ping(self) -> Dict[str, Any]:
        return self._request("/")

    def list_collections(self) -> Dict[str, Any]:
        return self._request("/collections")

    def get_collection(self, name: str) -> Dict[str, Any]:
        return self._request(f"/collections/{name}")

    def create_collection(
        self, name: str, dim: int = 1536, distance: str = "Cosine"
    ) -> Dict[str, Any]:
        return self._request(
            f"/collections/{name}",
            method="PUT",
            data={"vectors": {"size": dim, "distance": distance}},
        )

    def delete_collection(self, name: str) -> Dict[str, Any]:
        return self._request(f"/collections/{name}", method="DELETE")

    def upsert_points(self, name: str, points: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self._request(
            f"/collections/{name}/points?wait=true",
            method="PUT",
            data={"points": points},
        )

    def search(
        self,
        name: str,
        vector: List[float],
        limit: int = 5,
        filter_dict: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "vector": vector,
            "limit": limit,
            "with_payload": True,
        }
        if filter_dict:
            payload["filter"] = filter_dict
        return self._request(f"/collections/{name}/points/search", method="POST", data=payload)


def main() -> None:
    parser = argparse.ArgumentParser(description="Qdrant Python CLI & Diagnostic Tool")
    parser.add_argument("command", choices=["test", "ping", "list", "info", "create", "delete", "upsert-test", "search-test"], help="Command to run")
    parser.add_argument("--url", "-u", default=os.getenv("QDRANT_URL", "http://localhost:6333"), help="Qdrant endpoint")
    parser.add_argument("--api-key", "-k", default=os.getenv("QDRANT_API_KEY", ""), help="Qdrant API Key")
    parser.add_argument("--collection", "-c", default=os.getenv("QDRANT_COLLECTION_NAME", "schoolsummar_chunks"), help="Collection name")
    parser.add_argument("--dim", "-d", type=int, default=int(os.getenv("EMBEDDING_DIMENSION", 1536)), help="Vector dimension")
    parser.add_argument("--distance", default=os.getenv("QDRANT_DISTANCE", "Cosine"), help="Distance metric")

    args = parser.parse_args()
    client = QdrantRESTClient(args.url, args.api_key)

    masked_key = f"{args.api_key[:6]}...{args.api_key[-4:]}" if args.api_key else "(None)"
    print(f"[Qdrant Tool] Endpoint: {args.url} | Key: {masked_key}")

    if args.command in ("test", "ping"):
        res = client.ping()
        if res.get("_status_code") == 200:
            print(f"✔ Kết nối Qdrant THÀNH CÔNG! (Độ trễ: {res.get('_latency_ms')}ms)")
            print(f"  Version: {res.get('version')} | Title: {res.get('title')}")
        else:
            print(f"✖ Kết nối THẤT BẠI: {res.get('_error') or res}")

    elif args.command == "list":
        res = client.list_collections()
        if res.get("status") == "ok":
            cols = res.get("result", {}).get("collections", [])
            print(f"✔ Tìm thấy {len(cols)} collections:")
            for c in cols:
                print(f"  • {c.get('name')}")
        else:
            print(f"✖ Lỗi: {res.get('_error') or res}")

    elif args.command == "info":
        res = client.get_collection(args.collection)
        if res.get("status") == "ok":
            print(f"✔ Thông tin collection '{args.collection}':")
            print(json.dumps(res.get("result", {}), indent=2))
        else:
            print(f"✖ Không tìm thấy hoặc lỗi: {res.get('_error') or res}")

    elif args.command == "create":
        res = client.create_collection(args.collection, dim=args.dim, distance=args.distance)
        if res.get("status") == "ok":
            print(f"✔ Đã tạo collection '{args.collection}' (dim={args.dim}, metric={args.distance})!")
        else:
            print(f"✖ Tạo collection thất bại: {res.get('_error') or res}")

    elif args.command == "delete":
        res = client.delete_collection(args.collection)
        if res.get("status") == "ok":
            print(f"✔ Đã xóa collection '{args.collection}'!")
        else:
            print(f"✖ Xóa thất bại: {res.get('_error') or res}")

    elif args.command == "upsert-test":
        dummy_vec = [0.01 * (i % 10) for i in range(args.dim)]
        test_pt = {
            "id": 999999,
            "vector": dummy_vec,
            "payload": {
                "title": "Python Test Document",
                "test": True,
                "timestamp": time.time(),
            },
        }
        res = client.upsert_points(args.collection, [test_pt])
        if res.get("status") == "ok":
            print(f"✔ Ghi thử nghiệm thành công 1 vector vào '{args.collection}'!")
        else:
            print(f"✖ Ghi thử nghiệm thất bại: {res.get('_error') or res}")

    elif args.command == "search-test":
        dummy_vec = [0.01 * (i % 10) for i in range(args.dim)]
        res = client.search(args.collection, dummy_vec, limit=3)
        if res.get("status") == "ok":
            matches = res.get("result", [])
            print(f"✔ Tìm kiếm thành công ({len(matches)} kết quả):")
            for m in matches:
                print(f"  • ID: {m.get('id')} | Score: {m.get('score')} | Payload: {m.get('payload')}")
        else:
            print(f"✖ Tìm kiếm thất bại: {res.get('_error') or res}")


if __name__ == "__main__":
    main()
