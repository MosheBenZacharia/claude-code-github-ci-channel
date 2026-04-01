import { loadConfig } from './config.js'
import { pingAllClients } from './connections.js'
import { createServer } from './create-server.js'

const config = loadConfig()
const server = createServer(config)

setInterval(pingAllClients, 30_000)

console.error(`[relay] Server running on port ${config.port}`)
