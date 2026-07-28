import crypto from 'node:crypto'
import pg from 'pg'
import { randomUUID } from 'node:crypto'
import { conflict, notFound } from './errors.mjs'

const { Pool } = pg
const now = () => new Date().toISOString()
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex')
const normalizePaper = (paper) => ({
  id: paper.id,
  title: paper.title || 'Untitled paper',
  authors: Array.isArray(paper.authors) ? paper.authors : [],
  doi: paper.doi || null,
  source: paper.source || null,
  status: paper.status,
  pages: Number(paper.pages || paper.metadata?.pages || 0),
  added: paper.added || paper.createdAt,
  collection: paper.collection || paper.metadata?.collection || 'Uncategorized',
  color: paper.color || '#d9f5e9',
  createdAt: paper.createdAt,
  updatedAt: paper.updatedAt,
  metadata: paper.metadata || {},
})

const demoPapers = [
  {
    title: 'Attention during encoding enhances memory consolidation in humans',
    authors: ['J. D. Smith et al.'], journal: 'Nature Neuroscience', year: 2021, pages: 18,
    collection: 'Memory & cognition', color: '#d9f5e9', status: 'ready',
    text: 'Items encoded under high attentional focus showed significantly greater stabilization of neural representations during sleep compared to low-attention encoding conditions. Increased slow-wave activity and hippocampal–neocortical coupling predicted stronger recall performance the next day.',
  },
  {
    title: 'Neural markers of memory consolidation across attention levels',
    authors: ['L. M. Chen et al.'], journal: 'Journal of Neuroscience', year: 2020, pages: 12,
    collection: 'Memory & cognition', color: '#e6e8ff', status: 'ready',
    text: 'The magnitude of overnight consolidation scaled with attentional engagement at encoding, suggesting that attention gates which representations receive preferential stabilization.',
  },
  {
    title: 'Sleep-dependent reactivation predicts next-day recall',
    authors: ['R. Patel', 'N. Walsh'], journal: 'Cognitive Science', year: 2019, pages: 24,
    collection: 'Memory & cognition', color: '#fff0c9', status: 'processing',
    text: 'Sleep-dependent reactivation of encoded representations predicts recall performance on the following day.',
  },
  {
    title: 'Hippocampal gating of information during focused attention',
    authors: ['M. Rivera et al.'], journal: 'Science Advances', year: 2022, pages: 16,
    collection: 'Open questions', color: '#f5dce9', status: 'failed',
    text: 'Focused attention changes hippocampal gating and the allocation of information for later memory.',
  },
]

export class MemoryStore {
  constructor({ demoUserId }) {
    this.kind = 'memory'
    this.demoUserId = demoUserId
    this.users = new Map()
    this.papers = new Map()
    this.runs = new Map()
    this.jobs = new Map()
    this.sessions = new Map()
    this.messages = new Map()
    this.citations = new Map()
    this.ensureUser({ userId: demoUserId, subject: 'demo-local-user' })
    for (const seed of demoPapers) this.seedPaper(seed)
  }

  ensureUser(identity) {
    if (!this.users.has(identity.userId)) this.users.set(identity.userId, { id: identity.userId, authSubject: identity.subject, displayName: 'Avery Kim' })
  }

  seedPaper(seed) {
    const id = randomUUID()
    const createdAt = now()
    const paper = { id, ownerId: this.demoUserId, ...seed, doi: null, source: 'demo', sha256: sha(seed.title), metadata: { year: seed.year, pages: seed.pages, collection: seed.collection, text: seed.text, chunks: [{ id: `${id}-chunk-1`, text: seed.text, pageStart: 7, pageEnd: 8, score: 0.87 }] }, createdAt, updatedAt: createdAt }
    this.papers.set(id, paper)
    const runId = randomUUID()
    this.runs.set(runId, { id: runId, ownerId: this.demoUserId, paperId: id, status: 'succeeded', isActive: true, pipelineVersion: 'demo-v1', createdAt, updatedAt: createdAt })
  }

