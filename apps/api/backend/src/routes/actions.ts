/**
 * actions.ts — Action + Prediction API
 *
 * Routes:
 *   GET  /api/actions/:npi             — Recommended actions for provider
 *   GET  /api/predictions/:npi         — Trust predictions for provider
 *   GET  /api/intelligence/:npi        — Combined actions + predictions
 *   POST /api/actions/:actionId/outcome — Record action outcome feedback
 *   GET  /api/actions/completion-rates  — Category completion rates
 */

import type { Express, Request, Response } from 'express';
import {
  generateActions,
  generatePredictions,
  getProviderIntelligence,
  recordActionOutcome,
  getActionCompletionRates,
  getActionFeedbackHistory,
  type ActionCategory,
  type ActionOutcome,
} from '../services/actions/actionEngine';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;
const VALID_OUTCOMES: ActionOutcome[] = ['completed', 'skipped', 'deferred', 'failed'];

export function registerActionRoutes(app: Express): void {

  app.get('/api/actions/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!NPI_RE.test(npi)) return res.status(400).json({ error: 'Invalid NPI' });
    try {
      const actions = await generateActions(npi);
      res.json({ schema: 'https://vitalcv.com/actions/v1', npi, count: actions.length, actions });
    } catch (err) {
      log('error', `[Actions] Failed for NPI ${npi}: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Action generation failed' });
    }
  });

  app.get('/api/predictions/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!NPI_RE.test(npi)) return res.status(400).json({ error: 'Invalid NPI' });
    try {
      const predictions = await generatePredictions(npi);
      res.json({ schema: 'https://vitalcv.com/predictions/v1', npi, count: predictions.length, predictions });
    } catch (err) {
      log('error', `[Predictions] Failed for NPI ${npi}: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Prediction generation failed' });
    }
  });

  app.get('/api/provider-intelligence/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!NPI_RE.test(npi)) return res.status(400).json({ error: 'Invalid NPI' });
    try {
      const intelligence = await getProviderIntelligence(npi);
      res.json({ schema: 'https://vitalcv.com/provider-intelligence/v1', ...intelligence });
    } catch (err) {
      log('error', `[Intelligence] Failed for NPI ${npi}: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Provider intelligence generation failed' });
    }
  });

  app.post('/api/actions/:actionId/outcome', (req: Request, res: Response) => {
    const { actionId } = req.params;
    const { outcome, category, npi } = req.body as {
      outcome?: string; category?: string; npi?: string;
    };

    if (!outcome || !VALID_OUTCOMES.includes(outcome as ActionOutcome)) {
      return res.status(400).json({ error: `outcome must be one of: ${VALID_OUTCOMES.join(', ')}` });
    }
    if (!category || !npi) {
      return res.status(400).json({ error: 'Body must include category and npi' });
    }

    recordActionOutcome(actionId, category as ActionCategory, outcome as ActionOutcome, npi);
    res.json({ recorded: true, actionId, outcome });
  });

  app.get('/api/actions/completion-rates', (_req: Request, res: Response) => {
    res.json({
      schema: 'https://vitalcv.com/action-rates/v1',
      rates: getActionCompletionRates(),
    });
  });

  app.get('/api/actions/feedback-history', (req: Request, res: Response) => {
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 50;
    res.json({ history: getActionFeedbackHistory(limit) });
  });
}
