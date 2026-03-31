import { createHmac, timingSafeEqual } from 'node:crypto'

export function signSession(userId: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(userId).digest('hex')
  return `${userId}.${sig}`
}

export function verifySession(cookie: string, secret: string): string | null {
  const dotIdx = cookie.indexOf('.')
  if (dotIdx === -1) return null

  const userId = cookie.slice(0, dotIdx)
  const sig = cookie.slice(dotIdx + 1)
  const expected = createHmac('sha256', secret).update(userId).digest('hex')

  if (expected.length !== sig.length) return null
  try {
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return userId
  } catch {}
  return null
}
