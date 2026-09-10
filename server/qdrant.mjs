/**
 * Qdrant Vector Database Client for SchoolSummar RAG
 * Native fetch implementation - works seamlessly with Qdrant Cloud or Local Qdrant
 */
export class QdrantVectorStore {
  constructor(config, logger = console) {
    this.url = (config.qdrantUrl || 'http://localhost:6333').replace(/\/$/, '')
    this.apiKey = config.qdrantApiKey || ''
    this.collection = config.qdrantCollection || 'schoolsummar_chunks'
    this.vectorSize = Number(config.embeddingDimension || 1536)
    this.distance = config.qdrantDistance || 'Cosine'
    this.logger = logger
    this.enabled = Boolean(config.qdrantUrl)
  }

  async request(endpoint, method = 'GET', body = null) {
    const url = `${this.url}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`
    const headers = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers['api-key'] = this.apiKey

    const options = { method, headers }
    if (body) options.body = JSON.stringify(body)

    const res = await fetch(url, options)
    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    if (!res.ok) {
      const msg = data?.status?.error || data?.message || res.statusText
      throw new Error(`Qdrant API error (${res.status}): ${msg}`)
    }
    return data
  }

  async health() {
    try {
      const res = await this.request('/')
      return { ok: true, version: res.version, title: res.title }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  async ensureCollection(name = this.collection, size = this.vectorSize, distance = this.distance) {
    try {
      await this.request(`/collections/${name}`)
      return { created: false, name }
    } catch (err) {
      if (err.message.includes('404') || err.message.toLowerCase().includes('not found')) {
        this.logger.info?.({ collection: name, size, distance }, 'Creating Qdrant collection')
        await this.request(`/collections/${name}`, 'PUT', {
          vectors: { size, distance }
        })
        return { created: true, name }
      }
      throw err
    }
  }

  async upsertChunks(chunks, collection = this.collection) {
    if (!chunks || chunks.length === 0) return { count: 0 }
    await this.ensureCollection(collection)

    const points = chunks.map((chunk) => ({
      id: chunk.id,
      vector: chunk.vector,
      payload: {
        paperId: chunk.paperId,
        processingRunId: chunk.processingRunId,
        ownerId: chunk.ownerId,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        title: chunk.title || '',
        pageStart: chunk.pageStart || 1,
        pageEnd: chunk.pageEnd || chunk.pageStart || 1,
        metadata: chunk.metadata || {}
      }
    }))

    const batchSize = 100
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize)
      await this.request(`/collections/${collection}/points?wait=true`, 'PUT', { points: batch })
    }

    return { count: points.length }
  }

  async search(queryVector, { ownerId, paperId, limit = 8, collection = this.collection } = {}) {
    const filterMust = []
    if (ownerId) {
      filterMust.push({ key: 'ownerId', match: { value: ownerId } })
    }
    if (paperId) {
      filterMust.push({ key: 'paperId', match: { value: paperId } })
    }

    const payload = {
      vector: queryVector,
      limit,
      with_payload: true,
      with_vector: false
    }
    if (filterMust.length > 0) {
      payload.filter = { must: filterMust }
    }

    const res = await this.request(`/collections/${collection}/points/search`, 'POST', payload)
    const matches = res.result || []

    return matches.map((match) => ({
      paperId: match.payload?.paperId,
      processingRunId: match.payload?.processingRunId,
      chunkId: match.id,
      title: match.payload?.title || 'Untitled',
      text: match.payload?.text || '',
      pageStart: match.payload?.pageStart || 1,
      pageEnd: match.payload?.pageEnd || 1,
      score: match.score
    }))
  }
}

export const createQdrantStore = (config, logger) => {
  if (!config.qdrantUrl) return null
  return new QdrantVectorStore(config, logger)
}
