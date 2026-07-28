# Research RAG data architecture

This project stores relational metadata and search data in PostgreSQL and keeps
large binaries in S3-compatible object storage. PostgreSQL should not contain
PDF bytes, page images, tiles, or OCR engine JSON blobs.

## Storage layout

Use immutable keys scoped by user, paper, and processing run:

```text
users/{user_id}/papers/{paper_id}/original.pdf
users/{user_id}/papers/{paper_id}/runs/{run_id}/pages/0001/raw.webp
users/{user_id}/papers/{paper_id}/runs/{run_id}/pages/0001/thumb.webp
users/{user_id}/papers/{paper_id}/runs/{run_id}/tiles/{level}/{x}_{y}.webp
users/{user_id}/papers/{paper_id}/runs/{run_id}/assets/{asset_id}.webp
users/{user_id}/papers/{paper_id}/runs/{run_id}/ocr/result.json
```

The `object_key`, checksum, MIME type, and size are stored in the database.
The API checks ownership before returning a short-lived signed URL.

## Request identity and RLS

At the beginning of every API transaction, set the authenticated user:

```sql
SELECT set_config('app.user_id', $1, true);
```

All user-owned tables carry `owner_id`. The migration enables PostgreSQL row
level security as defense in depth. Background workers should use a separate
trusted database role or explicitly set the relevant user identity.

Do not use a pooled connection without setting the value transaction-locally;
the third argument to `set_config` must remain `true`.

## Pipeline contract

1. Insert `papers` and `paper_files` after upload.
2. Create one `processing_runs` row and one job per stage in `pipeline_jobs`.
3. Render pages into object storage and register them in `paper_pages`.
4. Store detector output in `layout_blocks` with pixel and normalized bounding boxes.
5. Store OCR text per block in `ocr_results`; keep large raw OCR responses in object storage.
6. Create `document_chunks` and their `chunk_blocks` mapping.
7. Insert embeddings into `chunk_embeddings`; mark only the selected model/run active.
8. Mark the processing run active only after all required stages succeed.

Every worker must be idempotent. Use the unique constraints on run/stage,
page number, chunk index, OCR engine, and embedding model as the final guard
against duplicate writes.

## Retrieval and citation

The v1 retrieval query should filter by `owner_id`, active embedding model, and
active processing run before ranking results. Combine vector similarity with
the GIN full-text index on `document_chunks.search_vector` and rerank the
merged candidates in the application.

`message_citations` stores a snapshot of the quote, page number, bounding box,
processing run, chunk, and optional asset. This is deliberate: a later OCR or
layout run must not silently change the evidence shown for an old answer.

To return an image citation:

1. Load `message_citations.asset_id`.
2. Verify the citation belongs to the requesting `owner_id`.
3. Resolve `paper_assets.object_key`.
4. Return a short-lived signed URL, optionally alongside the saved bounding box.

## Embedding dimension

The initial migration uses `vector(1536)` and enforces 1536 in
`embedding_models`. This is a schema decision, not a runtime setting. If the
chosen production model emits 768 or 1024 dimensions, change the vector type,
dimension check, and vector index in a new migration before ingesting data.

## Operational checks

- Benchmark p95 hybrid retrieval with a representative corpus before adding a separate vector database.
- Monitor queue age, stage duration, retry count, OCR confidence, embedding failures, and object-storage errors.
- Use cursor pagination on papers, sessions, and messages.
- Keep old processing runs until citations and retention policy allow cleanup.
- Delete objects through a background cleanup job after database soft-delete/retention checks.
