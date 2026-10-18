/**
 * Small fixed-window limiter. Per serverless instance, so it is a speed bump
 * rather than a hard guarantee; hard cost limits come from salon credits and
 * per-session round caps enforced in the database.
 */
const g = globalThis as unknown as { __tbycRl?: Map<string, { count: number; reset: number }> };
const buckets = (g.__tbycRl ??= new Map());

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const t = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < t) {
    buckets.set(key, { count: 1, reset: t + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < t) buckets.delete(k);
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
