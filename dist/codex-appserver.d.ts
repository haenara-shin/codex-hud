import type { RateLimits } from "./types.js";
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
/** Extract + write the rate-limit snapshot from app-server stdout. Used by the
 *  detached refresh child (via the `refresh-ratelimits` CLI command). */
export declare function writeRateLimitCacheFrom(stdout: string): boolean;
/** Run the app-server rate-limit RPC (used by the detached refresh child,
 *  where ~1s is fine). The app-server stays alive until its stdin closes, so
 *  we must keep stdin OPEN until the id:2 reply arrives, then kill it —
 *  closing stdin up front makes it exit before answering. Returns stdout/null. */
export declare function fetchRateLimitStdout(): Promise<string | null>;
/**
 * Newest app-server rate-limit snapshot from cache (fast, sync). If the cache
 * is stale/missing, fire a detached background refresh so the NEXT render is
 * current. Returns null if nothing usable is cached yet.
 */
export declare function readAppServerTelemetry(): AppServerTelemetry | null;
