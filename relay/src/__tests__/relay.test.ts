import { describe, test, expect, beforeEach } from 'bun:test'
import { createHmac } from 'node:crypto'

// ── crypto.ts ────────────────────────────────────────────────────────
import { verifyHmacSha256, hashToken, generateId } from '../crypto'

describe('verifyHmacSha256', () => {
  const secret = 'test-webhook-secret'
  const payload = '{"action":"completed"}'

  function sign(s: string, p: string): string {
    return 'sha256=' + createHmac('sha256', s).update(p).digest('hex')
  }

  test('valid signature passes', () => {
    const sig = sign(secret, payload)
    expect(verifyHmacSha256(secret, payload, sig)).toBe(true)
  })

  test('invalid signature fails', () => {
    const sig = sign(secret, payload)
    // flip a character in the hex portion
    const bad = sig.slice(0, -1) + (sig.at(-1) === 'a' ? 'b' : 'a')
    expect(verifyHmacSha256(secret, payload, bad)).toBe(false)
  })

  test('wrong length signature fails', () => {
    expect(verifyHmacSha256(secret, payload, 'sha256=tooshort')).toBe(false)
  })

  test('completely wrong format fails', () => {
    expect(verifyHmacSha256(secret, payload, '')).toBe(false)
  })

  test('wrong secret fails', () => {
    const sig = sign(secret, payload)
    expect(verifyHmacSha256('wrong-secret', payload, sig)).toBe(false)
  })
})

describe('hashToken', () => {
  test('is deterministic', () => {
    const token = 'ghp_abc123'
    expect(hashToken(token)).toBe(hashToken(token))
  })

  test('different tokens produce different hashes', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'))
  })

  test('returns a 64-character hex string', () => {
    const h = hashToken('anything')
    expect(h).toHaveLength(64)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('generateId', () => {
  test('starts with the given prefix', () => {
    const id = generateId('evt_')
    expect(id.startsWith('evt_')).toBe(true)
  })

  test('generates unique values', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateId('id_')))
    expect(ids.size).toBe(50)
  })

  test('has correct length (prefix + 32 hex chars)', () => {
    const id = generateId('x_')
    // 2-char prefix + 32 hex chars from 16 random bytes
    expect(id).toHaveLength(2 + 32)
  })
})

// ── dedupe.ts ────────────────────────────────────────────────────────
// The module uses a module-level Map, so tests interact with shared state.
// We order tests carefully and use unique ids to stay independent.
import { isDuplicate } from '../dedupe'

describe('isDuplicate', () => {
  test('first delivery is not a duplicate', () => {
    expect(isDuplicate('user-1', 'delivery-unique-1')).toBe(false)
  })

  test('second delivery with same key is a duplicate', () => {
    const user = 'user-dup'
    const delivery = 'delivery-dup-1'
    isDuplicate(user, delivery) // first
    expect(isDuplicate(user, delivery)).toBe(true)
  })

  test('different users with same deliveryId are independent', () => {
    const delivery = 'delivery-shared-1'
    expect(isDuplicate('user-a', delivery)).toBe(false)
    expect(isDuplicate('user-b', delivery)).toBe(false)
  })

  test('same user with different deliveryIds are independent', () => {
    const user = 'user-multi'
    expect(isDuplicate(user, 'del-1')).toBe(false)
    expect(isDuplicate(user, 'del-2')).toBe(false)
  })
})

// ── session.ts ───────────────────────────────────────────────────────
import { signSession, verifySession } from '../session'

describe('session signing and verification', () => {
  const secret = 'session-secret-key'
  const userId = 'user_12345'

  test('sign then verify returns the userId', () => {
    const cookie = signSession(userId, secret)
    expect(verifySession(cookie, secret)).toBe(userId)
  })

  test('tampered cookie fails verification', () => {
    const cookie = signSession(userId, secret)
    const tampered = cookie.replace(userId, 'user_evil')
    expect(verifySession(tampered, secret)).toBeNull()
  })

  test('wrong secret fails verification', () => {
    const cookie = signSession(userId, secret)
    expect(verifySession(cookie, 'wrong-secret')).toBeNull()
  })

  test('cookie without dot returns null', () => {
    expect(verifySession('nodothere', secret)).toBeNull()
  })

  test('empty string returns null', () => {
    expect(verifySession('', secret)).toBeNull()
  })

  test('cookie format is userId.signature', () => {
    const cookie = signSession(userId, secret)
    const parts = cookie.split('.')
    expect(parts).toHaveLength(2)
    expect(parts[0]).toBe(userId)
    expect(parts[1]).toMatch(/^[0-9a-f]{64}$/)
  })
})

// ── connections.ts ───────────────────────────────────────────────────
import {
  addClient,
  removeClient,
  broadcastToUser,
  disconnectByTokenHash,
} from '../connections'

