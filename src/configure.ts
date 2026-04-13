import { loadConfig, saveConfig } from "./config.js";
import type { DisplayConfig } from "./types.js";
import { DEFAULT_DISPLAY } from "./types.js";

type DisplayKey = keyof DisplayConfig;

const BOOL_KEYS: DisplayKey[] = [
  "showPlan",
  "showFooter",
  "showUsage",
  "showWeekly",
  "fallbackToWeek",
];
const NUMBER_KEYS: DisplayKey[] = ["barWidth"];
const ENUM_KEYS: Record<string, readonly string[]> = {
  layout: ["compact", "expanded"],
  language: ["en", "ko"],
};

function getDisplayConfig(): Required<DisplayConfig> {
  const stored = loadConfig().display ?? {};
  return { ...DEFAULT_DISPLAY, ...stored };
}

export function showConfig(asJson = false): string {
  const cfg = getDisplayConfig();
  if (asJson) return JSON.stringify(cfg, null, 2);

  const lines = [
    "Current display configuration:",
    "",
    `  layout         = ${cfg.layout}  (compact | expanded)`,
    `  showPlan       = ${cfg.showPlan}`,
    `  showFooter     = ${cfg.showFooter}`,
    `  showUsage      = ${cfg.showUsage}`,
    `  showWeekly     = ${cfg.showWeekly}`,
    `  barWidth       = ${cfg.barWidth}`,
    `  fallbackToWeek = ${cfg.fallbackToWeek}`,
    `  language       = ${cfg.language}  (en | ko)`,
  ];
  return lines.join("\n");
}

function parseValue(key: string, raw: string): unknown {
  if (BOOL_KEYS.includes(key as DisplayKey)) {
    if (raw === "true" || raw === "1") return true;
    if (raw === "false" || raw === "0") return false;
    throw new Error(`${key} must be true or false, got "${raw}"`);
  }
  if (NUMBER_KEYS.includes(key as DisplayKey)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`${key} must be a number, got "${raw}"`);
    if (key === "barWidth" && (n < 1 || n > 40)) {
      throw new Error(`barWidth must be between 1 and 40`);
    }
    return n;
  }
  if (key in ENUM_KEYS) {
    const allowed = ENUM_KEYS[key];
    if (!allowed.includes(raw)) {
      throw new Error(`${key} must be one of: ${allowed.join(", ")}`);
    }
    return raw;
  }
  throw new Error(`Unknown configuration key: ${key}`);
}

export function setConfigOption(
  key: string,
  value: string,
): { ok: boolean; message: string } {
  try {
    const parsed = parseValue(key, value);
    const current = loadConfig();
    const display: DisplayConfig = { ...(current.display ?? {}) };
    (display as Record<string, unknown>)[key] = parsed;
    saveConfig({ ...current, display });
    return { ok: true, message: `Set ${key} = ${String(parsed)}` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export function resetConfig(): { ok: boolean; message: string } {
  const current = loadConfig();
  const { display: _drop, ...rest } = current;
  void _drop;
  saveConfig(rest);
  return { ok: true, message: "Display configuration reset to defaults." };
}

export function listKeys(): string[] {
  return [...BOOL_KEYS, ...NUMBER_KEYS, ...Object.keys(ENUM_KEYS)];
}
