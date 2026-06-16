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
        resets: "resets",
        on: "on",
        months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
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
        resets: "리셋",
        on: "",
        months: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
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
function sameLocalDay(a, b) {
    return (a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate());
}
// Absolute reset clock in the user's local time: "19:38", or "15:04 on 22 Jun"
// (en) / "15:04 6월 22일" (ko) once the reset is past today.
function formatResetAbsolute(resetsAt, t) {
    const d = new Date(resetsAt * 1000);
    const clock = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    if (sameLocalDay(d, new Date()))
        return clock;
    const month = t.months[d.getMonth()];
    // en: "15:04 on 22 Jun" — ko: "15:04 6월 22일"
    return t.on
        ? `${clock} ${t.on} ${d.getDate()} ${month}`
        : `${clock} ${month} ${d.getDate()}일`;
}
// Inner text for the "(...)" reset hint, honoring cfg.resetStyle.
// verbose=true (expanded layout) prefixes the "resets" word.
function resetText(resetsAt, cfg, t, verbose) {
    if (resetsAt == null)
        return "";
    const rel = formatResetTime(resetsAt); // "" once the window has reset
    const abs = formatResetAbsolute(resetsAt, t);
    if (cfg.resetStyle === "relative") {
        if (!rel)
            return "";
        return verbose ? `${t.resetsIn} ${rel}` : rel;
    }
    if (cfg.resetStyle === "absolute") {
        return verbose ? `${t.resets} ${abs}` : abs;
    }
    // both
    const core = rel ? `${abs} · ${rel}` : abs;
    return verbose ? `${t.resets} ${core}` : core;
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
            const reset = resetText(rateLimits.primary.resets_at, cfg, t, true);
            const resetPart = reset ? ` ${DIM}(${reset})${RESET}` : "";
            lines.push(`${DIM}${t.usage}${RESET}   ${bar} ${color}${p.toFixed(0)}%${RESET}${resetPart}`);
        }
        if (cfg.showWeekly && rateLimits.secondary) {
            const p = rateLimits.secondary.used_percent;
            const color = getQuotaColor(p);
            const bar = quotaBar(p, cfg.barWidth);
            const reset = resetText(rateLimits.secondary.resets_at, cfg, t, true);
            const resetPart = reset ? ` ${DIM}(${reset})${RESET}` : "";
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
// ── Inline layout (ONE line with bars, claude-hud style) ──
function renderInline(data, cfg) {
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
        const reset = resetText(rateLimits.primary.resets_at, cfg, t, false);
        const resetPart = reset ? ` ${DIM}(${reset})${RESET}` : "";
        parts.push(`${DIM}${t.usage}${RESET} ${bar} ${color}${p.toFixed(0)}%${RESET}${resetPart}`);
    }
    if (rateLimits && cfg.showWeekly && rateLimits.secondary) {
        const p = rateLimits.secondary.used_percent;
        const color = getQuotaColor(p);
        const bar = quotaBar(p, cfg.barWidth);
        const reset = resetText(rateLimits.secondary.resets_at, cfg, t, false);
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
// ── Horizontal layout (header + metrics side-by-side + footer) ──
function renderHorizontal(data, cfg) {
    const lines = [];
    const t = I18N[cfg.language];
    const { rateLimits, sessionCount } = data;
    const plan = rateLimits?.plan_type ?? "";
    lines.push(`${DIM}── Codex${headerBadges(data, cfg, t)} ──${RESET}`);
    if (!rateLimits && sessionCount === 0) {
        lines.push(`${DIM}${t.noData}${RESET}`);
        return lines;
    }
    // Metrics on a single line, separated by │
    const metricParts = [];
    if (rateLimits && cfg.showUsage && rateLimits.primary) {
        const p = rateLimits.primary.used_percent;
        const color = getQuotaColor(p);
        const bar = quotaBar(p, cfg.barWidth);
        const reset = resetText(rateLimits.primary.resets_at, cfg, t, false);
        const resetPart = reset ? ` ${DIM}(${reset})${RESET}` : "";
        metricParts.push(`${DIM}${t.usage}${RESET} ${bar} ${color}${p.toFixed(0)}%${RESET}${resetPart}`);
    }
    if (rateLimits && cfg.showWeekly && rateLimits.secondary) {
        const p = rateLimits.secondary.used_percent;
        const color = getQuotaColor(p);
        const bar = quotaBar(p, cfg.barWidth);
        const reset = resetText(rateLimits.secondary.resets_at, cfg, t, false);
        const resetPart = reset ? ` ${DIM}(${reset})${RESET}` : "";
        metricParts.push(`${DIM}${t.weekly}${RESET} ${bar} ${color}${p.toFixed(0)}%${RESET}${resetPart}`);
    }
    if (cfg.showContext && data.context) {
        const p = contextPercent(data.context);
        const color = getQuotaColor(p);
        const bar = quotaBar(p, cfg.barWidth);
        metricParts.push(`${DIM}${t.context}${RESET} ${bar} ${color}${p.toFixed(0)}%${RESET}`);
    }
    if (metricParts.length > 0) {
        lines.push(metricParts.join(` ${DIM}│${RESET}  `));
    }
    if (cfg.showFooter && sessionCount > 0) {
        const label = sessionCount === 1 ? t.sessions : t.sessionsPlural;
        const planPart = cfg.showPlan && plan ? ` | ${plan}` : "";
        lines.push(`${DIM}${sessionCount} ${label}${planPart}${RESET}`);
    }
    return lines;
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
            const reset = resetText(rateLimits.primary.resets_at, cfg, t, false);
            const resetPart = reset ? ` ${DIM}(${reset})${RESET}` : "";
            parts.push(`${DIM}${t.usage}${RESET} ${color}${p.toFixed(0)}%${RESET}${resetPart}`);
        }
        if (cfg.showWeekly && rateLimits.secondary) {
            const p = rateLimits.secondary.used_percent;
            const color = getQuotaColor(p);
            const reset = resetText(rateLimits.secondary.resets_at, cfg, t, false);
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
// ── Dispatch ──
function dispatch(data, cfg) {
    if (cfg.layout === "compact")
        return renderCompact(data, cfg);
    if (cfg.layout === "horizontal")
        return renderHorizontal(data, cfg);
    if (cfg.layout === "inline")
        return renderInline(data, cfg);
    return renderExpanded(data, cfg);
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
    return dispatch(data, cfg);
}
// ── Preview (for /codex-hud:configure) ──
// Representative sample so layout/toggle differences are always visible, even
// when the user has no recent Codex sessions. Rendered by the SAME code paths
// as the live statusline, so a preview can never drift from reality.
function sampleData() {
    const now = Math.floor(Date.now() / 1000);
    return {
        rateLimits: {
            limit_id: "codex",
            limit_name: null,
            primary: { used_percent: 15, window_minutes: 300, resets_at: now + 16620 },
            secondary: {
                used_percent: 3,
                window_minutes: 10080,
                resets_at: now + 551400,
            },
            credits: null,
            plan_type: "team",
        },
        model: { model: "gpt-5.5", effort: "medium" },
        context: { used: 47000, window: 258400 },
        sessionCount: 15,
    };
}
function stripAnsi(s) {
    // eslint-disable-next-line no-control-regex
    return s.replace(/\x1b\[[0-9;]*m/g, "");
}
/**
 * Render the statusline for the user's stored config plus `overrides`, using
 * sample data, as plain text (no ANSI) suitable for an AskUserQuestion preview.
 */
export function renderPreview(overrides = {}) {
    const stored = loadConfig().display ?? {};
    const cfg = {
        ...DEFAULT_DISPLAY,
        ...stored,
        ...overrides,
    };
    return dispatch(sampleData(), cfg).map(stripAnsi);
}
