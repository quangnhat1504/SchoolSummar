# Database migrations

The initial schema is in
[`migrations/001_initial_schema.sql`](migrations/001_initial_schema.sql).
It requires PostgreSQL with the `pgcrypto` and `vector` extensions available.

Apply it to a fresh database with:

```bash
psql "$DATABASE_URL" --file database/migrations/001_initial_schema.sql
```

The application must set the authenticated user at the start of every
transaction before reading or writing tenant-owned rows:

```sql
SELECT set_config('app.user_id', $1, true);
```

The third argument must be `true`, so the setting is scoped to the current
transaction and cannot leak between pooled connections.

## Migration invariants

- `owner_id` is present on all user-owned data paths.
- A paper has at most one active successful processing run.
- A chunk has at most one active embedding.
- `message_citations` retains the processing-run and evidence snapshot used by
  the answer.
- Binary files remain in object storage; SQL stores keys and metadata only.

## Embedding dimension

The v1 schema uses `vector(1536)`. Select the production embedding model before
ingestion. If it emits another dimension, create a replacement migration for
the vector column, the `embedding_models.dimension` check, and the HNSW index.
