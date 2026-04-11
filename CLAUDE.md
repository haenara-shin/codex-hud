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

- **Local logs**: `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (no API key needed)
- **OpenAI API**: `/v1/organization/costs` and `/v1/organization/usage/completions` (needs Admin API key)

## API Key

Set `OPENAI_ADMIN_KEY` env var or run `/codex-hud:setup` to store in config.
