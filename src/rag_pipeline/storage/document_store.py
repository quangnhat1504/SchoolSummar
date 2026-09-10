"""Document and Chunk Storage Engine for RAG Pipeline.

Combines SQLite (Relational raw text & document metadata storage)
and Qdrant (Vector search & semantic retrieval with rich payloads).
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class DocumentRecord:
    """Represents an ingested document in the database."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    filename: str = ""
    title: str = ""
    file_hash: str = ""
    total_pages: int = 1
    raw_text: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))


@dataclass
class ChunkRecord:
    """Represents a text chunk stored for retrieval."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    document_id: str = ""
    chunk_index: int = 0
    raw_text: str = ""
    title: str = ""
    page_start: int = 1
    page_end: int = 1
    token_count: int = 0
    section_hierarchy: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))


class DocumentStore:
    """
    Unified storage manager:
    - SQLite for persistent relational document & raw text storage.
    - Qdrant Cloud / Local for vector indexing & high-speed semantic search.
    """

    def __init__(
        self,
        db_path: Optional[str | Path] = None,
        qdrant_url: Optional[str] = None,
        qdrant_api_key: Optional[str] = None,
        collection_name: Optional[str] = None,
    ) -> None:
        if db_path is None:
            data_dir = Path.cwd() / "data"
            data_dir.mkdir(parents=True, exist_ok=True)
            self.db_path = data_dir / "rag_storage.db"
        else:
            self.db_path = Path(db_path)
            self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self.qdrant_url = (qdrant_url or os.getenv("QDRANT_URL", "http://localhost:6333")).rstrip("/")
        self.qdrant_api_key = qdrant_api_key or os.getenv("QDRANT_API_KEY", "")
        self.collection_name = collection_name or os.getenv("QDRANT_COLLECTION_NAME", "schoolsummar_chunks")

        self._init_sqlite()
        self._init_qdrant_payload_indexes()

    # -------------------------------------------------------------------------
    # SQLite Database Initialization & Operations
    # -------------------------------------------------------------------------
    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_sqlite(self) -> None:
        """Create database tables and indexes if they do not exist."""
        with self._get_connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    title TEXT,
                    file_hash TEXT UNIQUE,
                    total_pages INTEGER DEFAULT 1,
                    raw_text TEXT NOT NULL,
                    metadata_json TEXT DEFAULT '{}',
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    raw_text TEXT NOT NULL,
                    title TEXT,
                    page_start INTEGER DEFAULT 1,
                    page_end INTEGER DEFAULT 1,
                    token_count INTEGER DEFAULT 0,
                    section_hierarchy_json TEXT DEFAULT '[]',
                    metadata_json TEXT DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks (document_id);
                CREATE INDEX IF NOT EXISTS idx_chunks_page ON chunks (page_start);
                CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents (file_hash);

                CREATE TABLE IF NOT EXISTS queries_log (
                    id TEXT PRIMARY KEY,
                    query TEXT NOT NULL,
                    retrieved_chunks_json TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    latency_ms REAL NOT NULL,
                    created_at TEXT NOT NULL
                );
            """)

    def insert_document(self, doc: DocumentRecord) -> DocumentRecord:
        """Save a document record and its raw text to SQLite."""
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO documents 
                (id, filename, title, file_hash, total_pages, raw_text, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    doc.id,
                    doc.filename,
                    doc.title,
                    doc.file_hash,
                    doc.total_pages,
                    doc.raw_text,
                    json.dumps(doc.metadata, ensure_ascii=False),
                    doc.created_at,
                ),
            )
        return doc

    def get_document(self, doc_id: str) -> Optional[DocumentRecord]:
        """Fetch document record by document ID."""
        with self._get_connection() as conn:
            cur = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
            row = cur.fetchone()
            if not row:
                return None
            return DocumentRecord(
                id=row["id"],
                filename=row["filename"],
                title=row["title"] or "",
                file_hash=row["file_hash"] or "",
                total_pages=row["total_pages"],
                raw_text=row["raw_text"],
                metadata=json.loads(row["metadata_json"] or "{}"),
                created_at=row["created_at"],
            )

    def insert_chunks(self, chunks: List[ChunkRecord]) -> int:
        """Save text chunks to SQLite."""
        if not chunks:
            return 0
        with self._get_connection() as conn:
            conn.executemany(
                """
                INSERT OR REPLACE INTO chunks
                (id, document_id, chunk_index, raw_text, title, page_start, page_end,
                 token_count, section_hierarchy_json, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        c.id,
                        c.document_id,
                        c.chunk_index,
                        c.raw_text,
                        c.title,
                        c.page_start,
                        c.page_end,
                        c.token_count,
                        json.dumps(c.section_hierarchy, ensure_ascii=False),
                        json.dumps(c.metadata, ensure_ascii=False),
                        c.created_at,
                    )
                    for c in chunks
                ],
            )
        return len(chunks)

    def get_chunks_by_document(self, document_id: str) -> List[ChunkRecord]:
        """Fetch all chunks belonging to a document, ordered by chunk_index."""
        with self._get_connection() as conn:
            cur = conn.execute(
                "SELECT * FROM chunks WHERE document_id = ? ORDER BY chunk_index ASC",
                (document_id,),
            )
            results: List[ChunkRecord] = []
            for row in cur.fetchall():
                results.append(
                    ChunkRecord(
                        id=row["id"],
                        document_id=row["document_id"],
                        chunk_index=row["chunk_index"],
                        raw_text=row["raw_text"],
                        title=row["title"] or "",
                        page_start=row["page_start"],
                        page_end=row["page_end"],
                        token_count=row["token_count"],
                        section_hierarchy=json.loads(row["section_hierarchy_json"] or "[]"),
                        metadata=json.loads(row["metadata_json"] or "{}"),
                        created_at=row["created_at"],
                    )
                )
            return results

    # -------------------------------------------------------------------------
    # Qdrant Vector & Payload Storage Operations
    # -------------------------------------------------------------------------
    def _qdrant_request(
        self, endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send HTTP request to Qdrant REST API."""
        full_url = f"{self.qdrant_url}/{endpoint.lstrip('/')}"
        headers = {"Content-Type": "application/json"}
        if self.qdrant_api_key:
            headers["api-key"] = self.qdrant_api_key

        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(full_url, data=body, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw)
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8")
            try:
                return json.loads(raw)
            except Exception:
                return {"status": "error", "error": raw, "code": e.code}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def _init_qdrant_payload_indexes(self) -> None:
        """Ensure Qdrant collection has payload indexes for document_id and chunk_id."""
        # Index document_id as keyword for ultra-fast filtering
        self._qdrant_request(
            f"collections/{self.collection_name}/index?wait=true",
            method="PUT",
            data={"field_name": "document_id", "field_schema": "keyword"},
        )
        self._qdrant_request(
            f"collections/{self.collection_name}/index?wait=true",
            method="PUT",
            data={"field_name": "chunk_id", "field_schema": "keyword"},
        )
        self._qdrant_request(
            f"collections/{self.collection_name}/index?wait=true",
            method="PUT",
            data={"field_name": "page_start", "field_schema": "integer"},
        )

    def sync_chunks_to_qdrant(
        self, chunks: List[ChunkRecord], embeddings: List[List[float]]
    ) -> int:
        """
        Upsert chunks with vectors and rich payloads into Qdrant.
        Stores full raw_text, document_id, chunk_id, page numbers, title, and metadata.
        """
        if not chunks or not embeddings or len(chunks) != len(embeddings):
            raise ValueError("Chunks and embeddings must be non-empty and have matching length.")

        points = []
        for chunk, vec in zip(chunks, embeddings):
            points.append({
                "id": chunk.id,
                "vector": [float(x) for x in vec],
                "payload": {
                    "document_id": chunk.document_id,
                    "chunk_id": chunk.id,
                    "chunk_index": chunk.chunk_index,
                    "raw_text": chunk.raw_text,
                    "title": chunk.title,
                    "page_start": chunk.page_start,
                    "page_end": chunk.page_end,
                    "token_count": chunk.token_count,
                    "section_hierarchy": chunk.section_hierarchy,
                    "metadata": chunk.metadata,
                    "created_at": chunk.created_at,
                },
            })

        batch_size = 64
        total_synced = 0
        for i in range(0, len(points), batch_size):
            batch = points[i : i + batch_size]
            res = self._qdrant_request(
                f"collections/{self.collection_name}/points?wait=true",
                method="PUT",
                data={"points": batch},
            )
            if res.get("status") == "ok":
                total_synced += len(batch)
            else:
                raise RuntimeError(f"Qdrant sync error: {res}")

        return total_synced

    def search_qdrant(
        self,
        query_vector: List[float],
        top_k: int = 5,
        filter_document_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Perform vector similarity search on Qdrant and return retrieved chunks
        with their scores and full raw text payload.
        """
        payload_data: Dict[str, Any] = {
            "vector": [float(x) for x in query_vector],
            "limit": top_k,
            "with_payload": True,
            "with_vector": False,
        }

        if filter_document_id:
            payload_data["filter"] = {
                "must": [{"key": "document_id", "match": {"value": filter_document_id}}]
            }

        res = self._qdrant_request(
            f"collections/{self.collection_name}/points/search",
            method="POST",
            data=payload_data,
        )

        if res.get("status") != "ok":
            raise RuntimeError(f"Qdrant search error: {res}")

        matches = res.get("result", [])
        return [
            {
                "score": match.get("score", 0.0),
                "id": match.get("id"),
                "document_id": match.get("payload", {}).get("document_id"),
                "chunk_id": match.get("payload", {}).get("chunk_id"),
                "chunk_index": match.get("payload", {}).get("chunk_index"),
                "raw_text": match.get("payload", {}).get("raw_text"),
                "title": match.get("payload", {}).get("title"),
                "page_start": match.get("payload", {}).get("page_start"),
                "page_end": match.get("payload", {}).get("page_end"),
                "metadata": match.get("payload", {}).get("metadata", {}),
            }
            for match in matches
        ]

    def log_query(
        self, query: str, retrieved_chunks: List[Dict[str, Any]], answer: str, latency_ms: float
    ) -> str:
        """Log query, retrieved context, and generated answer for audit."""
        log_id = str(uuid.uuid4())
        created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO queries_log (id, query, retrieved_chunks_json, answer, latency_ms, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    log_id,
                    query,
                    json.dumps(retrieved_chunks, ensure_ascii=False),
                    answer,
                    latency_ms,
                    created_at,
                ),
            )
        return log_id
