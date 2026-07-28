import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const sourcePath = decodeURI(new globalThis.URL('./src', (import.meta as ImportMeta & { url: string }).url).pathname)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^@\//, replacement: `${sourcePath}/` }],
  },
  server: { host: '0.0.0.0', port: 6100, strictPort: true },
  preview: { host: '0.0.0.0', port: 6100, strictPort: true },
})
