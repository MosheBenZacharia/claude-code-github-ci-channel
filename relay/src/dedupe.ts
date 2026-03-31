const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

const seen = new Map<string, number>()

export function isDuplicate(userId: string, deliveryId: string): boolean {
  const key = `${userId}:${deliveryId}`
  const now = Date.now()

  // Prune expired entries periodically (every 1000 checks)
  if (seen.size > 0 && seen.size % 1000 === 0) {
    for (const [k, ts] of seen) {
      if (now - ts > TTL_MS) seen.delete(k)
    }
  }

  if (seen.has(key)) return true
  seen.set(key, now)
  return false
}
