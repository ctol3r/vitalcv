import { ActivePersona } from '@prisma/client';
import type { Express, NextFunction, Request, Response } from 'express';
import {
  bootstrapFromNpi,
  ensureWorkspaceUser,
  getWorkspacesForUser,
  switchWorkspace,
} from '../services/workspace/workspaceService';
import { HttpError } from '../utils/httpError';

const NPI_RE = /^\d{10}$/;

type SwitchWorkspaceBody = {
  persona?: ActivePersona;
  orgId?: string;
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
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }

  return undefined;
}

function requireClerkUserId(req: Request): string {
  const clerkUserId = getHeaderValue(req.headers['x-clerk-user-id'])?.trim();
  if (!clerkUserId) {
    throw new HttpError(401, 'Missing x-clerk-user-id header.');
  }
  return clerkUserId;
}

export function registerWorkspaceRoutes(app: Express): void {
  app.get(
    '/api/me/workspaces',
    asyncHandler(async (req: Request, res: Response) => {
      const clerkUserId = requireClerkUserId(req);
      const clerkEmail = getHeaderValue(req.headers['x-clerk-user-email']);

      await ensureWorkspaceUser(clerkUserId, clerkEmail);
      const workspaces = await getWorkspacesForUser(clerkUserId);
      res.json(workspaces);
    }),
  );

  app.post(
    '/api/workspaces/switch',
    asyncHandler(async (req: Request, res: Response) => {
      const clerkUserId = requireClerkUserId(req);
      const clerkEmail = getHeaderValue(req.headers['x-clerk-user-email']);
      const body = (req.body ?? {}) as SwitchWorkspaceBody;

      if (!body.persona || !Object.values(ActivePersona).includes(body.persona)) {
        throw new HttpError(400, 'persona must be one of CLINICIAN, VERIFIER, or BOTH.');
      }

      await ensureWorkspaceUser(clerkUserId, clerkEmail);
      const preference = await switchWorkspace(clerkUserId, body.persona, body.orgId);
      res.json(preference);
    }),
  );

  app.get(
    '/api/identity/bootstrap/:npi',
    asyncHandler(async (req: Request, res: Response) => {
      const npi = req.params.npi?.trim();

      if (!npi || !NPI_RE.test(npi)) {
        throw new HttpError(400, 'NPI must be exactly 10 digits.');
      }

      const result = await bootstrapFromNpi(npi);
      res.json(result);
    }),
  );
}
