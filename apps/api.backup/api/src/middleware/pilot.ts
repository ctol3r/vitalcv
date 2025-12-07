import type { Request, Response, NextFunction } from 'express';

/**
 * Pilot Mode Guard Middleware
 *
 * When PILOT_MODE=1, blocks destructive or non-pilot routes to prevent
 * unintended changes during stakeholder demos and pilot deployments.
 */
export function pilotGuard(req: Request, res: Response, next: NextFunction) {
  if (process.env.PILOT_MODE !== '1') {
    return next();
  }

  // Block destructive or admin-only routes in pilot mode
  const blockedPatterns = [
    /\/api\/agent\/admin\/dedupe/i,
    /\/api\/agent\/mcp-admin\/import/i,
    /\/api\/status-admin\/.*assign/i,
    /\/api\/agent\/.*\/delete/i,
    /\/api\/admin\/.*\/purge/i
  ];

  const isBlocked = blockedPatterns.some(pattern => pattern.test(req.originalUrl));

  if (isBlocked) {
    return res.status(423).json({
      error: 'pilot_mode_locked',
      message: 'This operation is disabled in Pilot Mode',
      pilotMode: true
    });
  }

  next();
}

