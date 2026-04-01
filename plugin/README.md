# GitHub CI Channel for Claude Code

Pushes GitHub Actions CI failures into running Claude Code sessions, scoped to the session's current repository and git commit.

## Prerequisites

- [Claude Code](https://claude.ai/claude-code) v2.1.80 or later, authenticated with claude.ai
- [Bun](https://bun.sh) installed (`bun --version` to check)

## Setup

### 1. Get your credentials

Visit the relay server and sign in with GitHub:

**https://relay-production-5d82.up.railway.app/auth/github/start**

You'll get three credentials:
- **Webhook URL** — goes in your GitHub repo webhook settings
- **Webhook Secret** — goes in your GitHub repo webhook settings
- **Client Token** — goes in Claude Code

### 2. Add the GitHub webhook

In your GitHub repo: **Settings > Webhooks > Add webhook**

- **Payload URL**: your Webhook URL from the setup page
- **Content type**: `application/json`
- **Secret**: your Webhook Secret from the setup page
- **Events**: select "Let me select individual events" and check **"Check runs"**

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

> **Note**: Channels are in research preview. Third-party channel plugins require `--dangerously-load-development-channels` until they're added to an approved allowlist.

## How it works

When a GitHub Actions check run fails on your repo, the channel sends a notification to your Claude Code session with full context (branch, commit, check name, run URL, and your local HEAD). Claude decides if the failure is relevant to current work. Sessions on other repos are unaffected.

The system has two parts:
- **Relay server** (deployed) — receives GitHub webhooks and broadcasts them over WebSocket to connected clients
- **Channel server** (local, this plugin) — connects to the relay, matches events against your local repo, and emits rich notifications into your session

## Development

To use a custom relay URL (for self-hosting or development):

```
# Add to ~/.claude/channels/github-ci/.env
GITHUB_CI_RELAY_URL=wss://your-relay.example.com/connect
```
