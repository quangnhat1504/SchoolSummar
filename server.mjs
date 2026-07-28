import { createApp } from './server/app.mjs'

const app = createApp()
app.server.listen(app.config.port, app.config.host, () => {
  app.logger.info({ url: `${app.config.appUrl}`, mode: app.store.kind, llm: app.llm.health(), realtime: '/realtime' }, 'Research RAG server started')
})

const shutdown = async (signal) => {
  app.logger.info({ signal }, 'shutting down')
  app.hub.close()
  await app.store.close()
  app.server.close(() => process.exit(0))
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
