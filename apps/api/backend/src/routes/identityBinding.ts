import type { Express, Request, Response } from 'express';
import { isSuperAdminRequest } from '../middleware/tenantGuard';
import { log } from '../obs/logger';
import {
  createOrUpdateBinding,
  getBindingByNpi,
  listContestedBindings,
} from '../services/identity/npiDidBinding';
import { parseBooleanEnv } from '../utils/environment';

const NPI_PATTERN = /^\d{10}$/;

function featureEnabled(): boolean {
  return parseBooleanEnv(process.env.FEATURE_NPI_DID_BINDING, false);
}

function ensureFeatureEnabled(res: Response): boolean {
  if (featureEnabled()) {
    return true;
  }

  res.status(404).json({ error: 'Not found' });
  return false;
}

function validateNpi(npi: string, res: Response): string | null {
  const normalized = npi.trim();
  if (!NPI_PATTERN.test(normalized)) {
    res.status(400).json({ error: 'NPI must be exactly 10 digits' });
    return null;
  }

  return normalized;
}

function serializeBinding(binding: Awaited<ReturnType<typeof createOrUpdateBinding>>) {
  return {
    npi: binding.npi,
    did: binding.did,
    status: binding.status,
    sourceFingerprint: binding.sourceFingerprint,
    recipeVersion: binding.recipeVersion,
    evidencePointers: binding.evidencePointers,
    createdAt: binding.createdAt.toISOString(),
  };
}

export function registerIdentityBindingRoutes(app: Express): void {
  app.get('/api/identity/contested', async (_req: Request, res: Response) => {
    if (!ensureFeatureEnabled(res)) {
      return;
    }

    try {
      const bindings = await listContestedBindings();
      res.status(200).json({
        bindings: bindings.map((binding) => ({
          npi: binding.npi,
          did: binding.did,
          status: binding.status,
          contestReason: binding.contestReason,
          updatedAt: binding.updatedAt.toISOString(),
        })),
        total: bindings.length,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'identity_binding_contested_list_failed', { error: detail });
      res.status(500).json({ error: 'Failed to list contested bindings', detail });
    }
  });

  app.get('/api/identity/npi/:npi/binding', async (req: Request, res: Response) => {
    if (!ensureFeatureEnabled(res)) {
      return;
    }

    const npi = validateNpi(req.params.npi ?? '', res);
    if (!npi) {
      return;
    }

    try {
      const binding = await getBindingByNpi(npi) ?? await createOrUpdateBinding(npi);
      res.status(200).json(serializeBinding(binding));
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'identity_binding_get_failed', { npi, error: detail });
      res.status(500).json({ error: 'Failed to resolve NPI binding', detail });
    }
  });

  app.get('/api/identity/npi/:npi/binding/status', async (req: Request, res: Response) => {
    if (!ensureFeatureEnabled(res)) {
      return;
    }

    const npi = validateNpi(req.params.npi ?? '', res);
    if (!npi) {
      return;
    }

    try {
      const binding = await getBindingByNpi(npi);
      if (!binding) {
        res.status(404).json({ error: `Binding for NPI ${npi} not found` });
        return;
      }

      res.status(200).json({
        npi: binding.npi,
        did: binding.did,
        status: binding.status,
        updatedAt: binding.updatedAt.toISOString(),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'identity_binding_status_failed', { npi, error: detail });
      res.status(500).json({ error: 'Failed to retrieve NPI binding status', detail });
    }
  });

  app.post('/api/identity/npi/:npi/binding/refresh', async (req: Request, res: Response) => {
    if (!ensureFeatureEnabled(res)) {
      return;
    }

    if (!isSuperAdminRequest(req)) {
      res.status(403).json({
        error: 'forbidden',
        error_description: 'Super-admin role is required to refresh identity bindings.',
      });
      return;
    }

    const npi = validateNpi(req.params.npi ?? '', res);
    if (!npi) {
      return;
    }

    try {
      const binding = await createOrUpdateBinding(npi);
      res.status(200).json(serializeBinding(binding));
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'identity_binding_refresh_failed', { npi, error: detail });
      res.status(500).json({ error: 'Failed to refresh NPI binding', detail });
    }
  });
}
