import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const sourcePath = decodeURI(new globalThis.URL('./src', (import.meta as ImportMeta & { url: string }).url).pathname)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env || {}
  const devPort = Number(env.VITE_DEV_PORT || 5173)
  const apiProxy = runtimeEnv.VITE_API_PROXY_URL || env.VITE_API_PROXY_URL || 'http://127.0.0.1:6100'
  const realtimeProxy = apiProxy.replace(/^http/, 'ws')
  return {
    plugins: [react()],
    resolve: {
      alias: [{ find: /^@\//, replacement: `${sourcePath}/` }],
    },
    server: {
      host: '0.0.0.0',
      port: devPort,
      strictPort: true,
      proxy: {
        '/api': apiProxy,
        '/realtime': { target: realtimeProxy, ws: true },
      },
    },
    preview: { host: '0.0.0.0', port: devPort, strictPort: true },
  }
})
