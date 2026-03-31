# GitHub CI Channel for Claude Code — Spec

A Claude Code channel that pushes GitHub Actions CI failures into running
Claude Code sessions, scoped to the session's current repository and git
commit. Branch is retained as context only. Modelled on the official
Discord/iMessage channel plugins.

---

## Overview

When a GitHub Actions check run fails for a commit, the relevant Claude Code
session(s) — those whose working directory is on the matching repository and
`HEAD` commit — receive a channel notification and can react immediately.
Sessions on other repos or commits are unaffected.

The system has two components:

1. **Relay server** — a small deployed HTTP/WebSocket server. Receives GitHub
   webhooks, authenticates them, and broadcasts raw payloads to connected
   channel clients scoped to the correct user.

2. **Channel server** (`server.ts`) — a local MCP server spawned by each
   Claude Code instance. Connects outward to the relay, receives broadcasts,
   checks the local repository, branch, and `HEAD` commit, and emits a
   `notifications/claude/channel` event into its Claude Code session when the
   repository and commit match.

This mirrors how the Discord plugin works: Discord's gateway plays the role of
the relay server, and each Claude Code instance makes an outbound WebSocket
connection to it. No inbound port is opened on the user's machine.

---

## Architecture

```
GitHub
  │  POST /webhook/:userId  (HMAC-signed)
  ▼
Relay server  (deployed, publicly reachable)
  │  verify HMAC
  │  look up userId → connected clients
  │  broadcast raw payload to all clients for that user
  ▼
Channel server instances  (local, one per Claude Code session)
  │  receive broadcast
  │  determine current repo + git branch + HEAD commit
  │  repo + HEAD commit match event payload?
  ├─ yes → mcp.notification() → Claude Code session
  └─ no  → drop
```

---

## Relay Server

### Recommended stack

- `TypeScript` for both relay and channel server code
- `Bun` as the runtime for both processes
- `Hono` for relay HTTP routing, cookies, and WebSocket upgrade handling
- Bun's native `WebSocket` support for relay fan-out and channel-server
  connectivity
- `bun:sqlite` with direct SQL for persisted relay state
- `@modelcontextprotocol/sdk` for the local channel MCP server

### Responsibilities

- Accept GitHub webhook POSTs at `/webhook/:userId`
- Verify `X-Hub-Signature-256` against the user's stored webhook secret
- Accept WebSocket connections from channel server instances at `/connect`
- Authenticate connecting clients via a bearer token
- Maintain a registry of `userId → Set<WebSocket>` for connected clients
- Broadcast verified payloads to all connected clients for the matching user
- Provide minimal onboarding: GitHub sign-in, credential display, token/secret rotation

### API

#### `POST /webhook/:userId`

Receives GitHub webhook events.

Request headers:
- `X-Hub-Signature-256` — HMAC-SHA256 signature from GitHub
- `X-GitHub-Event` — event type (`check_run`, `workflow_run`, etc.)
- `X-GitHub-Delivery` — unique delivery ID for dedupe and replay protection

Behaviour:
1. Look up the user by `userId`
2. Verify the HMAC against the user's stored webhook secret — return `401` if invalid
3. Read `X-GitHub-Delivery`; if it was already seen for this `userId` within a
   short TTL window (for example 24 hours), return `200 OK` and drop it
4. Parse the payload
5. Filter: only forward `check_run` events with `action: "completed"` and
   `conclusion: "failure"` (and optionally `"timed_out"`)
6. Broadcast an envelope containing the delivery ID and raw JSON payload to all
   WebSocket clients registered under `userId`
