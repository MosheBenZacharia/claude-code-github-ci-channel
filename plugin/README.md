# GitHub CI Channel for Claude Code

Pushes GitHub Actions CI failures into running Claude Code sessions, scoped to the session's current repository and git commit.

## Setup

1. Visit the relay server to sign in with GitHub and get your credentials
2. In your GitHub repo: Settings → Webhooks → Add webhook
   - Payload URL: your `webhookUrl` from the setup page
   - Secret: your `webhookSecret` from the setup page
   - Events: select "Check runs"
3. In Claude Code:
   ```
   /plugin install github-ci
   /reload-plugins
   /github-ci:configure <clientToken>
   ```

## How It Works

When a GitHub Actions check run fails for a commit you're working on, the channel sends a notification to your Claude Code session. Only sessions whose working directory matches the failing repo and HEAD commit receive the notification.

## Development

To use a custom relay URL:

```
# Add to ~/.claude/channels/github-ci/.env
GITHUB_CI_RELAY_URL=wss://your-relay.example.com/connect
```
