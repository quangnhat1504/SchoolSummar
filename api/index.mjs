import { createApp } from '../server/app.mjs'

let app = null

export default async function handler(req, res) {
  if (!app) {
    app = createApp()
  }
  return app.handler(req, res)
}
