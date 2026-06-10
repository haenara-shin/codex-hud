#!/bin/bash
# Wrapper: runs claude-hud (which reads Claude Code's statusline JSON from
# stdin), then appends codex-hud status lines (which read only Codex logs —
# no stdin needed). Invoked by the launcher at ~/.claude/codex-hud-statusline.sh.

NODE="$(command -v node)"
# The statusline runs outside a login shell, so PATH may miss nvm/Homebrew.
if [ -z "$NODE" ]; then
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node "$HOME"/.nvm/versions/node/*/bin/node; do
    if [ -x "$candidate" ]; then
      NODE="$candidate"
      break
    fi
  done
fi
if [ -z "$NODE" ]; then
  # Print to stdout so the message shows up in the statusline itself.
  echo "codex-hud: node not found in PATH"
  exit 0
fi

# Resolve real path even through symlinks
SCRIPT_REAL="$(readlink -f "$0" 2>/dev/null || perl -MCwd -e 'print Cwd::realpath($ARGV[0])' "$0")"
CODEX_HUD_DIR="$(cd "$(dirname "$SCRIPT_REAL")/.." && pwd)"

CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

# Find claude-hud. Prefer Claude Code's plugin metadata (works for any
# marketplace alias); fall back to the newest cache dir of any alias.
CLAUDE_HUD_DIR=""
META="$CLAUDE_CONFIG_DIR/plugins/installed_plugins.json"
if [ -f "$META" ]; then
  CLAUDE_HUD_DIR="$("$NODE" -e '
    try {
      const data = JSON.parse(require("fs").readFileSync(process.argv[1], "utf-8"));
      for (const [key, entries] of Object.entries(data.plugins || {})) {
        if (!key.startsWith("claude-hud@")) continue;
        for (const e of entries || []) {
          if (e && e.installPath) { console.log(e.installPath + "/"); process.exit(0); }
        }
      }
    } catch {}
  ' "$META" 2>/dev/null)"
fi
if [ -z "$CLAUDE_HUD_DIR" ] || [ ! -f "${CLAUDE_HUD_DIR}dist/index.js" ]; then
  CLAUDE_HUD_DIR="$(ls -td "$CLAUDE_CONFIG_DIR"/plugins/cache/*/claude-hud/*/ 2>/dev/null | head -1)"
fi

if [ -n "$CLAUDE_HUD_DIR" ] && [ -f "${CLAUDE_HUD_DIR}dist/index.js" ]; then
  # claude-hud inherits our stdin directly; codex-hud doesn't read stdin.
  "$NODE" "${CLAUDE_HUD_DIR}dist/index.js"
fi

exec "$NODE" "$CODEX_HUD_DIR/dist/index.js" statusline
