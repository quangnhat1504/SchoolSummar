/**
 * Embedding Service for SchoolSummar RAG
 * Supports Cloudflare Workers AI (@cf/baai/bge-large-en-v1.5),
 * HuggingFace Inference API, and Local/Fallback Embeddings.
 */

export class CloudflareEmbeddingProvider {
  constructor(config = {}, logger = console) {
    this.accountId = config.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || ''
    this.apiToken = config.cloudflareApiToken || process.env.CLOUDFLARE_API_TOKEN || ''
    this.model = config.cloudflareEmbeddingModel || process.env.CLOUDFLARE_EMBEDDING_MODEL || '@cf/baai/bge-large-en-v1.5'
    this.workerUrl = config.cloudflareWorkerUrl || process.env.CLOUDFLARE_WORKER_URL || ''
    this.targetDimension = Number(config.embeddingDimension || process.env.EMBEDDING_DIMENSION || 1536)
    this.logger = logger
  }

  get isConfigured() {
    return Boolean(this.workerUrl || (this.accountId && this.apiToken))
  }

  /**
   * Determine the target endpoint
   */
  get endpoint() {
    if (this.workerUrl) {
      return this.workerUrl
    }
    return `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`
  }

  /**
   * Embed multiple passages/texts using Cloudflare Workers AI
   * @param {string[]} texts
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async embedTexts(texts) {
    if (!Array.isArray(texts) || texts.length === 0) return []

    if (!this.isConfigured) {
      this.logger.warn?.('Cloudflare Workers AI credentials not set. Falling back to deterministic pseudo-embeddings.')
      return texts.map((t, idx) => this.generateFallbackVector(t, idx))
    }

    const headers = { 'Content-Type': 'application/json' }
    if (!this.workerUrl && this.apiToken) {
      headers.Authorization = `Bearer ${this.apiToken}`
    }

    // Cloudflare Workers AI accepts { text: string | string[] }
    const payload = { text: texts }

    const startTime = Date.now()
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(`Cloudflare Workers AI embedding error (${response.status}): ${errorBody}`)
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    // Cloudflare response schema: { result: { shape: [N, 1024], data: [[...], [...]] }, success: true }
    let rawVectors = []
    if (data.result?.data) {
      rawVectors = data.result.data
    } else if (Array.isArray(data.result)) {
      rawVectors = data.result
    } else if (Array.isArray(data.data)) {
      rawVectors = data.data
    } else {
      throw new Error(`Unexpected Cloudflare embedding response format: ${JSON.stringify(data).slice(0, 200)}`)
    }

    this.logger.info?.({
      count: rawVectors.length,
      nativeDim: rawVectors[0]?.length || 0,
      targetDim: this.targetDimension,
      latencyMs,
    }, 'Generated embeddings via Cloudflare Workers AI')

    // Pad vectors to target dimension if necessary (e.g. 1024 -> 1536 for Qdrant collection)
    return rawVectors.map((vec) => this.padVector(vec, this.targetDimension))
  }

  /**
   * Embed a single query
   * @param {string} query
   * @returns {Promise<number[]>}
   */
  async embedQuery(query) {
    const vectors = await this.embedTexts([query])
    return vectors[0] || []
  }

  /**
   * Pad or truncate vector to target dimension
   */
  padVector(vector, targetDim) {
    if (!targetDim || vector.length === targetDim) return vector
    if (vector.length > targetDim) return vector.slice(0, targetDim)
    const padded = new Array(targetDim).fill(0)
    for (let i = 0; i < vector.length; i += 1) {
      padded[i] = vector[i]
    }
    return padded
  }

  /**
   * Deterministic fallback vector for offline testing
   */
  generateFallbackVector(text, seed = 0) {
    const vector = new Array(this.targetDimension).fill(0)
    let hash = seed + 42
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) & 0xffffffff
    }
    for (let i = 0; i < this.targetDimension; i += 1) {
      hash = (hash * 1664525 + 1013904223) & 0xffffffff
      vector[i] = (hash / 0xffffffff) * 2 - 1
    }
    // Normalize
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1
    return vector.map((v) => v / norm)
  }
}

