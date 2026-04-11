import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type {
  DateRange,
  ParsedSession,
  TokenUsage,
  RateLimits,
  AggregatedUsage,
  SessionMeta,
} from "./types.js";

function getSessionsDir(): string {
  return join(homedir(), ".codex", "sessions");
}

function getDateDirs(range: DateRange): string[] {
  const now = new Date();
  const dirs: string[] = [];

  let daysBack: number;
  switch (range) {
    case "today":
      daysBack = 0;
      break;
    case "week":
      daysBack = 6;
      break;
    case "month":
      daysBack = 29;
      break;
  }

  for (let i = 0; i <= daysBack; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear().toString();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dirs.push(join(getSessionsDir(), yyyy, mm, dd));
  }

  return dirs;
}

export function findSessionLogs(range: DateRange): string[] {
  const dirs = getDateDirs(range);
  const files: string[] = [];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry.endsWith(".jsonl")) {
          files.push(join(dir, entry));
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }

  return files;
}

export function parseSessionLog(filePath: string): ParsedSession {
  const dateMatch = filePath.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  const date = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
    : "unknown";

  let meta: SessionMeta | null = null;
  let lastUsage: TokenUsage | null = null;
  let lastRateLimits: RateLimits | null = null;
  let modelContextWindow: number | null = null;

  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        if (entry.type === "session_meta" && entry.payload) {
          meta = entry.payload as SessionMeta;
        }

        if (
          entry.type === "event_msg" &&
          entry.payload?.type === "token_count"
        ) {
          if (entry.payload.info?.total_token_usage) {
            lastUsage = entry.payload.info.total_token_usage as TokenUsage;
            if (entry.payload.info.model_context_window) {
              modelContextWindow = entry.payload.info.model_context_window as number;
            }
          }
          if (entry.payload.rate_limits) {
            lastRateLimits = entry.payload.rate_limits as RateLimits;
          }
        }
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // skip unreadable files
  }

  return {
    meta,
    totalUsage: lastUsage,
    rateLimits: lastRateLimits,
    modelContextWindow,
    date,
    filePath,
  };
}

function emptyUsage(): TokenUsage {
  return {
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 0,
  };
}

export function aggregateLocalUsage(range: DateRange): AggregatedUsage {
  const files = findSessionLogs(range).sort();
  const sessions: ParsedSession[] = [];
  const totals = emptyUsage();
  let latestRateLimits: RateLimits | null = null;

  for (const file of files) {
    const session = parseSessionLog(file);
    sessions.push(session);

    if (session.totalUsage) {
      totals.input_tokens += session.totalUsage.input_tokens;
      totals.cached_input_tokens += session.totalUsage.cached_input_tokens;
      totals.output_tokens += session.totalUsage.output_tokens;
      totals.reasoning_output_tokens +=
        session.totalUsage.reasoning_output_tokens;
      totals.total_tokens += session.totalUsage.total_tokens;
    }

    // Files are sorted by path (includes timestamp), so the last
    // non-null rateLimits we see is from the most recent session.
    if (session.rateLimits) {
      latestRateLimits = session.rateLimits;
    }
  }

  return {
    sessions,
    totals,
    latestRateLimits,
    sessionCount: sessions.filter((s) => s.totalUsage !== null).length,
  };
}
