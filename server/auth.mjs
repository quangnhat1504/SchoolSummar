import crypto from 'node:crypto'
import { validate as isUuid } from 'uuid'
import { unauthorized } from './errors.mjs'

const SESSION_COOKIE = 'research_session'
const PASSWORD_MIN_LENGTH = 5

const base64Url = (value) => Buffer.from(value).toString('base64url')
const fromBase64Url = (value) => Buffer.from(value, 'base64url')
const safeEqual = (left, right) => {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

export const assertPassword = (password) => {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH || password.length > 200) {
    throw new Error(`Password must be between ${PASSWORD_MIN_LENGTH} and 200 characters`)
  }
}

export const hashPassword = (password) => {
  assertPassword(password)
  const salt = crypto.randomBytes(16)
  const derived = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`
}

export const verifyPassword = (password, encoded) => {
  if (typeof password !== 'string' || typeof encoded !== 'string') return false
  const [algorithm, saltValue, hashValue] = encoded.split('$')
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false
  try {
    const derived = crypto.scryptSync(password, fromBase64Url(saltValue), 64)
    return safeEqual(derived, fromBase64Url(hashValue))
  } catch {
    return false
  }
}

export const hashSessionToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

export const createSessionToken = (userId, secret, ttlSeconds = 60 * 60 * 24 * 30, nowMs = Date.now()) => {
  const payload = base64Url(JSON.stringify({ sub: userId, sid: crypto.randomUUID(), exp: Math.floor(nowMs / 1000) + ttlSeconds }))
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export const verifySessionToken = (token, secret, nowMs = Date.now()) => {
  if (typeof token !== 'string') return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  if (!safeEqual(signature, expected)) return null
  try {
    const parsed = JSON.parse(fromBase64Url(payload).toString('utf8'))
    if (!isUuid(parsed.sub) || !isUuid(parsed.sid) || !Number.isFinite(parsed.exp) || parsed.exp <= Math.floor(nowMs / 1000)) return null
    return parsed
  } catch {
    return null
  }
}

export const parseCookies = (header = '') => Object.fromEntries(header.split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter(([key, value]) => key && value !== undefined))
export const getSessionToken = (request, requestUrl = new URL(request.url || '/', 'http://localhost')) => {
  const cookies = parseCookies(request.headers.cookie || '')
  return cookies[SESSION_COOKIE] || request.headers.authorization?.replace(/^Bearer\s+/i, '') || ''
}

export const sessionCookie = (token, config) => `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${config.authSessionTtlSeconds}; Path=/; HttpOnly; SameSite=Lax${config.nodeEnv === 'production' ? '; Secure' : ''}`
export const clearSessionCookie = (config) => `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${config.nodeEnv === 'production' ? '; Secure' : ''}`

export const getRequestIdentity = (request, config, requestUrl = new URL(request.url || '/', config.appUrl)) => {
  const token = getSessionToken(request, requestUrl)
  if (token) {
    const session = verifySessionToken(token, config.authSessionSecret)
    if (!session) throw unauthorized('Your session has expired. Please sign in again.')
    return { userId: session.sub, subject: session.sub, mode: 'session', sessionId: session.sid, token, tokenHash: hashSessionToken(token) }
  }

  const headerId = request.headers['x-user-id'] || requestUrl.searchParams.get('user_id')
  if (!config.authRequired && headerId && isUuid(String(headerId))) return { userId: String(headerId), subject: String(headerId), mode: 'header' }
  if (config.authRequired) throw unauthorized('Authentication required')
  return { userId: config.demoUserId, subject: 'demo-local-user', mode: 'development' }
}

export { PASSWORD_MIN_LENGTH, SESSION_COOKIE }
