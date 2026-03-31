import type { ServerWebSocket } from 'bun'

interface ConnectedClient {
  ws: ServerWebSocket<{ userId: string; tokenHash: string }>
  tokenHash: string
}

const clients = new Map<string, Set<ConnectedClient>>()

export function addClient(userId: string, ws: ServerWebSocket<any>, tokenHash: string) {
  let set = clients.get(userId)
  if (!set) {
    set = new Set()
    clients.set(userId, set)
  }
  set.add({ ws, tokenHash })
}

export function removeClient(userId: string, ws: ServerWebSocket<any>) {
  const set = clients.get(userId)
  if (!set) return
  for (const client of set) {
    if (client.ws === ws) {
      set.delete(client)
      break
    }
  }
  if (set.size === 0) clients.delete(userId)
}

export function broadcastToUser(userId: string, message: string) {
  const set = clients.get(userId)
  if (!set) return
  for (const client of set) {
    try {
      client.ws.send(message)
    } catch {
      set.delete(client)
    }
  }
}

export function disconnectByTokenHash(userId: string, tokenHash: string) {
  const set = clients.get(userId)
  if (!set) return
  for (const client of set) {
    if (client.tokenHash === tokenHash) {
      try {
        client.ws.close(4401, 'Token revoked')
      } catch {}
      set.delete(client)
    }
  }
  if (set.size === 0) clients.delete(userId)
}