function mockWs() {
  const sent: string[] = []
  let closed = false
  let closeCode = 0
  let closeReason = ''
  return {
    ws: {
      send(msg: string) { sent.push(msg) },
      ping() {},
      close(code: number, reason: string) { closed = true; closeCode = code; closeReason = reason },
    } as any,
    sent,
    get closed() { return closed },
    get closeCode() { return closeCode },
    get closeReason() { return closeReason },
  }
}

describe('connection tracking', () => {
  // Use unique user IDs per test to avoid cross-test pollution from module-level map.

  test('broadcastToUser sends to added client', () => {
    const userId = 'conn-user-1'
    const m = mockWs()
    addClient(userId, m.ws, 'hash-1')
    broadcastToUser(userId, '{"type":"event"}')
    expect(m.sent).toEqual(['{"type":"event"}'])
  })

  test('removeClient stops further broadcasts', () => {
    const userId = 'conn-user-2'
    const m = mockWs()
    addClient(userId, m.ws, 'hash-2')
    removeClient(userId, m.ws)
    broadcastToUser(userId, 'should-not-arrive')
    expect(m.sent).toEqual([])
  })

  test('broadcastToUser sends to multiple clients of same user', () => {
    const userId = 'conn-user-3'
    const m1 = mockWs()
    const m2 = mockWs()
    addClient(userId, m1.ws, 'hash-3a')
    addClient(userId, m2.ws, 'hash-3b')
    broadcastToUser(userId, 'msg')
    expect(m1.sent).toEqual(['msg'])
    expect(m2.sent).toEqual(['msg'])
  })

  test('broadcastToUser does not send to different user', () => {
    const m1 = mockWs()
    const m2 = mockWs()
    addClient('conn-user-4a', m1.ws, 'hash-4a')
    addClient('conn-user-4b', m2.ws, 'hash-4b')
    broadcastToUser('conn-user-4a', 'only-for-a')
    expect(m1.sent).toEqual(['only-for-a'])
    expect(m2.sent).toEqual([])
  })

  test('disconnectByTokenHash closes and removes matching sockets', () => {
    const userId = 'conn-user-5'
    const m1 = mockWs()
    const m2 = mockWs()
    addClient(userId, m1.ws, 'revoked-hash')
    addClient(userId, m2.ws, 'other-hash')
    disconnectByTokenHash(userId, 'revoked-hash')
    expect(m1.closed).toBe(true)
    expect(m1.closeCode).toBe(4401)
    expect(m2.closed).toBe(false)
    // m2 should still receive broadcasts
    broadcastToUser(userId, 'still-alive')
    expect(m2.sent).toEqual(['still-alive'])
  })

  test('disconnectByTokenHash with no clients is a no-op', () => {
    // Should not throw
    disconnectByTokenHash('nonexistent-user', 'some-hash')
  })
})

// ── webhook-log.ts ───────────────────────────────────────────────────
import { logWebhook, getWebhookLog, type WebhookLogEntry } from '../webhook-log'

function makeEntry(overrides: Partial<WebhookLogEntry> = {}): WebhookLogEntry {
  return {
    deliveryId: 'del-' + Math.random().toString(36).slice(2),
    event: 'check_run',
    action: 'completed',
    status: 'broadcast',
    summary: 'test entry',
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('webhook log', () => {
  test('returns empty array for unknown user', () => {
    expect(getWebhookLog('unknown-user-xyz')).toEqual([])
  })

  test('logs and retrieves entries', () => {
    const userId = 'wh-user-1'
    const entry = makeEntry()
    logWebhook(userId, entry)
    const log = getWebhookLog(userId)
    expect(log).toHaveLength(1)
    expect(log[0]).toEqual(entry)
  })

  test('most recent entry is first (unshift order)', () => {
    const userId = 'wh-user-2'
    const e1 = makeEntry({ summary: 'first' })
    const e2 = makeEntry({ summary: 'second' })
    logWebhook(userId, e1)
    logWebhook(userId, e2)
    const log = getWebhookLog(userId)
    expect(log[0].summary).toBe('second')
    expect(log[1].summary).toBe('first')
  })

  test('respects max entries limit (20)', () => {
    const userId = 'wh-user-3'
    for (let i = 0; i < 25; i++) {
      logWebhook(userId, makeEntry({ summary: `entry-${i}` }))
    }
    const log = getWebhookLog(userId)
    expect(log).toHaveLength(20)
    // Most recent should be entry-24
    expect(log[0].summary).toBe('entry-24')
  })

  test('different users have independent logs', () => {
    const userA = 'wh-user-4a'
    const userB = 'wh-user-4b'
    logWebhook(userA, makeEntry({ summary: 'a-entry' }))
    logWebhook(userB, makeEntry({ summary: 'b-entry' }))
    expect(getWebhookLog(userA)).toHaveLength(1)
    expect(getWebhookLog(userB)).toHaveLength(1)
    expect(getWebhookLog(userA)[0].summary).toBe('a-entry')
    expect(getWebhookLog(userB)[0].summary).toBe('b-entry')
  })
})
