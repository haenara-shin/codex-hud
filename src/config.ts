import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { PluginConfig } from "./types.js";

function getConfigDir(): string {
  const claudeConfigDir =
    process.env["CLAUDE_CONFIG_DIR"] || join(homedir(), ".claude");
  return join(claudeConfigDir, "plugins", "codex-hud");
}

function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

export function loadConfig(): PluginConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as PluginConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: PluginConfig): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2) + "\n");
}

export function resolveAdminKey(): string | null {
  const envKey = process.env["OPENAI_ADMIN_KEY"];
  if (envKey) return envKey;

  const config = loadConfig();
  return config.adminKey ?? null;
}
