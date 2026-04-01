import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { ChannelConfig } from './config.js'
import { matchesLocalRepo } from './git-match.js'

interface RelayEnvelope {
  deliveryId: string
  event: string
  payload: any
}

export function connectToRelay(mcp: Server, config: ChannelConfig) {
  let backoff = 1000
  const maxBackoff = 60000

  function connect() {
    const ws = new WebSocket(config.relayUrl, {
      headers: { Authorization: `Bearer ${config.clientToken}` },
    } as any)

    let pingInterval: ReturnType<typeof setInterval> | null = null

    ws.addEventListener('open', () => {
      console.error('[github-ci] Connected to relay')
      backoff = 1000
      // Send pings every 30s to keep connection alive
      pingInterval = setInterval(() => {
        try {
          ws.send('ping')
        } catch {}
      }, 30_000)
    })

    ws.addEventListener('message', async (event) => {
      try {
        const envelope: RelayEnvelope = JSON.parse(
          typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer),
        )
        await handleEnvelope(mcp, envelope)
      } catch (err) {
        console.error('[github-ci] Failed to handle message:', err)
      }
    })

    ws.addEventListener('close', (event) => {
      if (pingInterval) clearInterval(pingInterval)
      console.error(`[github-ci] Disconnected (code=${event.code}). Reconnecting in ${backoff}ms...`)
      scheduleReconnect()
    })

    ws.addEventListener('error', (err) => {
      console.error('[github-ci] WebSocket error:', err)
    })
  }

  function scheduleReconnect() {
    const jitter = Math.random() * backoff * 0.3
    setTimeout(connect, backoff + jitter)
    backoff = Math.min(backoff * 2, maxBackoff)
  }

  connect()
}

async function handleEnvelope(mcp: Server, envelope: RelayEnvelope) {
  const { deliveryId, event, payload } = envelope

  if (event !== 'check_run') return
  if (payload?.action !== 'completed') return
  if (payload?.check_run?.conclusion !== 'failure' && payload?.check_run?.conclusion !== 'timed_out') return

  const eventRepo = payload.repository?.full_name
  const eventSha = payload.check_run?.head_sha
  const checkName = payload.check_run?.name
  const runUrl = payload.check_run?.html_url
  const eventBranch =
    payload.check_run?.pull_requests?.[0]?.head?.ref ?? payload.check_run?.head_branch

  if (!eventRepo || !eventSha) return

  const match = await matchesLocalRepo(eventRepo, eventSha)
  if (!match) return

  console.error(`[github-ci] CI failure matched: ${checkName} on ${eventRepo}@${eventSha.slice(0, 7)}`)

  await mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content: 'GitHub CI failure on the current repo/commit.',
      meta: {
        branch: eventBranch,
        check: checkName,
        delivery_id: deliveryId,
        head_sha: eventSha,
        repo: eventRepo,
        run_url: runUrl,
      },
    },
  })
}
