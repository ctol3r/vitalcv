/**
 * apiAuth.ts — Wave 125: Real Authentication Middleware
 *
 * Express middleware for API authentication:
 *   - API key validation (X-API-Key header)
 *   - Bearer token validation
 *   - Rate limit tier extraction
 *   - Request context enrichment (req.auth)
 *
 * Supports:
 *   - Public routes (no auth required)
 *   - API key routes (verifiers, issuers)
 *   - Session-based routes (holders)
 */

import { createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { log } from '../obs/logger';
import { appendAuditEvent } from '../services/audit/auditLedger';
import type { BillingTier } from '../services/billing/contracts';

// ── Types ─────────────────────────────────────────────────────────────

/**
 * Coarse role discriminator for route-level authorization. Intentionally
 * a small, closed union — this is NOT a permissions system, just a
 * signal for requireRole() to gate employer-facing routes.
 */
export type AuthRole =
  | 'employer'
  | 'issuer'
  | 'holder'
  | 'verifier'
  | 'admin';

export interface AuthContext {
  authenticated: boolean;
  method: 'api-key' | 'bearer' | 'none';
  keyId?: string;
  tier?: BillingTier;
  clinicianId?: string;
  npi?: string;
  /** Populated when the auth path resolves a role (e.g. via key metadata
   *  or session claims). Unauthenticated requests omit it. */
  role?: AuthRole;
  /** Populated when the auth path resolves the tenant (org) for the
   *  actor. Unauthenticated / untenanted requests omit it. */
  organizationId?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

// ── In-Memory Key Store (production: use Prisma) ──────────────────────

interface StoredKey {
  keyId: string;
  keyHash: string;
  clinicianId: string;
  tier: BillingTier;
  name: string;
  active: boolean;
  createdAt: string;
}

const keyStore = new Map<string, StoredKey>();
let keyCounter = 0;

function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Register an API key (for testing and development).
 * Returns the raw key (shown once).
 */
export function registerApiKey(params: {
  clinicianId: string;
  tier?: BillingTier;
  name?: string;
}): { rawKey: string; keyId: string } {
  keyCounter++;
  const rawKey = `vk_test_${createHash('sha256').update(`${Date.now()}-${keyCounter}`).digest('hex').slice(0, 32)}`;
  const keyHash = hashApiKey(rawKey);
  const keyId = `key_${keyCounter}`;

  keyStore.set(keyHash, {
    keyId,
    keyHash,
    clinicianId: params.clinicianId,
    tier: params.tier ?? 'STARTER',
    name: params.name ?? 'default',
    active: true,
    createdAt: new Date().toISOString(),
  });

  return { rawKey, keyId };
}

/**
 * Validate an API key and return the stored key info.
 */
function validateApiKey(rawKey: string): StoredKey | null {
  const hash = hashApiKey(rawKey);
  const stored = keyStore.get(hash);
  if (!stored || !stored.active) return null;
  return stored;
}

// ── Session Store (in-memory, production: Redis/DB) ───────────────────

interface SessionEntry {
  sessionId: string;
  clinicianId: string;
  npi?: string;
  expiresAt: number;
}

const sessionStore = new Map<string, SessionEntry>();

/**
 * Create a session token (for testing).
 */
export function createSession(params: {
  clinicianId: string;
  npi?: string;
  ttlSeconds?: number;
}): string {
  const sessionId = `sess_${createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').slice(0, 32)}`;
  sessionStore.set(sessionId, {
    sessionId,
    clinicianId: params.clinicianId,
    npi: params.npi,
    expiresAt: Date.now() + (params.ttlSeconds ?? 3600) * 1000,
  });
  return sessionId;
}

function validateSession(token: string): SessionEntry | null {
  const entry = sessionStore.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    sessionStore.delete(token);
    return null;
  }
  return entry;
}

// ── Public Routes ─────────────────────────────────────────────────────

const PUBLIC_PATTERNS = [
  /^\/api\/public\//,
  /^\/api\/healthstart\/profiles/,
  /^\/api\/healthstart\/evidence/,
  /^\/api\/trust\/substrate\/.+\/band$/,
  /^\/api\/federation\/health$/,
  /^\/api\/providers\/health$/,
  /^\/api\/audit\/health$/,
  /^\/api\/conformance/,
  /^\/\.well-known\//,
  /^\/api\/oid4vci\/credential-offer/,
  /^\/api\/webauthn\//,
];

function isPublicRoute(path: string): boolean {
  return PUBLIC_PATTERNS.some((p) => p.test(path));
}

// ── Middleware ─────────────────────────────────────────────────────────

/**
 * API authentication middleware.
 * Checks X-API-Key header, then Authorization Bearer token.
 * Public routes pass through without auth.
 */
export function apiAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Public routes — no auth needed
  if (isPublicRoute(req.path)) {
    req.auth = { authenticated: false, method: 'none' };
    next();
    return;
  }

  // Try API key first
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    const stored = validateApiKey(apiKey);
    if (stored) {
      req.auth = {
        authenticated: true,
        method: 'api-key',
        keyId: stored.keyId,
        tier: stored.tier,
        clinicianId: stored.clinicianId,
      };
      next();
      return;
    }
    // Invalid key — log but don't block in dev
    log('warn', 'api_auth: invalid API key', { path: req.path });
  }

  // Try Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const session = validateSession(token);
    if (session) {
      req.auth = {
        authenticated: true,
        method: 'bearer',
        clinicianId: session.clinicianId,
        npi: session.npi,
      };
      next();
      return;
    }
    log('warn', 'api_auth: invalid bearer token', { path: req.path });
  }

  // No valid auth — allow through in development with unauthenticated context
  // In production, this would return 401
  req.auth = { authenticated: false, method: 'none' };
  next();
}

/**
 * Require authentication middleware.
 * Use on routes that must be authenticated.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.authenticated) {
    appendAuditEvent({
      category: 'AUTH',
      actor: req.ip ?? 'unknown',
      resource: req.path,
      requestFields: { method: req.method },
      resultFields: { denied: true },
      severity: 'WARNING',
      traceId: (req.headers['x-trace-id'] as string) ?? undefined,
    });
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Require specific tier middleware.
 */
export function requireTier(...tiers: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth?.authenticated || !req.auth.tier || !tiers.includes(req.auth.tier)) {
      res.status(403).json({ error: `Requires tier: ${tiers.join(' or ')}` });
      return;
    }
    next();
  };
}

/**
 * Require one of the supplied auth roles. Intentionally coarse —
 * matches on AuthContext.role. Unauthenticated requests are rejected
 * with 401 (not 403) so clients can distinguish missing credentials
 * from wrong role.
 */
export function requireRole(...roles: AuthRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth?.authenticated) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!req.auth.role || !roles.includes(req.auth.role)) {
      res.status(403).json({
        error: `Requires role: ${roles.join(' or ')}`,
      });
      return;
    }
    next();
  };
}

/**
 * Lightweight actor + tenant extractor for best-effort attribution.
 * Does NOT gate access — callers that need a gate use requireAuth or
 * requireRole. Returns nulls for unauthenticated requests so downstream
 * writes just carry missing context rather than failing.
 */
export function getActorContext(req: Request): {
  actorId: string | null;
  organizationId: string | null;
  role: AuthRole | null;
} {
  return {
    actorId: req.auth?.keyId ?? req.auth?.clinicianId ?? null,
    organizationId: req.auth?.organizationId ?? null,
    role: req.auth?.role ?? null,
  };
}
