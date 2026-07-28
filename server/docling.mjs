import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const asText = (value) => typeof value === 'string' ? value.trim() : ''
const hashText = (value) => createHash('sha256').update(value).digest('hex')

const normalizePage = (page, index) => ({
  pageNumber: Number(page.pageNumber || page.page_number || page.number || index + 1),
  width: Number(page.width || 612),
  height: Number(page.height || 792),
  imageObjectKey: page.imageObjectKey || page.image_object_key || null,
})

const normalizeBlock = (block, index) => ({
  id: block.id || block.blockId || `block-${index + 1}`,
  pageNumber: Number(block.pageNumber || block.page_number || block.page || 1),
  type: String(block.type || block.blockType || block.label || 'paragraph').toLowerCase(),
  text: asText(block.text || block.content || block.markdown),
  bbox: block.bbox || block.boundingBox || block.bounding_box || { x1: 0, y1: index * 24, x2: 612, y2: index * 24 + 20 },
  readingOrder: Number(block.readingOrder ?? block.reading_order ?? index),
  confidence: block.confidence == null ? null : Number(block.confidence),
  metadata: block.metadata || {},
})

const normalizeChunk = (chunk, index) => ({
  id: chunk.id || chunk.chunkId || `chunk-${index + 1}`,
  text: asText(chunk.text || chunk.content || chunk.markdown),
  pageStart: Number(chunk.pageStart || chunk.page_start || chunk.page || 1),
  pageEnd: Number(chunk.pageEnd || chunk.page_end || chunk.pageStart || chunk.page_start || chunk.page || 1),
  blocks: Array.isArray(chunk.blocks) ? chunk.blocks : [],
  metadata: chunk.metadata || {},
})

export const normalizeDoclingResult = (raw, { fallbackText = '', filename = 'document.pdf' } = {}) => {
  const root = raw?.document || raw?.data?.document || raw?.output || raw?.data || raw || {}
  const markdown = asText(raw?.markdown || raw?.data?.markdown || root.markdown || root.text || fallbackText)
  const rawPages = Array.isArray(root.pages) ? root.pages : Array.isArray(raw?.pages) ? raw.pages : []
  const rawBlocks = Array.isArray(root.layoutBlocks) ? root.layoutBlocks : Array.isArray(root.layout_blocks) ? root.layout_blocks : Array.isArray(raw?.layoutBlocks) ? raw.layoutBlocks : []
  const rawChunks = Array.isArray(root.chunks) ? root.chunks : Array.isArray(raw?.chunks) ? raw.chunks : []
  const blocks = rawBlocks.map(normalizeBlock).filter((block) => block.text)
  const pages = rawPages.map(normalizePage)
  const chunks = (rawChunks.length ? rawChunks : markdown ? [{ text: markdown, pageStart: 1, pageEnd: Math.max(pages.length, 1), blocks: blocks.map((block) => block.id) }] : []).map(normalizeChunk).filter((chunk) => chunk.text)
  if (!pages.length && (blocks.length || chunks.length)) pages.push(normalizePage({}, 0))
  const ocrResults = (Array.isArray(root.ocrResults) ? root.ocrResults : Array.isArray(root.ocr_results) ? root.ocr_results : blocks.filter((block) => block.text).map((block) => ({ blockId: block.id, text: block.text, engine: 'docling', confidence: block.confidence }))).map((result) => ({ blockId: result.blockId || result.block_id, text: asText(result.text), engine: result.engine || result.ocrEngine || 'docling', language: result.language || null, confidence: result.confidence == null ? null : Number(result.confidence) })).filter((result) => result.text)
  return { filename, markdown, pages, layoutBlocks: blocks, ocrResults, chunks, metadata: { source: 'docling', ...(raw?.metadata || root.metadata || {}) } }
}

const mockResult = ({ filename = 'document.pdf', metadata = {} } = {}) => {
  const text = asText(metadata.text) || `Docling is ready to process ${filename}. Upload a PDF and configure DOCLING_MODE=service or DOCLING_MODE=cli for production extraction.`
  return normalizeDoclingResult({ markdown: text, pages: [{ pageNumber: 1, width: 612, height: 792 }], layoutBlocks: [{ id: 'mock-block-1', pageNumber: 1, type: 'paragraph', text, bbox: { x1: 36, y1: 36, x2: 576, y2: 120 }, readingOrder: 0, confidence: 1 }], chunks: [{ id: 'mock-chunk-1', text, pageStart: 1, pageEnd: 1, blocks: ['mock-block-1'] }] }, { filename })
}

