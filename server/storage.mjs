import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readFile, rename, unlink } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createClient } from '@supabase/supabase-js'

const cleanKey = (key) => key.replace(/^\/+/, '').replaceAll('..', '_')

export class LocalObjectStore {
  constructor(root) { this.root = root; this.kind = 'local' }
  async putFile(sourcePath, objectKey) {
    const destination = join(this.root, cleanKey(objectKey))
    await mkdir(dirname(destination), { recursive: true })
    try {
      await rename(sourcePath, destination)
    } catch {
      await copyFile(sourcePath, destination)
      await unlink(sourcePath).catch(() => {})
    }
    return { objectKey: cleanKey(objectKey) }
  }
  async delete(objectKey) { try { await unlink(join(this.root, cleanKey(objectKey))) } catch (error) { if (error.code !== 'ENOENT') throw error } }
  async signedUrl(objectKey) { return `/api/v1/files/${encodeURIComponent(cleanKey(objectKey))}` }
  stream(objectKey) { return createReadStream(join(this.root, cleanKey(objectKey))) }
}

export class SupabaseObjectStore {
  constructor(config) {
    this.kind = 'supabase'
    this.bucket = config.supabaseStorageBucket || 'papers'
    this.client = createClient(config.supabaseUrl, config.supabaseSecretKey || config.supabasePublishableKey, {
      auth: { persistSession: false }
    })
  }
  async putFile(sourcePath, objectKey, contentType = 'application/pdf') {
    const fileBuffer = await readFile(sourcePath)
    const { error } = await this.client.storage.from(this.bucket).upload(cleanKey(objectKey), fileBuffer, {
      contentType,
      upsert: true
    })
    await unlink(sourcePath).catch(() => {})
    if (error) throw error
    return { objectKey: cleanKey(objectKey) }
  }
  async delete(objectKey) {
    await this.client.storage.from(this.bucket).remove([cleanKey(objectKey)])
  }
  async signedUrl(objectKey) {
    const { data } = await this.client.storage.from(this.bucket).createSignedUrl(cleanKey(objectKey), 3600)
    if (data?.signedUrl) return data.signedUrl
    const { data: pub } = this.client.storage.from(this.bucket).getPublicUrl(cleanKey(objectKey))
    return pub?.publicUrl || `/api/v1/files/${encodeURIComponent(cleanKey(objectKey))}`
  }
}

export class S3ObjectStore {
  constructor(config) {
    this.kind = 's3'; this.bucket = config.s3Bucket
    this.client = new S3Client({ region: config.s3Region, endpoint: config.s3Endpoint || undefined, forcePathStyle: config.s3ForcePathStyle, credentials: config.s3AccessKeyId ? { accessKeyId: config.s3AccessKeyId, secretAccessKey: config.s3SecretAccessKey } : undefined })
    this.ttl = config.signedUrlTtlSeconds
  }
  async putFile(sourcePath, objectKey, contentType = 'application/pdf') { await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: cleanKey(objectKey), Body: createReadStream(sourcePath), ContentType: contentType })); await unlink(sourcePath); return { objectKey: cleanKey(objectKey) } }
  async delete(objectKey) { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: cleanKey(objectKey) })) }
  async signedUrl(objectKey) { return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: cleanKey(objectKey) }), { expiresIn: this.ttl }) }
}

export const createObjectStore = (config) => {
  if (config.s3Bucket) return new S3ObjectStore(config)
  if (config.supabaseUrl && (config.supabaseSecretKey || config.supabasePublishableKey)) return new SupabaseObjectStore(config)
  return new LocalObjectStore(config.localStorageDir)
}

export const objectKeyForPaper = (ownerId, paperId, filename = 'original.pdf') => `users/${ownerId}/papers/${paperId}/${basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_')}`
