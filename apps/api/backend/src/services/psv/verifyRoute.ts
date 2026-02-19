/**
 * Phase 1G — POST /verify route.
 *
 * Accepts { npi } (and optional state, licenseNumber, providerType, credentialType),
 * selects the appropriate adapter, runs verification, builds a signed PSV artifact,
 * and returns it.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import { buildPsvArtifact } from './psvArtifactBuilder';
import { getJwksDocument } from './signingService';
import { HttpError } from '../../utils/httpError';
import { log } from '../../obs/logger';

// Import adapter infrastructure — these live outside src/ so we use relative paths.
import { AdapterRegistry } from '../../../adapters/AdapterRegistry';
import { NppesAdapter } from '../../../adapters/NppesAdapter';
import type { ProviderType, CredentialType } from '../../../types/psv';

// ── Bootstrap adapter registry ───────────────────────────────

const registry = new AdapterRegistry();
registry.register(NppesAdapter);

// ── Async handler wrapper ────────────────────────────────────

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// ── POST /verify handler ─────────────────────────────────────

async function handleVerify(req: Request, res: Response): Promise<void> {
  const { npi, state, licenseNumber, providerType, credentialType } = req.body as {
    npi?: string;
    state?: string;
    licenseNumber?: string;
    providerType?: ProviderType;
    credentialType?: CredentialType;
  };

  if (!npi || typeof npi !== 'string' || !/^\d{10}$/.test(npi)) {
    throw new HttpError(400, 'A valid 10-digit NPI is required');
  }

  // Default to the broadest adapter match
  const pType: ProviderType = providerType ?? 'Other';
  const cType: CredentialType = credentialType ?? 'License';

  const adapter = registry.getAdapter(pType, cType);
  if (!adapter) {
    throw new HttpError(
      422,
      `No adapter registered for providerType=${pType}, credentialType=${cType}`,
    );
  }

  log('info', 'psv_verify_start', { npi, adapter: adapter.adapterName });

  const payload = await adapter.verify({ npi, state, licenseNumber });

  const artifact = await buildPsvArtifact(payload);

  log('info', 'psv_verify_complete', {
    npi,
    artifactId: artifact.artifactId,
    status: artifact.credential.status,
  });

  res.status(200).json(artifact);
}

// ── GET /psv/.well-known/jwks.json handler ───────────────────

async function handlePsvJwks(_req: Request, res: Response): Promise<void> {
  const jwks = await getJwksDocument();
  res.json(jwks);
}

// ── Route registration ───────────────────────────────────────

export function registerPsvVerifyRoutes(app: Express): void {
  app.post('/verify', asyncHandler(handleVerify));
  app.get('/psv/.well-known/jwks.json', asyncHandler(handlePsvJwks));
}
