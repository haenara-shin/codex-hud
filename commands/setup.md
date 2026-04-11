---
description: Configure OpenAI Admin API key for Codex usage tracking
allowed-tools: Bash(node:*), AskUserQuestion, Read
---

# Setup Codex HUD

First, check the current configuration status:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" setup --json
```

Based on the result:

## If `status` is `"connected"`
Tell the user their Admin API key is already configured and working. Show the last 24h cost if available.

## If `status` is `"no_key"`
Ask the user for their OpenAI Admin API key:

> You need an **OpenAI Admin API key** (starts with `sk-admin-...`) to track Codex usage costs.
>
> Get one at: https://platform.openai.com/settings/organization/admin-keys
>
> Please enter your Admin API key:

Use `AskUserQuestion` to get the key from the user.

Then save and verify the key:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" setup --key "USER_PROVIDED_KEY" --json
```

If the connection succeeds, tell the user it's configured. If it fails, show the error and ask them to check the key.

## If `status` is `"error"`
Show the error message and suggest the user check their key or run setup again.
