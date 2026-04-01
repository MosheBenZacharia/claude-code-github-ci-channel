import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createServer } from '../create-server.js'
import { getDb } from '../db.js'
import { generateId, hashToken } from '../crypto.js'
import { createHmac } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let server: ReturnType<typeof createServer> | null = null
let BASE_URL: string
let WS_URL: string
let testUser: { id: string; webhookSecret: string; clientToken: string; tokenHash: string }

beforeAll(() => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'relay-test-'))
  const dbPath = join(tmpDir, 'test.sqlite')

  server = createServer({
    port: 0, // Let the OS assign a free port
    databasePath: dbPath,
    sessionSecret: 'test-session-secret',
    githubClientId: 'test-client-id',
    githubClientSecret: 'test-client-secret',
    publicUrl: 'http://localhost',
  })

  const assignedPort = server.port
  BASE_URL = `http://localhost:${assignedPort}`
  WS_URL = `ws://localhost:${assignedPort}/connect`

  // Seed a test user
  const db = getDb()
  const userId = generateId('usr_')
  const webhookSecret = generateId('whsec_')
  const clientToken = generateId('ct_')
  const tokenHash = hashToken(clientToken)

  db.run(
    'INSERT INTO users (id, github_user_id, github_login, webhook_secret, created_at) VALUES (?, ?, ?, ?, ?)',
    [userId, '12345', 'testuser', webhookSecret, Date.now()],
  )
  db.run('INSERT INTO client_tokens (token_hash, user_id, created_at) VALUES (?, ?, ?)', [
    tokenHash,
    userId,
    Date.now(),
  ])

  testUser = { id: userId, webhookSecret, clientToken, tokenHash }
})

afterAll(() => {
  server?.stop(true)
})

function signPayload(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
}

function makeCheckRunPayload(conclusion: string = 'failure') {
  return JSON.stringify({
    action: 'completed',
    check_run: {
      name: 'tests',
      head_sha: 'abc123',
      conclusion,
      html_url: 'https://github.com/owner/repo/runs/1',
      head_branch: 'main',
      pull_requests: [],
    },
    repository: { full_name: 'owner/repo' },
  })
}

// --- Health ---

