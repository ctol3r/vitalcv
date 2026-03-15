/**
 * graphScaling.ts — Wave 144: Trust Graph Performance Scaling API Routes
 *
 * GET /api/network/global/scaled         — Clustered graph (render-budget aware)
 * GET /api/network/global/segment/:id    — Lazy-load subgraph segment
 * GET /api/network/global/performance    — Graph render telemetry
 */

import type { Express, Request, Response } from 'express';
import {
  aggregateGraph,
  loadGraphSegment,
  getGraphPerformance,
} from '../services/graph/graphScaling';
import { log } from '../obs/logger';
import { recordGraphRenderSample } from '../qa/performanceWatchers';

export function registerGraphScalingRoutes(app: Express): void {
  /**
   * GET /api/network/global/scaled?budget=200
   * Returns the full graph with clustering applied when node count > budget.
   */
  app.get('/api/network/global/scaled', async (req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const budget = Math.max(50, Math.min(500, Number(req.query.budget) || 200));
      const graph = await aggregateGraph({ renderBudget: budget });
      recordGraphRenderSample({
        operation: 'aggregateGraph',
        latencyMs: Date.now() - startedAt,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
      });
      res.json(graph);
    } catch (err) {
      log('error', 'graph_scaled_route_error', { error: String(err) });
      res.status(500).json({ error: 'Graph scaling failed' });
    }
  });

  /**
   * GET /api/network/global/segment/:nodeId?depth=2
   * Lazy-load a neighborhood subgraph around a specific node.
   */
  app.get('/api/network/global/segment/:nodeId', async (req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const { nodeId } = req.params;
      const depth = Math.max(1, Math.min(4, Number(req.query.depth) || 2));
      const segment = await loadGraphSegment(nodeId, depth);
      recordGraphRenderSample({
        operation: 'loadGraphSegment',
        latencyMs: Date.now() - startedAt,
        nodeCount: segment.nodes.length,
        edgeCount: segment.edges.length,
      });
      res.json(segment);
    } catch (err) {
      log('error', 'graph_segment_route_error', { error: String(err) });
      res.status(500).json({ error: 'Graph segment load failed' });
    }
  });

  /**
   * GET /api/network/global/performance
   * Returns render telemetry: node count, edge count, estimated render time, clustering recommendation.
   */
  app.get('/api/network/global/performance', async (_req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const perf = await getGraphPerformance();
      recordGraphRenderSample({
        operation: 'getGraphPerformance',
        latencyMs: Date.now() - startedAt,
        nodeCount: perf.nodeCount,
        edgeCount: perf.edgeCount,
      });
      res.json(perf);
    } catch (err) {
      log('error', 'graph_performance_route_error', { error: String(err) });
      res.status(500).json({ error: 'Graph performance measurement failed' });
    }
  });
}
