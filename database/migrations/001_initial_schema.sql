-- Research RAG initial schema
-- PostgreSQL 15+ with pgvector installed.
-- The embedding dimension is intentionally fixed at 1536 in v1. Change both
-- vector(1536) and the dimension check before applying this migration if the
-- selected embedding model has a different dimension.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject text NOT NULL UNIQUE,
  email text,
  password_hash text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text,
  authors jsonb NOT NULL DEFAULT '[]'::jsonb,
  doi text,
  source text,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-fA-F]{64}$'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'processing', 'ready', 'failed', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, sha256)
);

CREATE UNIQUE INDEX papers_owner_doi_uq
  ON papers (owner_id, lower(doi))
  WHERE doi IS NOT NULL;

CREATE TABLE paper_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  paper_id uuid NOT NULL,
  file_type text NOT NULL
    CHECK (file_type IN ('original_pdf', 'supplement')),
  object_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  checksum text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, paper_id, file_type),
  FOREIGN KEY (owner_id, paper_id)
    REFERENCES papers(owner_id, id) ON DELETE CASCADE
);

CREATE TABLE processing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  paper_id uuid NOT NULL,
  pipeline_version text NOT NULL,
  layout_model text,
  ocr_model text,
  embedding_model text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  is_active boolean NOT NULL DEFAULT false,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, id, paper_id),
  FOREIGN KEY (owner_id, paper_id)
    REFERENCES papers(owner_id, id) ON DELETE CASCADE,
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at),
  CHECK (NOT is_active OR status = 'succeeded')
);

CREATE UNIQUE INDEX one_active_processing_run_per_paper
  ON processing_runs (owner_id, paper_id)
  WHERE is_active;

CREATE TABLE pipeline_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  paper_id uuid NOT NULL,
  processing_run_id uuid NOT NULL,
  job_type text NOT NULL
    CHECK (job_type IN ('page_render', 'layout', 'ocr', 'chunk', 'embedding')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  available_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, processing_run_id, job_type),
  FOREIGN KEY (owner_id, processing_run_id, paper_id)
    REFERENCES processing_runs(owner_id, id, paper_id) ON DELETE CASCADE
);

CREATE TABLE paper_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  paper_id uuid NOT NULL,
  processing_run_id uuid NOT NULL,
  page_number integer NOT NULL CHECK (page_number > 0),
  width integer NOT NULL CHECK (width > 0),
  height integer NOT NULL CHECK (height > 0),
  raw_image_object_key text NOT NULL UNIQUE,
  thumbnail_object_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, paper_id, processing_run_id, page_number),
  UNIQUE (owner_id, id, paper_id),
  FOREIGN KEY (owner_id, processing_run_id, paper_id)
    REFERENCES processing_runs(owner_id, id, paper_id) ON DELETE CASCADE
);

CREATE TABLE layout_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  paper_id uuid NOT NULL,
CREATE TABLE chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_key text NOT NULL DEFAULT 'memory-cognition',
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

CREATE UNIQUE INDEX users_email_uq
  ON users (lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id, created_at DESC);
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions (expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  session_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content text NOT NULL,
  model text,
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  FOREIGN KEY (owner_id, session_id)
    REFERENCES chat_sessions(owner_id, id) ON DELETE CASCADE
);

CREATE TABLE message_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  message_id uuid NOT NULL,
  paper_id uuid NOT NULL,
  processing_run_id uuid NOT NULL,
  chunk_id uuid,
  layout_block_id uuid,
  asset_id uuid,
  page_number integer NOT NULL CHECK (page_number > 0),
  quote text NOT NULL,
  bbox jsonb,
  retrieval_score real,
  rank integer NOT NULL CHECK (rank >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, message_id, rank),
  FOREIGN KEY (owner_id, message_id)
    REFERENCES chat_messages(owner_id, id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, processing_run_id, paper_id)
    REFERENCES processing_runs(owner_id, id, paper_id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_id, chunk_id, paper_id)
    REFERENCES document_chunks(owner_id, id, paper_id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_id, layout_block_id, paper_id)
    REFERENCES layout_blocks(owner_id, id, paper_id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_id, asset_id, paper_id)
    REFERENCES paper_assets(owner_id, id, paper_id) ON DELETE RESTRICT
);

