import type { NextFunction, Request, Response } from 'express';
import { log } from '../../obs/logger';

const MAX_ENTRIES = 1024;
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

type RateLimitEntry = {
  windowStartMs: number;
  count: number;
};

const store = new Map<string, RateLimitEntry>();

function extractIp(req: Request): string {
  const ip =
    typeof req.ip === 'string' && req.ip.trim().length > 0
      ? req.ip
      : typeof req.socket?.remoteAddress === 'string'
        ? req.socket.remoteAddress
        : 'unknown';
  return `demo-ip-${ip}`;
}

function trimStale(nowMs: number): void {
  if (store.size <= MAX_ENTRIES) return;
  for (const [key, entry] of store.entries()) {
    if (nowMs - entry.windowStartMs >= WINDOW_MS) {
      store.delete(key);
    }
  }
}

export function demoRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const nowMs = Date.now();
  const clientKey = extractIp(req);
  const current = store.get(clientKey);

  if (!current || nowMs - current.windowStartMs >= WINDOW_MS) {
    trimStale(nowMs);
    store.set(clientKey, { windowStartMs: nowMs, count: 1 });
    res.set('x-ratelimit-limit', String(MAX_REQUESTS));
    res.set('x-ratelimit-remaining', String(MAX_REQUESTS - 1));
    next();
    return;
  }

  current.count += 1;

  res.set('x-ratelimit-limit', String(MAX_REQUESTS));
  res.set('x-ratelimit-remaining', String(Math.max(0, MAX_REQUESTS - current.count)));

  if (current.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil(
      (WINDOW_MS - (nowMs - current.windowStartMs)) / 1000,
    );
    res.set('retry-after', String(retryAfter));

    log('warn', 'demo_rate_limit_exceeded', {
      clientKey,
      count: current.count,
    });

    res.status(429).json({
      error: 'Too many demo requests. Please wait a moment and try again.',
      retry_after_seconds: retryAfter,
    });
    return;
  }

  next();
}
