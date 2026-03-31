export interface WebhookLogEntry {
  deliveryId: string
  event: string
  action: string
  status: 'received' | 'broadcast' | 'filtered' | 'duplicate'
  summary: string
  timestamp: number
}

const MAX_ENTRIES = 20
const logs = new Map<string, WebhookLogEntry[]>()

export function logWebhook(userId: string, entry: WebhookLogEntry) {
  let userLog = logs.get(userId)
  if (!userLog) {
    userLog = []
    logs.set(userId, userLog)
  }
  userLog.unshift(entry)
  if (userLog.length > MAX_ENTRIES) userLog.pop()
}

export function getWebhookLog(userId: string): WebhookLogEntry[] {
  return logs.get(userId) ?? []
}
