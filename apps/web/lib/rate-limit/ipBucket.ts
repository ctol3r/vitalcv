/**
 * In-memory IP rate-limit bucket.
 *
 * Sliding-window token bucket keyed by IP. Lives in the route handler's
 * Node.js process — adequate for unauthenticated demo endpoints; it is
 * NOT a substitute for a shared store (Redis/Upstash) in a multi-process
 * production deployment, but the demo cluster runs single-process and
 * the threat model is "casual abuse", not "coordinated attacker".
 *
 * Default policy: 30 requests per IP per minute. Burst-tolerant via the
 * standard token-bucket fill rule.
 */

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export interface RateLimitPolicy {
  /** Maximum tokens (burst capacity). */
  capacity: number;
  /** Tokens added per second. */
  refillPerSecond: number;
}

export const DEFAULT_POLICY: RateLimitPolicy = {
  capacity: 30,
  refillPerSecond: 0.5, // 30 tokens / 60 seconds
};

const buckets = new Map<string, Bucket>();

/**
 * Best-effort IP extractor. Order: X-Forwarded-For (first hop) → X-Real-IP →
 * a sentinel "unknown" key. Sentinel is used so a malformed/missing header
 * still gets rate-limited as a single shared bucket.
 */
export function extractClientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first && first.length > 0 && first.length < 64) return first;
  }
  const real = headers.get('x-real-ip');
  if (real && real.length < 64) return real.trim();
  return '__no_ip__';
}

export interface RateLimitResult {
  allowed: boolean;
  tokensRemaining: number;
  retryAfterSeconds: number;
}

export function consumeToken(
  ip: string,
  policy: RateLimitPolicy = DEFAULT_POLICY,
  now: number = Date.now(),
): RateLimitResult {
  const existing = buckets.get(ip);
  let bucket: Bucket;
  if (existing) {
    const elapsedSec = (now - existing.lastRefillMs) / 1000;
    const refilled = Math.min(
      policy.capacity,
      existing.tokens + elapsedSec * policy.refillPerSecond,
    );
    bucket = { tokens: refilled, lastRefillMs: now };
  } else {
    bucket = { tokens: policy.capacity, lastRefillMs: now };
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    buckets.set(ip, bucket);
    return {
      allowed: true,
      tokensRemaining: Math.floor(bucket.tokens),
      retryAfterSeconds: 0,
    };
  }

  buckets.set(ip, bucket);
  const deficit = 1 - bucket.tokens;
  return {
    allowed: false,
    tokensRemaining: 0,
    retryAfterSeconds: Math.ceil(deficit / policy.refillPerSecond),
  };
}

/**
 * Exposed for tests to reset state between runs.
 */
export function __resetBuckets(): void {
  buckets.clear();
}
