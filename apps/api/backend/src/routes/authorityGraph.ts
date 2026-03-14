/**
 * authorityGraph.ts — Wave 500: Authority Graph Routes
 *
 * GET /api/authority/:npi         — full authority graph (AI-queryable, one request)
 * GET /api/authority/network/:npi — 2-hop neighborhood traversal via materialized AKG
 *
 * Exit criteria: any AI system can resolve a clinician's complete authority chain
 * (licenses, certifications, privileges, sanctions, decisions) in a single request.
 */

import type { Express, Request, Response } from 'express';
import {
  buildAuthorityGraph,
  resolveClinicianNodeId,
  AUTHORITY_GRAPH_SCHEMA,
  AUTHORITY_GRAPH_VERSION,
} from '../services/graph/authorityGraphEngine';
import { GraphNavigator } from '../services/intelligence/graphNavigator';
import { log } from '../obs/logger';

const navigator = new GraphNavigator();

// ── Simple in-process cache (30s) for authority graphs ───────────────────────
const graphCache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

export function registerAuthorityGraphRoutes(app: Express): void {

  /**
   * GET /api/authority/:npi
   *
   * Returns the complete authority graph for a clinician in one response.
   * Designed to be consumed by AI systems, verifiers, and staffing platforms.
   *
   * Response includes:
   *   - subject: clinician identity node with trustBand + readinessScore
   *   - nodes: ALL authority entities (boards, certs, institutions, privileges, sanctions, decisions)
   *   - edges: ALL relationships (ISSUED_BY, VERIFIED_BY, TRAINED_AT, PRIVILEGED_AT, ACCEPTED_BY, DEPENDS_ON, SANCTIONED_BY)
   *   - summary: structured capability summary optimized for AI consumption
   *
   * Query params:
   *   fresh=true   — bypass 30s cache and recompute (use sparingly)
   */
  app.get('/api/authority/:npi([0-9]{10})', async (req: Request, res: Response) => {
    const { npi } = req.params;
    const forceFresh = req.query.fresh === 'true';
    const startMs = Date.now();

    // Cache check
    if (!forceFresh) {
      const cached = graphCache.get(npi);
      if (cached && cached.expiresAt > Date.now()) {
        res.setHeader('X-Authority-Cache', 'HIT');
        res.setHeader('X-Authority-Schema', AUTHORITY_GRAPH_SCHEMA);
        res.setHeader('X-Authority-Version', AUTHORITY_GRAPH_VERSION);
        res.json(cached.data);
        return;
      }
    }

    try {
      const graph = await buildAuthorityGraph(npi);

      // Cache result
      graphCache.set(npi, { data: graph, expiresAt: Date.now() + CACHE_TTL_MS });

      res.setHeader('X-Authority-Cache', 'MISS');
      res.setHeader('X-Authority-Schema', AUTHORITY_GRAPH_SCHEMA);
      res.setHeader('X-Authority-Version', AUTHORITY_GRAPH_VERSION);
      res.setHeader('X-Authority-Latency-Ms', String(Date.now() - startMs));

      log('info', 'authority: graph served', {
        npi,
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        trustBand: graph.summary.trustBand,
        latencyMs: Date.now() - startMs,
      });

      res.json(graph);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log('error', 'authority: graph failed', { npi, error: message });
      res.status(500).json({ error: 'Failed to build authority graph' });
    }
  });

  /**
   * GET /api/authority/network/:npi
   *
   * Returns the 2-hop neighborhood of a clinician's authority node,
   * traversing the materialized KnowledgeNode/AuthorityEdge graph.
   *
   * This builds on the existing AKG infrastructure (graphNavigator.ts).
   * On first call: builds the full authority graph (triggers materialization),
   * then traverses the persisted AKG for the neighborhood.
   *
   * Query params:
   *   depth=2      — traversal depth (1–3, default 2)
   */
  app.get('/api/authority/network/:npi([0-9]{10})', async (req: Request, res: Response) => {
    const { npi } = req.params;
    const depth = Math.min(Math.max(Number(req.query.depth ?? 2), 1), 3);
    const startMs = Date.now();

    try {
      // Ensure authority graph is materialized (builds + upserts in background)
      // We trigger a fresh build to guarantee the AKG is populated
      await buildAuthorityGraph(npi);

      // Small yield to let the setImmediate materialization complete
      await new Promise(r => setTimeout(r, 100));

      // Resolve the CLINICIAN KnowledgeNode UUID
      const clinicianNodeDbId = await resolveClinicianNodeId(npi);

      if (!clinicianNodeDbId) {
        // Materialization may still be in flight — return the live graph as fallback
        log('warn', 'authority/network: node not materialized yet, returning live graph', { npi });
        const graph = await buildAuthorityGraph(npi);
        res.json({
          ...graph,
          depth,
          materialized: false,
          fallback: 'live_graph',
          computedAt: new Date().toISOString(),
          latencyMs: Date.now() - startMs,
        });
        return;
      }

      // Traverse materialized AKG
      const neighborhood = await navigator.getNodeNeighborhood(clinicianNodeDbId, depth);

      // Compute summary
      const byType: Record<string, number> = {};
      for (const node of neighborhood.nodes) {
        byType[node.entityType] = (byType[node.entityType] ?? 0) + 1;
      }

      log('info', 'authority/network: traversed', {
        npi,
        clinicianNodeDbId,
        depth,
        nodes: neighborhood.nodes.length,
        edges: neighborhood.edges.length,
        latencyMs: Date.now() - startMs,
      });

      res.setHeader('X-Authority-Schema', AUTHORITY_GRAPH_SCHEMA);
      res.setHeader('X-Authority-Version', AUTHORITY_GRAPH_VERSION);
      res.setHeader('X-Authority-Latency-Ms', String(Date.now() - startMs));

      res.json({
        schema: AUTHORITY_GRAPH_SCHEMA,
        version: AUTHORITY_GRAPH_VERSION,
        npi,
        depth,
        materialized: true,
        rootNodeId: clinicianNodeDbId,
        computedAt: new Date().toISOString(),
        nodes: neighborhood.nodes,
        edges: neighborhood.edges,
        summary: {
          totalNodes: neighborhood.nodes.length,
          totalEdges: neighborhood.edges.length,
          byType,
          networkReach: neighborhood.nodes.length,
        },
        latencyMs: Date.now() - startMs,
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log('error', 'authority/network: failed', { npi, error: message });
      res.status(500).json({ error: 'Failed to traverse authority network' });
    }
  });
}
