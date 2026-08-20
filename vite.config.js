import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { createSubscriptionLiveDemoOpenAiTransport } from './api/engine/subscriptionV1/liveDemoOpenAiTransport.js'

const SUBSCRIPTION_LIVE_DEMO_ROUTE = '/api/internal/subscription-v1-live-frontier-demo'
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

async function readJson(req, maxBytes = 2_000_000) {
  const chunks = []
  let bytes = 0
  for await (const chunk of req) {
    bytes += chunk.length
    if (bytes > maxBytes) throw new Error('SUBSCRIPTION_LIVE_DEMO_BODY_TOO_LARGE')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

function subscriptionV1LiveDemoVitePlugin({ enabled }) {
  return {
    name: 'subscription-v1-live-frontier-demo',
    configureServer(server) {
      if (!enabled) return
      const transport = createSubscriptionLiveDemoOpenAiTransport({ apiKey: globalThis.process?.env?.OPENAI_API_KEY })
      server.middlewares.use(async (req, res, next) => {
        const pathname = String(req.url || '').split('?')[0]
        if (pathname !== SUBSCRIPTION_LIVE_DEMO_ROUTE) return next()
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' })
        if (!LOOPBACK.has(req.socket.remoteAddress)) return sendJson(res, 403, { ok: false, code: 'LOOPBACK_ONLY' })
        if (req.headers['x-subscription-demo-synthetic'] !== 'founder-review-v2') return sendJson(res, 403, { ok: false, code: 'SYNTHETIC_DEMO_BINDING_REQUIRED' })
        try {
          const body = await readJson(req)
          const result = await transport(body.request, { stage: body.stage })
          return sendJson(res, 200, { ok: true, ...result })
        } catch (error) {
          return sendJson(res, 422, { ok: false, code: error?.code || error?.message || 'SUBSCRIPTION_LIVE_DEMO_REQUEST_FAILED', provider_status: error?.sanitized_provider_status || null, incomplete_reason: error?.sanitized_incomplete_reason || null })
        }
      })
    },
  }
}

function isLocalEngineModule(requestUrl = '') {
  const pathname = requestUrl.split('?')[0]
  return pathname.startsWith('/api/engine/')
    && pathname.endsWith('.js')
    && !pathname.includes('..')
    && existsSync(new URL(`.${pathname}`, import.meta.url))
}

export default defineConfig({
  plugins: [react(), subscriptionV1LiveDemoVitePlugin({ enabled: String(globalThis.process?.env?.VITE_SUBSCRIPTION_V1_LIVE_FRONTIER_DEMO).toLowerCase() === 'true' })],
  server: {
    proxy: {
      '/api/': {
        target: 'https://moremindmap.com',
        changeOrigin: true,
        bypass(req) {
          if (isLocalEngineModule(req.url)) {
            return req.url
          }
        },
      },
    },
  },
})
