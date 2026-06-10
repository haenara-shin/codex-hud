#!/bin/bash
NODE="$(command -v node)"
if [ -z "$NODE" ]; then
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node "$HOME"/.nvm/versions/node/*/bin/node; do
    if [ -x "$candidate" ]; then
      NODE="$candidate"
      break
    fi
  done
fi
if [ -z "$NODE" ]; then
  echo '{"label":"codex-hud: node not found"}'
  exit 0
fi
SCRIPT_REAL="$(readlink -f "$0" 2>/dev/null || perl -MCwd -e 'print Cwd::realpath($ARGV[0])' "$0")"
CODEX_HUD_DIR="$(cd "$(dirname "$SCRIPT_REAL")/.." && pwd)"
exec "$NODE" "$CODEX_HUD_DIR/dist/index.js" label
