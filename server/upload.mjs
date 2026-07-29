import Busboy from 'busboy'
import { createWriteStream } from 'node:fs'
import { mkdir, open, rm } from 'node:fs/promises'
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
    let parserFinished = false
    let streamFinished = false
    const fail = (error) => { if (!settled) { settled = true; reject(error) } }
    const complete = () => {
      if (!settled && parserFinished && streamFinished) { settled = true; resolve() }
    }
    const parser = Busboy({ headers: request.headers, limits: { files: 1, fileSize: config.maxUploadBytes, fields: 12 } })
    parser.on('field', (name, value) => { fields[name] = value })
    parser.on('file', (name, stream, info) => {
      if (name !== 'file') { stream.resume(); return }
      const mimeType = (info.mimeType || '').toLowerCase()
      const pdfFilename = /\.pdf$/i.test(info.filename || '')
      if (mimeType !== 'application/pdf' && !(pdfFilename && (!mimeType || mimeType === 'application/octet-stream'))) {
        stream.resume()
        fail(badRequest('Only PDF uploads are accepted'))
        return
      }
      fileInfo = info; writeStream = createWriteStream(tempPath)
      stream.on('data', (chunk) => { hash.update(chunk); fileSize += chunk.length })
      stream.on('limit', () => { fileLimit = true })
      stream.on('error', fail)
      writeStream.on('error', fail)
      writeStream.once('finish', () => { streamFinished = true; complete() })
      stream.pipe(writeStream)
    })
    parser.on('filesLimit', () => fail(badRequest('Only one PDF file can be uploaded at a time')))
    parser.on('error', fail)
    parser.on('finish', () => {
      if (settled) return
      if (!fileInfo) { fail(badRequest('Missing file field')) ; return }
      if (fileLimit) { fail(badRequest(`PDF exceeds ${config.maxUploadBytes} bytes`)); return }
      if (!writeStream) { fail(badRequest('Missing file field')); return }
      parserFinished = true
      complete()
    })
    request.on('error', fail)
    request.pipe(parser)
  }).catch(async (error) => { await rm(tempPath, { force: true }); throw error })

  let headerHandle = null
  try {
    headerHandle = await open(tempPath, 'r')
    const header = Buffer.alloc(5)
    const { bytesRead } = await headerHandle.read(header, 0, header.length, 0)
    if (bytesRead < 5 || header.toString('ascii', 0, 5) !== '%PDF-') throw badRequest('Uploaded file is not a valid PDF')
  } catch (error) {
    await rm(tempPath, { force: true })
    throw error
  } finally {
    await headerHandle?.close()
  }

  return { tempPath, filename: fileInfo.filename, mimeType: fileInfo.mimeType, sizeBytes: fileSize, sha256: hash.digest('hex'), fields }
}
