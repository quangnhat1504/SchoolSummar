/**
 * Client for TencentDB Agent Memory Gateway (:8420)
 * Provides 4-layer memory (L0->L1->L2->L3) and Skill routing for SchoolSummar RAG.
 */

export class AgentMemoryClient {
  constructor(config = {}, logger = console) {
    this.baseUrl = (config.agentMemoryUrl || process.env.AGENT_MEMORY_URL || 'http://127.0.0.1:8420').replace(/\/$/, '')
    this.enabled = config.agentMemoryEnabled ?? (process.env.AGENT_MEMORY_ENABLED !== 'false')
    this.defaultUserId = config.agentMemoryUserId || process.env.AGENT_MEMORY_USER_ID || 'schoolsummar-rag'
    this.logger = logger
  }

  async health() {
    if (!this.enabled) return { enabled: false }
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(2000) })
      if (!res.ok) return { enabled: true, ok: false, status: res.status }
      const data = await res.json()
      return { enabled: true, ok: true, version: data.version, uptime: data.uptime }
    } catch (err) {
      return { enabled: true, ok: false, error: err.message }
    }
  }

  async recall({ query, sessionKey, userId }) {
    if (!this.enabled) return { context: '', memoryCount: 0 }
    let contextParts = []
    let totalCount = 0

    // 1. Query L1/L2 synthesized memories from /recall
    try {
      const res = await fetch(`${this.baseUrl}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          session_key: sessionKey || 'default',
          user_id: userId || this.defaultUserId,
        }),
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.context) {
          contextParts.push(data.context)
          totalCount += data.memory_count || 1
        }
      }
    } catch (err) {
      this.logger?.debug?.({ err: err.message }, 'TencentDB memory recall fetch failed')
    }

    // 2. Query relevant conversation turns from /search/conversations as working memory
    if (sessionKey && query) {
      try {
        const convRes = await this.searchConversations({ query, sessionKey, limit: 3 })
        if (convRes?.results && convRes.total > 0) {
          contextParts.push(`### Relevant Past Conversation:\n${convRes.results}`)
          totalCount += convRes.total
        }
      } catch (err) {
        this.logger?.debug?.({ err: err.message }, 'TencentDB conversation search failed')
      }
    }

    return {
      context: contextParts.join('\n\n'),
      memoryCount: totalCount,
    }
  }

  async capture({ userContent, assistantContent, sessionKey, userId }) {
    if (!this.enabled) return false
    try {
      const res = await fetch(`${this.baseUrl}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_content: userContent,
          assistant_content: assistantContent,
          session_key: sessionKey || 'default',
          user_id: userId || this.defaultUserId,
        }),
        signal: AbortSignal.timeout(4000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async searchMemories({ query, limit = 5 }) {
    if (!this.enabled) return { results: '', total: 0 }
    try {
      const res = await fetch(`${this.baseUrl}/search/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit }),
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) return { results: '', total: 0 }
      return await res.json()
    } catch {
      return { results: '', total: 0 }
    }
  }

  async searchConversations({ query, sessionKey, limit = 5 }) {
    if (!this.enabled) return { results: '', total: 0 }
    try {
      const res = await fetch(`${this.baseUrl}/search/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, session_key: sessionKey, limit }),
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) return { results: '', total: 0 }
      return await res.json()
    } catch {
      return { results: '', total: 0 }
    }
  }
}

export const createAgentMemoryClient = (config, logger) => new AgentMemoryClient(config, logger)
