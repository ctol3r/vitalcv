/**
 * ownership.ts — NPI ownership claims and verification.
 *
 * POST   /api/ownership/claim        — REQUEST an NPI association (pending)
 * GET    /api/ownership/me           — the caller's associations and states
 * GET    /api/ownership/state/:npi   — the caller's state for one NPI
 * POST   /api/ownership/verify       — administrator accepts a pending claim
 * DELETE /api/ownership/:npi         — revoke an association
 *
 * Wave 1075. Two things changed, both load-bearing:
 *
 * 1. Identity comes from the VERIFIED Clerk session, not the browser-settable
 *    `x-clerk-user-id` header this file used to read.
 * 2. A claim is a REQUEST, not a grant. It is written pending and authorizes
 *    nothing until someone with authority verifies it. Previously a signed-in
 *    user could submit any ten-digit number and immediately hold the binding
 *    that PR #1074 uses to release private clinician data.
 *
 * No automated ownership proof is invented here. Until a real proof path
 * exists, verification is an explicit administrative action, and the clinician
 * is told plainly: identity verification required before private sharing is
 * enabled.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { HttpError } from '../utils/httpError';
import { log } from '../obs/logger';
import { requireVerifiedClerkUserId } from '../middleware/verifiedActor';
import { fetchNpiFromCMS } from '../modules/identity/nppes.service';
import {
  DELEGATED_METHOD,
  PENDING_METHOD,
  ownershipState,
  type NpiOwnershipState,
} from '../services/ownership/npiOwnershipState';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function isValidNpi(npi: string): boolean {
  return /^\d{10}$/.test(npi);
}

/** The roles permitted to accept a claim. Absent role => refused. */
const VERIFIER_ROLES = new Set(['admin', 'platform_admin', 'compliance']);

/**
 * The verifying administrator, or 403.
 *
 * Role is read from the VERIFIED session claims, never from a header — the
 * same rule as identity itself. `x-user-role` was forgeable in exactly the way
 * `x-clerk-user-id` was.
 */
function requireVerifierRole(req: Request): string {
  const actorId = requireVerifiedClerkUserId(req);
  const claims = (
    req as Request & { verifiedAuth?: { claims?: { role?: unknown; org_role?: unknown } } }
  ).verifiedAuth?.claims;
  const role = String(claims?.role ?? claims?.org_role ?? '').trim().toLowerCase();

  if (!VERIFIER_ROLES.has(role)) {
    log('warn', 'ownership_verify_denied', {
      reason: 'insufficient_role',
      route: '/api/ownership/verify',
    });
    throw new HttpError(403, 'Verifying an NPI claim requires an administrator role.');
  }
  return actorId;
}

/** Resolve the internal user for a verified Clerk subject. */
async function requireUser(clerkUserId: string): Promise<{ id: string }> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) throw new HttpError(404, 'User not found. Complete onboarding first.');
  return user;
}

/**
 * A clinician identity can only be an individual provider.
 *
 * NPPES `enumeration_type` is `NPI-1` for individuals and `NPI-2` for
 * organizations. Claiming a Type 2 as a personal identity is a category error,
 * not a permissions question, so it is refused before anything is written.
 *
 * A registry outage must not become an accidental grant: an unreadable
 * registry refuses the claim rather than defaulting it to individual.
 */
async function assertIndividualNpi(npi: string): Promise<void> {
  let result: Awaited<ReturnType<typeof fetchNpiFromCMS>>;
  try {
    result = await fetchNpiFromCMS(npi);
  } catch {
    throw new HttpError(503, 'The NPI registry could not be reached. Try again shortly.');
  }

  const record = (result?.rawPayload?.results ?? [])[0] as
    | { enumeration_type?: string }
    | undefined;
  if (!record) {
    throw new HttpError(404, 'That NPI was not found in the NPPES registry.');
  }
  if (String(record.enumeration_type ?? '').toUpperCase() === 'NPI-2') {
    throw new HttpError(
      400,
      'That NPI identifies an organization. A clinician profile needs an individual (Type 1) NPI.',
    );
  }
}

interface OwnershipRow {
  npi: string;
  claimedAt: Date;
  verifiedAt: Date | null;
  verificationMethod: string | null;
  revokedAt: Date | null;
}

interface OwnershipView {
  npi: string;
  state: NpiOwnershipState;
  claimedAt: Date;
  verifiedAt: Date | null;
  /** Present when the state cannot reach private information. */
  nextStep?: string;
}

const PENDING_NEXT_STEP = 'Identity verification required before private sharing is enabled.';

const OWNERSHIP_SELECT = {
  npi: true,
  claimedAt: true,
  verifiedAt: true,
  verificationMethod: true,
  revokedAt: true,
} as const;

function toView(row: OwnershipRow): OwnershipView {
  const state = ownershipState(row) ?? 'pending';
  return {
    npi: row.npi,
    state,
    claimedAt: row.claimedAt,
    verifiedAt: row.verifiedAt,
    ...(state === 'pending' ? { nextStep: PENDING_NEXT_STEP } : {}),
  };
}

