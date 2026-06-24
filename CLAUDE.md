# codex-hud

Claude Code plugin that displays OpenAI Codex API usage and costs.

## Build

```bash
npm install
npm run build
```

## Test locally

```bash
node dist/index.js                    # Help
node dist/index.js setup --json       # Check API key status
node dist/index.js usage week         # Token usage (local + API)
node dist/index.js usage today --local-only  # Local logs only
node dist/index.js costs today        # Cost breakdown (API only)
node dist/index.js costs week --daily # Daily cost breakdown
node dist/index.js summary            # One-line summary
```

## Install in Claude Code

```
/plugin install local "/Users/Haenara.SHIN/Documents/2_Study (Python, Math)/personal/3_codex_hud_in_cc"
```

## Data Sources

- **Local rollout logs**: `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (no API key needed) — usage + rate limits from the interactive Codex TUI.
- **Local app-server DB**: `~/.codex/logs_2.sqlite` (`codex.rate_limits` events) — rate limits + model for Codex **0.140–0.141** run via the app-server / Claude Code codex plugin. Read via node:sqlite (Node 22.5+) or the sqlite3 CLI.
- **Codex app-server RPC**: Codex **0.142+** writes rate limits NOWHERE on disk — they're only available by asking `codex app-server` over JSON-RPC (`account/rateLimits/read`, camelCase fields). ~1s/call, so codex-hud caches it (`~/.claude/plugins/codex-hud/ratelimit_cache.json`, 5-min TTL) and refreshes in a detached background process. Model + effort come from `~/.codex/config.toml` (the RPC doesn't return them).
- **OpenAI API**: `/v1/organization/costs` and `/v1/organization/usage/completions` (needs Admin API key)

## API Key

Set `OPENAI_ADMIN_KEY` env var or run `/codex-hud:setup` to store in config.
