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
      'The failing repo and commit match your current workspace. Investigate the failure.',
  },
)

const transport = new StdioServerTransport()
await mcp.connect(transport)

connectToRelay(mcp, config)
