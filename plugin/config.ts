import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DEFAULT_RELAY_URL = 'wss://github-ci-relay.up.railway.app/connect'

export interface ChannelConfig {
  clientToken: string
  relayUrl: string
}

export function loadConfig(): ChannelConfig {
  const envPath = join(homedir(), '.claude', 'channels', 'github-ci', '.env')

  if (!existsSync(envPath)) {
    console.error(`Config not found at ${envPath}. Run /github-ci:configure <clientToken> first.`)
    process.exit(1)
  }

  const env = Object.fromEntries(
    readFileSync(envPath, 'utf-8')
      .split('\n')
      .filter((line) => line.includes('=') && !line.startsWith('#'))
      .map((line) => {
        const idx = line.indexOf('=')
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
      }),
  )

  const clientToken = env.GITHUB_CI_CLIENT_TOKEN
  if (!clientToken) {
    console.error('GITHUB_CI_CLIENT_TOKEN not set. Run /github-ci:configure <clientToken> first.')
    process.exit(1)
  }

  const relayUrl = env.GITHUB_CI_RELAY_URL || DEFAULT_RELAY_URL

  return { clientToken, relayUrl }
}
