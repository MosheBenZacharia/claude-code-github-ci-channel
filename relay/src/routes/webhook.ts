import { Hono } from 'hono'
import { getDb } from '../db.js'
import { verifyHmacSha256 } from '../crypto.js'
import { isDuplicate } from '../dedupe.js'
import { broadcastToUser } from '../connections.js'

interface UserRow {
  id: string
  webhook_secret: string
}

const webhook = new Hono()

webhook.post('/webhook/:userId', async (c) => {
  const userId = c.req.param('userId')
  const db = getDb()

  const user = db.query('SELECT id, webhook_secret FROM users WHERE id = ?').get(userId) as UserRow | null
  if (!user) return c.text('Not found', 404)

  // Verify HMAC
  const signature = c.req.header('X-Hub-Signature-256')
  if (!signature) return c.text('Missing signature', 401)

  const rawBody = await c.req.text()
  if (!verifyHmacSha256(user.webhook_secret, rawBody, signature)) {
    console.error(`[webhook] HMAC verification failed for user ${userId}`)
    return c.text('Invalid signature', 401)
  }

  // Dedupe
  const deliveryId = c.req.header('X-GitHub-Delivery')
  if (deliveryId && isDuplicate(userId, deliveryId)) {
    console.error(`[webhook] Duplicate delivery ${deliveryId} for user ${userId}`)
    return c.text('OK', 200)
  }

  // Parse payload
  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return c.text('Invalid JSON', 400)
  }

  // Filter: only check_run completed with failure/timed_out
  const event = c.req.header('X-GitHub-Event')
  if (event !== 'check_run') {
    return c.text('OK', 200)
  }

  if (payload.action !== 'completed') {
    return c.text('OK', 200)
  }

  const conclusion = payload.check_run?.conclusion
  if (conclusion !== 'failure' && conclusion !== 'timed_out') {
    return c.text('OK', 200)
  }

  // Broadcast
  const envelope = JSON.stringify({
    deliveryId: deliveryId ?? 'unknown',
    event: 'check_run',
    payload,
  })

  broadcastToUser(userId, envelope)
  console.error(`[webhook] Broadcast check_run failure to user ${userId} (delivery=${deliveryId})`)

  return c.text('OK', 200)
})

export { webhook }
