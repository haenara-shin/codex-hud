import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getCacheDir } from "./config.js";
import type { RateLimits } from "./types.js";

// Codex CLI 0.142+ no longer writes rate limits to disk at all (neither rollout
// JSONL nor logs_2.sqlite). The live quota is only available by asking the
// app-server over JSON-RPC: `account/rateLimits/read`. That call costs ~1s
// (spawn + handshake), which is too slow for the statusline hot path — so we
// cache it and refresh in a detached background process (stale-while-revalidate).

export interface AppServerTelemetry {
  rateLimits: RateLimits;
  /** Configured model from ~/.codex/config.toml (the app-server RPC doesn't
   *  return the model, and 0.142 logs nothing on disk). */
  model: string | null;
  /** Reasoning effort from ~/.codex/config.toml, e.g. "xhigh". */
  effort: string | null;
  /** Epoch ms the snapshot was fetched. */
  timestampMs: number;
}

const CACHE_TTL_MS = 5 * 60_000;
// If the cache is older than this, don't even use it — Codex is probably idle.
const CACHE_MAX_AGE_MS = 24 * 60 * 60_000;

function cachePath(): string {
  return join(getCacheDir(), "ratelimit_cache.json");
}

function readConfigToml(): string {
  try {
    const p = join(homedir(), ".codex", "config.toml");
    return existsSync(p) ? readFileSync(p, "utf-8") : "";
  } catch {
    return "";
  }
}

function configEffort(toml = readConfigToml()): string | null {
  const m = /^\s*model_reasoning_effort\s*=\s*"?([A-Za-z]+)"?/m.exec(toml);
  return m ? m[1] : null;
}

function configModel(toml = readConfigToml()): string | null {
  const m = /^\s*model\s*=\s*"([^"]+)"/m.exec(toml);
  return m ? m[1] : null;
}

// ── Map the 0.142 camelCase JSON-RPC shape to codex-hud's RateLimits ──

interface RawWindow {
  usedPercent?: number;
  windowDurationMins?: number;
  resetsAt?: number;
}

function mapWindow(w: RawWindow | null | undefined) {
  if (!w || typeof w.usedPercent !== "number") return null;
  return {
    used_percent: w.usedPercent,
    window_minutes:
      typeof w.windowDurationMins === "number" ? w.windowDurationMins : null,
    resets_at: typeof w.resetsAt === "number" ? w.resetsAt : null,
  };
}

interface RawRateLimits {
  limitId?: string;
  limitName?: string | null;
  primary?: RawWindow;
  secondary?: RawWindow;
  credits?: unknown;
  planType?: string;
  rateLimitReachedType?: string | null;
}

function mapRateLimits(rl: RawRateLimits | undefined): RateLimits | null {
  if (!rl) return null;
  const primary = mapWindow(rl.primary);
  const secondary = mapWindow(rl.secondary);
  if (!primary && !secondary && !rl.rateLimitReachedType) return null;
  return {
    limit_id: typeof rl.limitId === "string" ? rl.limitId : "codex",
    limit_name: rl.limitName ?? null,
    primary,
    secondary,
    credits: rl.credits ?? null,
    plan_type: typeof rl.planType === "string" ? rl.planType : null,
    rate_limit_reached_type: rl.rateLimitReachedType ?? null,
  };
}

// ── Cache I/O ──

interface CacheFile {
  rateLimits: RateLimits;
  model: string | null;
  effort: string | null;
  fetchedAt: number;
}

function readCache(): AppServerTelemetry | null {
  try {
    const raw = readFileSync(cachePath(), "utf-8");
    const c = JSON.parse(raw) as CacheFile;
    if (!c.rateLimits || typeof c.fetchedAt !== "number") return null;
    if (Date.now() - c.fetchedAt > CACHE_MAX_AGE_MS) return null;
    return {
      rateLimits: c.rateLimits,
      model: c.model ?? null,
      effort: c.effort ?? null,
      timestampMs: c.fetchedAt,
    };
  } catch {
    return null;
  }
}

