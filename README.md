# GitHub CI Channel for Claude Code

A [Claude Code channel](https://code.claude.com/docs/en/channels) that pushes GitHub Actions CI failures into running Claude Code sessions. When a check run fails on your repo, Claude gets notified with full context and can start investigating immediately.

Sessions whose working directory matches the failing repo receive the notification with rich context (branch, commit, check name, conclusion, run URL, and your local HEAD). Claude decides if the failure is relevant to current work. Sessions on other repos are unaffected.

## How it works

```
GitHub Actions
  |  check_run fails
  |  POST /webhook/:userId (HMAC-signed)
  v
Relay server (deployed on Railway)
  |  verify signature
  |  broadcast to connected clients
  v
Channel server (local, one per Claude Code session)
  |  receive broadcast
  |  match against local repo, include local context
  v
Claude Code session
  |  <channel source="github-ci" repo="..." check="..." run_url="...">
  |  Claude investigates the failure
```

No inbound ports are opened on your machine. The local channel server makes an outbound WebSocket connection to the relay, the same pattern the official Discord and Telegram channel plugins use.

## Repo structure

```
.
├── relay/              # Deployed relay server (Bun + Hono + SQLite)
│   ├── src/
│   │   ├── server.ts         # Entrypoint: Hono routes + WebSocket upgrade
│   │   ├── config.ts         # Environment variable loading
│   │   ├── db.ts             # SQLite schema and init
│   │   ├── crypto.ts         # Token generation, hashing, HMAC verification
│   │   ├── session.ts        # Signed session cookies
│   │   ├── connections.ts    # WebSocket client tracking and broadcast
│   │   ├── dedupe.ts         # Delivery deduplication (TTL cache)
│   │   ├── webhook-log.ts    # In-memory webhook delivery log
│   │   ├── routes/
│   │   │   ├── auth.ts       # GitHub OAuth start/callback
│   │   │   ├── health.ts     # GET /health
│   │   │   ├── me.ts         # GET /me, token/secret rotation
│   │   │   └── webhook.ts    # POST /webhook/:userId
│   │   ├── views/
│   │   │   └── setup.ts      # HTML setup page
│   │   └── static/
│   │       └── icon.jpg
│   └── Dockerfile
│
├── plugin/             # Claude Code channel plugin (local MCP server)
│   ├── server.ts             # MCP entrypoint with channel capability
│   ├── config.ts             # Reads client token from ~/.claude/channels/
│   ├── relay-client.ts       # WebSocket connection with reconnect backoff
│   ├── git-match.ts          # Repo normalization + HEAD SHA matching
│   ├── commands/
│   │   └── configure.md      # /github-ci:configure slash command
│   ├── .claude-plugin/
│   │   └── plugin.json       # Plugin manifest
│   ├── .mcp.json             # MCP server config
│   └── README.md
│
├── docs/               # Spec and implementation plan
│   ├── github-ci-channel-spec.md
│   └── github-ci-channel-plan.md
│
└── .claude-plugin/
    └── marketplace.json      # Makes this repo a plugin marketplace
```

## Getting started

### Prerequisites

- [Claude Code](https://claude.ai/claude-code) v2.1.80+ with a claude.ai account
- [Bun](https://bun.sh) installed

### 1. Get your credentials

Visit the relay and sign in with GitHub:

**https://relay-production-5d82.up.railway.app/auth/github/start**

You'll get three credentials: a **Webhook URL**, a **Webhook Secret**, and a **Client Token**.

### 2. Add the GitHub webhook

In your GitHub repo: **Settings > Webhooks > Add webhook**

- **Payload URL**: your Webhook URL
- **Content type**: `application/json`
- **Secret**: your Webhook Secret
- **Events**: select "Let me select individual events" and check **Check runs**

### 3. Install the plugin

In Claude Code:

```
/plugin marketplace add MosheBenZacharia/claude-code-github-ci-channel
/plugin install github-ci@github-ci-channel
/reload-plugins
/github-ci:configure <your-client-token>
```

### 4. Start with channels enabled

```bash
claude --dangerously-load-development-channels plugin:github-ci@github-ci-channel
```

> Channels are in [research preview](https://code.claude.com/docs/en/channels#research-preview). Third-party plugins require `--dangerously-load-development-channels` until added to an approved allowlist.

### 5. Trigger a failure

Push a commit or open a PR. When a CI check run fails on your repo, Claude Code receives the notification with full context and can start investigating.

## Self-hosting the relay

The relay is a Bun + Hono server backed by SQLite. To self-host:

1. Clone the repo and `cd relay`
2. Copy `.env.example` to `.env` and fill in the values — in particular, set `PUBLIC_URL` to your relay's public URL (e.g. `https://relay.example.com`). This is used for OAuth callbacks and the webhook URLs shown to users.
3. Create a [GitHub OAuth App](https://github.com/settings/developers) with callback URL `https://your-host/auth/github/callback`
4. `bun install` and run with `bun run src/server.ts`
5. Visit `https://your-host/auth/github/start` to sign in and get your credentials (webhook URL, webhook secret, client token) from your own relay instance

Then configure Claude Code to use your relay:

```
# ~/.claude/channels/github-ci/.env
GITHUB_CI_CLIENT_TOKEN=<token from your relay's /me page>
GITHUB_CI_RELAY_URL=wss://your-host/connect
```

## License

[MIT](LICENSE)
