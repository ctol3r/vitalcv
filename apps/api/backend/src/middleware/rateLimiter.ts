/**
 * rateLimiter.ts — Wave 117: Rate Limiting Middleware
 *
 * In-memory rate limiter keyed by API key or IP.
 * Tier limits: STARTER=100/hr, GROWTH=1000/hr, ENTERPRISE=unlimited
 */

import type { Request, Response, NextFunction } from 'express';
import { getTierRateLimit, normalizeBillingTier } from '@vitalcv/shared/pricing';
import { log } from '../obs/logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Stub: apiKeyService was removed. Always returns valid with STARTER tier. */
async function validateApiKey(apiKey: string): Promise<{ valid: boolean; tier: string; keyId: string }> {
  return { valid: true, tier: 'STARTER', keyId: apiKey.slice(0, 12) };
}

function getEntry(key: string): RateLimitEntry {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || now > existing.resetAt) {
    const entry: RateLimitEntry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, entry);
    return entry;
  }
  return existing;
}

export function createRateLimiter(windowMs: number, max: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? 'unknown';
    const entry = getEntry(ip);
    entry.count++;

    if (max !== -1 && entry.count > max) {
      log('warn', 'rate_limit_exceeded', { ip, count: entry.count, max });
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((entry.resetAt - Date.now()) / 1000),
      });
      return;
    }
    next();
  };
}

export function applyRateLimitByApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    // No API key — apply conservative IP-based limit (50/hr)
    const ip = req.ip ?? 'unknown';
    const entry = getEntry(`ip:${ip}`);
    entry.count++;
    if (entry.count > 50) {
      res.status(429).json({ error: 'Rate limit exceeded. Provide an API key for higher limits.' });
      return;
    }
    next();
    return;
  }

  validateApiKey(apiKey).then(({ valid, tier, keyId }) => {
    if (!valid) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    const resolvedTier = normalizeBillingTier(tier);
    const limit = getTierRateLimit(resolvedTier);
    if (limit === -1) {
      next();
      return;
    }

    const entry = getEntry(`key:${keyId}`);
    entry.count++;

    if (entry.count > limit) {
      log('warn', 'api_key_rate_limit_exceeded', {
        keyId,
        tier: resolvedTier,
        count: entry.count,
        limit,
      });
      res.status(429).json({
        error: 'API key rate limit exceeded',
        tier: resolvedTier,
        limit,
        retryAfter: Math.ceil((entry.resetAt - Date.now()) / 1000),
      });
      return;
    }

    next();
  }).catch(() => next());
}

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 10 * 60 * 1000);
