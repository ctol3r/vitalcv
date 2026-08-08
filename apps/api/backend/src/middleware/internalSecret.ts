/**
 * internalSecret.ts — shared machine-auth guard for operator-only routes.
 *
 * The `x-monitoring-secret` check was written inline three times (`app.ts`,
 * `routes/pilotOps.ts`, `routes/pilotKpi.ts`). This is the shared form for new
 * call sites; the existing three are deliberately left alone here because
 * rewriting them touches ~20 live routes and belongs in its own change.
 *
 * Fail-closed by construction: an unset `MONITORING_SECRET` denies every
 * request rather than disabling the check. A guard that switches itself off
 * when unconfigured is the failure mode this whole gap is made of.
 */
import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';

function extractInternalSecret(req: Request): string | null {
  const raw = req.headers['x-monitoring-secret'];
  if (typeof raw === 'string') {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw[0] ?? null;
  }
  return null;
}

/** Constant-time compare; length mismatch short-circuits (length is not secret). */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function hasValidInternalSecret(req: Request): boolean {
  // Read at call time, not module load: tests and ops flips must take effect
  // without a redeploy, and a module-load read pins an empty value on boot.
  const expected = process.env.MONITORING_SECRET?.trim();
  if (!expected) {
    return false;
  }
  const provided = extractInternalSecret(req);
  if (!provided) {
    return false;
  }
  return secretMatches(provided, expected);
}

/** Express middleware form. 403 matches the existing `/api/internal/*` shape. */
export function requireInternalSecret(req: Request, res: Response, next: NextFunction): void {
  if (!hasValidInternalSecret(req)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}
