import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import test from 'node:test'
import pino from 'pino'
import { createLlmRouter } from '../server/llm.mjs'

const logger = pino({ level: 'silent' })

const listen = async (handler) => {
  const server = createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return { server, url: `http://127.0.0.1:${server.address().port}/v1` }
}

test('LLM router fails over from an unavailable provider to the next provider', async (t) => {
  const unavailable = await listen((_request, response) => {
    response.writeHead(503, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: { message: 'provider overloaded' } }))
  })
  const healthy = await listen(async (request, response) => {
    assert.equal(request.method, 'POST')
    assert.match(request.url, /\/chat\/completions$/)
    const body = await new Promise((resolve) => {
      const chunks = []
      request.on('data', (chunk) => chunks.push(chunk))
      request.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))))
    })
    assert.equal(body.model, 'healthy-model')
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ choices: [{ message: { content: 'Grounded provider response [1].' } }] }))
  })
  t.after(() => unavailable.server.close())
  t.after(() => healthy.server.close())

  const router = createLlmRouter({
    llmEnabled: true,
    llmProvider: 'auto',
    llmProviderOrder: 'groq,openrouter',
    llmMaxRetries: 0,
    llmTimeoutMs: 1000,
    llmMaxTokens: 64,
    llmCircuitBreakerThreshold: 2,
    llmCircuitBreakerCooldownMs: 5000,
    groqBaseUrl: unavailable.url,
    groqApiKey: 'groq-test-key',
    groqModel: 'unavailable-model',
    openRouterBaseUrl: healthy.url,
    openRouterApiKey: 'openrouter-test-key',
    openRouterModel: 'healthy-model',
    openRouterSiteUrl: '',
    openRouterAppName: 'Research RAG Test',
  }, logger)

  const result = await router.complete({ messages: [{ role: 'user', content: 'What does the paper say?' }] })
  assert.equal(result.provider, 'openrouter')
  assert.equal(result.text, 'Grounded provider response [1].')
  const health = router.health()
  assert.equal(health.configured, true)
  assert.equal(health.providers[0].state, 'degraded')
  assert.equal(health.providers[1].state, 'healthy')
})

test('LLM router advertises deterministic fallback when no key is configured', () => {
  const router = createLlmRouter({
    llmEnabled: true,
    llmProvider: 'auto',
    llmProviderOrder: 'groq,openrouter,huggingface,ollama,custom',
    groqBaseUrl: 'https://api.groq.com/openai/v1',
    groqApiKey: '',
    groqModel: 'llama-3.1-8b-instant',
    openRouterBaseUrl: 'https://openrouter.ai/api/v1',
    openRouterApiKey: '',
    openRouterModel: 'openrouter/free',
    huggingFaceBaseUrl: 'https://router.huggingface.co/v1',
    huggingFaceToken: '',
    huggingFaceModel: 'meta-llama/Llama-3.1-8B-Instruct:fastest',
    ollamaBaseUrl: '',
    ollamaApiKey: '',
    ollamaModel: 'llama3.1:8b',
    llmBaseUrl: '',
    llmApiKey: '',
    llmModel: '',
  }, logger)
  const health = router.health()
  assert.equal(health.configured, false)
  assert.equal(health.fallbackAvailable, true)
})