const retryable = (error) => error?.retryable === true || ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(error?.code)

const fetchService = async (config, input) => {
  if (!config.doclingServiceUrl) throw new Error('DOCLING_SERVICE_URL is required when DOCLING_MODE=service')
  const url = new URL(config.doclingServicePath || '/v1/convert', config.doclingServiceUrl).toString()
  const bytes = await readFile(input.sourcePath)
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: 'application/pdf' }), input.filename || 'document.pdf')
  form.append('pipeline', config.doclingPipeline)
  form.append('ocr', String(config.doclingOcr))
  form.append('tables', String(config.doclingTables))
  form.append('chunks_type', config.doclingChunksType)
  form.append('max_num_pages', String(config.doclingMaxPages))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.doclingTimeoutMs)
  try {
    const headers = { 'x-idempotency-key': input.sha256 || hashText(bytes) }
    if (config.doclingServiceApiKey) headers.authorization = `Bearer ${config.doclingServiceApiKey}`
    const response = await fetch(url, { method: 'POST', headers, body: form, signal: controller.signal })
    const body = await response.text()
    if (!response.ok) { const error = new Error(`Docling service returned HTTP ${response.status}: ${body.slice(0, 300)}`); error.retryable = response.status >= 500 || response.status === 429; throw error }
    try { return JSON.parse(body) } catch { return { markdown: body } }
  } finally { clearTimeout(timer) }
}

const runCli = async (config, input) => {
  if (!input.sourcePath) throw new Error('A local source file is required when DOCLING_MODE=cli')
  const outputDir = await mkdtemp(join(tmpdir(), 'research-rag-docling-'))
  try {
    const args = [input.sourcePath, '--to', 'json', '--output', outputDir, '--ocr', config.doclingOcr ? 'true' : 'false', '--tables', config.doclingTables ? 'true' : 'false', '--pipeline', config.doclingPipeline, '--max-num-pages', String(config.doclingMaxPages), '--max-file-size', String(config.doclingMaxFileSize)]
    const raw = await new Promise((resolve, reject) => {
      const child = spawn(config.doclingCli, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false })
      let stderr = ''; let stdout = ''
      const timer = setTimeout(() => { child.kill('SIGTERM'); reject(Object.assign(new Error('Docling CLI timed out'), { retryable: true })) }, config.doclingTimeoutMs)
      child.stdout.on('data', (chunk) => { stdout += chunk })
      child.stderr.on('data', (chunk) => { stderr += chunk })
      child.on('error', (error) => { clearTimeout(timer); reject(error) })
      child.on('close', async (code) => {
        clearTimeout(timer)
        if (code !== 0) return reject(Object.assign(new Error(`Docling CLI failed (${code}): ${stderr.slice(0, 300)}`), { retryable: false }))
        const outputPath = join(outputDir, `${input.filename.replace(/\.pdf$/i, '')}.json`)
        try { resolve(JSON.parse(await readFile(outputPath, 'utf8'))) } catch { resolve({ markdown: stdout || stderr }) }
      })
    })
    return raw
  } finally { await rm(outputDir, { recursive: true, force: true }) }
}

export class DoclingAdapter {
  constructor(config, logger) { this.config = config; this.logger = logger }

  async convert(input = {}) {
    const mode = this.config.doclingMode
    if (mode === 'disabled') return normalizeDoclingResult({}, input)
    if (mode === 'mock') return mockResult(input)
    let lastError
    for (let attempt = 0; attempt <= this.config.doclingMaxRetries; attempt += 1) {
      try {
        const raw = mode === 'service' ? await fetchService(this.config, input) : await runCli(this.config, input)
        return normalizeDoclingResult(raw, input)
      } catch (error) {
        lastError = error
        if (attempt >= this.config.doclingMaxRetries || !retryable(error)) throw error
        this.logger?.warn({ error, attempt: attempt + 1 }, 'retrying Docling conversion')
        await sleep(250 * (2 ** attempt))
      }
    }
    throw lastError
  }
}

export const createDoclingAdapter = (config, logger) => new DoclingAdapter(config, logger)
