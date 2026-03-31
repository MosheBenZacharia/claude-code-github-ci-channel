# GitHub CI Channel for Claude Code — Implementation Plan

Mark tasks as complete by changing `[ ]` to `[x]`.

## Phase 0 — Project Setup

- [x] Create the top-level repo layout: `docs/`, `relay/`, and `plugin/`
- [x] Move the spec and plan into `docs/`
- [x] Create the Claude Code plugin layout inside `plugin/`: `.claude-plugin/plugin.json`, `.mcp.json`, `server.ts`, `commands/configure.md`, `README.md`
- [x] Keep relay implementation code inside `relay/`
- [x] Do not add a `shared/` folder initially; only add one later if relay and plugin end up needing real shared code
- [x] Initialize Bun/TypeScript project files for the relay and channel server
- [x] Add runtime dependencies: `hono` and `@modelcontextprotocol/sdk`
- [x] Add `.env.example` files for relay config and local channel config
- [x] Add basic logging and error handling conventions

## Phase 1 — Relay Server Skeleton

- [x] Create the Bun + Hono relay entrypoint
- [x] Add `GET /health`
- [x] Add configuration loading for `PORT`, `DATABASE_PATH`, `SESSION_SECRET`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET`
- [x] Open the SQLite database with `bun:sqlite`
- [x] Create the initial schema for `users` and `client_tokens`
- [x] Add startup checks for missing env vars and missing database path
- [x] Mount the SQLite file at a stable persistent path such as `/data/github-ci.sqlite`

## Phase 2 — Authentication and Onboarding UI

- [x] Implement `GET /auth/github/start`
- [x] Implement `GET /auth/github/callback`
- [x] Create signed session-cookie handling for the relay web UI
- [x] Create or update the local user record from the GitHub OAuth identity
- [x] Generate a per-user webhook secret at onboarding
- [x] Generate an initial client token at onboarding and store only its hash
- [x] Implement `GET /me`
- [ ] Build the minimal setup page that shows `webhookUrl`, `webhookSecret`, and `clientToken`
- [x] Implement `POST /me/rotate-client-token`
- [x] Implement `POST /me/rotate-webhook-secret`

## Phase 3 — Webhook Ingestion and Filtering

- [x] Implement `POST /webhook/:userId`
- [x] Verify `X-Hub-Signature-256` against the stored webhook secret
- [x] Read `X-GitHub-Delivery` and reject duplicate deliveries inside the chosen TTL window
- [x] Parse and validate GitHub webhook JSON safely
- [x] Filter to `check_run` events with `action === "completed"`
- [x] Filter to failure conclusions included in V1 scope
- [x] Wrap outbound events in the relay envelope with `deliveryId`, `event`, and `payload`
- [x] Return `200 OK` quickly enough to stay inside GitHub's delivery window
- [x] Add request logging for accepted, rejected, duplicate, and ignored events

## Phase 4 — WebSocket Fan-out

- [x] Implement `GET /connect` WebSocket upgrade handling
- [x] Authenticate the client token from the `Authorization: Bearer` header
- [x] Track connected sockets by `userId`
- [x] Track the authenticated token hash alongside each connected socket
- [x] Broadcast accepted webhook envelopes to all sockets for the matching user
- [x] Remove sockets cleanly on disconnect and failed writes
- [x] Force-disconnect live sockets authenticated with a revoked token during token rotation
- [ ] Add ping/pong or equivalent keepalive behavior if needed by the hosting environment

## Phase 5 — Channel Server Core

- [x] Read `GITHUB_CI_CLIENT_TOKEN` from `~/.claude/channels/github-ci/.env`
- [x] Use the plugin's built-in production relay URL by default
- [x] Support `GITHUB_CI_RELAY_URL` as an override for development or self-hosting
- [x] Start the MCP server before beginning relay connection attempts
- [x] Connect to the relay with `Authorization: Bearer <token>`
- [x] Implement reconnect with exponential backoff and jitter
- [x] Parse relay envelopes and extract `deliveryId` plus GitHub payload
- [x] Defensively re-check the `check_run` event type, action, and conclusion on the client side

## Phase 6 — Git Matching Logic

- [x] Resolve the local repository identity and normalize it to `owner/repo`
- [x] Read the local `HEAD` commit with `git rev-parse HEAD`
- [ ] Optionally read the local branch name with `git branch --show-current` for context and logging
- [x] Extract `repository.full_name`, `check_run.head_sha`, `check_run.name`, `check_run.html_url`, and branch context from the webhook payload
- [x] Match notifications on repository plus `HEAD` commit SHA
- [x] Treat branch as context only, not as the authoritative match key
- [x] Drop non-matching events silently
- [x] Emit `notifications/claude/channel` with concise content and structured `meta`

## Phase 7 — Plugin Packaging and Local UX

- [x] Finalize `.claude-plugin/plugin.json`
- [x] Finalize `.mcp.json`
- [x] Implement `/github-ci:configure <clientToken>`
- [x] Write the client token to `~/.claude/channels/github-ci/.env`
- [ ] Ensure the saved local config is written with restrictive file permissions
- [x] Write the plugin README with install, configure, and run instructions
- [x] Document the optional relay URL override for development and self-hosting

## Phase 8 — Railway Deployment

- [ ] Create the Railway service for the relay
- [ ] Attach a persistent volume to the Railway service
- [ ] Set `DATABASE_PATH` to the SQLite file on the mounted volume
- [ ] Configure the required environment variables in Railway
- [ ] Expose the relay over HTTPS/WSS
- [ ] Verify that `GET /health` works through the deployed URL
- [ ] Verify that a redeploy preserves the SQLite database on the attached volume
- [ ] Verify that channel clients reconnect after a relay restart or redeploy

## Phase 9 — Testing

- [ ] Add unit tests for webhook HMAC validation
- [ ] Add unit tests for client-token authentication
- [ ] Add unit tests for delivery dedupe behavior
- [ ] Add unit tests for token rotation evicting live sockets
- [ ] Add unit tests for repo normalization
- [ ] Add unit tests for repo + commit matching
- [ ] Add integration tests for relay webhook intake to WebSocket delivery
- [ ] Add integration tests for the local channel server receiving and filtering events
- [ ] Run an end-to-end manual test with a real GitHub repository and a deliberately failing check run

## Phase 10 — Release Readiness

- [ ] Confirm the onboarding flow works from a clean machine
- [ ] Confirm GitHub webhook setup instructions are accurate
- [ ] Confirm failures only notify the matching repo + commit session
- [ ] Confirm duplicate webhook deliveries do not generate duplicate notifications
- [ ] Confirm token rotation immediately evicts old live sessions
- [ ] Confirm restart and redeploy behavior matches the deployment assumptions
- [ ] Review security notes around secret storage, TLS, and prompt-injection handling
- [ ] Decide whether any V1 items should move to the post-launch backlog before release

## Post-Launch Backlog

- [ ] Consider moving from SQLite to Postgres if multi-instance relay deployment becomes necessary
- [ ] Consider adding durable dedupe storage if replay protection needs to survive restarts
- [ ] Consider adding `workflow_run` support
- [ ] Consider adding per-repo filtering controls
- [ ] Consider adding richer PR-aware context in notifications
