import { aggregateLocalUsage } from "./local-logs.js";
import { loadConfig } from "./config.js";
import { formatNumber } from "./format.js";
import { DEFAULT_DISPLAY } from "./types.js";
// ANSI escape codes matching claude-hud's color scheme
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const BRIGHT_BLUE = "\x1b[94m";
const BRIGHT_MAGENTA = "\x1b[95m";
// ── i18n ──
const I18N = {
    en: {
        usage: "Usage",
        weekly: "Weekly",
        context: "Context",
        contextShort: "Ctx",
        sessions: "session",
        sessionsPlural: "sessions",
        sessionsShort: "s",
        noData: "No Codex sessions found",
        resetsIn: "resets in",
        limit: "LIMIT",
    },
    ko: {
        usage: "Usage",
        weekly: "Weekly",
        context: "Context",
        contextShort: "Ctx",
        sessions: "세션",
        sessionsPlural: "세션",
        sessionsShort: " 세션",
        noData: "Codex 세션 없음",
        resetsIn: "리셋까지",
        limit: "한도 초과",
    },
};
// ── Color helpers ──
function getQuotaColor(percent) {
    if (percent >= 90)
        return RED;
    if (percent >= 75)
        return BRIGHT_MAGENTA;
    return BRIGHT_BLUE;
}
function quotaBar(percent, width) {
    const safePercent = Math.min(100, Math.max(0, percent));
    const filled = Math.round((safePercent / 100) * width);
    const empty = width - filled;
    const color = getQuotaColor(safePercent);
    return `${color}${"█".repeat(filled)}${DIM}${"░".repeat(empty)}${RESET}`;
}
function formatResetTime(resetsAt) {
    if (resetsAt == null)
        return "";
    const now = Date.now() / 1000;
    const diffSec = resetsAt - now;
    if (diffSec <= 0)
        return "";
    const diffMins = Math.ceil(diffSec / 60);
    if (diffMins < 60)
        return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        if (remHours > 0)
            return `${days}d ${remHours}h`;
        return `${days}d`;
    }
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
// `── Codex gpt-5.5·medium ⚠ LIMIT ──` — model badge + limit alert.
function headerBadges(data, cfg, t) {
    let badges = "";
    if (cfg.showModel && data.model) {
        const effortPart = data.model.effort ? `·${data.model.effort}` : "";
        badges += ` ${data.model.model}${effortPart}`;
    }
    if (data.rateLimits?.rate_limit_reached_type) {
        badges += ` ${RESET}${RED}⚠ ${t.limit}${RESET}${DIM}`;
    }
    return badges;
}
function contextPercent(context) {
    return Math.min(100, (context.used / context.window) * 100);
}
// ── Expanded layout (multi-line with bars) ──
function renderExpanded(data, cfg) {
    const lines = [];
    const t = I18N[cfg.language];
    const { rateLimits, sessionCount } = data;
    const plan = rateLimits?.plan_type ?? "";
    lines.push(`${DIM}── Codex${headerBadges(data, cfg, t)} ──${RESET}`);
    if (!rateLimits && sessionCount === 0) {
        lines.push(`${DIM}${t.noData}${RESET}`);
        return lines;
    }
    if (rateLimits) {
        if (cfg.showUsage && rateLimits.primary) {
            const p = rateLimits.primary.used_percent;
            const color = getQuotaColor(p);
            const bar = quotaBar(p, cfg.barWidth);
            const reset = formatResetTime(rateLimits.primary.resets_at);
            const resetPart = reset ? ` ${DIM}(${t.resetsIn} ${reset})${RESET}` : "";
            lines.push(`${DIM}${t.usage}${RESET}   ${bar} ${color}${p.toFixed(0)}%${RESET}${resetPart}`);
        }
        if (cfg.showWeekly && rateLimits.secondary) {
            const p = rateLimits.secondary.used_percent;
            const color = getQuotaColor(p);
            const bar = quotaBar(p, cfg.barWidth);
            const reset = formatResetTime(rateLimits.secondary.resets_at);
            const resetPart = reset ? ` ${DIM}(${t.resetsIn} ${reset})${RESET}` : "";
            lines.push(`${DIM}${t.weekly}${RESET}  ${bar} ${color}${p.toFixed(0)}%${RESET}${resetPart}`);
        }
    }
    if (cfg.showContext && data.context) {
        const p = contextPercent(data.context);
        const color = getQuotaColor(p);
        const bar = quotaBar(p, cfg.barWidth);
        const detail = `${DIM}(${formatNumber(data.context.used)}/${formatNumber(data.context.window)})${RESET}`;
        lines.push(`${DIM}${t.context}${RESET} ${bar} ${color}${p.toFixed(0)}%${RESET} ${detail}`);
    }
    if (cfg.showFooter && sessionCount > 0) {
        const label = sessionCount === 1 ? t.sessions : t.sessionsPlural;
        const planPart = cfg.showPlan && plan ? ` | ${plan}` : "";
        lines.push(`${DIM}${sessionCount} ${label}${planPart}${RESET}`);
    }
    return lines;
}
// ── Horizontal layout (ONE line with bars, claude-hud style) ──
function renderHorizontal(data, cfg) {
    const t = I18N[cfg.language];
    const { rateLimits, sessionCount } = data;
    const plan = rateLimits?.plan_type ?? "";
    const parts = [];
    // Prefix carries plan + badges (no separate header/footer lines).
    const planLabel = cfg.showPlan && plan ? ` ${plan}` : "";
    parts.push(`${DIM}Codex${planLabel}${headerBadges(data, cfg, t)}${RESET}`);
    if (!rateLimits && sessionCount === 0) {
        parts.push(`${DIM}${t.noData}${RESET}`);
        return [parts.join(` ${DIM}│${RESET} `)];
    }
    if (rateLimits && cfg.showUsage && rateLimits.primary) {
        const p = rateLimits.primary.used_percent;
        const color = getQuotaColor(p);
        const bar = quotaBar(p, cfg.barWidth);
        const reset = formatResetTime(rateLimits.primary.resets_at);
        const resetPart = reset ? ` ${DIM}(${reset})${RESET}` : "";
        parts.push(`${DIM}${t.usage}${RESET} ${bar} ${color}${p.toFixed(0)}%${RESET}${resetPart}`);
    }
    if (rateLimits && cfg.showWeekly && rateLimits.secondary) {
        const p = rateLimits.secondary.used_percent;
        const color = getQuotaColor(p);
        const bar = quotaBar(p, cfg.barWidth);
        const reset = formatResetTime(rateLimits.secondary.resets_at);
        const resetPart = reset ? ` ${DIM}(${reset})${RESET}` : "";
        parts.push(`${DIM}${t.weekly}${RESET} ${bar} ${color}${p.toFixed(0)}%${RESET}${resetPart}`);
    }
    if (cfg.showContext && data.context) {
        const p = contextPercent(data.context);
        const color = getQuotaColor(p);
        const bar = quotaBar(p, cfg.barWidth);
        parts.push(`${DIM}${t.context}${RESET} ${bar} ${color}${p.toFixed(0)}%${RESET}`);
    }
    if (cfg.showFooter && sessionCount > 0) {
        parts.push(`${DIM}${sessionCount}${t.sessionsShort}${RESET}`);
    }
    return [parts.join(` ${DIM}│${RESET} `)];
}
// ── Compact layout (single line with separators) ──
function renderCompact(data, cfg) {
    const t = I18N[cfg.language];
    const { rateLimits, sessionCount } = data;
    const plan = rateLimits?.plan_type ?? "";
    const parts = [];
    // Prefix keeps the plan (compact has no footer); badges follow.
    const planLabel = cfg.showPlan && plan ? ` ${plan}` : "";
    parts.push(`${DIM}Codex${planLabel}${headerBadges(data, cfg, t)}${RESET}`);
    if (!rateLimits && sessionCount === 0) {
        parts.push(`${DIM}${t.noData}${RESET}`);
        return [parts.join(` ${DIM}│${RESET} `)];
    }
    if (rateLimits) {
        if (cfg.showUsage && rateLimits.primary) {
            const p = rateLimits.primary.used_percent;
            const color = getQuotaColor(p);
            const reset = formatResetTime(rateLimits.primary.resets_at);
            const resetPart = reset ? ` ${DIM}(${reset})${RESET}` : "";
            parts.push(`${DIM}${t.usage}${RESET} ${color}${p.toFixed(0)}%${RESET}${resetPart}`);
        }
        if (cfg.showWeekly && rateLimits.secondary) {
            const p = rateLimits.secondary.used_percent;
            const color = getQuotaColor(p);
            const reset = formatResetTime(rateLimits.secondary.resets_at);
            const resetPart = reset ? ` ${DIM}(${reset})${RESET}` : "";
            parts.push(`${DIM}${t.weekly}${RESET} ${color}${p.toFixed(0)}%${RESET}${resetPart}`);
        }
    }
    if (cfg.showContext && data.context) {
        const p = contextPercent(data.context);
        const color = getQuotaColor(p);
        parts.push(`${DIM}${t.contextShort}${RESET} ${color}${p.toFixed(0)}%${RESET}`);
    }
    if (cfg.showFooter && sessionCount > 0) {
        parts.push(`${DIM}${sessionCount}${t.sessionsShort}${RESET}`);
    }
    return [parts.join(` ${DIM}│${RESET} `)];
}
// ── Main export ──
export function renderStatusLines(range = "today") {
    const stored = loadConfig().display ?? {};
    const cfg = { ...DEFAULT_DISPLAY, ...stored };
    let local = aggregateLocalUsage(range);
    if (cfg.fallbackToWeek && range === "today" && local.sessionCount === 0) {
        const fallback = aggregateLocalUsage("week");
        if (fallback.sessionCount > 0) {
            local = fallback;
        }
    }
    const data = {
        rateLimits: local.latestRateLimits,
        model: local.latestModel,
        context: local.latestContext,
        sessionCount: local.sessionCount,
    };
    if (cfg.layout === "compact") {
        return renderCompact(data, cfg);
    }
    if (cfg.layout === "horizontal") {
        return renderHorizontal(data, cfg);
    }
    return renderExpanded(data, cfg);
}
