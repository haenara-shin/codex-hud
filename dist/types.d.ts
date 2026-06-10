export interface DisplayConfig {
    layout?: "compact" | "expanded" | "horizontal";
    showPlan?: boolean;
    showFooter?: boolean;
    showUsage?: boolean;
    showWeekly?: boolean;
    barWidth?: number;
    fallbackToWeek?: boolean;
    language?: "en" | "ko";
}
export interface PluginConfig {
    adminKey?: string;
    display?: DisplayConfig;
    /** The user's statusLine settings block as it was before install,
     *  so uninstall can restore it. */
    previousStatusLine?: Record<string, unknown>;
}
export declare const DEFAULT_DISPLAY: Required<DisplayConfig>;
export interface CostsBucket {
    object: string;
    amount: {
        value: number;
        currency: string;
    };
    line_item: string | null;
    project_id: string | null;
}
export interface CostsResponse {
    object: string;
    data: Array<{
        results: CostsBucket[];
        start_time: number;
        end_time: number;
    }>;
    has_more: boolean;
    next_page: string | null;
}
export interface UsageBucket {
    object: string;
    input_tokens: number;
    output_tokens: number;
    input_cached_tokens: number;
    num_model_requests: number;
    project_id: string | null;
    user_id: string | null;
    api_key_id: string | null;
    model: string | null;
    batch: boolean | null;
}
export interface UsageResponse {
    object: string;
    data: Array<{
        results: UsageBucket[];
        start_time: number;
        end_time: number;
    }>;
    has_more: boolean;
    next_page: string | null;
}
export interface TokenUsage {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
    reasoning_output_tokens: number;
    total_tokens: number;
}
export interface RateLimitWindow {
    used_percent: number;
    window_minutes: number | null;
    resets_at: number | null;
}
export interface RateLimits {
    limit_id: string | null;
    limit_name: string | null;
    primary: RateLimitWindow | null;
    secondary: RateLimitWindow | null;
    credits: unknown;
    plan_type: string | null;
    rate_limit_reached_type?: string | null;
}
export interface ParsedSession {
    totalUsage: TokenUsage | null;
    rateLimits: RateLimits | null;
    /** Epoch ms of the event that carried rateLimits (file mtime fallback). */
    rlTimestamp: number | null;
    date: string;
    filePath: string;
}
export interface AggregatedUsage {
    sessions: ParsedSession[];
    totals: TokenUsage;
    latestRateLimits: RateLimits | null;
    sessionCount: number;
}
export type ApiResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: string;
};
export type DateRange = "today" | "week" | "month";
