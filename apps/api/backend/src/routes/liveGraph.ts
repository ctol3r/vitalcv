/**
 * liveGraph.ts — Wave 247 + Wave Graph-Intelligence
 *
 * GET /api/graph/:npi                   — unified credential intelligence graph ← NEW
 * GET /api/graph/:npi/query             — filtered graph query (nodeType, edgeType) ← NEW
 * GET /api/graph/live/:npi              — per-clinician live graph (alias)
 * GET /api/graph/network                — global network graph (cached)
 * GET /api/graph/node/:nodeId/expand    — expand a node's neighborhood
 *
 * Graph node types: clinician | credential | institution | license | decision
 * Graph edge types: issued_by | verified_by | accepted_by | depends_on | has_credential | monitors
 */

import type { Express, Request, Response } from 'express';
import { buildClinicianGraph, buildNetworkGraph, expandNode } from '../services/graph/liveGraphBuilder';
import { log } from '../obs/logger';
import prisma from '../graphql/prisma_client';

// Simple in-memory cache for the network graph (TTL: 5 min)
let networkCache: { data: unknown; expiresAt: number } | null = null;
const NETWORK_CACHE_TTL_MS = 5 * 60 * 1000;

export function registerLiveGraphRoutes(app: Express): void {

  // ── GET /api/graph/:npi ── Unified credential intelligence graph ────────────
  // Returns all nodes and edges for a clinician: clinicians, credentials,
  // institutions, licenses, and decisions — queryable by nodeType and edgeType.
  // This is the canonical graph API for the VitalCV Trust Protocol.
  app.get('/api/graph/:npi([0-9]{10})', async (req: Request, res: Response) => {
    const { npi } = req.params;
    const nodeTypeFilter = typeof req.query.nodeType === 'string'
      ? req.query.nodeType.toLowerCase().split(',')
      : null;
    const edgeTypeFilter = typeof req.query.edgeType === 'string'
      ? req.query.edgeType.toLowerCase().split(',')
      : null;
    const includeDecisions = req.query.decisions !== 'false';

    try {
      const [graph, capsules] = await Promise.all([
        buildClinicianGraph(npi),
        includeDecisions
          ? prisma.decisionCapsule.findMany({
              where: { subjectNpi: npi },
              orderBy: { decisionTimestamp: 'desc' },
              take: 20,
              select: {
                id: true,
                decisionType: true,
                status: true,
                artifactHash: true,
                decisionTimestamp: true,
                credentialIds: true,
                metadata: true,
              },
            })
          : Promise.resolve([]),
      ]);

      // Inject explicit decision nodes (capsules as first-class graph nodes)
      const decisionNodes = capsules.map(c => {
        const meta = (c.metadata ?? {}) as Record<string, unknown>;
        const decisionAction = typeof meta.decisionAction === 'string' ? meta.decisionAction : 'APPROVE';
        const trustStateHash = typeof meta.trustStateHash === 'string' ? meta.trustStateHash : null;
        const verifierOrgId = typeof meta.verifierOrgId === 'string' ? meta.verifierOrgId : null;
        return {
          id: `decision:${c.id}`,
          type: 'decision' as const,
          label: `${c.decisionType} — ${decisionAction}`,
          trustLevel: c.status === 'VALID' ? 'L3' : c.status === 'AT_RISK' ? 'L2' : 'L0',
          status: c.status.toLowerCase(),
          metadata: {
            decisionType: c.decisionType,
            decisionAction,
            artifactHash: c.artifactHash,
            trustStateHash,
            decisionTimestamp: c.decisionTimestamp?.toISOString(),
            verifierOrgId,
            credentialIds: c.credentialIds,
          },
        };
      });

      // Decision → clinician edge (ACCEPTED_BY or REJECTED_BY)
      const clinicianNodeId = `clinician:${npi}`;
      const decisionEdges = capsules.map(c => {
        const meta = (c.metadata ?? {}) as Record<string, unknown>;
        const decisionAction = typeof meta.decisionAction === 'string' ? meta.decisionAction : 'APPROVE';
        return {
          id: `edge:decision:${c.id}:${decisionAction}`,
          source: `decision:${c.id}`,
          target: clinicianNodeId,
          type: decisionAction === 'APPROVE' ? 'accepted_by' : 'rejected_by',
          weight: c.status === 'VALID' ? 0.9 : 0.4,
          createdAt: c.decisionTimestamp?.toISOString() ?? new Date().toISOString(),
        };
      });

      // Decision → credential edges (DEPENDS_ON)
      const credDependencyEdges = capsules.flatMap(c =>
        c.credentialIds.map(credId => ({
          id: `edge:decision:${c.id}:dep:${credId}`,
          source: `decision:${c.id}`,
          target: `credential:${credId}`,
          type: 'depends_on',
          weight: 1.0,
          createdAt: c.decisionTimestamp?.toISOString() ?? new Date().toISOString(),
        }))
      );

      // Merge and normalise edge type casing (use lowercase for protocol conformance)
      const allNodes = [
        ...graph.nodes.map(n => ({ ...n, type: n.type === 'hospital' ? 'institution' : n.type })),
        ...decisionNodes,
      ];
      const allEdges = [
        ...graph.edges.map(e => ({ ...e, type: e.type.toLowerCase().replace('has_credential', 'issued_by') })),
        ...decisionEdges,
        ...credDependencyEdges,
      ];

      // Apply filters
      const filteredNodes = nodeTypeFilter
        ? allNodes.filter(n => nodeTypeFilter.includes(n.type))
        : allNodes;
      const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
      const filteredEdges = allEdges.filter(e => {
        const nodeMatch = filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target);
        const edgeMatch = edgeTypeFilter ? edgeTypeFilter.includes(e.type) : true;
        return nodeMatch && edgeMatch;
      });

      log('info', 'graph: intelligence query', {
        npi,
        nodeCount: filteredNodes.length,
        edgeCount: filteredEdges.length,
        filters: { nodeTypeFilter, edgeTypeFilter },
      });

      res.json({
        npi,
        computedAt: new Date().toISOString(),
        schema: 'https://vitalcv.com/protocol',
        nodeTypes: ['clinician', 'credential', 'institution', 'license', 'decision'],
        edgeTypes: ['issued_by', 'verified_by', 'accepted_by', 'depends_on', 'monitors'],
        nodes: filteredNodes,
        edges: filteredEdges,
        stats: {
          nodeCount: filteredNodes.length,
          edgeCount: filteredEdges.length,
          decisionCount: capsules.length,
          filtered: nodeTypeFilter !== null || edgeTypeFilter !== null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'graph: intelligence query failed', { npi, error: message });
      res.status(500).json({ error: 'Failed to build credential intelligence graph' });
    }
  });

  // ── GET /api/graph/:npi/query ── Filtered graph query ──────────────────────
  // Convenience alias with explicit query parameters surfaced in docs.
  // nodeType=credential,license&edgeType=verified_by,depends_on
  app.get('/api/graph/:npi([0-9]{10})/query', async (req: Request, res: Response) => {
    // Delegate to the main handler by forwarding via redirect with params preserved
    const { npi } = req.params;
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    res.redirect(307, `/api/graph/${npi}${qs ? '?' + qs : ''}`);
  });

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
