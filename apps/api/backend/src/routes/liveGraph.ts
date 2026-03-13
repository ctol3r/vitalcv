/**
 * liveGraph.ts — Wave 247: Live Trust Graph Routes
 *
 * GET /api/graph/live/:npi    — per-clinician live graph
 * GET /api/graph/network      — global network graph (cached)
 * GET /api/graph/node/:nodeId/expand — expand a node's neighborhood
 */

import type { Express, Request, Response } from 'express';
import { buildClinicianGraph, buildNetworkGraph, expandNode } from '../services/graph/liveGraphBuilder';
import { log } from '../obs/logger';

// Simple in-memory cache for the network graph (TTL: 5 min)
let networkCache: { data: unknown; expiresAt: number } | null = null;
const NETWORK_CACHE_TTL_MS = 5 * 60 * 1000;

export function registerLiveGraphRoutes(app: Express): void {
  /**
   * GET /api/graph/live/:npi
   * Returns a live trust graph for a single clinician.
   */
  app.get('/api/graph/live/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi || !/^\d{10}$/.test(npi)) {
      res.status(400).json({ error: 'Valid 10-digit NPI required' });
      return;
    }

    try {
      const graph = await buildClinicianGraph(npi);
      res.json(graph);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'liveGraph: clinician graph failed', { npi, error: message });
      res.status(500).json({ error: 'Failed to build clinician graph' });
    }
  });

  /**
   * GET /api/graph/network
   * Returns the global network graph (publicly readable, cached 5 min).
   * Optional query: ?limit=200
   */
  app.get('/api/graph/network', async (req: Request, res: Response) => {
    try {
      const now = Date.now();
      if (networkCache && networkCache.expiresAt > now) {
        res.setHeader('X-Cache', 'HIT');
        res.json(networkCache.data);
        return;
      }

      const limit = Math.min(parseInt(String(req.query.limit ?? '200'), 10) || 200, 500);
      const graph = await buildNetworkGraph({ limit });

      networkCache = { data: graph, expiresAt: now + NETWORK_CACHE_TTL_MS };

      res.setHeader('X-Cache', 'MISS');
      res.json(graph);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'liveGraph: network graph failed', { error: message });
      res.status(500).json({ error: 'Failed to build network graph' });
    }
  });

  /**
   * GET /api/graph/node/:nodeId/expand
   * Expands a node to return its immediate neighborhood.
   * nodeId is URL-encoded (e.g. "clinician:1234567890")
   */
  app.get('/api/graph/node/:nodeId/expand', async (req: Request, res: Response) => {
    const rawNodeId = req.params.nodeId;
    if (!rawNodeId) {
      res.status(400).json({ error: 'nodeId required' });
      return;
    }

    // Decode percent-encoding
    let nodeId: string;
    try {
      nodeId = decodeURIComponent(rawNodeId);
    } catch {
      nodeId = rawNodeId;
    }

    try {
      const graph = await expandNode(nodeId);
      res.json(graph);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'liveGraph: expand node failed', { nodeId, error: message });
      res.status(500).json({ error: 'Failed to expand node' });
    }
  });
}
