import { readdirSync, readFileSync, existsSync, openSync, readSync, closeSync, statSync, } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
// Files at or below this size are read whole; larger ones are tail-read.
// total_token_usage is cumulative, so only the LAST token_count per file
// matters — full-parsing a multi-MB active session on every statusline
// render (60s timer + every assistant message) is wasted work.
const FULL_READ_LIMIT = 256 * 1024;
// Tail windows widened in order until a token_count with usage is found.
const TAIL_WINDOWS = [64 * 1024, 1024 * 1024, 8 * 1024 * 1024];
function getSessionsDir() {
    return join(homedir(), ".codex", "sessions");
}
function dayDir(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const yyyy = d.getFullYear().toString();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return join(getSessionsDir(), yyyy, mm, dd);
}
function listLogs(dir) {
    if (!existsSync(dir))
        return [];
    try {
        return readdirSync(dir)
            .filter((entry) => entry.endsWith(".jsonl"))
            .map((entry) => join(dir, entry));
    }
    catch {
        return []; // skip unreadable dirs
    }
}
export function findSessionLogs(range) {
    let daysBack;
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
    const files = [];
    for (let i = 0; i <= daysBack; i++) {
        files.push(...listLogs(dayDir(i)));
    }
    return files;
}
function scanLines(content) {
    let lastUsage = null;
    let lastRateLimits = null;
    let rlTimestamp = null;
    for (const line of content.split("\n")) {
        if (!line.trim())
            continue;
        try {
            const entry = JSON.parse(line);
            if (entry.type === "event_msg" && entry.payload?.type === "token_count") {
                if (entry.payload.info?.total_token_usage) {
                    lastUsage = entry.payload.info.total_token_usage;
                }
                if (entry.payload.rate_limits) {
                    lastRateLimits = entry.payload.rate_limits;
                    const ts = typeof entry.timestamp === "string"
                        ? Date.parse(entry.timestamp)
                        : NaN;
                    rlTimestamp = Number.isNaN(ts) ? null : ts;
                }
            }
        }
        catch {
            // skip malformed lines (including a truncated line at a tail boundary
            // or the in-progress last line of an actively written file)
        }
    }
    return { lastUsage, lastRateLimits, rlTimestamp };
}
function readTailContent(filePath, size, bytes) {
    const fd = openSync(filePath, "r");
    try {
        const start = size - bytes; // caller guarantees bytes < size
        const buf = Buffer.alloc(bytes);
        const read = readSync(fd, buf, 0, bytes, start);
        const text = buf.toString("utf-8", 0, read);
        // Drop the (likely partial) first line; this also neutralizes a
        // multi-byte UTF-8 sequence split at the window boundary.
        const nl = text.indexOf("\n");
        return nl >= 0 ? text.slice(nl + 1) : "";
    }
    finally {
        closeSync(fd);
    }
}
function scanFile(filePath, size) {
    if (size <= FULL_READ_LIMIT) {
        return scanLines(readFileSync(filePath, "utf-8"));
    }
    for (const window of TAIL_WINDOWS) {
        if (window >= size)
            break; // window covers the whole file: full-read below
        const result = scanLines(readTailContent(filePath, size, window));
        if (result.lastUsage)
            return result;
    }
    // No token_count found in any tail window — degrade to the full read.
    return scanLines(readFileSync(filePath, "utf-8"));
}
export function parseSessionLog(filePath) {
    const dateMatch = filePath.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    const date = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
        : "unknown";
    let totalUsage = null;
    let rateLimits = null;
    let rlTimestamp = null;
    try {
        const { size, mtimeMs } = statSync(filePath);
        const scan = scanFile(filePath, size);
        totalUsage = scan.lastUsage;
        rateLimits = scan.lastRateLimits;
        rlTimestamp = scan.rlTimestamp ?? (rateLimits ? mtimeMs : null);
    }
    catch {
        // skip unreadable files
    }
    return { totalUsage, rateLimits, rlTimestamp, date, filePath };
}
function emptyUsage() {
    return {
        input_tokens: 0,
        cached_input_tokens: 0,
        output_tokens: 0,
        reasoning_output_tokens: 0,
        total_tokens: 0,
    };
}
export function aggregateLocalUsage(range) {
    const files = findSessionLogs(range).sort();
    const sessions = [];
    const totals = emptyUsage();
    let latestRateLimits = null;
    let latestRlTimestamp = -Infinity;
    // Rate limits are a point-in-time snapshot, so pick the one whose EVENT
    // timestamp is newest. File-path order is wrong here: paths sort by
    // session START time, so a long-running session's fresh snapshot would
    // lose to a stale one from a later-started session.
    const considerRateLimits = (session) => {
        if (session.rateLimits &&
            (session.rlTimestamp ?? 0) > latestRlTimestamp) {
            latestRateLimits = session.rateLimits;
            latestRlTimestamp = session.rlTimestamp ?? 0;
        }
    };
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
        considerRateLimits(session);
    }
    // A session that spans midnight keeps writing into yesterday's file, so
    // for the "today" range also scan the previous day — rate limits only;
    // usage totals still attribute to the session's start date.
    if (range === "today") {
        for (const file of listLogs(dayDir(1))) {
            considerRateLimits(parseSessionLog(file));
        }
    }
    return {
        sessions,
        totals,
        latestRateLimits,
        sessionCount: sessions.filter((s) => s.totalUsage !== null).length,
    };
}
