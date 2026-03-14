import type { Express, NextFunction, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { refreshTrustState } from '../services/trust/trustStateEngine';
import {
  bootstrapFromNpi,
  ensureWorkspaceUser,
} from '../services/workspace/workspaceService';
import { HttpError } from '../utils/httpError';

const NPI_RE = /^\d{10}$/;

type ActivateClinicianBody = {
  npi?: string;
};

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0]?.trim();
  }

  return undefined;
}

function requireClerkUserId(req: Request): string {
  const clerkUserId = getHeaderValue(req.headers['x-clerk-user-id']);
  if (!clerkUserId) {
    throw new HttpError(401, 'Missing x-clerk-user-id header.');
  }
  return clerkUserId;
}

export function registerClinicianRoutes(app: Express): void {
  app.post(
    '/api/clinician/activate',
    asyncHandler(async (req: Request, res: Response) => {
      const clerkUserId = requireClerkUserId(req);
      const clerkEmail = getHeaderValue(req.headers['x-clerk-user-email']);
      const { npi } = (req.body ?? {}) as ActivateClinicianBody;

      if (!npi || !NPI_RE.test(npi)) {
        throw new HttpError(400, 'npi must be exactly 10 digits.');
      }

      const user = await ensureWorkspaceUser(clerkUserId, clerkEmail);

      const conflictingProfile = await prisma.personProfile.findUnique({
        where: { npi },
      });
      if (conflictingProfile && conflictingProfile.userId !== user.id) {
        throw new HttpError(409, `NPI ${npi} is already registered to another account.`);
      }

      const existingProfile = await prisma.personProfile.findUnique({
        where: { userId: user.id },
      });

      const bootstrap = await bootstrapFromNpi(npi);
      if (bootstrap.npiType !== 'TYPE_1') {
        throw new HttpError(400, 'Only individual Type 1 NPIs can activate a clinician profile.');
      }

      const completeness = Math.max(existingProfile?.completeness ?? 0, 30);
      await prisma.personProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          npi,
          npiType: 'TYPE_1',
          completeness,
          ...(bootstrap.firstName ? { firstName: bootstrap.firstName } : {}),
          ...(bootstrap.lastName ? { lastName: bootstrap.lastName } : {}),
          ...(bootstrap.specialty ? { specialty: bootstrap.specialty } : {}),
          ...(bootstrap.state ? { stateOfPractice: bootstrap.state } : {}),
        },
        update: {
          npi,
          npiType: 'TYPE_1',
          completeness,
          updatedAt: new Date(),
          ...(bootstrap.firstName ? { firstName: bootstrap.firstName } : {}),
          ...(bootstrap.lastName ? { lastName: bootstrap.lastName } : {}),
          ...(bootstrap.specialty ? { specialty: bootstrap.specialty } : {}),
          ...(bootstrap.state ? { stateOfPractice: bootstrap.state } : {}),
        },
      });

      const trustState = await refreshTrustState(npi);
      const response = {
        readinessScore: trustState.readiness_score,
        readinessLevel: trustState.readiness_level,
        readinessStatus: trustState.readiness_status,
      };

      log('info', 'clinician_activated', {
        userId: user.id,
        clerkUserId,
        npi,
        readinessLevel: response.readinessLevel,
        readinessScore: response.readinessScore,
      });

      res.status(200).json(response);
    }),
  );
}
