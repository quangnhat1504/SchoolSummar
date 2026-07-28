import { WebSocketServer, WebSocket } from 'ws'

export class RealtimeHub {
  constructor({ authenticate, logger }) {
    this.authenticate = authenticate
    this.logger = logger
    this.clients = new Map()
    this.wss = new WebSocketServer({ noServer: true })
  }

  attach(server) {
    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '/', 'http://localhost')
      if (url.pathname !== '/realtime') {
        socket.destroy()
        return
      }
      let identity
      try {
        identity = this.authenticate(request, url)
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }
      this.wss.handleUpgrade(request, socket, head, (client) => {
        this.wss.emit('connection', client, request, identity)
      })
    })

    this.wss.on('connection', (client, _request, identity) => {
      client.ownerId = identity.userId
      const current = this.clients.get(identity.userId) || new Set()
      current.add(client)
      this.clients.set(identity.userId, current)
      client.send(JSON.stringify({ type: 'realtime.ready', payload: { userId: identity.userId } }))
      client.on('close', () => {
        current.delete(client)
        if (current.size === 0) this.clients.delete(identity.userId)
      })
      client.on('error', (error) => this.logger?.warn({ error }, 'realtime client error'))
    })
    return this
  }

  publish(ownerId, type, payload) {
    const clients = this.clients.get(ownerId)
    if (!clients) return
    const message = JSON.stringify({ type, payload, at: new Date().toISOString() })
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message)
    }
  }

  close() {
    for (const clients of this.clients.values()) {
      for (const client of clients) client.close()
    }
    this.wss.close()
  }
}
