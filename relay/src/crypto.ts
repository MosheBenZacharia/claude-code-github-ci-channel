import { randomBytes, createHmac, createHash, timingSafeEqual } from 'node:crypto'

export function generateId(prefix: string): string {
  return `${prefix}${randomBytes(16).toString('hex')}`
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function verifyHmacSha256(secret: string, payload: string, signature: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex')
  if (expected.length !== signature.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}