export class LocalEmbeddingProvider {
  constructor(config = {}, logger = console) {
    let baseUrl = config.embeddingBaseUrl || process.env.EMBEDDING_BASE_URL || process.env.LLM_BASE_URL || 'http://127.0.0.1:8000/v1'
    baseUrl = baseUrl.replace(/\/$/, '')
    if (!baseUrl.endsWith('/v1') && !baseUrl.endsWith('/embeddings')) {
      baseUrl = `${baseUrl}/v1`
    }
    this.endpoint = baseUrl.endsWith('/embeddings') ? baseUrl : `${baseUrl}/embeddings`
    this.model = config.embeddingModel || process.env.EMBEDDING_MODEL || 'BAAI/bge-large-en-v1.5'
    this.targetDimension = Number(config.embeddingDimension || process.env.EMBEDDING_DIMENSION || 1536)
    this.apiKey = config.embeddingApiKey || process.env.EMBEDDING_API_KEY || ''
    this.logger = logger
  }

  get isConfigured() {
    return Boolean(this.endpoint)
  }

  padVector(vector, targetDim) {
    if (!targetDim || vector.length === targetDim) return vector
    if (vector.length > targetDim) return vector.slice(0, targetDim)
    const padded = new Array(targetDim).fill(0)
    for (let i = 0; i < vector.length; i += 1) {
      padded[i] = vector[i]
    }
    return padded
  }

  generateFallbackVector(text, seed = 0) {
    const vector = new Array(this.targetDimension).fill(0)
    let hash = seed + 42
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) & 0xffffffff
    }
    for (let i = 0; i < this.targetDimension; i += 1) {
      hash = (hash * 1664525 + 1013904223) & 0xffffffff
      vector[i] = (hash / 0xffffffff) * 2 - 1
    }
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1
    return vector.map((v) => v / norm)
  }

  async embedTexts(texts) {
    if (!Array.isArray(texts) || texts.length === 0) return []
    const startTime = Date.now()
    const headers = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        throw new Error(`Local embedding error (${response.status}): ${errorBody}`)
      }

      const data = await response.json()
      const latencyMs = Date.now() - startTime

      let rawVectors = []
      if (Array.isArray(data.data)) {
        rawVectors = data.data.map((item) => item.embedding || item)
      } else if (Array.isArray(data.embeddings)) {
        rawVectors = data.embeddings
      } else if (Array.isArray(data.result?.data)) {
        rawVectors = data.result.data
      } else {
        throw new Error(`Unexpected local embedding response format: ${JSON.stringify(data).slice(0, 200)}`)
      }

      this.logger.info?.({
        count: rawVectors.length,
        nativeDim: rawVectors[0]?.length || 0,
        targetDim: this.targetDimension,
        latencyMs,
      }, 'Generated embeddings via Local BGE Retriever')

      return rawVectors.map((vec) => this.padVector(vec, this.targetDimension))
    } catch (err) {
      this.logger.warn?.({ error: err.message }, 'Local embeddings failed; falling back to deterministic vectors')
      return texts.map((t, idx) => this.generateFallbackVector(t, idx))
    }
  }

  async embedQuery(query) {
    const vectors = await this.embedTexts([query])
    return vectors[0] || []
  }
}

/**
 * Factory function to instantiate configured embedding provider
 */
export const createEmbeddingProvider = (config = {}, logger = console) => {
  const providerType = (config.embeddingProvider || process.env.EMBEDDING_PROVIDER || 'local').toLowerCase()

  if (providerType === 'local' || providerType === 'ollama' || providerType === 'custom') {
    return new LocalEmbeddingProvider(config, logger)
  }

  return new CloudflareEmbeddingProvider(config, logger)
}
