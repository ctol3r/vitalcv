/**
 * ownership.ts — NPI Ownership Claims
 *
 * POST /api/ownership/claim   — claim an NPI for the authenticated user
 * GET  /api/ownership/me      — list caller's NPI ownerships
 * DELETE /api/ownership/:npi  — revoke an NPI claim
 *
 * Auth: x-clerk-user-id header (forwarded by Next.js proxy)
 */

import type { Express, NextFunction, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { HttpError } from '../utils/httpError';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function requireClerkUserId(req: Request): string {
  const raw = req.headers['x-clerk-user-id'];
  const id = typeof raw === 'string' ? raw.trim() : (Array.isArray(raw) ? raw[0]?.trim() : undefined);
  if (!id) throw new HttpError(401, 'Missing x-clerk-user-id header.');
  return id;
}

function isValidNpi(npi: string): boolean {
  return /^\d{10}$/.test(npi);
}

export function registerOwnershipRoutes(app: Express): void {
  /**
   * POST /api/ownership/claim
   * Body: { npi: string }
   * Creates or returns an existing NpiOwnership record.
   */
  app.post(
    '/api/ownership/claim',
    asyncHandler(async (req: Request, res: Response) => {
      const clerkUserId = requireClerkUserId(req);
      const { npi } = req.body as { npi?: string };

      if (!npi || !isValidNpi(npi)) {
        throw new HttpError(400, 'npi must be a 10-digit string.');
      }

      // Resolve internal user id from clerkUserId
      const user = await prisma.user.findUnique({ where: { clerkUserId } });
      if (!user) throw new HttpError(404, 'User not found. Complete onboarding first.');

      // Upsert ownership — idempotent
      const ownership = await prisma.npiOwnership.upsert({
        where: { userId_npi: { userId: user.id, npi } },
        create: { userId: user.id, npi, verificationMethod: 'CLAIMED' },
        update: { revokedAt: null }, // re-activate if previously revoked
      });

      res.status(201).json({ ownership });
    }),
  );

  /**
   * GET /api/ownership/me
   * Returns all NPI ownerships for the authenticated user.
   */
  app.get(
    '/api/ownership/me',
    asyncHandler(async (req: Request, res: Response) => {
      const clerkUserId = requireClerkUserId(req);

      const user = await prisma.user.findUnique({ where: { clerkUserId } });
      if (!user) throw new HttpError(404, 'User not found.');

      const ownerships = await prisma.npiOwnership.findMany({
        where: { userId: user.id, revokedAt: null },
        orderBy: { claimedAt: 'desc' },
      });

      res.json({ ownerships });
    }),
  );

  /**
   * DELETE /api/ownership/:npi
   * Soft-revokes the NPI claim by setting revokedAt.
   */
  app.delete(
    '/api/ownership/:npi',
    asyncHandler(async (req: Request, res: Response) => {
      const clerkUserId = requireClerkUserId(req);
      const { npi } = req.params as { npi: string };

      if (!isValidNpi(npi)) throw new HttpError(400, 'Invalid NPI format.');

      const user = await prisma.user.findUnique({ where: { clerkUserId } });
      if (!user) throw new HttpError(404, 'User not found.');

      const updated = await prisma.npiOwnership.updateMany({
        where: { userId: user.id, npi, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (updated.count === 0) throw new HttpError(404, 'Ownership record not found or already revoked.');

      res.json({ revoked: true, npi });
    }),
  );
}
