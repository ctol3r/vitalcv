/**
 * Rate Limit Factory — Wave M
 *
 * Deterministic, IP-based rate limiters for all public-facing endpoints.
 * No external service dependency — uses in-memory sliding window.
 *
 * Configuration:
 *   - trustState:        60 req/min  (read-only lookups)
 *   - proof:             30 req/min  (computationally expensive)
 *   - credentialStatus: 100 req/min  (lightweight reads)
 *   - wallet:            50 req/min  (auth-gated operations)
 */

import { createHash } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

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
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitTier = keyof typeof RATE_LIMIT_CONFIGS;

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

function extractClientKey(req: Request, res: Response): string {
  // Prefer API key fingerprint, fall back to IP
  const apiKeyId =
    typeof res.locals.api_key_id === 'string' && res.locals.api_key_id.trim().length > 0
      ? res.locals.api_key_id
      : null;

  if (apiKeyId) {
    return apiKeyId;
  }

  const ip =
    typeof req.ip === 'string' && req.ip.trim().length > 0
      ? req.ip
      : typeof req.socket?.remoteAddress === 'string'
        ? req.socket.remoteAddress
        : 'unknown';

  return `ip-${ip}`;
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
    const clientKey = extractClientKey(req, res);
    const current = store.get(clientKey);

    // Set common headers
    const setHeaders = (remaining: number): void => {
      res.setHeader('x-rate-limit-limit', String(config.maxRequests));
      res.setHeader('x-rate-limit-window-ms', String(config.windowMs));
      res.setHeader('x-rate-limit-remaining', String(Math.max(0, remaining)));
      res.setHeader('x-rate-limit-tier', config.label);
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
      setHeaders(0);
      res.status(429).json({ error: `Rate limit exceeded for ${config.label}` });
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
