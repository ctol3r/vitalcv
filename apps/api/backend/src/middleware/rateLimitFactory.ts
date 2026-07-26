/**
 * Rate Limit Factory — Wave M, extended by G3 (Wave 1509 · S3)
 *
 * Deterministic rate limiters for all public-facing endpoints.
 * No external service dependency — uses an in-memory fixed window.
 *
 * Configuration:
 *   - trustState:        60 req/min  (read-only lookups)
 *   - proof:             30 req/min  (computationally expensive)
 *   - credentialStatus: 100 req/min  (lightweight reads)
 *   - wallet:            50 req/min  (auth-gated operations)
 *   - passportExport:    10 req/min  (full-record export, most expensive lane)
 *
 * KEYING (G3). Buckets are keyed, in order of preference:
 *   1. verified user id — ONLY when `CLERK_JWT_VERIFICATION=enforce`, because that
 *      is the mode in which `verifiedIdentity` overwrites `x-clerk-user-id` with the
 *      JWT `sub` and strips unverifiable identity headers. In `off`/`shadow` the
 *      header is caller-supplied and keying on it would let an attacker mint an
 *      unlimited number of buckets by rotating a header.
 *   2. API key fingerprint
 *   3. client IP (`app.set('trust proxy', 1)` in app.ts makes `req.ip` the real
 *      client address behind Railway's proxy rather than the proxy's own)
 *
 * This upgrades itself the moment G1 reaches `enforce`; until then it degrades
 * honestly to IP, and the response advertises which scope was actually used.
 *
 * LIMITATION: the store is per-process. With N API instances the effective global
 * limit is N x the configured limit. Documented in docs/security/rate-limiting.md.
 */

import { createHash } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

const MAX_ENTRIES = 2048;

type RateLimitEntry = {
  windowStartMs: number;
  count: number;
};

type RateLimitConfig = {
  label: string;
  maxRequests: number;
  windowMs: number;
};

const RATE_LIMIT_CONFIGS = {
  trustState: { label: 'trust-state', maxRequests: 60, windowMs: 60_000 },
  proof: { label: 'proof', maxRequests: 30, windowMs: 60_000 },
  credentialStatus: { label: 'credential-status', maxRequests: 100, windowMs: 60_000 },
  wallet: { label: 'wallet', maxRequests: 50, windowMs: 60_000 },
  passportExport: { label: 'passport-export', maxRequests: 10, windowMs: 60_000 },
  documentIntelligence: { label: 'document-intelligence', maxRequests: 10, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitTier = keyof typeof RATE_LIMIT_CONFIGS;

/** Which identity a bucket was keyed on. Surfaced to the caller in 429 bodies. */
export type RateLimitScope = 'user' | 'api_key' | 'ip';

// Separate store per tier to prevent cross-contamination
const stores = new Map<RateLimitTier, Map<string, RateLimitEntry>>();

function getStore(tier: RateLimitTier): Map<string, RateLimitEntry> {
  let store = stores.get(tier);
  if (!store) {
    store = new Map();
    stores.set(tier, store);
  }
  return store;
}

function extractClientKey(req: Request, res: Response): { key: string; scope: RateLimitScope } {
  // 1. Verified user — trustworthy ONLY under enforce (see module header).
  if (env().CLERK_JWT_VERIFICATION === 'enforce') {
    const verifiedUserId = req.headers['x-clerk-user-id'];
    if (typeof verifiedUserId === 'string' && verifiedUserId.trim().length > 0) {
      return { key: `user-${verifiedUserId.trim()}`, scope: 'user' };
    }
  }

  // 2. API key fingerprint.
  const apiKeyId =
    typeof res.locals.api_key_id === 'string' && res.locals.api_key_id.trim().length > 0
      ? res.locals.api_key_id
      : null;

  if (apiKeyId) {
    return { key: apiKeyId, scope: 'api_key' };
  }

  // 3. Client IP. Correct behind Railway's proxy because app.ts sets trust proxy.
  const ip =
    typeof req.ip === 'string' && req.ip.trim().length > 0
      ? req.ip
      : typeof req.socket?.remoteAddress === 'string'
        ? req.socket.remoteAddress
        : 'unknown';

  return { key: `ip-${ip}`, scope: 'ip' };
}

function trimStale(store: Map<string, RateLimitEntry>, nowMs: number, windowMs: number): void {
  if (store.size <= MAX_ENTRIES) return;

  for (const [key, entry] of store.entries()) {
    if (nowMs - entry.windowStartMs >= windowMs) {
      store.delete(key);
    }
  }
}

/**
 * Create rate-limit middleware for a specific tier.
 *
 * Returns Express middleware that enforces the configured rate limit
 * and sets standard x-rate-limit-* response headers.
 */
export function createTierRateLimiter(
  tier: RateLimitTier,
): (req: Request, res: Response, next: NextFunction) => void {
  const config = RATE_LIMIT_CONFIGS[tier];
  const store = getStore(tier);

  return (req: Request, res: Response, next: NextFunction): void => {
    const nowMs = Date.now();
    const { key: clientKey, scope } = extractClientKey(req, res);
    const current = store.get(clientKey);

    // Set common headers
    const setHeaders = (remaining: number): void => {
      res.setHeader('x-rate-limit-limit', String(config.maxRequests));
      res.setHeader('x-rate-limit-window-ms', String(config.windowMs));
      res.setHeader('x-rate-limit-remaining', String(Math.max(0, remaining)));
      res.setHeader('x-rate-limit-tier', config.label);
      res.setHeader('x-rate-limit-scope', scope);
    };

    // New window or expired window
    if (!current || nowMs - current.windowStartMs >= config.windowMs) {
      store.set(clientKey, { windowStartMs: nowMs, count: 1 });
      setHeaders(config.maxRequests - 1);
      next();
      return;
    }

    // Window active, check limit
    if (current.count >= config.maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.windowStartMs + config.windowMs - nowMs) / 1000),
      );
      setHeaders(0);
      // RFC 9110 §10.2.3 — a 429 without Retry-After leaves well-behaved clients
      // guessing, so they hammer. This is the difference between shedding load and
      // amplifying it.
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: 'rate_limit_exceeded',
        message: `Rate limit exceeded for ${config.label}.`,
        tier: config.label,
        limit: config.maxRequests,
        windowMs: config.windowMs,
        scope,
        retryAfterSeconds,
      });
      return;
    }

    current.count += 1;
    store.set(clientKey, current);
    setHeaders(config.maxRequests - current.count);
    trimStale(store, nowMs, config.windowMs);
    next();
  };
}

// ── Pre-built middleware exports ──────────────────────────────

export const proofRateLimit = createTierRateLimiter('proof');
export const credentialStatusRateLimit = createTierRateLimiter('credentialStatus');
export const walletRateLimit = createTierRateLimiter('wallet');
export const trustStateRateLimit = createTierRateLimiter('trustState');
export const passportExportRateLimit = createTierRateLimiter('passportExport');
export const documentIntelligenceRateLimit = createTierRateLimiter('documentIntelligence');
