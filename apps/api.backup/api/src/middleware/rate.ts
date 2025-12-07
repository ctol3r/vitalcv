import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

export const perTenantLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: (req: Request) => req.headers['x-tenant-id'] ? 90 : 30,
  keyGenerator: (req) => String(req.headers['x-tenant-id'] || req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limit_exceeded', retry_after_seconds: 60 }
});

