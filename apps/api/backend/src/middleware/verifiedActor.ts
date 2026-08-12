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
import {
  authorizesPrivateAccess,
  blockedReason,
  ownershipState,
} from '../services/ownership/npiOwnershipState';
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
 *
 * An earlier version also recorded whether an `x-clerk-user-id` header was
 * PRESENT (never its value). The header-trust ratchet flags any backend file
 * that reads that header, and it cannot distinguish "derives identity from
 * this" from "counts it". Baselining an exception here would weaken the one
 * gate that polices the exact defect this hotfix closes, so the signal is
 * dropped rather than the rule bent.
 */
function auditDenial(
  req: Request,
  reason: 'no_verified_session' | 'npi_not_bound' | 'ownership_pending' | 'malformed_npi',
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
 * Map a Clerk subject to the internal `User.id`.
 *
 * These two identifiers are not interchangeable and are easy to confuse:
 * `clerkUserId` looks like `user_2abc…`; `internalUserId` is a UUID. Every
 * table that scopes data to a person stores the INTERNAL id.
 *
 * Exported so callers resolve the boundary once, explicitly, instead of doing
 * it inline — doing it inline is how the two got mixed up.
 */
export async function resolveInternalUserId(clerkUserId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  return user?.id ?? null;
}

/**
 * Every NPI the verified user may act for — the server-side answer to "who is
 * this?", used where the caller must not be allowed to name the subject at all.
 *
 * `requireNpiAuthorization` answers a *closed* question ("may you act for this
 * NPI you named?"). Some routes need the *open* one ("which NPIs are yours?"),
 * because accepting a subject identifier from the request is itself the defect
 * — see #948, where `?npi=` selected the rows and NPIs are public NPPES
 * identifiers, so the history was enumerable rather than merely guessable.
 *
 * Same authority rule as the closed form and for the same reason: only
 * VERIFIED and DELEGATED bindings count. A `CLAIMED` row is a request someone
 * made about themselves, and treating it as authority is exactly how PR #1074
 * let any signed-in user read a stranger's record.
 *
 * Returns `[]` for a user with no account row or no qualifying binding. An
 * empty set is a real answer — "you may act for nobody" — and callers must
 * render it as an empty result, never as unscoped access.
 */
export async function resolveAuthorizedNpis(clerkUserId: string): Promise<string[]> {
  const internalUserId = await resolveInternalUserId(clerkUserId);
  if (!internalUserId) return [];

  // Revoked rows are fetched rather than filtered in SQL so `ownershipState`
  // stays the single place that decides what a row means. A `revokedAt` filter
  // here would be a second, silently diverging copy of that rule.
  const bindings = await prisma.npiOwnership.findMany({
    where: { userId: internalUserId },
    select: { npi: true, verifiedAt: true, verificationMethod: true, revokedAt: true },
  });

  const authorized = new Set<string>();
  for (const binding of bindings) {
    if (authorizesPrivateAccess(ownershipState(binding))) authorized.add(binding.npi);
  }
  return [...authorized];
}

/**
 * Assert that the verified user may act for this NPI.
 *
 * A share discloses a clinician's compiled evidence, so "signed in" is not
 * sufficient — and neither is "asked to be". Only a VERIFIED or DELEGATED
 * binding authorizes. A pending self-asserted claim (`CLAIMED`, no
 * `verifiedAt`) is a request, and PR #1074 treated it as authority: any
 * signed-in user could claim a stranger's NPI and read their private record.
 *
 * 403, not 404: the caller is authenticated and the NPI is public, so there
 * is nothing to conceal by pretending the record is absent. The message names
 * the state so the surface can route the clinician into verification rather
 * than guessing why it was refused.
 */
export async function requireNpiAuthorization(
  clerkUserId: string,
  npi: string,
  req?: Request,
): Promise<void> {
  const digits = (npi ?? '').trim();
  if (!/^\d{10}$/.test(digits)) {
    if (req) auditDenial(req, 'malformed_npi');
    throw new HttpError(400, 'NPI must be exactly 10 digits.');
  }

  /*
   * `npi_ownership.user_id` is a UUID column holding the INTERNAL `User.id` —
   * that is what routes/ownership.ts writes. Every caller of this function
   * passes the CLERK subject, so the query sent `user_2abc…` at a uuid column
   * and Postgres rejected it at the type comparison, BEFORE it could determine
   * whether any row existed. The result was a 500 on an authenticated request
   * instead of a 403, and a genuinely verified binding that could never match.
   *
   * Resolve the boundary explicitly. Never coerce or cast a Clerk id into a
   * UUID: a Clerk subject is not a malformed UUID, it is a different
   * identifier for the same person, and the mapping lives in the `User` table.
   */
  const internalUserId = await resolveInternalUserId(clerkUserId);
  if (!internalUserId) {
    // No VitalCV account row yet, so nothing can be bound to them. A 403 with
    // the ordinary "not linked" message — not a 404 that would leak whether an
    // account exists, and emphatically not a 500.
    if (req) auditDenial(req, 'npi_not_bound');
    throw new HttpError(403, blockedReason(null), 'OWNERSHIP_REQUIRED');
  }

  // Revoked rows are read too, so a revoked binding is reported as revoked
  // rather than as "never linked".
  const binding = await prisma.npiOwnership.findFirst({
    where: { userId: internalUserId, npi: digits },
    select: { verifiedAt: true, verificationMethod: true, revokedAt: true },
    orderBy: { claimedAt: 'desc' },
  });

  const state = ownershipState(binding);
  if (!authorizesPrivateAccess(state)) {
    if (req) auditDenial(req, state === 'pending' ? 'ownership_pending' : 'npi_not_bound');
    // A stable code so the Apply surface can route a PENDING clinician into
    // verification instead of showing a generic refusal.
    throw new HttpError(
      403,
      blockedReason(state),
      state === 'pending' ? 'OWNERSHIP_PENDING' : 'OWNERSHIP_REQUIRED',
    );
  }
}
