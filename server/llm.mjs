const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const asList = (value) => String(value || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)

const isRetryableStatus = (status) => status === 408 || status === 409 || status === 425 || status === 429 || status >= 500

const retryAfterMs = (response) => {
  const value = Number(response.headers.get('retry-after'))
  return Number.isFinite(value) && value > 0 ? Math.min(value * 1000, 10_000) : 0
}

const errorMessage = (payload, response) => payload?.error?.message || payload?.message || `LLM request failed with HTTP ${response.status}`

const providerFromConfig = (id, config) => {
  const definitions = {
    groq: {
      baseUrl: config.groqBaseUrl,
      apiKey: config.groqApiKey || (config.llmProvider === 'groq' ? config.llmApiKey : ''),
      model: config.groqModel || config.llmModel,
      free: true,
    },
    openrouter: {
      baseUrl: config.openRouterBaseUrl,
      apiKey: config.openRouterApiKey || (config.llmProvider === 'openrouter' ? config.llmApiKey : ''),
      model: config.openRouterModel || config.llmModel,
      free: true,
      headers: {
        ...(config.openRouterSiteUrl ? { 'http-referer': config.openRouterSiteUrl } : {}),
        ...(config.openRouterAppName ? { 'x-title': config.openRouterAppName } : {}),
      },
    },
    huggingface: {
      baseUrl: config.huggingFaceBaseUrl,
      apiKey: config.huggingFaceToken || (config.llmProvider === 'huggingface' ? config.llmApiKey : ''),
      model: config.huggingFaceModel || config.llmModel,
      free: false,
    },
    ollama: {
      baseUrl: config.ollamaBaseUrl,
      apiKey: config.ollamaApiKey,
      model: config.ollamaModel,
      free: true,
    },
    custom: {
      baseUrl: config.llmBaseUrl,
      apiKey: config.llmApiKey,
      model: config.llmModel,
      free: false,
    },
  }
  const definition = definitions[id]
  if (!definition?.baseUrl || !definition.model) return null
  if (id !== 'ollama' && !definition.apiKey) return null
  return { id, ...definition }
}

const buildProviders = (config) => {
  if (!config.llmEnabled) return []
  const requested = config.llmProvider !== 'auto' ? [config.llmProvider] : asList(config.llmProviderOrder)
  const ids = requested.flatMap((id) => id === 'hf' ? ['huggingface'] : id === 'open-router' ? ['openrouter'] : [id])
  return [...new Set(ids)].map((id) => providerFromConfig(id, config)).filter(Boolean)
}

const publicState = (provider, state) => ({
  provider: provider.id,
  model: provider.model,
  free: provider.free,
  configured: true,
  state: state.openedUntil > Date.now() ? 'open' : state.failures ? 'degraded' : state.lastSuccessAt ? 'healthy' : 'idle',
  failures: state.failures,
  lastError: state.lastError,
  lastSuccessAt: state.lastSuccessAt,
  retryAt: state.openedUntil > Date.now() ? new Date(state.openedUntil).toISOString() : null,
})

export const createLlmRouter = (config, logger = console) => {
  const providers = buildProviders(config)
  const states = new Map(providers.map((provider) => [provider.id, { failures: 0, openedUntil: 0, lastError: null, lastSuccessAt: null }]))

  const callProvider = async (provider, request) => {
    const state = states.get(provider.id)
    if (state.openedUntil > Date.now()) throw new Error(`${provider.id} circuit is open`)
    let lastError
    const attempts = Math.max(0, config.llmMaxRetries) + 1

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), config.llmTimeoutMs)
      try {
        const headers = { 'content-type': 'application/json', ...provider.headers }
        if (provider.apiKey) headers.authorization = `Bearer ${provider.apiKey}`
        const response = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({ model: provider.model, messages: request.messages, temperature: 0.1, max_tokens: request.maxTokens || config.llmMaxTokens, stream: false }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          const error = new Error(errorMessage(payload, response))
          error.status = response.status
          if (!isRetryableStatus(response.status) || attempt === attempts - 1) throw error
          await sleep(retryAfterMs(response) || 2 ** attempt * 250)
          lastError = error
          continue
        }
        const text = payload.choices?.[0]?.message?.content?.trim()
        if (!text) throw new Error('LLM response did not contain message content')
        state.failures = 0
        state.openedUntil = 0
        state.lastError = null
        state.lastSuccessAt = new Date().toISOString()
        return { text, provider: provider.id, model: provider.model }
      } catch (error) {
        lastError = error.name === 'AbortError' ? new Error(`LLM request timed out after ${config.llmTimeoutMs}ms`) : error
        if (attempt < attempts - 1 && (lastError.status === undefined || isRetryableStatus(lastError.status))) {
          await sleep(2 ** attempt * 250)
          continue
        }
        break
      } finally {
        clearTimeout(timeout)
      }
    }

    state.failures += 1
    state.lastError = lastError?.message || 'Unknown provider error'
    if (state.failures >= config.llmCircuitBreakerThreshold) state.openedUntil = Date.now() + config.llmCircuitBreakerCooldownMs
    throw lastError || new Error(`${provider.id} failed`)
  }

  const complete = async (request) => {
    const errors = []
    for (const provider of providers) {
      try { return await callProvider(provider, request) } catch (error) {
        errors.push({ provider: provider.id, message: error.message })
        logger.warn?.({ provider: provider.id, error: error.message }, 'LLM provider unavailable; trying fallback')
      }
    }
    const error = new Error(errors.length ? `All configured LLM providers failed: ${errors.map((item) => `${item.provider}: ${item.message}`).join('; ')}` : 'No LLM provider configured')
    error.providers = errors
    throw error
  }

  return {
    complete,
    health: () => ({
      enabled: config.llmEnabled,
      configured: providers.length > 0,
      fallbackAvailable: true,
      providers: providers.map((provider) => publicState(provider, states.get(provider.id))),
    }),
  }
}
