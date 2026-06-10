---
description: Remove the codex-hud statusline integration (restores your previous statusline)
allowed-tools: Bash(node:*)
---

# Uninstall Codex HUD statusline

Remove the statusline integration. If a previous statusline was saved during setup, it is restored automatically.

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" uninstall-statusline
```

Report the output to the user. Then remind them:

- Restart Claude Code or run `/reload-plugins` for the change to take effect.
- This only removes the statusline integration. To remove the plugin entirely afterwards, run `/plugin uninstall codex-hud`.
- The stored configuration (including any saved Admin API key) lives at `~/.claude/plugins/codex-hud/config.json` — delete that file too if they want a clean slate.
