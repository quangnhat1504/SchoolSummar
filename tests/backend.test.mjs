import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'
import test from 'node:test'
import WebSocket from 'ws'
import pino from 'pino'
import { createApp } from '../server/app.mjs'
import { MemoryStore } from '../server/store.mjs'
import { createDoclingAdapter, normalizeDoclingResult } from '../server/docling.mjs'

const ownerId = '00000000-0000-4000-8000-000000000001'
const logger = pino({ level: 'silent' })

const start = async (options = {}) => {
  const storage = join('/tmp', `research-rag-test-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  await mkdir(storage, { recursive: true })
  const app = createApp({
    logger,
    store: new MemoryStore({ demoUserId: ownerId }),
    localStorageDir: storage,
    doclingMode: 'mock',
    ...options,
  })
  app.server.listen(0, '127.0.0.1')
  await once(app.server, 'listening')
  const address = app.server.address()
  const base = `http://127.0.0.1:${address.port}`
  return { app, base, storage, close: async () => { app.hub.close(); await app.store.close(); await new Promise((resolve) => app.server.close(resolve)); await rm(storage, { recursive: true, force: true }) } }
}

const json = async (base, path, init) => {
  const response = await fetch(`${base}${path}`, init)
  const body = await response.json()
  assert.equal(response.ok, true, JSON.stringify(body))
  return body.data
}

test('Docling result normalization produces RAG-ready pages, blocks and chunks', () => {
  const result = normalizeDoclingResult({ markdown: '# Title\n\nA paragraph.', pages: [{ page_number: 2 }], layout_blocks: [{ id: 'b1', page_number: 2, type: 'paragraph', text: 'A paragraph.' }] })
  assert.equal(result.pages[0].pageNumber, 2)
  assert.equal(result.layoutBlocks[0].id, 'b1')
  assert.equal(result.chunks[0].text, '# Title\n\nA paragraph.')
})

test('API serves SPA, accepts PDF upload, runs Docling and streams chat realtime', async (t) => {
  const runtime = await start()
  t.after(runtime.close)
  const health = await fetch(`${runtime.base}/api/health`)
  assert.equal(health.status, 200)
  const workspace = await fetch(`${runtime.base}/workspace`)
  assert.equal(workspace.status, 200)
  assert.match(await workspace.text(), /Research RAG|<div id="root"/)
  const ws = new WebSocket(`ws://127.0.0.1:${new URL(runtime.base).port}/realtime`)
  const events = []
  ws.on('message', (message) => events.push(JSON.parse(message.toString())))
  await once(ws, 'open')

  const pdf = Buffer.from('%PDF-1.4\n% research-rag test\n%%EOF')
  const form = new FormData()
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'test-paper.pdf')
  const uploadedResponse = await fetch(`${runtime.base}/api/v1/papers/upload`, { method: 'POST', body: form })
  const uploadedBody = await uploadedResponse.json()
  assert.equal(uploadedResponse.status, 202, JSON.stringify(uploadedBody))
  const paperId = uploadedBody.data.paper.id

  const session = await json(runtime.base, '/api/v1/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Integration test' }) })
  await json(runtime.base, `/api/v1/sessions/${session.id}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'What does the uploaded paper discuss?' }) })
  const deadline = Date.now() + 4000
  while (Date.now() < deadline && (!events.some((event) => event.type === 'processing.completed') || !events.some((event) => event.type === 'chat.completed'))) await new Promise((resolve) => setTimeout(resolve, 25))
  ws.close()
  assert.ok(events.some((event) => event.type === 'processing.docling'))
  assert.ok(events.some((event) => event.type === 'processing.completed'))
  assert.ok(events.some((event) => event.type === 'chat.completed'))
  const paper = await json(runtime.base, `/api/v1/papers/${paperId}`)
  assert.equal(paper.status, 'Ready')
  assert.ok(paper.metadata.docling.chunks >= 1)
})

test('Docling service mode posts multipart input and normalizes response', async (t) => {
  const service = createServer(async (request, response) => {
    assert.equal(request.method, 'POST')
    assert.match(request.headers['content-type'], /multipart\/form-data/)
    for await (const _chunk of request) {}
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ markdown: 'Service extracted text', pages: [{ pageNumber: 1 }], chunks: [{ text: 'Service extracted text', pageStart: 1, pageEnd: 1 }] }))
  })
  service.listen(0, '127.0.0.1')
  await once(service, 'listening')
  t.after(() => service.close())
  const pdfPath = join('/tmp', `docling-service-${Date.now()}.pdf`)
  await writeFile(pdfPath, '%PDF-1.4\n%%EOF')
  t.after(() => rm(pdfPath, { force: true }))
  const port = service.address().port
  const adapter = createDoclingAdapter({ doclingMode: 'service', doclingServiceUrl: `http://127.0.0.1:${port}`, doclingServicePath: '/v1/convert', doclingServiceApiKey: '', doclingTimeoutMs: 2000, doclingMaxRetries: 0, doclingPipeline: 'standard', doclingOcr: true, doclingTables: true, doclingChunksType: 'hybrid', doclingMaxPages: 100 }, logger)
  const result = await adapter.convert({ sourcePath: pdfPath, filename: 'service.pdf', sha256: createHash('sha256').update('pdf').digest('hex') })
  assert.equal(result.chunks[0].text, 'Service extracted text')
})