7. Return `200 OK` immediately (within GitHub's 10s window)

#### `GET /connect`

WebSocket upgrade endpoint for channel server instances.

Authentication: `Authorization: Bearer <clientToken>` header on the upgrade
request.

On connect:
1. Validate the token — close with `4401` if invalid
2. Look up the `userId` associated with the token
3. Register the socket under `userId`, tagged with the authenticated token hash
4. On disconnect, deregister

Message format (relay → client): a UTF-8 JSON string envelope:

```json
{
  "deliveryId": "72d3162e-cc78-11e3-81ab-4c9367dc0958",
  "event": "check_run",
  "payload": { "...": "raw GitHub webhook JSON payload" }
}
```

#### `GET /auth/github/start`

Starts GitHub OAuth for self-serve onboarding.

#### `GET /auth/github/callback`

Completes GitHub OAuth, creates the local account if needed, and establishes an
authenticated session cookie for the web UI.

#### `GET /me`

Returns the authenticated user's channel credentials and setup information.

Response:
```json
{
  "userId": "usr_abc123",
  "githubLogin": "octocat",
  "clientToken": "ct_...",
  "webhookSecret": "whsec_...",
  "webhookUrl": "https://relay.example.com/webhook/usr_abc123"
}
```

The `webhookUrl` and `webhookSecret` are what the user configures in their
GitHub repo settings. The `clientToken` goes into their local
`~/.claude/channels/github-ci/.env`. The relay URL is fixed by the plugin in
production and only needs a local override for development or self-hosting.

#### `POST /me/rotate-client-token`

Revokes the current `clientToken` and issues a new one. Requires the user's web
session. Any currently connected WebSocket clients authenticated with the old
token are immediately disconnected.

#### `POST /me/rotate-webhook-secret`

Issues a new webhook secret for GitHub webhook verification. Requires the user's
web session.

#### `GET /health`

Returns `200 OK`. Used for uptime monitoring.

### Data Model

SQLite via `bun:sqlite` (single-file, sufficient for this use case):

```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,   -- "usr_" + random
  github_user_id TEXT UNIQUE NOT NULL,
  github_login TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,   -- plaintext or encrypted at rest; used to verify GitHub HMAC
  created_at  INTEGER NOT NULL
);

CREATE TABLE client_tokens (
  token_hash  TEXT PRIMARY KEY,   -- SHA-256 of "ct_" + random
  user_id     TEXT NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL,
  last_seen   INTEGER,
  revoked_at  INTEGER
);
```

In-memory only (not persisted):

```
connectedClients: Map<userId, Set<{ ws: WebSocket, tokenHash: string }>>
recentDeliveries: TTL cache keyed by (userId, deliveryId)
```

### Deployment

- Deploy the relay as a long-lived `Railway` service
- Runtime: `Bun`
- App server: `Hono` on top of `Bun.serve()`
- WebSockets: Bun native WebSocket support; no separate socket broker in V1
- Database: `SQLite` via `bun:sqlite`
- Store the SQLite file on an attached Railway volume mounted at a stable path
  such as `/data/github-ci.sqlite`
- Keep `DATABASE_PATH` pointed at that mounted volume so restarts and redeploys
  preserve the database
- TLS terminates at Railway's edge
- Environment variables: `PORT`, `DATABASE_PATH`, `SESSION_SECRET`,
  `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

Operational expectations:

- Relay restarts or redeploys should not lose persisted user/token data as long
  as the same Railway volume remains attached
- In-memory state is rebuilt on process start: active WebSocket connections drop
  and reconnect, and the recent-delivery dedupe cache starts empty
- This is acceptable for V1 because the channel clients auto-reconnect and
  GitHub can redeliver webhook events if needed

Why Railway:

- This design requires a persistent process with long-lived WebSocket
  connections
- It also requires a durable on-disk SQLite file
- Railway fits that model directly with a single service plus attached volume

Non-goals for the V1 deployment:

- `Vercel` is not a target host for the relay because this design depends on a
  long-lived process and durable local disk
- No Redis, no message queue, and no external database in V1

If the project later needs multiple relay instances or higher availability,
migrate the relay from SQLite-on-volume to hosted `Postgres` plus a pub/sub fan-out layer.

---

## Channel Server

### Responsibilities

- Read `clientToken` from `~/.claude/channels/github-ci/.env`
- Connect outward to the relay server via WebSocket
- Receive broadcast payloads
- Check the current git repository, branch, and `HEAD` commit against the payload
- Emit `notifications/claude/channel` into the Claude Code session on match
- Reconnect automatically on disconnect
- Register with Claude Code as a channel MCP server

### Configuration

`~/.claude/channels/github-ci/.env`:
```
GITHUB_CI_CLIENT_TOKEN=ct_...
```

Optional development/self-hosting override:
```
GITHUB_CI_RELAY_URL=wss://relay.example.com/connect
```

The plugin should ship with a fixed production relay URL and use
`GITHUB_CI_RELAY_URL` only as an override. This keeps user-facing setup to a
single token in the common case.

### Startup sequence

1. Read `.env`
2. Connect to Claude Code via `StdioServerTransport` (standard MCP)
3. Start the relay connection loop in the background
4. Connect to relay WebSocket with `Authorization: Bearer <token>`
5. If connection fails, log to stderr and retry with exponential backoff
6. Begin receiving messages once connected

### Message handling

On each message received from the relay:

1. Parse the envelope and extract `deliveryId` and `payload`
2. Check `action === "completed"` and `conclusion === "failure"` (relay
   should already filter, but double-check defensively)
3. Extract `eventBranch`, `eventRepo`, `eventSha`, `checkName`, and `runUrl`:
   ```
   const eventBranch =
     payload.check_run.pull_requests[0]?.head?.ref
       ?? payload.check_run.head_branch

   const eventRepo = payload.repository.full_name
   const eventSha = payload.check_run.head_sha
   const checkName = payload.check_run.name
   const runUrl = payload.check_run.html_url
   ```
4. Run `git rev-parse HEAD` in the working directory
5. Determine the local repo identity from `git config --get remote.origin.url`
   and normalize it to `owner/repo`
6. Optionally run `git branch --show-current` for logging and UI context
7. If repo and commit SHA match, emit:
   ```ts
   mcp.notification({
     method: 'notifications/claude/channel',
     params: {
       content: 'GitHub CI failure on the current repo/commit.',
       meta: {
         branch: eventBranch,
         check:  checkName,
         delivery_id: deliveryId,
         head_sha: eventSha,
         repo:   eventRepo,
         run_url: runUrl,
       },
     },
   })
   ```
8. If repo or commit SHA do not match, drop silently

Commit SHA is the authoritative match key. Branch is included as context, but
is not sufficient on its own because the local branch may have advanced past the
failing commit before the webhook arrives.

### Reconnection

Use exponential backoff with jitter: start at 1s, cap at 60s. Log each
reconnect attempt to stderr. This is important because Claude Code sessions
can be long-lived and a relay deploy/restart shouldn't permanently disconnect
them.

### MCP server declaration

```ts
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
```

### Plugin structure

Following the standard Claude Code plugin layout:

```
github-ci/
├── .claude-plugin/
│   └── plugin.json
├── .mcp.json
├── server.ts          ← channel server
├── commands/
│   └── configure.md  ← /github-ci:configure slash command
└── README.md
```

`.claude-plugin/plugin.json`:
```json
{
  "name": "github-ci",
  "description": "GitHub Actions CI failure channel for Claude Code",
  "version": "1.0.0",
  "keywords": ["github", "actions", "ci", "channel", "mcp"]
}
```

`.mcp.json`:
```json
{
  "mcpServers": {
    "github-ci": {
      "command": "bun",
      "args": ["run", "--cwd", "${CLAUDE_PLUGIN_ROOT}", "--shell=bun", "--silent", "server.ts"]
    }
  }
}
```

### Installation (user-facing)

```bash
/plugin install github-ci@<marketplace>
```

Reload plugins so the slash command is available in the current session:
```bash
/reload-plugins
```

Then configure:
```bash
/github-ci:configure <clientToken>
```

This saves the token to `~/.claude/channels/github-ci/.env`. The relay URL comes
from the plugin by default; advanced users can set `GITHUB_CI_RELAY_URL`
manually for development or self-hosting.

Start with channels enabled:
```bash
claude --dangerously-load-development-channels --channels plugin:github-ci@<marketplace>
```

---

## User Onboarding Flow

1. User visits relay server web UI
2. Signs in with GitHub
3. Lands on a setup page showing `webhookUrl`, `webhookSecret`, and `clientToken`
4. In their GitHub repo: Settings → Webhooks → Add webhook
   - Payload URL: `webhookUrl`
   - Secret: `webhookSecret`
   - Events: select "Check runs"
5. In Claude Code:
   ```
   /plugin install github-ci@<marketplace>
   /reload-plugins
   /github-ci:configure <clientToken>
   ```
6. Restart with `claude --dangerously-load-development-channels --channels plugin:github-ci@<marketplace>`
7. Push a branch or open a PR — the next failing check run on that repo/commit
   notifies the relevant session

---

## Multi-instance behaviour

Multiple Claude Code sessions on the same machine connect independently to the
relay. Each opens its own WebSocket connection and performs its own repo and
commit check, with branch used only as extra context. A user working on
`feature/auth` and `feature/payments`
simultaneously, or on two different repos that both have a `main` branch, gets
notified only in the session on the matching repo/commit. This is the same
fan-out model the Discord and iMessage plugins use.

---

## Security

### GitHub → relay

- Webhook secret is per-user, generated at onboarding, stored plaintext or
  encrypted at rest so the relay can verify GitHub's HMAC
- Every inbound POST is verified with HMAC-SHA256 before any processing
- Payloads that fail verification are rejected with `401` — never broadcast

### Channel server → relay

- Client tokens are random, high-entropy, stored hashed in the database
- Transmitted over TLS (WSS)
- Stored locally in `~/.claude/channels/github-ci/.env` with `chmod 600`,
  same as the Discord plugin's token handling
- Rotatable via `/me/rotate-client-token` if compromised
- Rotating a token immediately disconnects any live sockets authenticated with
  the revoked token

### Relay server

- Webhook endpoint and WebSocket endpoint are the only public surfaces
- No user content is stored — payloads are broadcast in memory and discarded
- Rate-limit webhook POSTs per `userId` to mitigate replay/flood attacks
- Cache recent `X-GitHub-Delivery` IDs per user for a short TTL and drop
  duplicates to handle retries, redeliveries, and replay attempts
- The onboarding UI can stay minimal: GitHub sign-in, credential display, and
  credential rotation only

### Prompt injection

The GitHub payload fields included in the channel notification
(`checkName`, `repo`, `runUrl`) should be carried in `meta` attributes rather
than interpolated heavily into `content`, to reduce the surface for injection
via a maliciously named check or repo. The relay never executes payload
content — it only forwards raw JSON.

---

## Out of Scope for V1

- `workflow_run` support; v1 only handles `check_run`
- PR-aware enrichment beyond the repo/branch/commit information already in the payload
- Success notifications
- Reply tools or GitHub write actions
- Per-repo filtering controls
- Self-hosted relay UX and documentation
