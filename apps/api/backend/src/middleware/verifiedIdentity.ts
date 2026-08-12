/**
 * G1 header-trust closure — verified Clerk session JWTs (staged rollout).
 *
 * The backend historically trusts identity-bearing headers (`x-clerk-user-id`,
 * `x-user-role`, `x-verifier-role`, `x-role`) set by the web tier after Clerk
 * auth. Anyone who can reach the API origin directly can forge them (ASVS
 * scorecard gap G1 / 14.5.4). This middleware verifies the Clerk session JWT
 * that the web tier already forwards as `Authorization: Bearer <token>` on
 * most proxy call sites (`apps/web/app/api/intelligence/_shared.ts`).
 *
 * Rollout modes (CLERK_JWT_VERIFICATION, mirrors the VERIFIER_RBAC_ENFORCED
 * shadow pattern — a security control must never silently no-op):
 *
 *   off      — no-op (default until CLERK_ISSUER is configured).
 *   shadow   — verify when a bearer token is present; compare the verified
 *              `sub` to `x-clerk-user-id`; log outcomes; NEVER block. This
 *              measures (a) forged-header attempts and (b) which web call
 *              sites still don't forward tokens, without any traffic risk.
 *   enforce  — identity comes ONLY from the verified token:
 *                * valid token → `x-clerk-user-id` is REWRITTEN to the
 *                  verified `sub`, so all ~35 downstream header readers
 *                  transparently receive cryptographically verified identity
 *                  (no per-route refactor);
 *                * identity header WITHOUT a valid token → 401, fail closed;
 *                * unverified requests also lose the role-bypass headers
 *                  (`x-user-role` / `x-verifier-role` / `x-role`), closing the
 *                  `super-admin` tenant-guard bypass;
 *                * anonymous requests (no identity header, no token) pass
 *                  through untouched — public routes and API-key
 *                  server-to-server flows are unaffected.
 *
 * Verification: `jose` remote JWKS from `${CLERK_ISSUER}/.well-known/jwks.json`
 * with issuer + exp/nbf checks, plus optional `azp` allowlist
 * (CLERK_AUTHORIZED_PARTIES). Org-context binding (`x-org-id`) to a verified
 * org claim is phase 2 — it needs the org claim added to the Clerk JWT
 * template first (tracked in docs/security/m3-security-status.md).
 */

import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { env } from '../config/env';
import { log } from '../obs/logger';

export type VerifiedIdentityOutcome =
  | 'anonymous'            // no identity header, no bearer token
  | 'header_without_token' // legacy call site — identity header but no bearer
  | 'verified_match'       // token valid and sub === x-clerk-user-id
  | 'verified_mismatch'    // token valid but sub !== x-clerk-user-id (forgery signal)
  | 'token_only'           // token valid, no identity header
  | 'invalid_token';       // bearer present but failed verification

export interface VerifiedAuth {
  outcome: VerifiedIdentityOutcome;
  /** Verified Clerk user id (JWT `sub`) — only set when the token verified. */
  verifiedUserId?: string;
  /** Failure reason when outcome === 'invalid_token'. */
  reason?: string;
}

/** Verifies a raw JWT and returns its payload; throws on any failure. */
export type TokenVerifier = (token: string) => Promise<JWTPayload>;

const ROLE_BYPASS_HEADERS = ['x-user-role', 'x-verifier-role', 'x-role'] as const;

// Sample high-volume shadow logs: always log the first N occurrences of an
// outcome, then every SAMPLE_EVERYth. Mismatches/invalids always log.
const ALWAYS_LOG_FIRST = 25;
const SAMPLE_EVERY = 100;
const outcomeCounts = new Map<string, number>();

function shouldLogSampled(outcome: VerifiedIdentityOutcome): boolean {
  const n = (outcomeCounts.get(outcome) ?? 0) + 1;
  outcomeCounts.set(outcome, n);
  return n <= ALWAYS_LOG_FIRST || n % SAMPLE_EVERY === 0;
}

/**
 * The ONLY signature algorithm this backend will accept on a session token.
 *
 * `jwtVerify` without an `algorithms` allowlist accepts whatever the token's
 * own header asks for, which makes the attacker a participant in choosing how
 * their token is checked — the family that includes `alg: none` and the
 * RS256→HS256 confusion where the public key is replayed as an HMAC secret.
 * Clerk signs session JWTs with RS256, so the allowlist is exactly one entry;
 * anything else is either a downgrade attempt or an issuer change that must be
 * a reviewed edit here rather than a silent acceptance.
 *
 * Related: #553 deleted the HS256 stack from this codebase. Leaving the
 * verifier open to symmetric algorithms would let it back in through the door
 * the token itself holds.
 */
export const ACCEPTED_JWT_ALGORITHMS = ['RS256'] as const;

/**
 * Either jose key form: a JWKS resolver (production) or a resolved key (tests).
 *
 * Spelled as a union rather than `Parameters<typeof jwtVerify>[1]`, which
 * collapses to the last overload — the resolver — and rejects a plain key. The
 * key arm is written structurally rather than as jose's `KeyLike` on purpose:
 * that alias exists in jose 5 and not in 6, and this file must not pin a major.
 * `CryptoKey` and node's `KeyObject` both satisfy `{ type: string }`.
 */
