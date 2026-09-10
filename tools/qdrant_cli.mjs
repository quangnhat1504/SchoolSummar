#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

// Auto-load .env file if present
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = val
    }
  }
}

loadEnv()

// Helper to parse arguments
function parseArgs(argv) {
  const args = argv.slice(2)
  const options = {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY || '',
    collection: process.env.QDRANT_COLLECTION_NAME || 'schoolsummar_chunks',
    dim: Number(process.env.EMBEDDING_DIMENSION || 1536),
    distance: process.env.QDRANT_DISTANCE || 'Cosine',
    command: '',
    params: []
  }

  let i = 0
  while (i < args.length) {
    const arg = args[i]
    if (arg === '--url' || arg === '-u') {
      options.url = args[++i]
    } else if (arg === '--api-key' || arg === '-k') {
      options.apiKey = args[++i]
    } else if (arg === '--collection' || arg === '-c') {
      options.collection = args[++i]
    } else if (arg === '--dim' || arg === '-d') {
      options.dim = Number(args[++i])
    } else if (arg === '--distance') {
      options.distance = args[++i]
    } else if (arg === '--limit' || arg === '-l') {
      options.limit = Number(args[++i])
    } else if (!options.command) {
      options.command = arg
    } else {
      options.params.push(arg)
    }
    i++
  }

  // Normalize URL
  if (options.url.endsWith('/')) {
    options.url = options.url.slice(0, -1)
  }

  return options
}

class QdrantClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  async request(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`
    const headers = {
      'Content-Type': 'application/json'
    }
    if (this.apiKey) {
      headers['api-key'] = this.apiKey
    }

    const t0 = Date.now()
    const options = { method, headers }
    if (body) {
      options.body = JSON.stringify(body)
    }

    try {
      const res = await fetch(url, options)
      const latency = Date.now() - t0
      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }

      return {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        latency,
        data
      }
    } catch (err) {
      return {
        ok: false,
        status: 0,
        statusText: err.message,
        latency: Date.now() - t0,
        error: err
      }
    }
  }
}

function printHeader(title) {
  console.log(`\n========================================`)
  console.log(`  ${title}`)
  console.log(`========================================`)
}

function printUsage() {
  console.log(`
Qdrant Vector Database CLI - SchoolSummar RAG
=============================================
Usage:
  node tools/qdrant_cli.mjs <command> [options]

Commands:
  test | ping                  Kiểm tra kết nối và độ trễ tới Qdrant
  list | collections           Liệt kê danh sách tất cả các collection
  info [collection]            Xem chi tiết cấu hình và số lượng vectors
  create [name] [--dim N]      Tạo collection mới (mặc định dim: 1536, metric: Cosine)
  delete [name]                Xóa một collection
  points [name] [--limit N]    Xem các điểm dữ liệu (points) trong collection
  upsert-test [name]           Ghi thử 1 vector kiểm tra quyền write
  search-test [name]           Tìm kiếm thử nghiệm vector (cosine search)
  cluster                      Xem thông tin cluster Qdrant
  help                         Hiển thị hướng dẫn này

Options:
  --url, -u <url>              Qdrant URL (hoặc qua QDRANT_URL trong .env)
  --api-key, -k <key>          Qdrant API Key (hoặc qua QDRANT_API_KEY trong .env)
  --collection, -c <name>      Tên collection (mặc định: schoolsummar_chunks)
  --dim, -d <number>           Kích thước vector (mặc định: 1536 hoặc 1024)
  --distance <metric>          Khoảng cách: Cosine | Dot | Euclid (mặc định: Cosine)
  --limit, -l <number>         Giới hạn kết quả (mặc định: 5)

Ví dụ:
  node tools/qdrant_cli.mjs test
  node tools/qdrant_cli.mjs list
  node tools/qdrant_cli.mjs create schoolsummar_chunks --dim 1024
  node tools/qdrant_cli.mjs info schoolsummar_chunks
  node tools/qdrant_cli.mjs upsert-test schoolsummar_chunks
  node tools/qdrant_cli.mjs search-test schoolsummar_chunks
`)
}

async function main() {
  const opts = parseArgs(process.argv)
  const client = new QdrantClient(opts.url, opts.apiKey)

  if (!opts.command || opts.command === 'help') {
    printUsage()
    return
  }

  console.log(`[Qdrant CLI] Connecting to: ${opts.url}`)
  if (opts.apiKey) {
    console.log(`[Qdrant CLI] API Key: ${opts.apiKey.slice(0, 6)}...${opts.apiKey.slice(-4)}`)
  } else {
    console.log(`[Qdrant CLI] API Key: (None / Public / Local)`)
  }

  switch (opts.command) {
    case 'ping':
    case 'test': {
      printHeader('Testing Connection to Qdrant')
      const res = await client.request('/')
      if (res.ok) {
        console.log(`\x1b[32m✔ Kết nối THÀNH CÔNG!\x1b[0m`)
        console.log(`- Status: ${res.status} ${res.statusText}`)
        console.log(`- Latency: ${res.latency}ms`)
        console.log(`- Server Title: ${res.data?.title || 'Qdrant'}`)
        console.log(`- Version: ${res.data?.version || 'Unknown'}`)
      } else {
        console.log(`\x1b[31m✖ Kết nối THẤT BẠI!\x1b[0m`)
        console.log(`- Error: ${res.statusText}`)
        if (res.data) console.log(`- Response:`, JSON.stringify(res.data, null, 2))
        console.log(`\nHướng dẫn kiểm tra:`)
        console.log(`1. Nếu dùng Qdrant Cloud: kiểm tra lại QDRANT_URL và QDRANT_API_KEY trong file .env`)
        console.log(`2. Nếu dùng Local: đảm bảo Qdrant đang chạy (docker run -p 6333:6333 qdrant/qdrant)`)
      }
      break
    }

    case 'list':
    case 'collections': {
      printHeader('Collections in Qdrant')
      const res = await client.request('/collections')
      if (res.ok) {
        const collections = res.data?.result?.collections || []
        if (collections.length === 0) {
          console.log('Hiện chưa có collection nào được tạo.')
        } else {
          console.log(`Tìm thấy ${collections.length} collection:`)
          for (const col of collections) {
            console.log(`  • \x1b[36m${col.name}\x1b[0m`)
          }
        }
      } else {
        console.log(`\x1b[31m✖ Không thể lấy danh sách collection: ${res.statusText}\x1b[0m`)
        if (res.data) console.log(JSON.stringify(res.data, null, 2))
      }
      break
    }

    case 'info': {
      const colName = opts.params[0] || opts.collection
      printHeader(`Collection Details: ${colName}`)
      const res = await client.request(`/collections/${colName}`)
      if (res.ok) {
        const result = res.data?.result
        console.log(`- Name: ${colName}`)
        console.log(`- Status: ${result?.status}`)
        console.log(`- Vectors count: ${result?.vectors_count ?? result?.points_count ?? 0}`)
        console.log(`- Points count: ${result?.points_count ?? 0}`)
        console.log(`- Indexed vectors: ${result?.indexed_vectors_count ?? 0}`)
        console.log(`- Vector config:`, JSON.stringify(result?.config?.params?.vectors, null, 2))
      } else {
        console.log(`\x1b[31m✖ Không tìm thấy collection "${colName}": ${res.statusText}\x1b[0m`)
        if (res.data) console.log(JSON.stringify(res.data, null, 2))
      }
      break
    }

    case 'create': {
      const colName = opts.params[0] || opts.collection
      const dim = opts.dim
      const distance = opts.distance
      printHeader(`Creating Collection: ${colName} (dim: ${dim}, metric: ${distance})`)
      const payload = {
        vectors: {
          size: dim,
          distance: distance
        }
      }
      const res = await client.request(`/collections/${colName}`, 'PUT', payload)
      if (res.ok) {
        console.log(`\x1b[32m✔ Collection "${colName}" đã được tạo thành công!\x1b[0m`)
        console.log(`- Vector dimension: ${dim}`)
        console.log(`- Distance metric: ${distance}`)
      } else {
        console.log(`\x1b[31m✖ Tạo collection thất bại: ${res.statusText}\x1b[0m`)
        if (res.data) console.log(JSON.stringify(res.data, null, 2))
      }
      break
    }

    case 'delete': {
      const colName = opts.params[0] || opts.collection
      printHeader(`Deleting Collection: ${colName}`)
      const res = await client.request(`/collections/${colName}`, 'DELETE')
      if (res.ok) {
        console.log(`\x1b[32m✔ Collection "${colName}" đã được xóa thành công!\x1b[0m`)
      } else {
        console.log(`\x1b[31m✖ Xóa collection thất bại: ${res.statusText}\x1b[0m`)
        if (res.data) console.log(JSON.stringify(res.data, null, 2))
      }
      break
    }

    case 'points': {
      const colName = opts.params[0] || opts.collection
      const limit = opts.limit || 5
      printHeader(`Listing Points from: ${colName} (limit: ${limit})`)
      const res = await client.request(`/collections/${colName}/points/scroll`, 'POST', {
        limit,
        with_payload: true,
        with_vector: false
      })
      if (res.ok) {
        const points = res.data?.result?.points || []
        console.log(`Tìm thấy ${points.length} points:`)
        console.log(JSON.stringify(points, null, 2))
      } else {
        console.log(`\x1b[31m✖ Lỗi khi lấy points: ${res.statusText}\x1b[0m`)
        if (res.data) console.log(JSON.stringify(res.data, null, 2))
      }
      break
    }

    case 'upsert-test': {
      const colName = opts.params[0] || opts.collection
      printHeader(`Upserting Test Vector into: ${colName}`)
      // Get collection dim
      const colInfo = await client.request(`/collections/${colName}`)
      let dim = opts.dim
      if (colInfo.ok) {
        const vecCfg = colInfo.data?.result?.config?.params?.vectors
        if (vecCfg?.size) dim = vecCfg.size
      }

      // Generate random test vector
      const dummyVec = Array.from({ length: dim }, () => Number((Math.random() * 2 - 1).toFixed(4)))
      const testPoint = {
        id: 999999,
        vector: dummyVec,
        payload: {
          test: true,
          title: 'SchoolSummar Test Document',
          sample_text: 'This is a test chunk inserted by Qdrant CLI to verify database connectivity.',
          created_at: new Date().toISOString()
        }
      }

      const res = await client.request(`/collections/${colName}/points?wait=true`, 'PUT', {
        points: [testPoint]
      })
      if (res.ok) {
        console.log(`\x1b[32m✔ Ghi test vector thành công vào collection "${colName}"!\x1b[0m`)
        console.log(`- Point ID: 999999`)
        console.log(`- Vector Dim: ${dim}`)
        console.log(`- Payload:`, testPoint.payload)
      } else {
        console.log(`\x1b[31m✖ Ghi vector thất bại: ${res.statusText}\x1b[0m`)
        if (res.data) console.log(JSON.stringify(res.data, null, 2))
      }
      break
    }

    case 'search-test': {
      const colName = opts.params[0] || opts.collection
      printHeader(`Testing Vector Search in: ${colName}`)
      const colInfo = await client.request(`/collections/${colName}`)
      let dim = opts.dim
      if (colInfo.ok) {
        const vecCfg = colInfo.data?.result?.config?.params?.vectors
        if (vecCfg?.size) dim = vecCfg.size
      }

      const queryVec = Array.from({ length: dim }, () => Number((Math.random() * 2 - 1).toFixed(4)))
      const res = await client.request(`/collections/${colName}/points/search`, 'POST', {
        vector: queryVec,
        limit: 3,
        with_payload: true
      })
      if (res.ok) {
        const results = res.data?.result || []
        console.log(`\x1b[32m✔ Tìm kiếm vector thành công! Kết quả (${results.length} items):\x1b[0m`)
        for (const item of results) {
          console.log(`\n  • Point ID: ${item.id} (Score: ${item.score.toFixed(4)})`)
          console.log(`    Payload:`, item.payload)
        }
      } else {
        console.log(`\x1b[31m✖ Tìm kiếm thất bại: ${res.statusText}\x1b[0m`)
        if (res.data) console.log(JSON.stringify(res.data, null, 2))
      }
      break
    }

    case 'cluster': {
      printHeader('Qdrant Cluster Info')
      const res = await client.request('/cluster')
      if (res.ok) {
        console.log(JSON.stringify(res.data, null, 2))
      } else {
        console.log(`\x1b[31m✖ Không thể lấy thông tin cluster: ${res.statusText}\x1b[0m`)
        if (res.data) console.log(JSON.stringify(res.data, null, 2))
      }
      break
    }

    default:
      console.log(`Lệnh không hợp lệ: "${opts.command}". Chạy "node tools/qdrant_cli.mjs help" để xem trợ giúp.`)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
