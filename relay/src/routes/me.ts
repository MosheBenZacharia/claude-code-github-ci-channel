import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import type { RelayConfig } from '../config.js'
import { getDb } from '../db.js'
import { generateId, hashToken } from '../crypto.js'
import { verifySession } from '../session.js'
import { disconnectByTokenHash } from '../connections.js'

interface UserRow {
  id: string
  github_user_id: string
  github_login: string
  webhook_secret: string
}

interface TokenRow {
  token_hash: string
}

function getAuthedUser(c: any, secret: string): UserRow | null {
  const cookie = getCookie(c, 'session')
  if (!cookie) return null
  const userId = verifySession(cookie, secret)
  if (!userId) return null
  const db = getDb()
  return db.query('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | null
}

export function createMeRoutes(config: RelayConfig) {
  const me = new Hono()

  me.get('/me', (c) => {
    const user = getAuthedUser(c, config.sessionSecret)
    if (!user) return c.redirect('/auth/github/start')

    const db = getDb()
    const activeToken = db
      .query('SELECT token_hash FROM client_tokens WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1')
      .get(user.id) as TokenRow | null

    return c.json({
      userId: user.id,
      githubLogin: user.github_login,
      webhookUrl: `${config.publicUrl}/webhook/${user.id}`,
      webhookSecret: user.webhook_secret,
      hasClientToken: !!activeToken,
    })
  })

  me.post('/me/rotate-client-token', async (c) => {
    const user = getAuthedUser(c, config.sessionSecret)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const db = getDb()
    const now = Date.now()

    // Revoke all existing tokens and disconnect their sockets
    const oldTokens = db
      .query('SELECT token_hash FROM client_tokens WHERE user_id = ? AND revoked_at IS NULL')
      .all(user.id) as TokenRow[]

    db.run('UPDATE client_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [
      now,
      user.id,
    ])

    for (const t of oldTokens) {
      disconnectByTokenHash(user.id, t.token_hash)
    }

    // Issue new token
    const newToken = generateId('ct_')
    const newHash = hashToken(newToken)
    db.run('INSERT INTO client_tokens (token_hash, user_id, created_at) VALUES (?, ?, ?)', [
      newHash,
      user.id,
      now,
    ])

    return c.json({ clientToken: newToken })
  })

  me.post('/me/rotate-webhook-secret', (c) => {
    const user = getAuthedUser(c, config.sessionSecret)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const newSecret = generateId('whsec_')
    const db = getDb()
    db.run('UPDATE users SET webhook_secret = ? WHERE id = ?', [newSecret, user.id])

    return c.json({ webhookSecret: newSecret })
  })

  return me
}
