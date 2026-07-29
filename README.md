# Research RAG

Research RAG turns research PDFs into a searchable, explainable workspace:

```text
PDF upload → layout detection / OCR → chunks → retrieval → cited answer
```

## Run locally

```bash
npm install
cp .env.sample .env
npm run dev
```

The dev command prints the frontend URL it selected. It starts the API on `6100` and Vite on the first available port starting at `5173`, with `/api` and `/realtime` proxied to the API; this avoids failures when another local app already uses `5173`. For a production-like build, run `npm run build && npm start` and open `http://localhost:6100`. `DOCLING_MODE=mock` keeps a fresh checkout runnable; use `service` or `cli` for real PDF processing.

The workspace supports local email/password login at `/login`. Set
`AUTH_REQUIRED=true` and a strong `AUTH_SESSION_SECRET` for production. Chat
sessions are persisted per user and project; the workspace reopens the selected
session and the History view reads from `GET /api/v1/sessions`.
Passwords require at least 5 characters for this local research workspace.

## LLM configuration

The server uses a provider chain so chat remains available when a hosted model is rate-limited:

```dotenv
LLM_PROVIDER=auto
LLM_PROVIDER_ORDER=groq,openrouter,huggingface,ollama,custom
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.1-8b-instant
```

Groq is the primary hosted Llama 3.1 8B provider. OpenRouter, Hugging Face, and optional local Ollama are fallbacks. If every provider is unavailable, the RAG service returns a grounded extractive answer from the retrieved OCR chunks. Provider state is visible at `GET /api/v1/llm/health`.

See [docs/llm-providers.md](docs/llm-providers.md) for provider limits and setup details.

## Repository structure

| Folder | Responsibility |
| --- | --- |
| `src/` | React UI, landing page, workspace, and reusable components |
| `server/` | HTTP API, auth, storage, Docling pipeline, RAG, LLM routing, realtime events |
| `database/` | PostgreSQL/pgvector migration and data invariants |
| `docs/` | Architecture and provider documentation |
| `design-system/` | UI/UX design system used by the landing page |
| `tests/` | Backend, pipeline, realtime, and provider failover tests |

## Quality checks

```bash
npm run check
npm test
npm run build
```

Binary PDFs, page images, and raw OCR/Docling payloads belong in configured object storage; PostgreSQL stores metadata, text, chunks, embeddings, and evidence references.
