import type { Request, Response, NextFunction } from 'express';

const windowMs = 60 * 1000;
const bucket = new Map<string, { count: number, ts: number }>();

export function tenantGuard(req: Request, res: Response, next: NextFunction) {
  const tenant = (req.headers['x-tenant-id'] || 'public') + '';
  const key = tenant;
  const now = Date.now();
  const state = bucket.get(key) || { count: 0, ts: now };

  if (now - state.ts > windowMs) {
    state.count = 0;
    state.ts = now;
  }

  // naive defaults - can be enhanced to load from AgentTenantQuota table
  const rpm = 120;
  const limit = rpm;

  if (state.count >= limit) {
    return res.status(429).json({
      ok: false,
      error: 'rate_limited',
      retry_after_ms: (state.ts + windowMs) - now
    });
  }

  state.count++;
  bucket.set(key, state);
  next();
}

