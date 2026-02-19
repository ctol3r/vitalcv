import type { NextFunction, Request, Response } from 'express';
import { sha256Hex } from '../utils/deterministic';

const DEFAULT_RATE_LIMIT_PER_MINUTE = 120;
const DEFAULT_PUBLIC_RATE_LIMIT = 100;
const TRUST_STATE_RATE_LIMIT_WINDOW_MS = 60_000;
const PUBLIC_RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const MAX_RATE_LIMIT_ENTRIES = 1024;

type RateLimitEntry = {
  window_started_at_ms: number;
  count: number;
};

const trustStateRateLimitByKey = new Map<string, RateLimitEntry>();
const publicApiRateLimitByKey = new Map<string, RateLimitEntry>();

function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function configuredApiKeys(): Set<string> {
  const configured = (process.env.API_KEYS || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return new Set(configured);
}

function toApiKeyId(apiKey: string): string {
  const fingerprint = sha256Hex(apiKey).slice(0, 12);
  return `key-${fingerprint}`;
}

function parseApiKeyHeader(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getRateLimitKey(req: Request, res: Response): string {
  const localKey = typeof res.locals.api_key_id === 'string' ? res.locals.api_key_id : null;
  if (localKey && localKey.trim().length > 0) {
    return localKey;
  }

  const requestIp =
    typeof req.ip === 'string' && req.ip.trim().length > 0
      ? req.ip
      : typeof req.socket?.remoteAddress === 'string'
        ? req.socket.remoteAddress
        : 'unknown';
  return `ip-${requestIp}`;
}

function trimStaleRateLimitEntries(
  store: Map<string, RateLimitEntry>,
  nowMs: number,
  windowMs: number,
): void {
  if (store.size <= MAX_RATE_LIMIT_ENTRIES) {
    return;
  }

  for (const [key, value] of store.entries()) {
    if (nowMs - value.window_started_at_ms >= windowMs) {
      store.delete(key);
    }
  }
}

function createRateLimiter(
  store: Map<string, RateLimitEntry>,
  windowMs: number,
  maxRequests: number,
  label: string,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const nowMs = Date.now();
    const rateLimitKey = getRateLimitKey(req, res);
    const current = store.get(rateLimitKey);

    if (!current || nowMs - current.window_started_at_ms >= windowMs) {
      store.set(rateLimitKey, {
        window_started_at_ms: nowMs,
        count: 1,
      });
      res.setHeader('x-rate-limit-limit', String(maxRequests));
      res.setHeader('x-rate-limit-window-ms', String(windowMs));
      res.setHeader('x-rate-limit-remaining', String(maxRequests - 1));
      next();
      return;
    }

    if (current.count >= maxRequests) {
      res.setHeader('x-rate-limit-limit', String(maxRequests));
      res.setHeader('x-rate-limit-window-ms', String(windowMs));
      res.setHeader('x-rate-limit-remaining', '0');
      res.status(429).json({ error: `Rate limit exceeded for ${label}` });
      return;
    }

    current.count += 1;
    store.set(rateLimitKey, current);
    res.setHeader('x-rate-limit-limit', String(maxRequests));
    res.setHeader('x-rate-limit-window-ms', String(windowMs));
    res.setHeader('x-rate-limit-remaining', String(Math.max(0, maxRequests - current.count)));
    trimStaleRateLimitEntries(store, nowMs, windowMs);
    next();
  };
}

/**
 * Require a valid API key for write endpoints.
 * Returns 401 if no key is provided or the key is not in the configured list.
 * In development, allows requests without API keys if none are configured.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const allowedApiKeys = configuredApiKeys();
  const provided = parseApiKeyHeader(req.get('x-api-key'));

  // In development with no configured keys, allow all requests
  if (allowedApiKeys.size === 0 && process.env.NODE_ENV !== 'production') {
    res.locals.api_key_id = 'dev-anonymous';
    next();
    return;
  }

  if (!provided) {
    res.status(401).json({ error: 'API key required. Provide x-api-key header.' });
    return;
  }

  if (!allowedApiKeys.has(provided)) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  res.locals.api_key_id = toApiKeyId(provided);
  next();
}

/**
 * Rate limit for trust-state queries. Uses in-memory sliding window.
 */
export function trustStateRateLimit(req: Request, res: Response, next: NextFunction): void {
  const maxRequests = parsePositiveIntEnv(
    'TRUST_STATE_RATE_LIMIT_PER_MINUTE',
    DEFAULT_RATE_LIMIT_PER_MINUTE,
  );
  const limiter = createRateLimiter(
    trustStateRateLimitByKey,
    TRUST_STATE_RATE_LIMIT_WINDOW_MS,
    maxRequests,
    'trust-state',
  );
  limiter(req, res, next);
}

/**
 * Generic public API rate limiter for stability smoke checks.
 */
export function publicApiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const maxRequests = parsePositiveIntEnv(
    'PUBLIC_RATE_LIMIT_PER_TEN_MINUTES',
    DEFAULT_PUBLIC_RATE_LIMIT,
  );
  const limiter = createRateLimiter(
    publicApiRateLimitByKey,
    PUBLIC_RATE_LIMIT_WINDOW_MS,
    maxRequests,
    'public-api',
  );
  limiter(req, res, next);
}