  async health() { return { ok: true, mode: this.kind } }
  async close() {}
  async ensureIdentity(identity) { this.ensureUser(identity) }

  async listPapers(ownerId, { q = '', status = '', limit = 50, cursor = '' } = {}) {
    const query = q.trim().toLowerCase()
    let items = [...this.papers.values()].filter((paper) => paper.ownerId === ownerId && paper.status !== 'deleted')
    if (query) items = items.filter((paper) => `${paper.title} ${paper.authors.join(' ')} ${paper.doi || ''}`.toLowerCase().includes(query))
    if (status) items = items.filter((paper) => paper.status === status)
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    if (cursor) items = items.filter((paper) => paper.id !== cursor)
    const page = items.slice(0, Math.min(Math.max(limit, 1), 100))
    return { items: page.map(normalizePaper), nextCursor: items.length > page.length ? page.at(-1).id : null }
  }

  async getPaper(ownerId, paperId) {
    const paper = this.papers.get(paperId)
    if (!paper || paper.ownerId !== ownerId || paper.status === 'deleted') throw notFound('Paper not found')
    const run = [...this.runs.values()].filter((item) => item.ownerId === ownerId && item.paperId === paperId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    const jobs = run ? [...this.jobs.values()].filter((job) => job.processingRunId === run.id) : []
    return { ...normalizePaper(paper), processingRun: run || null, jobs }
  }

  async createPaper(ownerId, input) {
    this.ensureUser({ userId: ownerId, subject: ownerId })
    if ([...this.papers.values()].some((paper) => paper.ownerId === ownerId && paper.sha256 === input.sha256)) throw conflict('A paper with this file hash already exists')
    const id = randomUUID(); const createdAt = now()
    const paper = { id, ownerId, ...input, status: 'uploaded', createdAt, updatedAt: createdAt, metadata: input.metadata || {} }
    this.papers.set(id, paper)
    return normalizePaper(paper)
  }
  async attachFile(ownerId, paperId, file) { const paper = this.papers.get(paperId); if (!paper || paper.ownerId !== ownerId) throw notFound('Paper not found'); paper.metadata = { ...paper.metadata, objectKey: file.objectKey, fileName: file.fileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes }; paper.updatedAt = now(); return paper }
  async persistDoclingResult(ownerId, paperId, runId, document) {
    const paper = this.papers.get(paperId)
    if (!paper || paper.ownerId !== ownerId) throw notFound('Paper not found')
    paper.metadata = { ...paper.metadata, docling: { pages: document.pages.length, blocks: document.layoutBlocks.length, chunks: document.chunks.length, markdown: document.markdown } }
    paper.metadata.chunks = document.chunks.map((chunk, index) => ({ id: chunk.id || `${runId}-chunk-${index + 1}`, text: chunk.text, pageStart: chunk.pageStart, pageEnd: chunk.pageEnd, score: 0.5, metadata: chunk.metadata }))
    paper.updatedAt = now()
    return document
  }

  async createProcessingRun(ownerId, paperId) {
    const paper = this.papers.get(paperId)
    if (!paper || paper.ownerId !== ownerId) throw notFound('Paper not found')
    const runId = randomUUID(); const createdAt = now()
    const run = { id: runId, ownerId, paperId, status: 'queued', isActive: false, pipelineVersion: 'v1', createdAt, updatedAt: createdAt }
    this.runs.set(runId, run)
    for (const jobType of ['page_render', 'layout', 'ocr', 'chunk', 'embedding']) {
      const job = { id: randomUUID(), ownerId, paperId, processingRunId: runId, jobType, status: 'queued', attempts: 0, createdAt, updatedAt: createdAt }
      this.jobs.set(job.id, job)
    }
    paper.status = 'processing'; paper.updatedAt = now()
    return { run, jobs: [...this.jobs.values()].filter((job) => job.processingRunId === runId) }
  }

  async setRunStatus(ownerId, runId, status, isActive = false) {
    const run = this.runs.get(runId); if (!run || run.ownerId !== ownerId) throw notFound('Processing run not found')
    run.status = status; run.isActive = isActive; run.updatedAt = now()
    if (status === 'running') run.startedAt ||= now()
    if (['succeeded', 'failed', 'cancelled'].includes(status)) run.completedAt = now()
    const paper = this.papers.get(run.paperId); if (paper) { paper.status = status === 'succeeded' ? 'ready' : status === 'failed' ? 'failed' : paper.status; paper.updatedAt = now() }
    return run
  }

  async setJobStatus(ownerId, jobId, status) {
    const job = this.jobs.get(jobId); if (!job || job.ownerId !== ownerId) throw notFound('Pipeline job not found')
    job.status = status; job.updatedAt = now(); job.attempts += status === 'running' ? 1 : 0
    if (status === 'running') job.startedAt = now()
    if (['succeeded', 'failed', 'cancelled'].includes(status)) job.completedAt = now()
    return job
  }

  async listProcessing(ownerId) {
    const runs = [...this.runs.values()].filter((run) => run.ownerId === ownerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return runs.map((run) => ({ ...run, paper: normalizePaper(this.papers.get(run.paperId)), jobs: [...this.jobs.values()].filter((job) => job.processingRunId === run.id) }))
  }

  async createSession(ownerId, title = null) { const id = randomUUID(); const createdAt = now(); const session = { id, ownerId, title: title || 'New research thread', createdAt, updatedAt: createdAt }; this.sessions.set(id, session); return session }
  async listSessions(ownerId) { return [...this.sessions.values()].filter((session) => session.ownerId === ownerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }
  async getSession(ownerId, sessionId) { const session = this.sessions.get(sessionId); if (!session || session.ownerId !== ownerId) throw notFound('Chat session not found'); return session }
  async listMessages(ownerId, sessionId) { await this.getSession(ownerId, sessionId); return [...this.messages.values()].filter((message) => message.ownerId === ownerId && message.sessionId === sessionId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((message) => ({ ...message, citations: this.citations.get(message.id) || [] })) }
  async addMessage(ownerId, sessionId, input) { const session = await this.getSession(ownerId, sessionId); const message = { id: randomUUID(), ownerId, sessionId, role: input.role, content: input.content, model: input.model || null, metadata: input.metadata || {}, createdAt: now() }; this.messages.set(message.id, message); session.updatedAt = now(); return message }
  async addCitations(ownerId, messageId, sources) { const citations = sources.map((source, rank) => ({ id: randomUUID(), ownerId, messageId, paperId: source.paperId, processingRunId: source.processingRunId, chunkId: source.chunkId || null, pageNumber: source.pageStart || 1, quote: source.text, retrievalScore: source.score, rank })); this.citations.set(messageId, citations); return citations }
  async searchChunks(ownerId, query, { paperId, limit = 8 } = {}) {
    const words = query.toLowerCase().split(/\W+/).filter((word) => word.length > 2)
    const results = []
    for (const paper of this.papers.values()) {
      if (paper.ownerId !== ownerId || paper.status === 'deleted' || (paperId && paper.id !== paperId)) continue
      const run = [...this.runs.values()].find((item) => item.ownerId === ownerId && item.paperId === paper.id && item.isActive)
      if (!run) continue
      for (const chunk of paper.metadata?.chunks || []) {
        const haystack = chunk.text.toLowerCase(); const score = words.reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0) / Math.max(words.length, 1)
        if (score > 0 || results.length === 0) results.push({ paperId: paper.id, processingRunId: run.id, chunkId: chunk.id, title: paper.title, text: chunk.text, pageStart: chunk.pageStart || 1, pageEnd: chunk.pageEnd || chunk.pageStart || 1, score: Math.max(score, 0.05) })
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  }
}

export class PostgresStore {
  constructor({ databaseUrl, databaseSsl }) {
    this.kind = 'postgres'
    this.pool = new Pool({ connectionString: databaseUrl, ssl: databaseSsl ? { rejectUnauthorized: false } : false, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 })
  }

  async withTx(ownerId, callback) {
    const client = await this.pool.connect()
    try { await client.query('BEGIN'); await client.query('SELECT set_config($1, $2, true)', ['app.user_id', ownerId]); const result = await callback(client); await client.query('COMMIT'); return result } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  }
  async health() { await this.pool.query('SELECT 1'); return { ok: true, mode: this.kind } }
  async close() { await this.pool.end() }
  async ensureIdentity(identity) { await this.withTx(identity.userId, (client) => client.query('INSERT INTO users (id, auth_subject, display_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET auth_subject = EXCLUDED.auth_subject', [identity.userId, identity.subject, 'Avery Kim'])) }

  async listPapers(ownerId, { q = '', status = '', limit = 50, cursor = '' } = {}) {
    const values = [ownerId]; const where = ['p.owner_id = $1', "p.status <> 'deleted'"]
    if (q) { values.push(`%${q}%`); where.push(`(p.title ILIKE $${values.length} OR p.doi ILIKE $${values.length})`) }
    if (status) { values.push(status); where.push(`p.status = $${values.length}`) }
    if (cursor) { values.push(cursor); where.push(`p.id <> $${values.length}`) }
    values.push(Math.min(Math.max(limit, 1), 100))
    const { rows } = await this.pool.query(`SELECT p.id, p.title, p.authors, p.doi, p.source, p.status, p.metadata, p.created_at, p.updated_at FROM papers p WHERE ${where.join(' AND ')} ORDER BY p.updated_at DESC, p.id DESC LIMIT $${values.length}`, values)
    return { items: rows.map((row) => normalizePaper({ id: row.id, title: row.title, authors: row.authors, doi: row.doi, source: row.source, status: row.status, metadata: row.metadata, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() })), nextCursor: rows.length === values.at(-1) ? rows.at(-1)?.id || null : null }
  }

  async getPaper(ownerId, paperId) {
    const { rows } = await this.pool.query('SELECT id, title, authors, doi, source, status, metadata, created_at, updated_at FROM papers WHERE owner_id=$1 AND id=$2 AND status <> $3', [ownerId, paperId, 'deleted'])
    if (!rows[0]) throw notFound('Paper not found')
    const runResult = await this.pool.query('SELECT id, status, is_active, pipeline_version, created_at, updated_at, started_at, completed_at FROM processing_runs WHERE owner_id=$1 AND paper_id=$2 ORDER BY created_at DESC LIMIT 1', [ownerId, paperId])
    const run = runResult.rows[0] || null
    const jobs = run ? (await this.pool.query('SELECT id, job_type, status, attempts, started_at, completed_at FROM pipeline_jobs WHERE owner_id=$1 AND processing_run_id=$2 ORDER BY created_at', [ownerId, run.id])).rows : []
    return { ...normalizePaper({ ...rows[0], createdAt: rows[0].created_at.toISOString(), updatedAt: rows[0].updated_at.toISOString() }), processingRun: run, jobs }
  }

  async createPaper(ownerId, input) {
    return this.withTx(ownerId, async (client) => {
      await client.query('INSERT INTO users (id, auth_subject, display_name) VALUES ($1, $1, $2) ON CONFLICT (id) DO NOTHING', [ownerId, 'Researcher'])
      const { rows } = await client.query('INSERT INTO papers (owner_id, title, authors, doi, source, sha256, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,title,authors,doi,source,status,metadata,created_at,updated_at', [ownerId, input.title || null, JSON.stringify(input.authors || []), input.doi || null, input.source || null, input.sha256, input.metadata || {}])
      return normalizePaper({ ...rows[0], createdAt: rows[0].created_at.toISOString(), updatedAt: rows[0].updated_at.toISOString() })
    })
  }
  async attachFile(ownerId, paperId, file) { return this.withTx(ownerId, async (client) => { await client.query('INSERT INTO paper_files(owner_id,paper_id,file_type,object_key,mime_type,size_bytes,checksum) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(owner_id,paper_id,file_type) DO UPDATE SET object_key=EXCLUDED.object_key,mime_type=EXCLUDED.mime_type,size_bytes=EXCLUDED.size_bytes,checksum=EXCLUDED.checksum', [ownerId, paperId, 'original_pdf', file.objectKey, file.mimeType, file.sizeBytes, file.sha256]); await client.query('UPDATE papers SET metadata=metadata || $1::jsonb, updated_at=now() WHERE owner_id=$2 AND id=$3', [JSON.stringify({ objectKey: file.objectKey, fileName: file.fileName, sizeBytes: file.sizeBytes }), ownerId, paperId]); return file }) }

  async createProcessingRun(ownerId, paperId) {
    return this.withTx(ownerId, async (client) => {
      const { rows } = await client.query('INSERT INTO processing_runs (owner_id,paper_id,pipeline_version,status) VALUES ($1,$2,$3,$4) RETURNING id,owner_id,paper_id,status,is_active,pipeline_version,created_at,updated_at', [ownerId, paperId, 'v1', 'queued'])
      const run = rows[0]; const jobs = []
      for (const jobType of ['page_render', 'layout', 'ocr', 'chunk', 'embedding']) { const result = await client.query('INSERT INTO pipeline_jobs (owner_id,paper_id,processing_run_id,job_type) VALUES ($1,$2,$3,$4) RETURNING id,job_type,status,attempts,created_at,updated_at', [ownerId, paperId, run.id, jobType]); jobs.push(result.rows[0]) }
      await client.query('UPDATE papers SET status=$1 WHERE owner_id=$2 AND id=$3', ['processing', ownerId, paperId])
      return { run, jobs }
    })
  }

  async setRunStatus(ownerId, runId, status, isActive = false) { return this.withTx(ownerId, async (client) => { const { rows } = await client.query('UPDATE processing_runs SET status=$1,is_active=$2,started_at=CASE WHEN $1=$3 AND started_at IS NULL THEN now() ELSE started_at END,completed_at=CASE WHEN $1 IN ($4,$5,$6) THEN now() ELSE completed_at END WHERE owner_id=$7 AND id=$8 RETURNING *', [status, isActive, 'running', 'succeeded', 'failed', 'cancelled', ownerId, runId]); if (!rows[0]) throw notFound('Processing run not found'); if (status === 'succeeded') await client.query('UPDATE papers SET status=$1 WHERE owner_id=$2 AND id=$3', ['ready', ownerId, rows[0].paper_id]); return rows[0] }) }
  async setJobStatus(ownerId, jobId, status) { return this.withTx(ownerId, async (client) => { const { rows } = await client.query('UPDATE pipeline_jobs SET status=$1,attempts=attempts+CASE WHEN $1=$2 THEN 1 ELSE 0 END,started_at=CASE WHEN $1=$2 THEN now() ELSE started_at END,completed_at=CASE WHEN $1 IN ($3,$4,$5) THEN now() ELSE completed_at END WHERE owner_id=$6 AND id=$7 RETURNING *', [status, 'running', 'succeeded', 'failed', 'cancelled', ownerId, jobId]); if (!rows[0]) throw notFound('Pipeline job not found'); return rows[0] }) }
  async listProcessing(ownerId) { const { rows } = await this.pool.query('SELECT r.*, p.title, p.authors, p.status AS paper_status FROM processing_runs r JOIN papers p ON p.owner_id=r.owner_id AND p.id=r.paper_id WHERE r.owner_id=$1 ORDER BY r.created_at DESC', [ownerId]); return Promise.all(rows.map(async (run) => ({ ...run, jobs: (await this.pool.query('SELECT * FROM pipeline_jobs WHERE owner_id=$1 AND processing_run_id=$2 ORDER BY created_at', [ownerId, run.id])).rows }))) }
  async createSession(ownerId, title = null) { const { rows } = await this.pool.query('INSERT INTO chat_sessions(owner_id,title) VALUES($1,$2) RETURNING *', [ownerId, title || 'New research thread']); return rows[0] }
  async listSessions(ownerId) { return (await this.pool.query('SELECT id,title,created_at,updated_at FROM chat_sessions WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 100', [ownerId])).rows }
  async getSession(ownerId, sessionId) { const { rows } = await this.pool.query('SELECT id,owner_id,title,created_at,updated_at FROM chat_sessions WHERE owner_id=$1 AND id=$2', [ownerId, sessionId]); if (!rows[0]) throw notFound('Chat session not found'); return rows[0] }
  async listMessages(ownerId, sessionId) { await this.getSession(ownerId, sessionId); const { rows } = await this.pool.query('SELECT m.id,m.session_id,m.role,m.content,m.model,m.metadata,m.created_at,COALESCE((SELECT json_agg(c ORDER BY c.rank) FROM message_citations c WHERE c.owner_id=m.owner_id AND c.message_id=m.id),\'[]\'::json) citations FROM chat_messages m WHERE m.owner_id=$1 AND m.session_id=$2 ORDER BY m.created_at,m.id', [ownerId, sessionId]); return rows }
  async addMessage(ownerId, sessionId, input) { await this.getSession(ownerId, sessionId); const { rows } = await this.pool.query('INSERT INTO chat_messages(owner_id,session_id,role,content,model,metadata) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [ownerId, sessionId, input.role, input.content, input.model || null, input.metadata || {}]); return rows[0] }
  async addCitations(ownerId, messageId, sources) { const rows = []; for (const [rank, source] of sources.entries()) { const result = await this.pool.query('INSERT INTO message_citations(owner_id,message_id,paper_id,processing_run_id,chunk_id,page_number,quote,retrieval_score,rank) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [ownerId, messageId, source.paperId, source.processingRunId, source.chunkId || null, source.pageStart || 1, source.text, source.score, rank]); rows.push(result.rows[0]) } return rows }
  async searchChunks(ownerId, query, { paperId, limit = 8 } = {}) { const values = [ownerId, query]; const scope = paperId ? 'AND c.paper_id = $3' : ''; if (paperId) values.push(paperId); values.push(limit); const result = await this.pool.query(`SELECT c.id AS chunk_id,c.paper_id,c.processing_run_id,c.text,c.page_start,c.page_end,p.title,ts_rank_cd(c.search_vector, plainto_tsquery('simple',$2)) AS score FROM document_chunks c JOIN papers p ON p.owner_id=c.owner_id AND p.id=c.paper_id JOIN processing_runs r ON r.owner_id=c.owner_id AND r.id=c.processing_run_id AND r.is_active=true WHERE c.owner_id=$1 ${scope} AND (c.search_vector @@ plainto_tsquery('simple',$2) OR c.text ILIKE '%' || $2 || '%') ORDER BY score DESC,c.chunk_index LIMIT $${values.length}`, values); return result.rows.map((row) => ({ paperId: row.paper_id, processingRunId: row.processing_run_id, chunkId: row.chunk_id, title: row.title, text: row.text, pageStart: row.page_start, pageEnd: row.page_end, score: Number(row.score) })) }
}

export const createStore = (config, logger) => {
  if (config.storeMode === 'memory' || (!config.databaseUrl && config.storeMode !== 'postgres')) return new MemoryStore({ demoUserId: config.demoUserId })
  const store = new PostgresStore(config)
  logger.info({ mode: store.kind }, 'postgres store configured')
  return store
}
