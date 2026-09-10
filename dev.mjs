import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

const children = []
let stopping = false

const canListen = (port) => new Promise((resolve) => {
  const probe = createServer()
  probe.once('error', () => resolve(false))
  probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)))
})

const findFrontendPort = async () => {
  const preferred = Number(process.env.VITE_DEV_PORT || 5173)
  for (let port = preferred; port < preferred + 20; port += 1) {
    if (await canListen(port)) return port
  }
  throw new Error(`No available frontend port found between ${preferred} and ${preferred + 19}`)
}

const stop = (code = 0, signal = '') => {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  setTimeout(() => process.exit(code), 250)
  if (signal) process.stderr.write(`\nDevelopment process stopped (${signal}).\n`)
}

const start = (args) => {
  const child = spawn(process.execPath, args, { stdio: 'inherit', env: process.env })
  children.push(child)
  child.once('error', (error) => {
    if (!stopping) stop(1, error.code || 'child-error')
  })
  child.once('exit', (code, signal) => {
    if (!stopping) stop(code || 1, signal)
  })
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

const frontendPort = await findFrontendPort()
process.env.VITE_DEV_PORT = String(frontendPort)
process.stdout.write(`Research RAG frontend: http://localhost:${frontendPort}\n`)
start(['--env-file-if-exists=.env', 'server.mjs'])
start(['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', String(frontendPort), '--strictPort'])
