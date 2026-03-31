---
name: configure
description: Configure the GitHub CI channel with your client token
arguments:
  - name: clientToken
    description: Your client token from the relay server setup page
    required: true
---

Save the provided client token for the GitHub CI channel.

1. Create the directory `~/.claude/channels/github-ci/` if it doesn't exist
2. Write the token to `~/.claude/channels/github-ci/.env` as `GITHUB_CI_CLIENT_TOKEN=<clientToken>`
3. Set file permissions to 600 on the `.env` file
4. Confirm the token was saved successfully
