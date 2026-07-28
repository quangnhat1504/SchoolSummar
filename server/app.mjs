import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import pino from 'pino'
import { z } from 'zod'
import { config as defaultConfig } from './config.mjs'
import { getRequestIdentity } from './auth.mjs'
import { ApiError, badRequest, errorPayload, notFound } from './errors.mjs'
import { createStore } from './store.mjs'
import { createObjectStore, objectKeyForPaper } from './storage.mjs'
import { parsePdfUpload } from './upload.mjs'
import { answerQuestion, streamAnswer } from './rag.mjs'
import { processRun } from './processing.mjs'
import { RealtimeHub } from './realtime.mjs'
import { createDoclingAdapter } from './docling.mjs'

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
const paperInput = z.object({ title: z.string().trim().min(1).max(500).optional(), authors: z.array(z.string().trim().min(1).max(200)).max(100).default([]), doi: z.string().trim().max(300).optional(), source: z.string().trim().max(100).optional(), sha256: z.string().regex(/^[0-9a-f]{64}$/i), metadata: z.record(z.any()).optional() })
const messageInput = z.object({ content: z.string().trim().min(1).max(20_000), scope: z.object({ paperId: z.string().uuid().optional() }).optional() })

const sendJson = (response, status, payload, headers = {}) => { response.writeHead(status, { ...jsonHeaders, ...headers }); response.end(JSON.stringify(payload)) }
const parseLimit = (value, fallback = 50) => Math.min(Math.max(Number.parseInt(value || fallback, 10) || fallback, 1), 100)
const pathParts = (pathname) => pathname.split('/').filter(Boolean)
const readJson = async (request, maxBytes) => { let size = 0; const chunks = []; for await (const chunk of request) { size += chunk.length; if (size > maxBytes) throw new ApiError(413, 'payload_too_large', 'JSON body exceeds the configured limit'); chunks.push(chunk) } if (!chunks.length) return {}; try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw badRequest('Request body must be valid JSON') } }
const publicPaper = (paper) => ({ ...paper, status: paper.status === 'uploaded' ? 'Uploaded' : paper.status === 'processing' ? 'Processing' : paper.status === 'ready' ? 'Ready' : paper.status === 'failed' ? 'Failed' : paper.status })

const startProcessing = (store, hub, identity, result, logger, docling, input = {}) => { void processRun({ store, hub, ownerId: identity.userId, run: result.run, jobs: result.jobs, logger, docling, ...input }) }

const queueChat = async ({ store, hub, identity, sessionId, userMessage, question, scope, config, logger }) => {
  hub.publish(identity.userId, 'chat.message.created', { sessionId, message: userMessage })
  try {
    hub.publish(identity.userId, 'chat.started', { sessionId, messageId: userMessage.id })
    const answer = await answerQuestion(config, store, identity.userId, question, scope)
    const assistant = await store.addMessage(identity.userId, sessionId, { role: 'assistant', content: answer.text, model: answer.mode, metadata: { retrievalMode: answer.mode, sourceCount: answer.sources.length } })
    if (answer.sources.length) await store.addCitations(identity.userId, assistant.id, answer.sources)
    await streamAnswer(answer, async (delta) => hub.publish(identity.userId, 'chat.delta', { sessionId, messageId: assistant.id, delta }))
    hub.publish(identity.userId, 'chat.completed', { sessionId, message: { ...assistant, citations: answer.sources } })
  } catch (error) {
    logger.error({ error, sessionId }, 'chat generation failed')
    hub.publish(identity.userId, 'chat.failed', { sessionId, messageId: userMessage.id, message: 'Unable to generate an answer. Please retry.' })
  }
}

