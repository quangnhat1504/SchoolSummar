/**
 * Cloudflare Worker for BGE-Large Embeddings
 * Model: @cf/baai/bge-large-en-v1.5
 * 
 * Exposes a fast REST endpoint to embed texts for SchoolSummar RAG.
 */

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'online',
        model: '@cf/baai/bge-large-en-v1.5',
        provider: 'Cloudflare Workers AI',
        version: '1.0.0'
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const body = await request.json()
      const textInput = body.text || body.input

      if (!textInput) {
        return new Response(JSON.stringify({ error: "Missing 'text' in request body." }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const texts = Array.isArray(textInput) ? textInput : [textInput]
      const model = body.model || '@cf/baai/bge-large-en-v1.5'

      // Call Cloudflare Workers AI
      const response = await env.AI.run(model, {
        text: texts,
      })

      return new Response(JSON.stringify({
        success: true,
        model,
        shape: response.shape,
        data: response.data,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    } catch (err) {
      return new Response(JSON.stringify({
        success: false,
        error: err.message,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }
  },
}
