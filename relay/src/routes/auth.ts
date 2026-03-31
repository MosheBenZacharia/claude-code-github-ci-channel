import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { RelayConfig } from '../config.js'
import { getDb } from '../db.js'
import { generateId, hashToken } from '../crypto.js'
import { signSession, verifySession } from '../session.js'

export function createAuthRoutes(config: RelayConfig) {
  const auth = new Hono()

  auth.get('/auth/github/start', (c) => {
    const params = new URLSearchParams({
      client_id: config.githubClientId,
      redirect_uri: `${config.publicUrl}/auth/github/callback`,
      scope: 'read:user',
    })
    return c.redirect(`https://github.com/login/oauth/authorize?${params}`)
  })

  auth.get('/auth/github/callback', async (c) => {
    const code = c.req.query('code')
    if (!code) return c.text('Missing code', 400)

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: config.githubClientId,
        client_secret: config.githubClientSecret,
        code,
      }),
    })

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string }
    if (!tokenData.access_token) return c.text('OAuth failed', 400)

    // Fetch GitHub user
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const ghUser = (await userRes.json()) as { id: number; login: string }

    const db = getDb()
    const githubUserId = String(ghUser.id)

    // Find or create user
    let user = db.query('SELECT id FROM users WHERE github_user_id = ?').get(githubUserId) as
      | { id: string }
      | null

    let clientToken: string | undefined

    if (!user) {
      const userId = generateId('usr_')
      const webhookSecret = generateId('whsec_')
      clientToken = generateId('ct_')
      const tokenHash = hashToken(clientToken)

      db.run(
        'INSERT INTO users (id, github_user_id, github_login, webhook_secret, created_at) VALUES (?, ?, ?, ?, ?)',
        [userId, githubUserId, ghUser.login, webhookSecret, Date.now()],
      )

      db.run('INSERT INTO client_tokens (token_hash, user_id, created_at) VALUES (?, ?, ?)', [
        tokenHash,
        userId,
        Date.now(),
      ])

      user = { id: userId }
    } else {
      // Update login in case it changed
      db.run('UPDATE users SET github_login = ? WHERE id = ?', [ghUser.login, user.id])
    }

    // Set session cookie
    const sessionValue = signSession(user.id, config.sessionSecret)
    setCookie(c, 'session', sessionValue, {
      httpOnly: true,
      secure: config.publicUrl.startsWith('https'),
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    // Flash the initial client token so /me can show it once
    if (clientToken) {
      setCookie(c, 'flash_token', clientToken, {
        httpOnly: true,
        secure: config.publicUrl.startsWith('https'),
        sameSite: 'Lax',
        path: '/me',
        maxAge: 60,
      })
    }

    return c.redirect('/me')
  })

  return auth
}
