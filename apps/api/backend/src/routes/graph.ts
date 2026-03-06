/**
 * graph.ts — Wave 82: Trust Graph Intelligence API
 *
 * GET /api/graph/:npi — Returns intelligent graph with insights.
 */

import type { Express, Request, Response } from 'express';
import { generateTrustGraph } from '../services/graph/graphEngine';
import { analyzeGraph } from '../services/graph/graphInsights';
import { log } from '../obs/logger';

export function registerGraphRoutes(app: Express): void {
  /**
   * GET /api/graph/:npi
   *
   * Returns { nodes, edges, insights } for a clinician's trust network.
   */
  app.get('/api/graph/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi) {
      res.status(400).json({ error: 'NPI parameter is required' });
      return;
    }

    try {
      const graph = await generateTrustGraph(npi);
      const insightReport = analyzeGraph(graph);

      res.json({
        nodes: graph.nodes,
        edges: graph.edges,
        insights: insightReport.insights,
        summary: insightReport.summary,
        generatedAt: graph.generatedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'graph_route: failed', { npi, error: message });
      res.status(500).json({ error: 'Failed to generate trust graph' });
    }
  });
}
