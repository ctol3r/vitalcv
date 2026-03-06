/**
 * decisionInsights.ts — Wave 83: Decision Intelligence API
 *
 * GET /api/decision-insights/:npi — Returns decision readiness, risks, and actions.
 */

import type { Express, Request, Response } from 'express';
import { generateDecisionInsights } from '../services/decision/decisionEngine';
import { log } from '../obs/logger';

export function registerDecisionInsightsRoutes(app: Express): void {
  app.get('/api/decision-insights/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi) {
      res.status(400).json({ error: 'NPI parameter is required' });
      return;
    }

    try {
      const report = await generateDecisionInsights(npi);
      res.json({
        readiness: report.readinessLevel,
        insights: report.riskFactors,
        actions: report.nextActions,
        blockingCredentials: report.blockingCredentials,
        recommendedDecisions: report.recommendedDecisions,
        generatedAt: report.generatedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'decision_insights: failed', { npi, error: message });
      res.status(500).json({ error: 'Failed to generate decision insights' });
    }
  });
}
