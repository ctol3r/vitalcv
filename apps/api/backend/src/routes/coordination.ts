/**
 * coordination.ts — Wave 132: Coordination & Cleanup Routes
 *
 * GET  /api/coordination/status     → operation stats
 * GET  /api/coordination/operations → pending/running ops
 * POST /api/coordination/revoke     → idempotency-guarded revocation
 * POST /api/coordination/cleanup    → orphan discovery (DRY RUN)
 */

import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import {
  coordinateRevocation,
  coordinateIngestion,
  getCoordinationStatus,
} from '../services/coordination/coordinationService';
import { listPending } from '../services/coordination/operationRegistry';
import { runCleanup } from '../services/coordination/graphCleanup';

export function registerCoordinationRoutes(app: Express): void {
  // GET /api/coordination/status
  app.get('/api/coordination/status', (_req: Request, res: Response) => {
    res.json(getCoordinationStatus());
  });

  // GET /api/coordination/operations
  app.get('/api/coordination/operations', (_req: Request, res: Response) => {
    res.json({ operations: listPending() });
  });

  // POST /api/coordination/revoke
  app.post('/api/coordination/revoke', async (req: Request, res: Response) => {
    const { credentialId, reason } = req.body as { credentialId?: string; reason?: string };
    if (!credentialId || !reason) {
      return res.status(400).json({ error: 'credentialId and reason are required' });
    }
    try {
      const op = await coordinateRevocation(credentialId, reason);
      return res.json({ operation: op });
    } catch (err) {
      log('error', 'coordination_revoke_route_error', {
        error: err instanceof Error ? err.message : 'unknown',
      });
      return res.status(500).json({ error: 'Coordination revoke failed' });
    }
  });

  // POST /api/coordination/ingest
  app.post('/api/coordination/ingest', async (req: Request, res: Response) => {
    const { npi, payload } = req.body as { npi?: string; payload?: unknown };
    if (!npi) return res.status(400).json({ error: 'npi is required' });
    try {
      const op = await coordinateIngestion(npi, payload);
      return res.json({ operation: op });
    } catch (err) {
      log('error', 'coordination_ingest_route_error', {
        error: err instanceof Error ? err.message : 'unknown',
      });
      return res.status(500).json({ error: 'Coordination ingest failed' });
    }
  });

  // POST /api/coordination/cleanup
  app.post('/api/coordination/cleanup', async (_req: Request, res: Response) => {
    try {
      const report = await runCleanup();
      return res.json({ report });
    } catch (err) {
      log('error', 'coordination_cleanup_route_error', {
        error: err instanceof Error ? err.message : 'unknown',
      });
      return res.status(500).json({ error: 'Cleanup discovery failed' });
    }
  });
}
