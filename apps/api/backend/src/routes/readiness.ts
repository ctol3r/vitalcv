/**
 * Waves 208-210 — Readiness + Clear-to-Start Routes
 */
import type { Express, Request, Response } from 'express';
import { parseBooleanEnv } from '../utils/environment';
import { orchestrateVerification } from '../services/psv-adapters/psvOrchestrator';
import { computeReadiness } from '../services/verticals/readiness/readinessEngine';
import { log } from '../obs/logger';

function enabled(): boolean { return parseBooleanEnv(process.env.FEATURE_READINESS_ENGINE, false); }

export function registerReadinessRoutes(app: Express): void {
  app.get('/api/readiness/:npi/clear-to-start', async (req: Request, res: Response) => {
    if (!enabled()) { res.status(404).json({ error: 'Not found' }); return; }
    const { state, profession } = req.query as { state?: string; profession?: string };
    if (!state || !profession) { res.status(400).json({ error: 'state and profession query params required' }); return; }
    try {
      const { artifacts } = await orchestrateVerification(req.params.npi);
      const report = computeReadiness(req.params.npi, state, profession, artifacts);
      res.json({ clearToStart: report.readinessState === 'DECISION_GRADE', daysEstimate: report.endorsement_timeline.estimatedDays, report });
    } catch (err) {
      log('error', 'readiness_clear_to_start_failed', { npi: req.params.npi, error: String(err) });
      res.status(500).json({ error: 'Readiness check failed' });
    }
  });

  app.get('/api/readiness/:npi/report', async (req: Request, res: Response) => {
    if (!enabled()) { res.status(404).json({ error: 'Not found' }); return; }
    const { state, profession } = req.query as { state?: string; profession?: string };
    if (!state || !profession) { res.status(400).json({ error: 'state and profession required' }); return; }
    const { artifacts } = await orchestrateVerification(req.params.npi);
    res.json(computeReadiness(req.params.npi, state, profession, artifacts));
  });
}
