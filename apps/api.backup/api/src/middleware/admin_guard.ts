/**
 * Batch 62: Admin Guard Middleware
 * Protects admin-only routes (reseed, migrations/apply)
 */

import { Request, Response, NextFunction } from 'express';

export function adminGuard(req: Request, res: Response, next: NextFunction) {
  // Allow bypass in local development
  if (process.env.DEV_ALLOW_ADMIN === '1') {
    return next();
  }

  // Check user role from request context or header
  const role = (req as any).user?.role || req.headers['x-dev-role'] || 'viewer';

  if (String(role).toLowerCase() === 'admin') {
    return next();
  }

  return res.status(403).json({
    ok: false,
    error: 'admin_required',
    message: 'This operation requires admin privileges'
  });
}

