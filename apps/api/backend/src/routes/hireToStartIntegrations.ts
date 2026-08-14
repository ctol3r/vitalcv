import type { Express, NextFunction, Request, Response } from 'express';

import { HttpError } from '../utils/httpError';
import { receiveHireToStartIntegrationEvent } from '../services/integrations/hireToStartIntegrationService';
import { importGenericHireToStartRoles } from '../services/integrations/hireToStartRoleImportService';
import { requireOrgRole, VERIFIER_MUTATION_ROLES } from '../middleware/orgRoleGuard';
import type { VerifiedAuth } from '../middleware/verifiedIdentity';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function requireHeader(req: Request, name: string): string {
  const value = req.get(name)?.trim();
  if (!value) throw new HttpError(401, 'Invalid integration signature.');
  return value;
}

function requireVerifiedClerkUserId(req: Request): string {
  const id = (req as Request & { verifiedAuth?: VerifiedAuth }).verifiedAuth?.verifiedUserId?.trim();
  if (!id) throw new HttpError(401, 'Verified Clerk session required.');
  return id;
}

export function registerHireToStartIntegrationRoutes(app: Express): void {
  app.post(
    '/api/integrations/hire-to-start/roles/import',
    requireOrgRole(VERIFIER_MUTATION_ROLES),
    asyncHandler(async (req, res) => {
      res.setHeader('Cache-Control', 'private, no-store');
      const clerkUserId = requireVerifiedClerkUserId(req);
      const result = await importGenericHireToStartRoles(clerkUserId, req.body);
      res.status(200).json(result);
    }),
  );

  app.post(
    '/api/integrations/hire-to-start/events',
    asyncHandler(async (req, res) => {
      res.setHeader('Cache-Control', 'private, no-store');
      const result = await receiveHireToStartIntegrationEvent(req.body, {
        keyId: requireHeader(req, 'x-vitalcv-key-id'),
        timestamp: requireHeader(req, 'x-vitalcv-timestamp'),
        signature: requireHeader(req, 'x-vitalcv-signature'),
      });
      res.status(result.duplicate ? 200 : 202).json(result);
    }),
  );
}