CREATE INDEX papers_owner_updated_idx ON papers (owner_id, updated_at DESC, id DESC);
CREATE INDEX papers_owner_status_idx ON papers (owner_id, status, updated_at DESC);
CREATE INDEX processing_runs_paper_idx ON processing_runs (owner_id, paper_id, created_at DESC);
CREATE INDEX pipeline_jobs_claim_idx
  ON pipeline_jobs (status, available_at, created_at)
  WHERE status IN ('queued', 'failed');
CREATE INDEX pages_paper_idx ON paper_pages (owner_id, paper_id, page_number);
CREATE INDEX layout_blocks_page_order_idx
  ON layout_blocks (owner_id, page_id, reading_order);
CREATE INDEX ocr_results_block_idx ON ocr_results (owner_id, layout_block_id);
CREATE INDEX paper_assets_page_idx ON paper_assets (owner_id, page_id, asset_type);
CREATE INDEX chunks_owner_run_idx
  ON document_chunks (owner_id, processing_run_id, chunk_index);
CREATE INDEX chunks_search_vector_idx ON document_chunks USING gin (search_vector);
CREATE INDEX embeddings_owner_model_idx
  ON chunk_embeddings (owner_id, embedding_model_id, chunk_id)
  WHERE is_active;
CREATE INDEX embeddings_vector_hnsw_idx
  ON chunk_embeddings USING hnsw (embedding vector_cosine_ops)
  WHERE is_active;
CREATE INDEX chat_sessions_owner_updated_idx
  ON chat_sessions (owner_id, updated_at DESC, id DESC);
CREATE INDEX chat_messages_session_created_idx
  ON chat_messages (owner_id, session_id, created_at, id);
CREATE INDEX message_citations_message_idx
  ON message_citations (owner_id, message_id, rank);

CREATE TRIGGER users_updated_at_trigger
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER papers_updated_at_trigger
BEFORE UPDATE ON papers
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER processing_runs_updated_at_trigger
BEFORE UPDATE ON processing_runs
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER pipeline_jobs_updated_at_trigger
BEFORE UPDATE ON pipeline_jobs
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER chat_sessions_updated_at_trigger
BEFORE UPDATE ON chat_sessions
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

COMMENT ON TABLE processing_runs IS 'Immutable model/pipeline snapshots; exactly one succeeded run may be active per paper.';
COMMENT ON TABLE paper_assets IS 'Object-storage references for raw pages, tiles, figures and table crops used by citations.';
COMMENT ON TABLE message_citations IS 'Citation snapshot retained so old chat answers remain reproducible after reprocessing.';
COMMENT ON COLUMN chunk_embeddings.embedding IS 'v1 uses 1536 dimensions; change schema before adopting another dimension.';

-- Defense-in-depth tenant isolation. The API must set the local setting at
-- the beginning of every transaction: SELECT set_config('app.user_id', $1, true).
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE layout_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunk_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunk_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_owner_policy ON users
  USING (id = app.current_user_id())
  WITH CHECK (id = app.current_user_id());

CREATE POLICY papers_owner_policy ON papers
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY paper_files_owner_policy ON paper_files
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY processing_runs_owner_policy ON processing_runs
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY pipeline_jobs_owner_policy ON pipeline_jobs
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY paper_pages_owner_policy ON paper_pages
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY layout_blocks_owner_policy ON layout_blocks
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY ocr_results_owner_policy ON ocr_results
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY paper_assets_owner_policy ON paper_assets
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY document_chunks_owner_policy ON document_chunks
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY chunk_blocks_owner_policy ON chunk_blocks
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY chunk_embeddings_owner_policy ON chunk_embeddings
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY chat_sessions_owner_policy ON chat_sessions
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY chat_messages_owner_policy ON chat_messages
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY message_citations_owner_policy ON message_citations
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());

COMMIT;
