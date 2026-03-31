import { Hono } from 'hono'
import { getDb } from '../db.js'
import { verifyHmacSha256 } from '../crypto.js'
import { isDuplicate } from '../dedupe.js'
import { broadcastToUser } from '../connections.js'
import { logWebhook } from '../webhook-log.js'

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

  const deliveryId = c.req.header('X-GitHub-Delivery') ?? 'unknown'
  const event = c.req.header('X-GitHub-Event') ?? 'unknown'

  // Dedupe
  if (deliveryId !== 'unknown' && isDuplicate(userId, deliveryId)) {
    logWebhook(userId, {
      deliveryId,
      event,
      action: '',
      status: 'duplicate',
      summary: `Duplicate ${event} delivery`,
      timestamp: Date.now(),
    })
    return c.text('OK', 200)
  }

  // Parse payload
  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return c.text('Invalid JSON', 400)
  }

  const action = payload.action ?? ''
  const repo = payload.repository?.full_name ?? ''

  // Ping events
  if (event === 'ping') {
    logWebhook(userId, {
      deliveryId,
      event,
      action: '',
      status: 'received',
      summary: repo ? `Ping from ${repo}` : 'Webhook connected',
      timestamp: Date.now(),
    })
    return c.text('OK', 200)
  }

  // Filter: only check_run completed with failure/timed_out
  if (event !== 'check_run') {
    logWebhook(userId, {
      deliveryId,
      event,
      action,
      status: 'filtered',
      summary: `${event} event (not check_run)`,
      timestamp: Date.now(),
    })
    return c.text('OK', 200)
  }

  if (action !== 'completed') {
    logWebhook(userId, {
      deliveryId,
      event,
      action,
      status: 'filtered',
      summary: `check_run ${action} (waiting for completed)`,
      timestamp: Date.now(),
    })
    return c.text('OK', 200)
  }

  const conclusion = payload.check_run?.conclusion
  const checkName = payload.check_run?.name ?? 'unknown'

  if (conclusion !== 'failure' && conclusion !== 'timed_out') {
    logWebhook(userId, {
      deliveryId,
      event,
      action,
      status: 'filtered',
      summary: `${checkName}: ${conclusion}`,
      timestamp: Date.now(),
    })
    return c.text('OK', 200)
  }

  // Broadcast
  const envelope = JSON.stringify({
    deliveryId,
    event: 'check_run',
    payload,
  })

  broadcastToUser(userId, envelope)

  logWebhook(userId, {
    deliveryId,
    event,
    action,
    status: 'broadcast',
    summary: `${checkName}: ${conclusion} on ${repo}`,
    timestamp: Date.now(),
  })

  return c.text('OK', 200)
})

export { webhook }
