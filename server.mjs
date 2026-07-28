import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const dist = join(root, 'dist')
const port = Number(process.env.PORT || 6100)
const contentTypes = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
}

const sendJson = (response, status, payload) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(payload))
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  if (requestUrl.pathname === '/api/health') {
    sendJson(response, 200, { ok: true, service: 'research-rag-node', port })
    return
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }
  if (!existsSync(dist)) {
    sendJson(response, 503, { error: 'Build chưa tồn tại. Hãy chạy npm run build trước.' })
    return
  }
  const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '')
  const candidate = normalize(join(dist, relativePath))
  const safeCandidate = candidate.startsWith(dist) ? candidate : join(dist, 'index.html')
  const filePath = existsSync(safeCandidate) && statSync(safeCandidate).isFile() ? safeCandidate : join(dist, 'index.html')
  response.writeHead(200, {
    'cache-control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    'content-type': contentTypes[extname(filePath)] || 'application/octet-stream',
  })
  if (request.method === 'HEAD') response.end()
  else createReadStream(filePath).pipe(response)
})

server.listen(port, '0.0.0.0', () => console.log(`Research RAG đang chạy tại http://localhost:${port}`))
process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())
