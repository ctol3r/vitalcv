/**
 * Internal route auth for source-health endpoints.
 *
 * Accepts EITHER:
 *   - `Authorization: Bearer <CRON_SECRET>` (preferred for scheduled callers)
 *   - `x-monitoring-secret: <MONITORING_SECRET>` (legacy/manual operator path)
 *
 * Returns one of:
 *   - { ok: true } when an env-configured secret matches
 *   - { ok: false, status: 401, body: { error: 'unauthorized' } }
 *   - { ok: false, status: 500, body: { error: 'no probe auth configured' } }
 *     when both env secrets are unset (defensive — fail closed).
 *
 * Constant-time compare via `crypto.timingSafeEqual` when buffers match
 * length; otherwise we still fail closed (no early return mismatch).
 */

import { timingSafeEqual } from 'node:crypto';

export interface AuthEnv {
  cronSecret?: string;
  monitoringSecret?: string;
}

export interface AuthHeaders {
  authorization?: string | null;
  monitoring?: string | null;
}

export type AuthResult =
  | { ok: true }
  | { ok: false; status: 401; body: { error: 'unauthorized' } }
  | { ok: false; status: 500; body: { error: 'no probe auth configured' } };

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf-8');
  const bBuf = Buffer.from(b, 'utf-8');
  if (aBuf.length !== bBuf.length) {
    // Still consume time — Node's timingSafeEqual requires equal length.
    // Compare aBuf to itself as a placeholder, then fail.
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

function parseBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

export function checkAuth(
  headers: AuthHeaders,
  env: AuthEnv,
): AuthResult {
  const cronSecret = (env.cronSecret ?? '').trim();
  const monitoringSecret = (env.monitoringSecret ?? '').trim();

  if (!cronSecret && !monitoringSecret) {
    return {
      ok: false,
      status: 500,
      body: { error: 'no probe auth configured' },
    };
  }

  const bearer = parseBearer(headers.authorization);
  if (bearer && cronSecret && safeEqual(bearer, cronSecret)) {
    return { ok: true };
  }

  const monitoring = (headers.monitoring ?? '').trim();
  if (monitoring && monitoringSecret && safeEqual(monitoring, monitoringSecret)) {
    return { ok: true };
  }

  return { ok: false, status: 401, body: { error: 'unauthorized' } };
}

export function readAuthEnv(): AuthEnv {
  return {
    cronSecret: process.env.CRON_SECRET,
    monitoringSecret: process.env.MONITORING_SECRET,
  };
}

export function readAuthHeaders(req: Request): AuthHeaders {
  return {
    authorization: req.headers.get('authorization'),
    monitoring: req.headers.get('x-monitoring-secret'),
  };
}
