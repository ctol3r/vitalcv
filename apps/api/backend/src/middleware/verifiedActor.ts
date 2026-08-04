/**
 * Verified actor helpers — Wave 1072C / C1.
 *
 * The rule these enforce: **a browser may not assert the identity that
 * authorizes a share or a revocation.** Identity comes from the Clerk session
 * JWT that `verifiedIdentityMiddleware` has already verified against the
 * remote JWKS; the `x-clerk-user-id` header is never consulted here, so a
 * forged header cannot reach any caller of these functions.
 *
 * `requireVerifiedClerkUserId` was previously copy-pasted into three route
 * files (applications, activation, capacity). It lives here now so a fourth
 * copy is never written, and so the NPI-binding rule below sits beside it.
 *
 * Biometric confirmation is deliberately NOT part of this contract: it
 * confirms INTENT after identity has been established, and can never stand in
 * for authentication.
 */

import type { Request } from 'express';

import { HttpError } from '../utils/httpError';
import { log } from '../obs/logger';
import type { VerifiedAuth } from './verifiedIdentity';
import prisma from '../graphql/prisma_client';

/**
 * Record a denied access so the refusal is auditable.
 *
 * Deliberately NOT logged: the NPI, the clinician's name, the response that
 * would have been served, or any credential/blocker detail. A denial log that
 * carries the private payload recreates the exposure it exists to police, and
 * an NPI-keyed denial stream is itself an enumeration record. What is kept is
 * the shape of the refusal — where, why, and whether a session existed at all
 * — which is what an operator needs to spot probing.
 */
function auditDenial(
  req: Request,
  reason: 'no_verified_session' | 'npi_not_bound' | 'malformed_npi',
): void {
  log('warn', 'authz_denied', {
    reason,
    // `req.route?.path` is the PATTERN ("/api/apply/shares/:npi"), never the
    // populated URL, so no NPI reaches the log line.
    route: (req as Request & { route?: { path?: string } }).route?.path ?? 'unknown',
    method: req.method,
    hadVerifiedSession: Boolean(
      (req as Request & { verifiedAuth?: VerifiedAuth }).verifiedAuth?.verifiedUserId,
    ),
    // The presence of a forgeable header on a denied request is the signal
    // worth keeping; its VALUE is attacker-controlled and is not recorded.
    presentedIdentityHeader: Boolean(req.headers['x-clerk-user-id']),
  });
}

/**
 * The cryptographically verified Clerk user id, or 401.
 *
 * `verifiedAuth.verifiedUserId` is set only when a bearer token actually
 * verified, in every rollout mode — so this fails closed even while
 * CLERK_JWT_VERIFICATION is 'off' or 'shadow'. That is the intent: routes
 * that authorize disclosure must not degrade to header trust.
 */
export function requireVerifiedClerkUserId(req: Request): string {
  const verifiedUserId = (req as Request & { verifiedAuth?: VerifiedAuth })
    .verifiedAuth?.verifiedUserId?.trim();
  if (!verifiedUserId) {
    auditDenial(req, 'no_verified_session');
    throw new HttpError(401, 'Verified Clerk session required.');
  }
  return verifiedUserId;
}

/**
 * Assert that the verified user may act for this NPI.
 *
 * Authorized when an unrevoked `NpiOwnership` row binds the two. A share
 * discloses a clinician's compiled evidence, so "signed in" is not
 * sufficient — the caller must be the clinician (or hold an explicitly
 * granted binding).
 *
 * 403, not 404: the caller is authenticated and the NPI is public, so there
 * is nothing to conceal by pretending the record is absent.
 */
export async function requireNpiAuthorization(
  userId: string,
  npi: string,
  req?: Request,
): Promise<void> {
  const digits = (npi ?? '').trim();
  if (!/^\d{10}$/.test(digits)) {
    if (req) auditDenial(req, 'malformed_npi');
    throw new HttpError(400, 'NPI must be exactly 10 digits.');
  }

  const binding = await prisma.npiOwnership.findFirst({
    where: { userId, npi: digits, revokedAt: null },
    select: { id: true },
  });

  if (!binding) {
    if (req) auditDenial(req, 'npi_not_bound');
    throw new HttpError(
      403,
      'This NPI is not linked to your account. Claim it before sharing its record.',
    );
  }
}