export function registerOwnershipRoutes(app: Express): void {
  /**
   * POST /api/ownership/claim
   * Body: { npi: string }
   *
   * Creates or returns a PENDING claim. 202, not 201: the association was
   * accepted for review, and nothing was granted.
   */
  app.post(
    '/api/ownership/claim',
    asyncHandler(async (req: Request, res: Response) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const { npi } = req.body as { npi?: string };

      if (!npi || !isValidNpi(npi)) {
        throw new HttpError(400, 'npi must be a 10-digit string.');
      }

      const user = await requireUser(clerkUserId);
      await assertIndividualNpi(npi);

      const existing = (await prisma.npiOwnership.findUnique({
        where: { userId_npi: { userId: user.id, npi } },
        select: OWNERSHIP_SELECT,
      })) as OwnershipRow | null;

      // An already-verified association is returned untouched — re-claiming
      // must never reset a verified row back to pending, and must never be a
      // path to re-verifying one.
      if (existing && ownershipState(existing) === 'verified') {
        res.status(200).json({ ownership: toView(existing) });
        return;
      }

      const row = (await prisma.npiOwnership.upsert({
        where: { userId_npi: { userId: user.id, npi } },
        create: { userId: user.id, npi, verificationMethod: PENDING_METHOD },
        // Re-claiming a revoked or pending row reopens it as PENDING. It
        // explicitly does NOT set verifiedAt.
        update: { revokedAt: null, verifiedAt: null, verificationMethod: PENDING_METHOD },
        select: OWNERSHIP_SELECT,
      })) as OwnershipRow;

      log('info', 'ownership_claim_submitted', { state: 'pending' });
      res.status(202).json({ ownership: toView(row) });
    }),
  );

  /**
   * GET /api/ownership/me
   * Every association for the caller, with its honest state.
   */
  app.get(
    '/api/ownership/me',
    asyncHandler(async (req: Request, res: Response) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const user = await requireUser(clerkUserId);

      const rows = (await prisma.npiOwnership.findMany({
        where: { userId: user.id },
        orderBy: { claimedAt: 'desc' },
        select: OWNERSHIP_SELECT,
      })) as OwnershipRow[];

      res.json({ ownerships: rows.map(toView) });
    }),
  );

  /**
   * GET /api/ownership/state/:npi
   * The single state the Apply surface needs to decide what to render.
   */
  app.get(
    '/api/ownership/state/:npi',
    asyncHandler(async (req: Request, res: Response) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const { npi } = req.params as { npi: string };
      if (!isValidNpi(npi)) throw new HttpError(400, 'Invalid NPI format.');

      const user = await requireUser(clerkUserId);
      const row = (await prisma.npiOwnership.findUnique({
        where: { userId_npi: { userId: user.id, npi } },
        select: OWNERSHIP_SELECT,
      })) as OwnershipRow | null;

      if (!row) {
        res.json({ npi, state: 'none', nextStep: PENDING_NEXT_STEP });
        return;
      }
      res.json(toView(row));
    }),
  );

  /**
   * POST /api/ownership/verify
   * Body: { npi: string, userId: string, method?: 'ADMIN_VERIFIED' | 'DELEGATED' }
   *
   * The narrowly scoped administrative path. This exists because no secure
   * automated proof path exists yet; it is deliberately an explicit human
   * action rather than an inferred one.
   */
  app.post(
    '/api/ownership/verify',
    asyncHandler(async (req: Request, res: Response) => {
      const actorId = requireVerifierRole(req);
      const { npi, userId, method } = req.body as {
        npi?: string;
        userId?: string;
        method?: string;
      };

      if (!npi || !isValidNpi(npi)) throw new HttpError(400, 'npi must be a 10-digit string.');
      if (!userId) throw new HttpError(400, 'userId is required.');

      const resolvedMethod = method === DELEGATED_METHOD ? DELEGATED_METHOD : 'ADMIN_VERIFIED';

      const existing = await prisma.npiOwnership.findUnique({
        where: { userId_npi: { userId, npi } },
        select: { revokedAt: true },
      });
      if (!existing) throw new HttpError(404, 'No claim exists for that user and NPI.');
      if (existing.revokedAt) {
        throw new HttpError(409, 'That association was revoked. It must be re-claimed first.');
      }

      const row = (await prisma.npiOwnership.update({
        where: { userId_npi: { userId, npi } },
        data: { verifiedAt: new Date(), verificationMethod: resolvedMethod },
        select: OWNERSHIP_SELECT,
      })) as OwnershipRow;

      /*
       * Auditable without the payload: who acted, what changed, which method.
       * No clinician name and no credential detail — and no NPI, because the
       * pairing of an administrator with an NPI in a log line is itself a
       * disclosure about that clinician.
       */
      log('info', 'ownership_verified', {
        actorId,
        method: resolvedMethod,
        subjectUserId: userId,
        previousState: 'pending',
        newState: ownershipState(row),
      });

      res.json({ ownership: toView(row) });
    }),
  );

  /**
   * DELETE /api/ownership/:npi
   * Soft-revokes the caller's own association.
   */
  app.delete(
    '/api/ownership/:npi',
    asyncHandler(async (req: Request, res: Response) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const { npi } = req.params as { npi: string };

      if (!isValidNpi(npi)) throw new HttpError(400, 'Invalid NPI format.');

      const user = await requireUser(clerkUserId);
      const updated = await prisma.npiOwnership.updateMany({
        where: { userId: user.id, npi, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (updated.count === 0) {
        throw new HttpError(404, 'Ownership record not found or already revoked.');
      }

      log('info', 'ownership_revoked', { byOwner: true });
      res.json({ revoked: true, npi });
    }),
  );
}
