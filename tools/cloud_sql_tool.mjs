/**
 * Cloud SQL (PostgreSQL / Neon / Supabase) Migration & Diagnostic Utility
 * Designed for SchoolSummar RAG
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const { Client } = pg

// Load .env if present
function loadEnv() {
  const envPath = join(process.cwd(), '.env')
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const [key, ...rest] = trimmed.split('=')
    const val = rest.join('=').trim().replace(/^["']|["']$/g, '')
    if (!process.env[key.trim()]) {
      process.env[key.trim()] = val
    }
  }
}

loadEnv()

function parseArgs() {
  const args = process.argv.slice(2)
  const command = args[0] || 'help'
  let databaseUrl = process.env.DATABASE_URL || ''

  for (let i = 1; i < args.length; i++) {
    if ((args[i] === '--url' || args[i] === '-u') && args[i + 1]) {
      databaseUrl = args[i + 1]
      i++
    }
  }

  return { command, databaseUrl }
}

async function getClient(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL không được tìm thấy trong .env và không có tham số --url.')
  }
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  })
  await client.connect()
  return client
}

async function cmdTest(databaseUrl) {
  console.log('========================================')
  console.log('  Testing Cloud SQL Connection')
  console.log('========================================')
  const masked = databaseUrl.replace(/:[^:@]+@/, ':****@')
  console.log(`Endpoint: ${masked}`)

  const t0 = Date.now()
  let client
  try {
    client = await getClient(databaseUrl)
    const latency = Date.now() - t0

    const verRes = await client.query('SELECT version(), current_database(), current_user;')
    console.log('\n✔ Kết nối Cloud SQL THÀNH CÔNG!')
    console.log(`  • Độ trễ: ${latency}ms`)
    console.log(`  • Database: ${verRes.rows[0].current_database}`)
    console.log(`  • User: ${verRes.rows[0].current_user}`)
    console.log(`  • Server version: ${verRes.rows[0].version.split(',')[0]}`)

    // Check extensions
    const extRes = await client.query("SELECT extname FROM pg_extension WHERE extname IN ('vector', 'pgcrypto');")
    const installedExts = extRes.rows.map(r => r.extname)
    console.log(`  • Tiện ích mở rộng đã cài: ${installedExts.join(', ') || '(Chưa có)'}`)

    const hasVector = installedExts.includes('vector')
    const hasCrypto = installedExts.includes('pgcrypto')
    if (hasVector && hasCrypto) {
      console.log('  ✔ Sẵn sàng 100% cho pgvector và pgcrypto!')
    } else {
      console.log('  ℹ Chạy lệnh "cloud-sql migrate" để tự động kích hoạt extensions và tạo schema.')
    }
  } catch (err) {
    console.error('\n✖ Kết nối THẤT BẠI:')
    console.error(`  ${err.message}`)
  } finally {
    if (client) await client.end()
  }
}

async function cmdMigrate(databaseUrl) {
  console.log('========================================')
  console.log('  Running Schema Migration on Cloud SQL')
  console.log('========================================')

  const migrationPath = join(process.cwd(), 'database', 'migrations', '001_initial_schema.sql')
  if (!existsSync(migrationPath)) {
    console.error(`✖ Không tìm thấy file migration tại: ${migrationPath}`)
    return
  }

  const sqlContent = readFileSync(migrationPath, 'utf8')
  console.log(`• File migration: ${migrationPath}`)
  console.log(`• Kích thước: ${sqlContent.length} bytes`)

  let client
  try {
    client = await getClient(databaseUrl)
    console.log('• Đang thực thi migration trên Cloud SQL...')
    const t0 = Date.now()
    await client.query(sqlContent)
    const elapsed = ((Date.now() - t0) / 1000).toFixed(2)

    console.log(`\n✔ Migration hoàn tất thành công trong ${elapsed}s!`)
    console.log('Các bảng sau đã được khởi tạo: users, papers, paper_files, processing_runs, paper_pages, layout_blocks, ocr_results, document_chunks, chunk_embeddings, embedding_models...')
  } catch (err) {
    console.error('\n✖ Migration thất bại:')
    console.error(`  ${err.message}`)
  } finally {
    if (client) await client.end()
  }
}

async function cmdStatus(databaseUrl) {
  console.log('========================================')
  console.log('  Cloud SQL Schema Status')
  console.log('========================================')

  let client
  try {
    client = await getClient(databaseUrl)
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `)

    console.log(`✔ Tìm thấy ${res.rows.length} bảng trong database:`)
    for (const r of res.rows) {
      try {
        const countRes = await client.query(`SELECT count(*) FROM "${r.table_name}";`)
        console.log(`  • ${r.table_name.padEnd(24)} : ${countRes.rows[0].count} bản ghi`)
      } catch {
        console.log(`  • ${r.table_name}`)
      }
    }
  } catch (err) {
    console.error('\n✖ Lỗi kiểm tra status:')
    console.error(`  ${err.message}`)
  } finally {
    if (client) await client.end()
  }
}

function showHelp() {
  console.log(`
Cloud SQL CLI - SchoolSummar RAG
================================
Quản lý và kết nối PostgreSQL Cloud (Neon, Supabase, AWS RDS, GCP Cloud SQL)

Sử dụng:
  .\\cloud-sql.bat <command> [options]
  node tools/cloud_sql_tool.mjs <command> [options]

Các lệnh (Commands):
  test | ping       Kiểm tra kết nối tới Cloud SQL, đo độ trễ, kiểm tra pgvector
  migrate           Áp dụng toàn bộ database/migrations/001_initial_schema.sql lên Cloud
  status            Liệt kê tất cả các bảng và số lượng bản ghi trong database
  help              Hiển thị trợ giúp

Tùy chọn (Options):
  --url, -u <url>   Chuỗi kết nối PostgreSQL (Mặc định đọc DATABASE_URL từ .env)

Ví dụ:
  .\\cloud-sql.bat test
  .\\cloud-sql.bat migrate
  .\\cloud-sql.bat status
  .\\cloud-sql.bat test --url "postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require"
`)
}

async function main() {
  const { command, databaseUrl } = parseArgs()

  switch (command) {
    case 'test':
    case 'ping':
      await cmdTest(databaseUrl)
      break
    case 'migrate':
      await cmdMigrate(databaseUrl)
      break
    case 'status':
      await cmdStatus(databaseUrl)
      break
    case 'help':
    default:
      showHelp()
      break
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
