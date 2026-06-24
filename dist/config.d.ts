import type { PluginConfig } from "./types.js";
/** Plugin dir for caches (rate-limit snapshot etc.); created 0700 on demand. */
export declare function getCacheDir(): string;
export declare function loadConfig(): PluginConfig;
export declare function saveConfig(config: PluginConfig): void;
export declare function resolveAdminKey(): string | null;
