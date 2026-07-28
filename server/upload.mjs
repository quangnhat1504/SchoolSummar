import Busboy from 'busboy'
import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { badRequest } from './errors.mjs'

export const parsePdfUpload = async (request, config) => {
  const contentType = request.headers['content-type'] || ''
  if (!contentType.startsWith('multipart/form-data')) throw badRequest('Expected multipart/form-data with a PDF file')
  const tempDir = join(tmpdir(), 'research-rag-uploads')
  await mkdir(tempDir, { recursive: true })
  const tempPath = join(tempDir, `${randomUUID()}.upload`)
  const hash = createHash('sha256')
  let fileInfo = null
  let writeStream = null
  let fileSize = 0
  let fileLimit = false
  const fields = {}

  await new Promise((resolve, reject) => {
    let settled = false
    const fail = (error) => { if (!settled) { settled = true; reject(error) } }
    const parser = Busboy({ headers: request.headers, limits: { files: 1, fileSize: config.maxUploadBytes, fields: 12 } })
    parser.on('field', (name, value) => { fields[name] = value })
    parser.on('file', (name, stream, info) => {
      if (name !== 'file') { stream.resume(); return }
      if (!info.mimeType || info.mimeType !== 'application/pdf') { stream.resume(); fail(badRequest('Only application/pdf uploads are accepted')); return }
      fileInfo = info; writeStream = createWriteStream(tempPath)
      stream.on('data', (chunk) => { hash.update(chunk); fileSize += chunk.length })
      stream.on('limit', () => { fileLimit = true })
      stream.on('error', fail)
      writeStream.on('error', fail)
      stream.pipe(writeStream)
    })
    parser.on('error', fail)
    parser.on('finish', () => {
      if (settled) return
      if (!fileInfo) { fail(badRequest('Missing file field')) ; return }
      if (fileLimit) { fail(badRequest(`PDF exceeds ${config.maxUploadBytes} bytes`)); return }
      if (!writeStream) { fail(badRequest('Missing file field')); return }
      writeStream.once('finish', () => { settled = true; resolve() })
      writeStream.once('error', fail)
      writeStream.end()
    })
    request.on('error', fail)
    request.pipe(parser)
  }).catch(async (error) => { await rm(tempPath, { force: true }); throw error })

  return { tempPath, filename: fileInfo.filename, mimeType: fileInfo.mimeType, sizeBytes: fileSize, sha256: hash.digest('hex'), fields }
}
