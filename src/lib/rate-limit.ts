/**
 * Rate Limiting — Phase 10
 *
 * In-memory token-bucket rate limiter.
 * Per-IP for unauthenticated requests, per-userId for authenticated.
 *
 * Per spec Phase 10:
 *   - API_RATE_LIMIT_PER_MINUTE ต้องมีผลจริง
 *   - 429 response + Retry-After
 */

import { getEnv } from "@/lib/env";

type Bucket = { tokens: number; lastRefill: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000; // prevent unbounded memory

function getKey(identifier: string, route: string): string {
  return `${identifier}:${route}`;
}

/**
 * Check rate limit. Returns { allowed, remaining, retryAfterMs }.
 * If not allowed, the bucket is not refilled (caller should return 429).
 */
export function checkRateLimit(
  identifier: string,
  route: string,
  opts: { perMinute?: number } = {},
): { allowed: boolean; remaining: number; retryAfterMs: number; limit: number } {
  const limit = opts.perMinute ?? getEnv().apiRateLimitPerMinute;
  const key = getKey(identifier, route);
  const now = Date.now();
  const refillIntervalMs = 60_000 / limit; // ms per token

  let bucket = buckets.get(key);
  if (!bucket) {
    // Evict oldest if at capacity
    if (buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) buckets.delete(oldestKey);
    }
    bucket = { tokens: limit, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor(elapsed / refillIntervalMs);
  if (refill > 0) {
    bucket.tokens = Math.min(limit, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    const retryAfterMs = Math.ceil(refillIntervalMs);
    return { allowed: false, remaining: 0, retryAfterMs, limit };
  }

  bucket.tokens -= 1;
  return { allowed: true, remaining: bucket.tokens, retryAfterMs: 0, limit };
}

/**
 * Get identifier for rate limiting: userId if authenticated, else IP.
 * Called from middleware.
 */
export function getRateLimitIdentifier(req: Request, userId?: string): string {
  if (userId) return `user:${userId}`;
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  return `ip:${ip}`;
}

// Stricter limits for sensitive endpoints
export const RATE_LIMITS = {
  login: { perMinute: 5 },
  ai: { perMinute: 10 },
  deploy: { perMinute: 3 },
  rollback: { perMinute: 3 },
  merge: { perMinute: 3 },
  approval: { perMinute: 10 },
  github: { perMinute: 30 },
  default: undefined, // uses API_RATE_LIMIT_PER_MINUTE
} as const;

// Test helper — clears all buckets
export function _resetRateLimitForTests(): void {
  buckets.clear();
}