export const createApp = (overrides = {}) => {
  const config = { ...defaultConfig, ...overrides }
  const logger = overrides.logger || pino({ level: process.env.LOG_LEVEL || 'info' })
  const store = overrides.store || createStore(config, logger)
  const objectStore = overrides.objectStore || createObjectStore(config)
  const docling = overrides.docling || createDoclingAdapter(config, logger)
  const hub = overrides.hub || new RealtimeHub({ authenticate: (request, url) => getRequestIdentity(request, config, url), logger })

  const server = createServer(async (request, response) => {
    const requestId = request.headers['x-request-id'] || randomUUID()
    const requestUrl = new URL(request.url || '/', config.appUrl)
      response.setHeader('x-request-id', requestId)
    try {
      if (requestUrl.pathname.startsWith('/api/')) {
        if (request.method === 'GET' && requestUrl.pathname === '/api/health') return sendJson(response, 200, { ok: true, service: config.appName, version: '1.0.0', mode: store.kind, realtime: true })
        if (request.method === 'GET' && requestUrl.pathname === '/api/ready') { const readiness = await store.health(); return sendJson(response, readiness.ok ? 200 : 503, { ...readiness, service: config.appName }) }
        const identity = getRequestIdentity(request, config, requestUrl)
        await store.ensureIdentity(identity)
        const parts = pathParts(requestUrl.pathname)
        const method = request.method || 'GET'

        if (method === 'GET' && requestUrl.pathname === '/api/v1/papers') {
          const result = await store.listPapers(identity.userId, { q: requestUrl.searchParams.get('q') || '', status: requestUrl.searchParams.get('status') || '', limit: parseLimit(requestUrl.searchParams.get('limit')), cursor: requestUrl.searchParams.get('cursor') || '' })
          return sendJson(response, 200, { ok: true, data: { ...result, items: result.items.map(publicPaper) } })
        }
        if (method === 'POST' && requestUrl.pathname === '/api/v1/papers') {
          const input = paperInput.parse(await readJson(request, config.maxJsonBytes)); const paper = await store.createPaper(identity.userId, input); const run = await store.createProcessingRun(identity.userId, paper.id); startProcessing(store, hub, identity, run, logger, docling, { filename: `${paper.title}.pdf`, sha256: input.sha256, metadata: input.metadata }); hub.publish(identity.userId, 'paper.created', { paper: publicPaper(paper) }); return sendJson(response, 202, { ok: true, data: { paper: publicPaper(paper), processingRun: run.run } })
        }
        if (method === 'POST' && requestUrl.pathname === '/api/v1/papers/upload') {
          const upload = await parsePdfUpload(request, config); const paper = await store.createPaper(identity.userId, { title: upload.fields.title || upload.filename.replace(/\.pdf$/i, ''), authors: upload.fields.authors ? upload.fields.authors.split(',').map((author) => author.trim()).filter(Boolean) : [], doi: upload.fields.doi || undefined, source: upload.fields.source || 'upload', sha256: upload.sha256, metadata: { fileName: upload.filename } }); const objectKey = objectKeyForPaper(identity.userId, paper.id, upload.filename); await objectStore.putFile(upload.tempPath, objectKey, upload.mimeType); await store.attachFile(identity.userId, paper.id, { objectKey, fileName: upload.filename, mimeType: upload.mimeType, sizeBytes: upload.sizeBytes, sha256: upload.sha256 }); const run = await store.createProcessingRun(identity.userId, paper.id); startProcessing(store, hub, identity, run, logger, docling, { sourcePath: objectStore.kind === 'local' ? join(config.localStorageDir, objectKey) : undefined, filename: upload.filename, sha256: upload.sha256, metadata: paper.metadata }); hub.publish(identity.userId, 'paper.created', { paper: publicPaper(paper) }); return sendJson(response, 202, { ok: true, data: { paper: publicPaper(paper), processingRun: run.run } })
        }
        if (parts[0] === 'api' && parts[1] === 'v1' && parts[2] === 'papers' && parts[3] && method === 'GET' && parts.length === 4) { const paper = await store.getPaper(identity.userId, parts[3]); return sendJson(response, 200, { ok: true, data: { ...paper, status: publicPaper(paper).status } }) }
        if (parts[0] === 'api' && parts[1] === 'v1' && parts[2] === 'papers' && parts[3] && parts[4] === 'processing' && method === 'GET') { const paper = await store.getPaper(identity.userId, parts[3]); return sendJson(response, 200, { ok: true, data: { run: paper.processingRun, jobs: paper.jobs } }) }
        if (method === 'GET' && requestUrl.pathname === '/api/v1/processing') return sendJson(response, 200, { ok: true, data: await store.listProcessing(identity.userId) })
        if (method === 'GET' && requestUrl.pathname === '/api/v1/collections') { const papers = (await store.listPapers(identity.userId, { limit: 100 })).items; const grouped = new Map(); for (const paper of papers) { const name = paper.collection || 'Uncategorized'; const current = grouped.get(name) || { name, count: 0, papers: [] }; current.count += 1; current.papers.push(paper.id); grouped.set(name, current) } return sendJson(response, 200, { ok: true, data: [...grouped.values()] }) }
        if (method === 'GET' && requestUrl.pathname === '/api/v1/sessions') return sendJson(response, 200, { ok: true, data: await store.listSessions(identity.userId) })
        if (method === 'POST' && requestUrl.pathname === '/api/v1/sessions') { const body = await readJson(request, config.maxJsonBytes); const session = await store.createSession(identity.userId, typeof body.title === 'string' ? body.title : null); return sendJson(response, 201, { ok: true, data: session }) }
        if (parts[0] === 'api' && parts[1] === 'v1' && parts[2] === 'sessions' && parts[3] && parts[4] === 'messages' && method === 'GET') return sendJson(response, 200, { ok: true, data: await store.listMessages(identity.userId, parts[3]) })
        if (parts[0] === 'api' && parts[1] === 'v1' && parts[2] === 'sessions' && parts[3] && parts[4] === 'messages' && method === 'POST') { const body = messageInput.parse(await readJson(request, config.maxJsonBytes)); const userMessage = await store.addMessage(identity.userId, parts[3], { role: 'user', content: body.content }); void queueChat({ store, hub, identity, sessionId: parts[3], userMessage, question: body.content, scope: body.scope, config, logger }); return sendJson(response, 202, { ok: true, data: { message: userMessage, status: 'queued' } }) }
        if (parts[0] === 'api' && parts[1] === 'v1' && parts[2] === 'files' && parts[3] && method === 'GET' && objectStore.kind === 'local') { const objectKey = decodeURIComponent(parts.slice(3).join('/')); const filePath = join(config.localStorageDir, objectKey); try { const metadata = await stat(filePath); response.writeHead(200, { 'content-type': 'application/pdf', 'content-length': metadata.size, 'cache-control': 'private, max-age=60' }); return objectStore.stream(objectKey).pipe(response) } catch { throw notFound('File not found') } }
        return sendJson(response, 404, errorPayload(notFound('API route not found'), requestId), { 'cache-control': 'no-store' })
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { ok: false, error: { code: 'method_not_allowed', message: 'Method not allowed', requestId } })
      const dist = join(process.cwd(), 'dist'); const relative = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, ''); const candidate = normalize(join(dist, relative)); const safe = candidate === dist || candidate.startsWith(`${dist}/`); const requested = safe ? candidate : join(dist, 'index.html'); let filePath = requested
      try { if (!(await stat(filePath)).isFile()) filePath = join(dist, 'index.html') } catch { filePath = join(dist, 'index.html') }
      const contentTypes = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' }
      response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] || 'application/octet-stream', 'cache-control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' })
      if (request.method === 'HEAD') return response.end()
      return createReadStream(filePath).pipe(response)
    } catch (error) {
      const status = error?.status || 500
      logger[status >= 500 ? 'error' : 'warn']({ error, requestId, method: request.method, path: requestUrl.pathname }, 'request failed')
      return sendJson(response, status, errorPayload(error, requestId))
    }
  })

  hub.attach(server)
  return { config, server, store, objectStore, hub, logger }
}
