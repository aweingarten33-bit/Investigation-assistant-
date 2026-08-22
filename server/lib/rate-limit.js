const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

// A live Node process (unlike the old per-request Deno edge functions) means
// this in-memory limiter is now a real guarantee for the process's traffic,
// not just a best-effort mitigation — see AUDIT.md.
export function createRateLimiter(max = RATE_LIMIT_MAX, windowMs = RATE_LIMIT_WINDOW_MS) {
  const buckets = new Map();
  return function isRateLimited(ip) {
    const now = Date.now();
    const hits = (buckets.get(ip) ?? []).filter((t) => now - t < windowMs);
    hits.push(now);
    buckets.set(ip, hits);
    return hits.length > max;
  };
}

export function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded || "").split(",")[0].trim();
  return first || req.socket.remoteAddress || "unknown";
}
