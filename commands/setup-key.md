---
description: Configure or update the OpenAI Admin API key (enables /codex-hud:costs-*)
allowed-tools: Bash(node:*), Bash(pbpaste:*), Bash(wl-paste:*), Bash(xclip:*), AskUserQuestion
---

# Configure OpenAI Admin API Key

This command is only needed for dollar-cost tracking via `/codex-hud:costs-today/week/month`. Rate limits, token usage, and the statusline work without it.

First, check the current state:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" setup --json
```

If `"status": "connected"`, tell the user the key is already configured and working. Offer to replace it (optional).

If `"status": "no_key"` or the user wants to replace the key:

**IMPORTANT — never ask the user to paste the key into the chat.** Anything typed into the conversation is stored in session transcripts. Use the clipboard instead.

Tell the user:

1. Open https://platform.openai.com/settings/organization/admin-keys
2. Create or copy an Admin key (starts with `sk-admin-...`) — leave it in the clipboard

Then ask via `AskUserQuestion`:

- header: "Admin Key"
- question: "Is the Admin API key copied to your clipboard? (It will be read directly from the clipboard — never typed into the chat.)"
- multiSelect: false
- options:
  - "Key is in my clipboard" — proceed
  - "Cancel" — abort without changes

If the user confirms, read the key from the clipboard and pipe it via stdin (macOS; on Linux substitute `wl-paste` or `xclip -selection clipboard -o`):

```bash
pbpaste | node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" setup --key-stdin --json
```

On success (`"status": "saved"`), tell the user it was saved and verified, and suggest clearing the clipboard:

```bash
printf '' | pbcopy
```

On failure, show the error and suggest they re-copy the key from the URL above and try again.
