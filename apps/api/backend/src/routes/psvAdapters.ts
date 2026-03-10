import type { Express, Request, Response } from 'express';
import { parseBooleanEnv } from '../utils/environment';
import { listAdapters } from '../services/psv-adapters/adapterRegistry';
import { orchestrateVerification, getOrchestrationStatus, enrollProviderForMonitoring } from '../services/psv-adapters/psvOrchestrator';
import { log } from '../obs/logger';

function enabled(): boolean { return parseBooleanEnv(process.env.FEATURE_PSV_ADAPTERS, false); }
function gate(res: Response): boolean { if (!enabled()) { res.status(404).json({ error: 'Not found' }); return false; } return true; }

export function registerPsvAdapterRoutes(app: Express): void {
  app.get('/api/psv/adapters', (_req: Request, res: Response) => {
    if (!gate(res)) return;
    res.json({ adapters: listAdapters() });
  });

  app.post('/api/psv/verify/:npi', async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const result = await orchestrateVerification(req.params.npi, req.body?.sources as string[] | undefined);
      res.json(result);
    } catch (err) {
      log('error', 'psv_verify_failed', { npi: req.params.npi, error: String(err) });
      res.status(500).json({ error: 'Verification failed' });
    }
  });

  app.get('/api/psv/status/:npi', (req: Request, res: Response) => {
    if (!gate(res)) return;
    res.json(getOrchestrationStatus(req.params.npi));
  });

  app.post('/api/psv/enroll/:npi', (req: Request, res: Response) => {
    if (!gate(res)) return;
    enrollProviderForMonitoring(req.params.npi);
    res.status(201).json({ enrolled: true, npi: req.params.npi });
  });
}
