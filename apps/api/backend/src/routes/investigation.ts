/**
 * investigation.ts — Investigation API
 *
 * Routes:
 *   POST /api/investigation/provider/:npi     — Full provider investigation
 *   POST /api/investigation/network/:npi      — Network analysis
 *   POST /api/investigation/compare           — Multi-provider comparison
 */

import type { Express, Request, Response } from 'express';
import {
  investigateProvider,
  investigateNetwork,
  investigateComparison,
} from '../services/copilot/investigationEngine';
import { getWorkbenchContext } from '../services/investigation/workbenchContextService';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;

export function registerInvestigationRoutes(app: Express): void {

  // ── GET /api/investigation/workbench ──────────────────────────────────────
  //
  // Returns a unified, linked-context investigation payload given any
  // combination of anchors: npi, findingId, storylineId.
  //
  // Query params:
  //   npi          - 10-digit NPI string
  //   findingId    - finding ID string
  //   storylineId  - storyline ID string
  //
  app.get('/api/investigation/workbench', async (req: Request, res: Response) => {
    const { npi, findingId, storylineId } = req.query as Record<string, string | undefined>;

    if (!npi && !findingId && !storylineId) {
      return res.status(400).json({
        error: 'At least one anchor (npi, findingId, storylineId) is required',
      });
    }

    if (npi && !NPI_RE.test(npi)) {
      return res.status(400).json({ error: 'Invalid NPI — must be 10 digits' });
    }

    try {
      const context = await getWorkbenchContext({
        npi: npi ?? undefined,
        findingId: findingId ?? undefined,
        storylineId: storylineId ?? undefined,
      });
      res.json({ schema: 'https://vitalcv.com/workbench/v1', ...context });
    } catch (err) {
      log('error', `[Workbench] Context failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Workbench context unavailable' });
    }
  });

  // ── POST /api/investigation/provider/:npi ─────────────────────────────────
  //
  // Full provider investigation: trust score + freshness + divergence +
  // anomaly detection + graph network + artifact history + recommendations.
  //
  app.post('/api/investigation/provider/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!NPI_RE.test(npi)) {
      return res.status(400).json({ error: 'Invalid NPI — must be 10 digits' });
    }

    try {
      const report = await investigateProvider(npi);
      res.json({
        schema: 'https://vitalcv.com/investigation/v1',
        ...report,
      });
    } catch (err) {
      log('error', `[Investigation] Provider investigation failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Investigation failed' });
    }
  });

  // ── POST /api/investigation/network/:npi ──────────────────────────────────
  //
  // Network analysis: expand graph neighborhood, identify collaborators,
  // institutions, research clusters, and network statistics.
  //
  app.post('/api/investigation/network/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!NPI_RE.test(npi)) {
      return res.status(400).json({ error: 'Invalid NPI — must be 10 digits' });
    }

    const depth = Math.min(Number(req.query.depth ?? req.body?.depth ?? 2), 4);

    try {
      const report = await investigateNetwork(npi, depth);
      res.json({
        schema: 'https://vitalcv.com/investigation-network/v1',
        ...report,
      });
    } catch (err) {
      log('error', `[Investigation] Network investigation failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Network investigation failed' });
    }
  });

  // ── POST /api/investigation/compare ───────────────────────────────────────
  //
  // Multi-provider comparison: parallel trust scoring, per-dimension spread,
  // ranking, common gaps.
  //
  // Body: { npis: string[] }  (2–5 NPIs)
  //
  app.post('/api/investigation/compare', async (req: Request, res: Response) => {
    const { npis } = req.body as { npis?: string[] };
    if (!Array.isArray(npis) || npis.length < 2) {
      return res.status(400).json({ error: 'Body must include npis: string[] with at least 2 NPIs' });
    }
    if (npis.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 NPIs for comparison' });
    }
    if (!npis.every(n => NPI_RE.test(n))) {
      return res.status(400).json({ error: 'All NPIs must be 10 digits' });
    }

    try {
      const report = await investigateComparison(npis);
      res.json({
        schema: 'https://vitalcv.com/investigation-comparison/v1',
        ...report,
      });
    } catch (err) {
      log('error', `[Investigation] Comparison failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Comparison investigation failed' });
    }
  });
}
