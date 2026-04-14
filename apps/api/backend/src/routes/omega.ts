/**
 * omega.ts — HTTP surface for the Omega Orchestrator.
 *
 * Validates the incoming request envelope, delegates to orchestrateOmega
 * (no logic here), and returns the orchestrator's response verbatim.
 * Status code is derived from OmegaResponse.status so operators can
 * distinguish "no such NPI" from "core ok but subsystems degraded".
 *
 * Guards (added in hardening pass — do not alter response shape):
 *   - Per-IP sliding-window rate limit (20 req/min, 429 when exceeded)
 *   - Structured pre/post logs (no payloads, no PII beyond NPI prefix)
 *   - Response timing attached to logs only
 */

import type { Express, Request, Response } from 'express';
import { orchestrateOmega } from '../orchestrator/vcv-omega';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;

// ── Rate limit ───────────────────────────────────────────────────────────
// Lightweight in-process sliding window. No external deps. Per-IP keying.
// Suitable for pilot-scale single-instance deployments; swap for shared
// store once we go multi-instance.

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 20;
const rateBuckets = new Map<string, number[]>();

function getClientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

function consumeRateToken(clientKey: string, now: number = Date.now()): boolean {
  const cutoff = now - RATE_WINDOW_MS;
  const existing = rateBuckets.get(clientKey) ?? [];
  // Prune expired entries in-place.
  const pruned: number[] = [];
  for (const ts of existing) {
    if (ts > cutoff) pruned.push(ts);
  }
  if (pruned.length >= RATE_MAX_REQUESTS) {
    rateBuckets.set(clientKey, pruned);
    return false;
  }
  pruned.push(now);
  rateBuckets.set(clientKey, pruned);
  return true;
}

// Exported for tests only — resets the rate buckets.
export function __resetOmegaRateLimiterForTests(): void {
  rateBuckets.clear();
}

interface OmegaRequestBody {
  npi?: unknown;
  orgId?: unknown;
  role?: unknown;
  persist?: unknown;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean';
}

export function registerOmegaRoutes(app: Express): void {
  app.post('/api/omega', async (req: Request, res: Response) => {
    // Rate limit first — cheap, before any body parsing beyond what
    // express.json() already did for us.
    const clientKey = getClientKey(req);
    if (!consumeRateToken(clientKey)) {
      log('warn', 'omega_rate_limited', { client_key: clientKey });
      return res.status(429).json({
        error: 'rate_limited',
        error_description: 'Too many requests',
      });
    }

    const start = Date.now();
    const body = (req.body ?? {}) as OmegaRequestBody;
    const rawNpi = body.npi;
    const { orgId, role, persist } = body;

    // Input hardening — trim whitespace before validating format.
    const npi = typeof rawNpi === 'string' ? rawNpi.trim() : rawNpi;

    if (typeof npi !== 'string' || !NPI_RE.test(npi)) {
      return res.status(400).json({
        error: 'invalid_npi',
        error_description: 'npi must be a 10-digit string.',
      });
    }
    if (!isOptionalString(orgId)) {
      return res.status(400).json({
        error: 'invalid_orgId',
        error_description: 'orgId must be a string when provided.',
      });
    }
    if (!isOptionalString(role)) {
      return res.status(400).json({
        error: 'invalid_role',
        error_description: 'role must be a string when provided.',
      });
    }
    if (!isOptionalBoolean(persist)) {
      return res.status(400).json({
        error: 'invalid_persist',
        error_description: 'persist must be a boolean when provided.',
      });
    }

    const trimmedOrgId = orgId?.trim();
    const trimmedRole = role?.trim();
    const npiPrefix = npi.slice(0, 4) + '····';

    // Pre-call structured log — no payload, prefixed NPI only.
    log('info', 'omega_request_received', {
      npi_prefix: npiPrefix,
      orgId: trimmedOrgId || undefined,
      role: trimmedRole || undefined,
      timestamp: new Date(start).toISOString(),
    });

    try {
      const result = await orchestrateOmega({
        subject: { npi },
        context: { orgId: trimmedOrgId, role: trimmedRole, persist },
      });

      const status = result.status === 'not_found' ? 404 : 200;
      const duration_ms = Date.now() - start;

      // Post-call log with outcome + duration. Response body is NOT logged.
      log('info', 'omega_request_served', {
        npi_prefix: npiPrefix,
        result_status: result.status,
        http_status: status,
        duration_ms,
      });

      return res.status(status).json(result);
    } catch (error) {
      const duration_ms = Date.now() - start;
      log('error', 'omega_request_failed', {
        npi_prefix: npiPrefix,
        duration_ms,
        message: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({
        error: 'omega_failed',
        error_description: 'Could not orchestrate Omega request.',
      });
    }
  });
}
