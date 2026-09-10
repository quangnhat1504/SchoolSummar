/**
 * Test CLI tool for Cloudflare Workers AI BGE Embeddings
 * Usage: node tools/test_cloudflare_embedding.mjs [optional sample text]
 */
import { CloudflareEmbeddingProvider } from '../server/embeddings.mjs'

const sampleText = process.argv.slice(2).join(' ') || 'SchoolSummar: Intelligent Scientific Document Layout & Multi-Document RAG.'

console.log('=' .repeat(70))
console.log('      CLOUDFLARE WORKERS AI — BGE EMBEDDING TEST UTILITY')
console.log('=' .repeat(70))

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || ''
const apiToken = process.env.CLOUDFLARE_API_TOKEN || ''
const workerUrl = process.env.CLOUDFLARE_WORKER_URL || ''
const model = process.env.CLOUDFLARE_EMBEDDING_MODEL || '@cf/baai/bge-large-en-v1.5'

console.log(`• Model:             ${model}`)
console.log(`• Worker URL:        ${workerUrl || '(Chưa cấu hình, sử dụng Cloudflare AI REST API)'}`)
console.log(`• Account ID:        ${accountId ? accountId.slice(0, 6) + '...' + accountId.slice(-4) : '(Chưa cấu hình trong .env)'}`)
console.log(`• API Token:         ${apiToken ? '*** (Đã cấu hình)' : '(Chưa cấu hình trong .env)'}`)
console.log(`• Văn bản thử nghiệm: "${sampleText}"\n`)

const provider = new CloudflareEmbeddingProvider({
  cloudflareAccountId: accountId,
  cloudflareApiToken: apiToken,
  cloudflareWorkerUrl: workerUrl,
  cloudflareEmbeddingModel: model,
  embeddingDimension: 1536,
})

if (!provider.isConfigured) {
  console.log('⚠️  CHƯA CẤU HÌNH CLOUDFLARE CREDENTIALS TRONG .env')
  console.log('   Vui lòng thêm vào file .env:')
  console.log('   CLOUDFLARE_ACCOUNT_ID=your_account_id_here')
  console.log('   CLOUDFLARE_API_TOKEN=your_api_token_here')
  console.log('   (Hoặc nếu bạn deploy Worker riêng: CLOUDFLARE_WORKER_URL=https://your-worker.workers.dev)\n')
  console.log('• Đang chạy thử nghiệm Vector Fallback...')
  const fallbackVector = await provider.embedQuery(sampleText)
  console.log(`✔ Fallback vector shape: [${fallbackVector.length}], Sample: [${fallbackVector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`)
  process.exit(0)
}

console.log(`[1/2] Đang gửi yêu cầu sinh vector tới Cloudflare Workers AI...`)
const t0 = Date.now()

try {
  const vector = await provider.embedQuery(sampleText)
  const latency = Date.now() - t0

  console.log(`[2/2] ✔ NHẬN VECTOR THÀNH CÔNG TỪ CLOUDFLARE!`)
  console.log(`• Độ trễ mạng (RTT): ${latency} ms`)
  console.log(`• Chiều dài Vector:   ${vector.length}-dim`)
  console.log(`• Mẫu 5 giá trị đầu: [${vector.slice(0, 5).map(v => v.toFixed(5)).join(', ')}...]`)
  console.log(`• Chuẩn L2-Norm:     ${Math.sqrt(vector.reduce((s, v) => s + v * v, 0)).toFixed(4)}`)
  console.log('\n======================================================================')
  console.log('  KẾT NỐI CLOUDFLARE WORKERS AI HOÀN HẢO! SẴN SÀNG CHO RAG PIPELINE.')
  console.log('======================================================================\n')
} catch (err) {
  console.error(`❌ LỖI KẾT NỐI CLOUDFLARE: ${err.message}`)
  process.exit(1)
}
