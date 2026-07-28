import { join } from 'node:path'

const asInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const config = {
  appName: process.env.APP_NAME || 'research-rag',
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: asInt(process.env.PORT, 6100),
  appUrl: process.env.APP_URL || `http://localhost:${asInt(process.env.PORT, 6100)}`,
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: process.env.DATABASE_SSL !== 'false',
  storeMode: process.env.STORE_MODE || 'auto',
  authRequired: process.env.AUTH_REQUIRED === 'true' || process.env.NODE_ENV === 'production',
  demoUserId: process.env.DEMO_USER_ID || '00000000-0000-4000-8000-000000000001',
  maxJsonBytes: asInt(process.env.MAX_JSON_BYTES, 1_000_000),
  maxUploadBytes: asInt(process.env.MAX_UPLOAD_BYTES, 50 * 1024 * 1024),
  localStorageDir: join(process.cwd(), process.env.LOCAL_STORAGE_DIR || 'storage'),
  s3Endpoint: process.env.S3_ENDPOINT || '',
  s3Region: process.env.S3_REGION || 'us-east-1',
  s3Bucket: process.env.S3_BUCKET || '',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || '',
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  signedUrlTtlSeconds: asInt(process.env.S3_SIGNED_URL_TTL_SECONDS, 900),
  llmBaseUrl: process.env.LLM_BASE_URL || '',
  llmApiKey: process.env.LLM_API_KEY || '',
  llmModel: process.env.LLM_MODEL || '',
  retrievalTopK: asInt(process.env.RETRIEVAL_TOP_K, 20),
  rerankTopK: asInt(process.env.RERANK_TOP_K, 8),
}

export const isProduction = config.nodeEnv === 'production'
