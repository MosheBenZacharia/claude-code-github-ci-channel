import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { connectToRelay } from './relay-client.js'
import { loadConfig } from './config.js'

const config = loadConfig()

const mcp = new Server(
  { name: 'github-ci', version: '1.0.0' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
    },
    instructions:
      'CI failure notifications arrive as <channel source="github-ci" ...>. ' +
      'The repo matches your workspace. Check same_commit to see if the failure is on your exact HEAD commit. ' +
      'Key attributes: check (test name), conclusion (failure/timed_out), branch, head_sha (failing commit), ' +
      'local_head (your HEAD), local_branch, run_url (link to the failing run). Investigate the failure.',
  },
)

const transport = new StdioServerTransport()
await mcp.connect(transport)

connectToRelay(mcp, config)