describe('GET /health', () => {
  test('returns OK', async () => {
    const res = await fetch(`${BASE_URL}/health`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OK')
  })
})

// --- Webhook ---

describe('POST /webhook/:userId', () => {
  test('rejects unknown user', async () => {
    const res = await fetch(`${BASE_URL}/webhook/usr_nonexistent`, {
      method: 'POST',
      body: '{}',
    })
    expect(res.status).toBe(404)
  })

  test('rejects missing signature', async () => {
    const res = await fetch(`${BASE_URL}/webhook/${testUser.id}`, {
      method: 'POST',
      body: '{}',
    })
    expect(res.status).toBe(401)
  })

  test('rejects invalid signature', async () => {
    const body = makeCheckRunPayload()
    const res = await fetch(`${BASE_URL}/webhook/${testUser.id}`, {
      method: 'POST',
      headers: {
        'X-Hub-Signature-256': 'sha256=invalid',
        'X-GitHub-Event': 'check_run',
        'X-GitHub-Delivery': generateId('del_'),
      },
      body,
    })
    expect(res.status).toBe(401)
  })

  test('accepts valid signed webhook', async () => {
    const body = makeCheckRunPayload()
    const sig = signPayload(testUser.webhookSecret, body)
    const res = await fetch(`${BASE_URL}/webhook/${testUser.id}`, {
      method: 'POST',
      headers: {
        'X-Hub-Signature-256': sig,
        'X-GitHub-Event': 'check_run',
        'X-GitHub-Delivery': generateId('del_'),
      },
      body,
    })
    expect(res.status).toBe(200)
  })

  test('filters non-check_run events', async () => {
    const body = JSON.stringify({ action: 'opened' })
    const sig = signPayload(testUser.webhookSecret, body)
    const res = await fetch(`${BASE_URL}/webhook/${testUser.id}`, {
      method: 'POST',
      headers: {
        'X-Hub-Signature-256': sig,
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': generateId('del_'),
      },
      body,
    })
    expect(res.status).toBe(200)
  })

  test('filters successful check_runs', async () => {
    const body = makeCheckRunPayload('success')
    const sig = signPayload(testUser.webhookSecret, body)
    const res = await fetch(`${BASE_URL}/webhook/${testUser.id}`, {
      method: 'POST',
      headers: {
        'X-Hub-Signature-256': sig,
        'X-GitHub-Event': 'check_run',
        'X-GitHub-Delivery': generateId('del_'),
      },
      body,
    })
    expect(res.status).toBe(200)
  })

  test('accepts ping events', async () => {
    const body = JSON.stringify({ zen: 'test', hook_id: 1, repository: { full_name: 'owner/repo' } })
    const sig = signPayload(testUser.webhookSecret, body)
    const res = await fetch(`${BASE_URL}/webhook/${testUser.id}`, {
      method: 'POST',
      headers: {
        'X-Hub-Signature-256': sig,
        'X-GitHub-Event': 'ping',
        'X-GitHub-Delivery': generateId('del_'),
      },
      body,
    })
    expect(res.status).toBe(200)
  })
})

// --- WebSocket ---

describe('WebSocket /connect', () => {
  test('rejects missing auth', async () => {
    const res = await fetch(`${BASE_URL}/connect`, {
      headers: { Upgrade: 'websocket' },
    })
    expect(res.status).toBe(401)
  })

  test('rejects invalid token', async () => {
    const res = await fetch(`${BASE_URL}/connect`, {
      headers: {
        Upgrade: 'websocket',
        Authorization: 'Bearer invalid_token',
      },
    })
    expect(res.status).toBe(401)
  })

  test('connects with valid token', async () => {
    const ws = new WebSocket(WS_URL, {
      headers: { Authorization: `Bearer ${testUser.clientToken}` },
    } as any)

    const connected = await new Promise<boolean>((resolve) => {
      ws.addEventListener('open', () => resolve(true))
      ws.addEventListener('error', () => resolve(false))
      setTimeout(() => resolve(false), 3000)
    })

    expect(connected).toBe(true)
    ws.close()
  })
})

// --- Webhook → WebSocket delivery ---

describe('webhook to WebSocket delivery', () => {
  test('broadcasts failure to connected client', async () => {
    const ws = new WebSocket(WS_URL, {
      headers: { Authorization: `Bearer ${testUser.clientToken}` },
    } as any)

    await new Promise<void>((resolve) => {
      ws.addEventListener('open', () => resolve())
    })

    // Small delay to ensure the server registers the client
    await new Promise((r) => setTimeout(r, 50))

    const messagePromise = new Promise<any>((resolve) => {
      ws.addEventListener('message', (event) => {
        resolve(JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer)))
      })
      setTimeout(() => resolve(null), 3000)
    })

    // Send a failing check_run webhook
    const body = makeCheckRunPayload('failure')
    const sig = signPayload(testUser.webhookSecret, body)
    const deliveryId = generateId('del_')
    await fetch(`${BASE_URL}/webhook/${testUser.id}`, {
      method: 'POST',
      headers: {
        'X-Hub-Signature-256': sig,
        'X-GitHub-Event': 'check_run',
        'X-GitHub-Delivery': deliveryId,
      },
      body,
    })

    const envelope = await messagePromise
    expect(envelope).not.toBeNull()
    expect(envelope.deliveryId).toBe(deliveryId)
    expect(envelope.event).toBe('check_run')
    expect(envelope.payload.check_run.conclusion).toBe('failure')
    expect(envelope.payload.repository.full_name).toBe('owner/repo')

    ws.close()
  })

  test('does not broadcast successful check_runs', async () => {
    const ws = new WebSocket(WS_URL, {
      headers: { Authorization: `Bearer ${testUser.clientToken}` },
    } as any)

    await new Promise<void>((resolve) => {
      ws.addEventListener('open', () => resolve())
    })

    await new Promise((r) => setTimeout(r, 50))

    let received = false
    ws.addEventListener('message', () => {
      received = true
    })

    const body = makeCheckRunPayload('success')
    const sig = signPayload(testUser.webhookSecret, body)
    await fetch(`${BASE_URL}/webhook/${testUser.id}`, {
      method: 'POST',
      headers: {
        'X-Hub-Signature-256': sig,
        'X-GitHub-Event': 'check_run',
        'X-GitHub-Delivery': generateId('del_'),
      },
      body,
    })

    await new Promise((r) => setTimeout(r, 200))
    expect(received).toBe(false)

    ws.close()
  })

  test('broadcasts timed_out to connected client', async () => {
    const ws = new WebSocket(WS_URL, {
      headers: { Authorization: `Bearer ${testUser.clientToken}` },
    } as any)

    await new Promise<void>((resolve) => {
      ws.addEventListener('open', () => resolve())
    })

    await new Promise((r) => setTimeout(r, 50))

    const messagePromise = new Promise<any>((resolve) => {
      ws.addEventListener('message', (event) => {
        resolve(JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer)))
      })
      setTimeout(() => resolve(null), 3000)
    })

    const body = makeCheckRunPayload('timed_out')
    const sig = signPayload(testUser.webhookSecret, body)
    await fetch(`${BASE_URL}/webhook/${testUser.id}`, {
      method: 'POST',
      headers: {
        'X-Hub-Signature-256': sig,
        'X-GitHub-Event': 'check_run',
        'X-GitHub-Delivery': generateId('del_'),
      },
      body,
    })

    const envelope = await messagePromise
    expect(envelope).not.toBeNull()
    expect(envelope.payload.check_run.conclusion).toBe('timed_out')

    ws.close()
  })
})

// --- Webhook log API ---

describe('GET /me/webhook-log', () => {
  test('returns 401 without session', async () => {
    const res = await fetch(`${BASE_URL}/me/webhook-log`)
    expect(res.status).toBe(401)
  })
})