function cacheIsFresh(): boolean {
  try {
    return Date.now() - statSync(cachePath()).mtimeMs < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

// ── Parse a JSON-RPC `account/rateLimits/read` response into a cache write ──

/** Extract + write the rate-limit snapshot from app-server stdout. Used by the
 *  detached refresh child (via the `refresh-ratelimits` CLI command). */
export function writeRateLimitCacheFrom(stdout: string): boolean {
  for (const line of stdout.split("\n")) {
    if (!line.includes('"id":2')) continue;
    try {
      const msg = JSON.parse(line);
      const rl = mapRateLimits(msg?.result?.rateLimits);
      if (!rl) continue;
      const toml = readConfigToml();
      const payload: CacheFile = {
        rateLimits: rl,
        model: configModel(toml),
        effort: configEffort(toml),
        fetchedAt: Date.now(),
      };
      const p = cachePath();
      const tmp = `${p}.tmp.${process.pid}`;
      writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n", { mode: 0o600 });
      renameSync(tmp, p);
      return true;
    } catch {
      // try next line
    }
  }
  return false;
}

function findCodexBin(): string | null {
  // PATH first (covers most setups), then common install locations — the
  // statusline runs outside a login shell so PATH can be minimal.
  const candidates = [
    "codex",
    join(homedir(), ".local", "bin", "codex"),
    "/opt/homebrew/bin/codex",
    "/usr/local/bin/codex",
  ];
  for (const c of candidates) {
    try {
      const r = spawnSync(c, ["--version"], { timeout: 4000, stdio: "ignore" });
      if (r.status === 0) return c;
    } catch {
      // next
    }
  }
  return null;
}

/** Run the app-server rate-limit RPC (used by the detached refresh child,
 *  where ~1s is fine). The app-server stays alive until its stdin closes, so
 *  we must keep stdin OPEN until the id:2 reply arrives, then kill it —
 *  closing stdin up front makes it exit before answering. Returns stdout/null. */
export function fetchRateLimitStdout(): Promise<string | null> {
  const bin = findCodexBin();
  if (!bin) return Promise.resolve(null);
  const requests =
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"codex-hud","version":"0.10.0","title":"codex-hud"}}}\n' +
    '{"jsonrpc":"2.0","method":"initialized","params":{}}\n' +
    '{"jsonrpc":"2.0","id":2,"method":"account/rateLimits/read","params":{}}\n';
  return new Promise((resolve) => {
    let done = false;
    const finish = (val: string | null) => {
      if (done) return;
      done = true;
      try {
        child.kill();
      } catch {
        // already gone
      }
      clearTimeout(timer);
      resolve(val);
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(bin, ["app-server"], { stdio: ["pipe", "pipe", "ignore"] });
    } catch {
      return resolve(null);
    }

    const timer = setTimeout(() => finish(buf || null), 12_000);
    let buf = "";
    child.stdout?.on("data", (d) => {
      buf += d.toString();
      if (buf.includes('"id":2')) finish(buf);
    });
    child.on("error", () => finish(null));
    try {
      child.stdin?.write(requests);
    } catch {
      finish(null);
    }
  });
}

// ── Public: read cache (sync, fast) + kick a detached refresh if stale ──

let triggered = false;

function triggerBackgroundRefresh(): void {
  if (triggered) return;
  triggered = true;
  try {
    // fileURLToPath (not URL.pathname) so a path with spaces/non-ASCII isn't
    // left percent-encoded — that would make the child fail to find index.js.
    const self = fileURLToPath(import.meta.url);
    const entry = join(self, "..", "index.js");
    const child = spawn(process.execPath, [entry, "refresh-ratelimits"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch {
    // best-effort
  }
}

let memo: { value: AppServerTelemetry | null } | null = null;

/**
 * Newest app-server rate-limit snapshot from cache (fast, sync). If the cache
 * is stale/missing, fire a detached background refresh so the NEXT render is
 * current. Returns null if nothing usable is cached yet.
 */
export function readAppServerTelemetry(): AppServerTelemetry | null {
  if (memo) return memo.value;
  const cached = readCache();
  if (!cached || !cacheIsFresh()) {
    triggerBackgroundRefresh();
  }
  memo = { value: cached };
  return cached;
}
