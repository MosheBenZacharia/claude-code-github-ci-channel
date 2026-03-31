import { Hono } from 'hono'
import { loadConfig } from './config.js'
import { initDatabase, getDb } from './db.js'
import { hashToken } from './crypto.js'
import { addClient, removeClient } from './connections.js'
import { health } from './routes/health.js'
import { createAuthRoutes } from './routes/auth.js'
import { createMeRoutes } from './routes/me.js'
import { webhook } from './routes/webhook.js'

const config = loadConfig()
initDatabase(config.databasePath)

const app = new Hono()

app.route('/', health)
app.route('/', createAuthRoutes(config))
app.route('/', createMeRoutes(config))
app.route('/', webhook)

type WsData = { userId: string; tokenHash: string }

// Bun.serve with WebSocket support
const server = Bun.serve<WsData>({
  port: config.port,
  fetch(req, server) {
    const url = new URL(req.url)

    // WebSocket upgrade for /connect
    if (url.pathname === '/connect') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401 })
      }

      const token = authHeader.slice(7)
      const tokenHash = hashToken(token)
      const db = getDb()

      const row = db
        .query('SELECT user_id FROM client_tokens WHERE token_hash = ? AND revoked_at IS NULL')
        .get(tokenHash) as { user_id: string } | null

      if (!row) {
        return new Response('Unauthorized', { status: 401 })
      }

      // Update last_seen
      db.run('UPDATE client_tokens SET last_seen = ? WHERE token_hash = ?', [Date.now(), tokenHash])

      const upgraded = server.upgrade(req, {
        data: { userId: row.user_id, tokenHash },
      })

      if (!upgraded) {
        return new Response('WebSocket upgrade failed', { status: 500 })
      }
      return undefined
    }

    // Serve static icon
    if (url.pathname === '/icon.jpg') {
      const file = Bun.file(new URL('./static/icon.jpg', import.meta.url).pathname)
      return new Response(file, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } })
    }

    // All other routes handled by Hono
    return app.fetch(req)
  },
  websocket: {
    open(ws) {
      addClient(ws.data.userId, ws as any, ws.data.tokenHash)
      console.error(`[ws] Client connected for user ${ws.data.userId}`)
    },
    close(ws) {
      removeClient(ws.data.userId, ws as any)
      console.error(`[ws] Client disconnected for user ${ws.data.userId}`)
    },
    message(_ws, _msg) {
      // Clients don't send messages to relay in V1
    },
  },
})

console.error(`[relay] Server running on port ${config.port}`)
