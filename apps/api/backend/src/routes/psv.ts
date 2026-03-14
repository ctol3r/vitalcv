import type { Express, NextFunction, Request, Response } from 'express';
import { proofRateLimit } from '../middleware/rateLimitFactory';
import {
  createDefaultOrchestrator,
  type PsvVerifyRequest,
} from '../services/psv/PsvOrchestrator';
import { getPsvCacheInstance } from '../services/psv/PsvVerificationCache';
import type { CredentialType } from '../../types/psv';
import { HttpError } from '../utils/httpError';

const VALID_CREDENTIAL_TYPES: CredentialType[] = [
  'License',
  'BoardCertification',
  'DEA',
  'Registration',
  'CompactPrivilege',
  'Other',
];
const NPI_RE = /^\d{10}$/;
const orchestrator = createDefaultOrchestrator();
const cache = getPsvCacheInstance();

type VerifyBody = {
  npi?: unknown;
  credential_type?: unknown;
  state?: unknown;
  license_number?: unknown;
  bypass_cache?: unknown;
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

function isCredentialType(value: unknown): value is CredentialType {
  return (
    typeof value === 'string' &&
    VALID_CREDENTIAL_TYPES.includes(value as CredentialType)
  );
}

function parseVerifyRequest(body: VerifyBody): PsvVerifyRequest {
  const npi = typeof body.npi === 'string' ? body.npi.trim() : '';
  if (!NPI_RE.test(npi)) {
    throw new HttpError(400, 'npi must be exactly 10 digits.');
  }

  if (
    body.credential_type !== undefined &&
    !isCredentialType(body.credential_type)
  ) {
    throw new HttpError(400, 'credential_type is invalid.');
  }

  const state =
    typeof body.state === 'string' && body.state.trim().length > 0
      ? body.state.trim().toUpperCase()
      : undefined;
  const licenseNumber =
    typeof body.license_number === 'string' && body.license_number.trim().length > 0
      ? body.license_number.trim()
      : undefined;

  return {
    npi,
    credentialType: body.credential_type,
    state,
    licenseNumber,
    bypassCache: body.bypass_cache === true,
  };
}

export function registerPsvRoutes(app: Express): void {
  app.post(
    '/api/psv/verify',
    proofRateLimit,
    asyncHandler(async (req: Request, res: Response) => {
      requireClerkUserId(req);
      const request = parseVerifyRequest((req.body ?? {}) as VerifyBody);
      const response = await orchestrator.verify(request);
      res.status(200).json(response);
    }),
  );

  app.get(
    '/api/psv/cache/stats',
    asyncHandler(async (req: Request, res: Response) => {
      requireClerkUserId(req);
      res.status(200).json(cache.stats());
    }),
  );

  app.delete(
    '/api/psv/cache/:npi',
    asyncHandler(async (req: Request, res: Response) => {
      requireClerkUserId(req);
      const npi = req.params.npi?.trim() ?? '';
      if (!NPI_RE.test(npi)) {
        throw new HttpError(400, 'npi must be exactly 10 digits.');
      }

      const removed = cache.invalidate(npi);
      res.status(200).json({ ok: true, npi, removed });
    }),
  );
}