export type JWTVerifierKeyInput =
  | Parameters<typeof jwtVerify>[1]
  | Uint8Array
  | { readonly type: string };

/**
 * Build a verifier over any jose key input (remote JWKS in production, a local
 * key in tests). Exported so the algorithm allowlist is exercised by the same
 * code path production runs, rather than asserted against a stub that would
 * pass whether or not the allowlist is there.
 */
export function createTokenVerifier(key: JWTVerifierKeyInput, issuer: string): TokenVerifier {
  return async (token: string) => {
    const { payload } = await jwtVerify(token, key as Parameters<typeof jwtVerify>[1], {
      issuer,
      algorithms: [...ACCEPTED_JWT_ALGORITHMS],
    });
    return payload;
  };
}

let remoteVerifier: TokenVerifier | null = null;
let remoteVerifierIssuer: string | null = null;

function getRemoteVerifier(issuer: string): TokenVerifier {
  if (!remoteVerifier || remoteVerifierIssuer !== issuer) {
    const jwks = createRemoteJWKSet(new URL(`${issuer.replace(/\/$/, '')}/.well-known/jwks.json`));
    remoteVerifier = createTokenVerifier(jwks, issuer);
    remoteVerifierIssuer = issuer;
  }
  return remoteVerifier;
}

function extractBearer(req: Request): string | null {
  const raw = req.headers.authorization;
  if (typeof raw !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match ? match[1] : null;
}

function azpAllowed(payload: JWTPayload, authorizedParties: string[]): boolean {
  if (authorizedParties.length === 0) return true;
  const azp = payload.azp;
  return typeof azp !== 'string' || authorizedParties.includes(azp);
}

export interface VerifiedIdentityOptions {
  /** Override the token verifier (tests inject a local-key verifier). */
  verifier?: TokenVerifier;
}

export function createVerifiedIdentityMiddleware(options: VerifiedIdentityOptions = {}) {
  return async function verifiedIdentity(req: Request, res: Response, next: NextFunction): Promise<void> {
    const mode = env().CLERK_JWT_VERIFICATION;
    if (mode === 'off') return next();

    const issuer = env().CLERK_ISSUER;
    if (!issuer && !options.verifier) {
      // envValidation fails the boot for enforce-without-issuer; shadow logs
      // loudly here (sampled) rather than crashing an observability feature.
      if (shouldLogSampled('invalid_token')) {
        log('error', 'jwt_auth_misconfigured', { mode, missing: 'CLERK_ISSUER' });
      }
      return next();
    }

    const headerUserId =
      typeof req.headers['x-clerk-user-id'] === 'string' ? (req.headers['x-clerk-user-id'] as string) : undefined;
    const token = extractBearer(req);

    let auth: VerifiedAuth;
    if (!token) {
      auth = { outcome: headerUserId ? 'header_without_token' : 'anonymous' };
    } else {
      try {
        const verify = options.verifier ?? getRemoteVerifier(issuer as string);
        const payload = await verify(token);
        const authorizedParties = env().CLERK_AUTHORIZED_PARTIES;
        if (!azpAllowed(payload, authorizedParties)) {
          auth = { outcome: 'invalid_token', reason: `azp_not_allowed:${String(payload.azp)}` };
        } else if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
          auth = { outcome: 'invalid_token', reason: 'missing_sub' };
        } else if (!headerUserId) {
          auth = { outcome: 'token_only', verifiedUserId: payload.sub };
        } else if (payload.sub === headerUserId) {
          auth = { outcome: 'verified_match', verifiedUserId: payload.sub };
        } else {
          auth = { outcome: 'verified_mismatch', verifiedUserId: payload.sub };
        }
      } catch (err) {
        auth = { outcome: 'invalid_token', reason: err instanceof Error ? err.name : 'unknown' };
      }
    }

    (req as any).verifiedAuth = auth;

    const logPayload = {
      outcome: auth.outcome,
      mode,
      path: req.path,
      method: req.method,
      hasHeaderIdentity: Boolean(headerUserId),
      ...(auth.reason ? { reason: auth.reason } : {}),
    };

    if (auth.outcome === 'verified_mismatch' || auth.outcome === 'invalid_token') {
      // Forgery signals: always log, never sample.
      log('warn', 'jwt_auth_verification', logPayload);
    } else if (shouldLogSampled(auth.outcome)) {
      log('info', 'jwt_auth_verification', logPayload);
    }

    if (mode === 'shadow') return next();

    // --- enforce ---
    if (auth.verifiedUserId) {
      // Propagate verified identity to every downstream header reader.
      req.headers['x-clerk-user-id'] = auth.verifiedUserId;
      return next();
    }
    if (headerUserId) {
      // Identity claimed but not proven — fail closed.
      log('warn', 'jwt_auth_enforce_rejected', logPayload);
      res.status(401).json({ error: 'unauthorized', detail: 'identity_header_requires_verified_session_token' });
      return;
    }
    // Anonymous: allowed through, but an unverified request must not carry
    // role-bypass headers (closes the x-user-role: super-admin tenant bypass).
    for (const header of ROLE_BYPASS_HEADERS) {
      if (header in req.headers) delete req.headers[header];
    }
    return next();
  };
}

/** Production middleware — remote Clerk JWKS. */
export const verifiedIdentityMiddleware = createVerifiedIdentityMiddleware();
