# LLM provider routing

Research RAG uses an OpenAI-compatible provider adapter so the chat API does not depend on one vendor. Configure keys in `.env`; never put them in `.env.sample` or the frontend.

## Current provider assessment

| Priority | Provider | Model/configuration | Cost posture | Role |
| --- | --- | --- | --- | --- |
| 1 | Groq | `llama-3.1-8b-instant` | Free plan with rate limits | Primary hosted Llama 3.1 8B provider |
| 2 | OpenRouter | `openrouter/free` | Free models, low shared limits | Free hosted fallback; selected model can change |
| 3 | Hugging Face Inference Providers | `meta-llama/Llama-3.1-8B-Instruct:fastest` | Monthly free credits, then usage-based | Optional provider-router fallback |
| 4 | Ollama | `llama3.1:8b` | Local/self-hosted | No quota or vendor dependency when installed |
| 5 | Grounded fallback | Retrieval extractive answer | Always available | Keeps chat useful when every LLM is unavailable |

Groq's current free-plan limits and model availability are documented in its [rate-limit documentation](https://console.groq.com/docs/rate-limits) and [model page](https://console.groq.com/docs/model/llama-3.1-8b-instant). OpenRouter documents that free models have low limits and can be unavailable during peaks in its [FAQ](https://openrouter.ai/docs/faq), so it is deliberately not the only dependency. Hugging Face documents its OpenAI-compatible router and free monthly credits in [chat completion](https://huggingface.co/docs/inference-providers/en/tasks/chat-completion) and [pricing](https://huggingface.co/docs/inference-providers/en/pricing). Provider model catalogs change; the application therefore treats the exact model as configuration rather than hard-coding a guarantee.

SambaNova's `Meta-Llama-3.1-8B-Instruct` was removed on April 14, 2026 according to its [deprecation list](https://docs.sambanova.ai/docs/en/models/deprecations). Cerebras lists `llama3.1-8b` as deprecated in its [supported-models documentation](https://inference-docs.cerebras.ai/models/overview), so neither is in the default chain.

## Configuration

```dotenv
LLM_PROVIDER=auto
LLM_PROVIDER_ORDER=groq,openrouter,huggingface,ollama,custom
GROQ_API_KEY=...
GROQ_MODEL=llama-3.1-8b-instant
OPENROUTER_API_KEY=...
HF_TOKEN=...
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_MODEL=llama3.1:8b
```

The server loads `.env` through Node's `--env-file-if-exists` flag. Check the non-secret status at `GET /api/v1/llm/health`. The response never includes API keys.

## Reliability behavior

Each request uses a timeout, bounded exponential retry, `Retry-After` support, and a per-provider circuit breaker. Providers are attempted in `LLM_PROVIDER_ORDER`. If all providers fail or no key is configured, the RAG service returns a grounded extractive answer from retrieved OCR chunks and records `retrievalMode: fallback`; the chat endpoint therefore remains usable instead of returning a 500.
