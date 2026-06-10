const BASE_URL = "https://api.openai.com";
const TIMEOUT_MS = 10_000;
async function apiFetch(path, adminKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            headers: {
                Authorization: `Bearer ${adminKey}`,
                "Content-Type": "application/json",
            },
            signal: controller.signal,
        });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            if (res.status === 401 || res.status === 403) {
                return {
                    ok: false,
                    error: `Authentication failed (${res.status}). Check your Admin API key.`,
                };
            }
            if (res.status === 429) {
                return { ok: false, error: "Rate limited by OpenAI API. Try again later." };
            }
            return {
                ok: false,
                error: `OpenAI API error ${res.status}: ${body.slice(0, 200)}`,
            };
        }
        const data = (await res.json());
        return { ok: true, data };
    }
    catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            return { ok: false, error: "OpenAI API request timed out (10s)." };
        }
        return {
            ok: false,
            error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
    finally {
        clearTimeout(timer);
    }
}
function buildQuery(params) {
    const parts = [];
    for (const [key, val] of Object.entries(params)) {
        if (Array.isArray(val)) {
            for (const v of val) {
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
            }
        }
        else {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
        }
    }
    return parts.join("&");
}
// Number of whole days covered by [startTime, endTime|now], at least 1.
function dayCount(startTime, endTime) {
    const end = endTime ?? Math.floor(Date.now() / 1000);
    return Math.max(1, Math.ceil((end - startTime) / 86400));
}
// The Costs/Usage APIs return at most `limit` buckets per page (1d default is
// only 7) and hide the rest behind has_more/next_page. Without this, a 30-day
// range silently reports ~7 days. Loop through pages and merge the buckets.
async function apiFetchAllPages(basePath, params, adminKey) {
    let merged = null;
    let page = null;
    // Hard cap so a misbehaving cursor can't loop forever.
    for (let i = 0; i < 50; i++) {
        const pageParams = { ...params };
        if (page)
            pageParams["page"] = page;
        const res = await apiFetch(`${basePath}?${buildQuery(pageParams)}`, adminKey);
        if (!res.ok) {
            // Return whatever we have so far; only surface the error on page 1.
            if (merged)
                break;
            return res;
        }
        if (!merged) {
            merged = res.data;
        }
        else {
            merged.data.push(...res.data.data);
            merged.has_more = res.data.has_more;
            merged.next_page = res.data.next_page;
        }
        if (!res.data.has_more || !res.data.next_page)
            break;
        // A cursor that doesn't advance would duplicate buckets up to the
        // iteration cap — bail out instead.
        if (res.data.next_page === page)
            break;
        page = res.data.next_page;
    }
    if (!merged) {
        return { ok: false, error: "No data returned from OpenAI API." };
    }
    return { ok: true, data: merged };
}
export async function fetchCosts(adminKey, startTime, endTime, bucketWidth = "1d") {
    const params = {
        start_time: String(startTime),
        bucket_width: bucketWidth,
        "group_by[]": ["line_item"],
        // Costs API caps daily buckets at 180; request the whole range up front.
        limit: String(Math.min(dayCount(startTime, endTime), 180)),
    };
    if (endTime) {
        params["end_time"] = String(endTime);
    }
    return apiFetchAllPages("/v1/organization/costs", params, adminKey);
}
export async function fetchUsage(adminKey, startTime, endTime, bucketWidth = "1d") {
    const params = {
        start_time: String(startTime),
        bucket_width: bucketWidth,
        "group_by[]": ["model"],
        // Usage API caps 1d buckets at 31; request the whole range up front.
        limit: String(Math.min(dayCount(startTime, endTime), 31)),
    };
    if (endTime) {
        params["end_time"] = String(endTime);
    }
    return apiFetchAllPages("/v1/organization/usage/completions", params, adminKey);
}
export async function testConnection(adminKey) {
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;
    return fetchCosts(adminKey, oneDayAgo, now, "1d");
}
