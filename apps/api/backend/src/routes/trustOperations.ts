/**
 * trustOperations.ts — Wave 87: Trust Operations API
 *
 * GET /api/trust/operations/:npi — Unified operational state.
 */

import type { Express, Request, Response } from 'express';
import { generateTrustOperationsState } from '../services/trust/trustOperations';
import { log } from '../obs/logger';

export function registerTrustOperationsRoutes(app: Express): void {
  app.get('/api/trust/operations/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi) {
      res.status(400).json({ error: 'NPI parameter is required' });
      return;
    }

    try {
      const state = await generateTrustOperationsState(npi);
      res.json({
        graph: { nodes: state.graph.nodes, edges: state.graph.edges },
        insights: state.graphInsights.insights,
        alerts: state.alerts,
        decisionInsights: {
          readiness: state.decisionInsights.readinessLevel,
          actions: state.decisionInsights.nextActions,
          risks: state.decisionInsights.riskFactors,
        },
        status: state.status,
        summary: state.summary,
        generatedAt: state.generatedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'trust_operations: failed', { npi, error: message });
      res.status(500).json({ error: 'Failed to generate trust operations state' });
    }
  });
}
