# CLAUDE.md

## Project overview

GitHub CI Channel for Claude Code — a channel plugin that pushes GitHub Actions CI failures into running Claude Code sessions. Two components: a deployed relay server (Bun + Hono + SQLite on Railway) and a local channel plugin (MCP server).

## Repo structure

- `relay/` — Deployed relay server. Entrypoint: `relay/src/server.ts`
- `plugin/` — Claude Code channel plugin. Entrypoint: `plugin/server.ts`
- `docs/` — Spec and implementation plan
- `.claude-plugin/marketplace.json` — Makes this repo a Claude Code plugin marketplace

## Key docs

- `docs/github-ci-channel-spec.md` — Full technical spec
- `docs/github-ci-channel-plan.md` — Implementation checklist (Phases 0-10)
- [Claude Code channels docs](https://code.claude.com/docs/en/channels)
- [Claude Code channels reference (building channels)](https://code.claude.com/docs/en/channels-reference)
- [Claude Code plugins docs](https://code.claude.com/docs/en/plugins)
- [Claude Code plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)

## Development commands

```bash
# Relay
cd relay && bun run dev          # Start relay locally (needs .env)
cd relay && bun test             # Run relay tests (unit + integration)

# Plugin
cd plugin && bun test            # Run plugin tests

# Typecheck
cd relay && npx tsc --noEmit --skipLibCheck
cd plugin && npx tsc --noEmit --skipLibCheck
```

## Deploying the relay to Railway

**Important**: `railway up` uploads local files and ignores `source.rootDirectory`. You must use `--path-as-root` to deploy from a subdirectory:

```bash
railway up --service relay --ci --path-as-root relay/
```

Without `--path-as-root`, Railway sees the repo root and Railpack fails to detect the app. The relay uses a Dockerfile at `relay/Dockerfile`.

The Railway project is linked in the repo root (`.railway/` config). Run commands from the repo root, not from `relay/`.

## Railway environment

- **Project**: github-ci-relay
- **Service**: relay
- **Domain**: `relay-production-5d82.up.railway.app`
- **Volume**: mounted at `/data` for SQLite persistence
- **Env vars**: `PORT`, `DATABASE_PATH`, `SESSION_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `PUBLIC_URL`

## Architecture decisions

- **Repo-only matching**: The channel server matches on repository only (not commit SHA). Claude receives rich context (local HEAD, local branch, failing SHA, `same_commit` flag) and decides relevance. This avoids silently dropping notifications when the developer has continued working past the failing commit.

- **No `--cwd` in .mcp.json**: The plugin's `.mcp.json` uses `${CLAUDE_PLUGIN_ROOT}/server.ts` as an absolute path instead of `--cwd`. This is critical — `--cwd` would change the working directory to the plugin root, breaking git commands that need to run in the user's project directory.

- **Channels flag syntax**: The correct CLI syntax for development channels is:
  ```
  claude --dangerously-load-development-channels plugin:github-ci@github-ci-channel
  ```
  NOT `--dangerously-load-development-channels --channels ...` (these are not two separate flags).

- **Webhook log is in-memory**: The recent deliveries shown on `/me` are stored in a per-user ring buffer (max 20 entries) and reset on relay restart. This is intentional — no need to persist diagnostic logs.

## Git workflow

Always commit and push from the repo root (`/Users/mobenz/Programming/claude-code-github-ci-channel`), not from subdirectories. Git commands like `git add relay/src/...` fail if the working directory is inside `relay/` due to path resolution.
