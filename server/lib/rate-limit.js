const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const CLEANUP_INTERVAL_MS = 5 * 60_000;

export function createRateLimiter(max = RATE_LIMIT_MAX, windowMs = RATE_LIMIT_WINDOW_MS) {
  const buckets = new Map();
  let lastCleanup = Date.now();

  return function isRateLimited(ip) {
    const now = Date.now();

    if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
      for (const [key, hits] of buckets.entries()) {
        const recent = hits.filter((timestamp) => now - timestamp < windowMs);
        if (recent.length === 0) buckets.delete(key);
        else buckets.set(key, recent);
      }
      lastCleanup = now;
    }

    const hits = (buckets.get(ip) ?? []).filter((timestamp) => now - timestamp < windowMs);
    hits.push(now);
    buckets.set(ip, hits);
    return hits.length > max;
  };
}

export function clientIp(req) {
  // Express is configured with `trust proxy = 1` in server/index.js, so req.ip
  // applies the proxy trust policy instead of blindly trusting a user-supplied
  // X-Forwarded-For value.
  return req.ip || req.socket.remoteAddress || "unknown";
}
