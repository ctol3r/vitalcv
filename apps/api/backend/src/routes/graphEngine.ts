/**
 * graphEngine.ts — Graph System API
 *
 * Full graph API supporting global/local views, AI linking, preferences,
 * search, filtering, and graph management operations.
 */

import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import {
  getGraphSnapshot, buildFullGraph, getLocalGraph,
  reindexNode, detectOrphans, validateReciprocalLinks,
} from '../services/graph-engine/graphIndexer';
import {
  generateLinkSuggestions, generateAllLinkSuggestions,
  applyLinkSuggestion, bulkApplyByThreshold, rejectLink,
  type LinkSuggestion,
} from '../services/graph-engine/aiLinker';
import {
  defaultPreferences,
  type GraphPreferences, type GraphLayer, type NodeType, type EdgeType,
  NODE_TYPES, EDGE_TYPES,
} from '../services/graph-engine/schema';

// ── In-memory preference + preset store ───────────────────────────────────────

const presets = new Map<string, GraphPreferences>();
presets.set('default', defaultPreferences());

// Pinned nodes store
const pinnedNodes = new Map<string, { x: number; y: number }>();

// Layout save store
const savedLayouts = new Map<string, Record<string, { x: number; y: number }>>();

export function registerGraphEngineRoutes(app: Express): void {

  // ── Global graph ────────────────────────────────────────────────────────

  /**
   * GET /api/graph-engine/global
   *
   * Full graph snapshot. Supports query filters:
   *   ?layer=trust|knowledge|blended
   *   ?nodeTypes=clinician,claim,source
   *   ?edgeTypes=derived_from,affiliated_with
   *   ?trustTiers=GOLD,SILVER
   *   ?showOrphans=true
   *   ?showAiLinks=true
   *   ?search=cardiology
   *   ?fresh=true
   */
  app.get('/api/graph-engine/global', async (req: Request, res: Response) => {
    try {
      const fresh = req.query.fresh === 'true';
      const snapshot = await getGraphSnapshot(fresh);

      // Apply filters
      let nodes = [...snapshot.nodes];
      let edges = [...snapshot.edges];

      const layer = req.query.layer as string;
      if (layer === 'trust' || layer === 'knowledge') {
        nodes = nodes.filter(n => n.layer === layer || n.layer === 'blended');
        edges = edges.filter(e => e.layer === layer || e.layer === 'blended');
      }

      if (req.query.nodeTypes) {
        const types = new Set((req.query.nodeTypes as string).split(','));
        nodes = nodes.filter(n => types.has(n.type));
      }

      if (req.query.edgeTypes) {
        const types = new Set((req.query.edgeTypes as string).split(','));
        edges = edges.filter(e => types.has(e.type));
      }

      if (req.query.trustTiers) {
        const tiers = new Set((req.query.trustTiers as string).split(','));
        nodes = nodes.filter(n => !n.trustTier || tiers.has(n.trustTier));
      }

      if (req.query.showOrphans !== 'true') {
        nodes = nodes.filter(n => n.degree > 0);
      }

      if (req.query.showAiLinks === 'false') {
        edges = edges.filter(e => e.createdBy !== 'ai');
      }

      if (req.query.search) {
        const term = (req.query.search as string).toLowerCase();
        const matchingNodeIds = new Set(
          nodes.filter(n =>
            n.label.toLowerCase().includes(term) ||
            n.title.toLowerCase().includes(term) ||
            n.tags.some(t => t.toLowerCase().includes(term))
          ).map(n => n.id)
        );
        // Include neighbors of matching nodes
        for (const e of edges) {
          if (matchingNodeIds.has(e.source)) matchingNodeIds.add(e.target);
          if (matchingNodeIds.has(e.target)) matchingNodeIds.add(e.source);
        }
        nodes = nodes.filter(n => matchingNodeIds.has(n.id));
      }

      // Filter edges to only include visible nodes
      const nodeIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

      // Apply pinned positions
      for (const node of nodes) {
        const pin = pinnedNodes.get(node.id);
        if (pin) { node.fx = pin.x; node.fy = pin.y; }
      }

      res.json({
        schema: 'https://vitalcv.com/graph/v1',
        generatedAt: snapshot.generatedAt,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        nodes,
        edges,
        stats: snapshot.stats,
        availableNodeTypes: NODE_TYPES,
        availableEdgeTypes: EDGE_TYPES,
      });
    } catch (err) {
      log('error', 'graphEngine: global failed', { error: String(err) });
      res.status(500).json({ error: 'Graph fetch failed' });
    }
  });

  // ── Local graph ─────────────────────────────────────────────────────────

  /**
   * GET /api/graph-engine/local/:nodeId
   *
   * Neighborhood graph around a specific node.
   *   ?depth=1|2|3 (default 2)
   */
  app.get('/api/graph-engine/local/:nodeId', async (req: Request, res: Response) => {
    const { nodeId } = req.params;
    const depth = Math.min(parseInt(req.query.depth as string) || 2, 5);

    try {
      const snapshot = await getLocalGraph(nodeId!, depth);
      res.json({
        schema: 'https://vitalcv.com/graph/v1',
        mode: 'local',
        focusNodeId: nodeId,
        depth,
        ...snapshot,
      });
    } catch (err) {
      log('error', 'graphEngine: local failed', { nodeId, error: String(err) });
      res.status(500).json({ error: 'Local graph failed' });
    }
  });

  // ── Node detail ─────────────────────────────────────────────────────────

  /**
   * GET /api/graph-engine/node/:id
   * Single node with full metadata + edge breakdown.
   */
  app.get('/api/graph-engine/node/:id', async (req: Request, res: Response) => {
    try {
      const snapshot = await getGraphSnapshot();
      const node = snapshot.nodes.find(n => n.id === req.params.id);
      if (!node) { res.status(404).json({ error: 'Node not found' }); return; }

      const connectedEdges = snapshot.edges.filter(e =>
        (e.source === node.id || e.target === node.id) && e.status === 'active'
      );

      const edgeBreakdown: Record<string, number> = {};
      for (const e of connectedEdges) {
        edgeBreakdown[e.type] = (edgeBreakdown[e.type] ?? 0) + 1;
      }

      const neighborIds = new Set<string>();
      for (const e of connectedEdges) {
        if (e.source === node.id) neighborIds.add(e.target);
        if (e.target === node.id) neighborIds.add(e.source);
      }

      const neighbors = snapshot.nodes
        .filter(n => neighborIds.has(n.id))
        .map(n => ({ id: n.id, label: n.label, type: n.type, degree: n.degree }));

      res.json({
        node,
        edges: connectedEdges,
        edgeBreakdown,
        neighbors,
        neighborCount: neighbors.length,
      });
    } catch (err) {
      log('error', 'graphEngine: node detail failed', { error: String(err) });
      res.status(500).json({ error: 'Node detail failed' });
    }
  });

  // ── Node neighbors ──────────────────────────────────────────────────────

  app.get('/api/graph-engine/node/:id/neighbors', async (req: Request, res: Response) => {
    try {
      const depth = Math.min(parseInt(req.query.depth as string) || 1, 3);
      const snapshot = await getLocalGraph(req.params.id!, depth);
      res.json({ focusNodeId: req.params.id, depth, ...snapshot });
    } catch (err) {
      res.status(500).json({ error: 'Neighbors fetch failed' });
    }
  });

  // ── Search ──────────────────────────────────────────────────────────────

  app.get('/api/graph-engine/search', async (req: Request, res: Response) => {
    const q = (req.query.q as string ?? '').toLowerCase().trim();
    if (!q) { res.json({ results: [], total: 0 }); return; }

    try {
      const snapshot = await getGraphSnapshot();
      const results = snapshot.nodes
        .filter(n =>
          n.label.toLowerCase().includes(q) ||
          n.title.toLowerCase().includes(q) ||
          n.tags.some(t => t.toLowerCase().includes(q)) ||
          n.type.includes(q)
        )
        .slice(0, 50)
        .map(n => ({
          id: n.id, label: n.label, type: n.type,
          degree: n.degree, color: n.color, layer: n.layer,
        }));

      res.json({ query: q, results, total: results.length });
    } catch (err) {
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // ── Groups ──────────────────────────────────────────────────────────────

  app.get('/api/graph-engine/groups', async (_req: Request, res: Response) => {
    try {
      const snapshot = await getGraphSnapshot();
      const groups: Record<string, { count: number; color: string; types: string[] }> = {};
      for (const n of snapshot.nodes) {
        if (!groups[n.group]) {
          groups[n.group] = { count: 0, color: n.color, types: [] };
        }
        groups[n.group]!.count++;
        if (!groups[n.group]!.types.includes(n.type)) {
          groups[n.group]!.types.push(n.type);
        }
      }
      res.json({ groups, totalGroups: Object.keys(groups).length });
    } catch (err) {
      res.status(500).json({ error: 'Groups fetch failed' });
    }
  });

  // ── Presets ─────────────────────────────────────────────────────────────

  app.get('/api/graph-engine/presets', (_req: Request, res: Response) => {
    const list = [...presets.values()].map(p => ({
      id: p.id, name: p.name, isDefault: p.isDefault,
      layer: p.layer, updatedAt: p.updatedAt,
    }));
    res.json({ presets: list, total: list.length });
  });

  app.post('/api/graph-engine/presets', (req: Request, res: Response) => {
    const body = req.body as Partial<GraphPreferences>;
    const id = body.id ?? `preset_${Date.now()}`;
    const preset: GraphPreferences = {
      ...defaultPreferences(),
      ...body,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    presets.set(id, preset);
    res.status(201).json({ id, message: 'Preset saved' });
  });

  // ── Rebuild ─────────────────────────────────────────────────────────────

  app.post('/api/graph-engine/rebuild', async (_req: Request, res: Response) => {
    try {
      const snapshot = await buildFullGraph();
      res.json({
        message: 'Graph rebuilt',
        nodeCount: snapshot.nodeCount,
        edgeCount: snapshot.edgeCount,
        stats: snapshot.stats,
      });
    } catch (err) {
      log('error', 'graphEngine: rebuild failed', { error: String(err) });
      res.status(500).json({ error: 'Rebuild failed' });
    }
  });

  // ── AI Linking ──────────────────────────────────────────────────────────

  /**
   * POST /api/graph-engine/ai-links/suggest
   * Body: { nodeId?: string } — if nodeId, suggest for that node; otherwise batch
   */
  app.post('/api/graph-engine/ai-links/suggest', async (req: Request, res: Response) => {
    try {
      const snapshot = await getGraphSnapshot();
      const body = req.body as Record<string, unknown>;

      if (body.nodeId && typeof body.nodeId === 'string') {
        const result = await generateLinkSuggestions(body.nodeId, snapshot.nodes, snapshot.edges);
        res.json(result);
      } else {
        const result = await generateAllLinkSuggestions(snapshot.nodes, snapshot.edges, {
          maxNodes: typeof body.maxNodes === 'number' ? body.maxNodes : 100,
        });
        res.json(result);
      }
    } catch (err) {
      log('error', 'graphEngine: ai-links suggest failed', { error: String(err) });
      res.status(500).json({ error: 'AI link suggestion failed' });
    }
  });

  /**
   * POST /api/graph-engine/ai-links/apply
   * Body: { suggestion: LinkSuggestion } | { threshold: number, suggestions: LinkSuggestion[] }
   */
  app.post('/api/graph-engine/ai-links/apply', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;

      if (body.suggestion) {
        const result = await applyLinkSuggestion(body.suggestion as LinkSuggestion);
        res.json({ ...result, message: 'Link applied' });
      } else if (Array.isArray(body.suggestions)) {
        const threshold = typeof body.threshold === 'number' ? body.threshold : 0.85;
        const result = await bulkApplyByThreshold(body.suggestions as LinkSuggestion[], threshold);
        res.json({ ...result, message: `${result.applied} links applied` });
      } else {
        res.status(400).json({ error: 'Provide suggestion or suggestions[]' });
      }
    } catch (err) {
      log('error', 'graphEngine: ai-links apply failed', { error: String(err) });
      res.status(500).json({ error: 'Link apply failed' });
    }
  });

  // ── Reject edge ─────────────────────────────────────────────────────────

  app.post('/api/graph-engine/edge/reject', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const { sourceId, targetId, edgeType } = body;
    if (!sourceId || !targetId || !edgeType) {
      res.status(400).json({ error: 'sourceId, targetId, edgeType required' });
      return;
    }
    rejectLink(String(sourceId), String(targetId), String(edgeType));
    res.json({ message: 'Edge rejected — will not be re-suggested' });
  });

  // ── Pin node ────────────────────────────────────────────────────────────

  app.post('/api/graph-engine/node/pin', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const { nodeId, x, y, unpin } = body;
    if (!nodeId) { res.status(400).json({ error: 'nodeId required' }); return; }

    if (unpin) {
      pinnedNodes.delete(String(nodeId));
      res.json({ message: 'Node unpinned' });
    } else {
      pinnedNodes.set(String(nodeId), {
        x: typeof x === 'number' ? x : 0,
        y: typeof y === 'number' ? y : 0,
      });
      res.json({ message: 'Node pinned', x, y });
    }
  });

  // ── Save layout ─────────────────────────────────────────────────────────

  app.post('/api/graph-engine/layout/save', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const name = String(body.name ?? 'autosave');
    const positions = body.positions as Record<string, { x: number; y: number }>;
    if (!positions) { res.status(400).json({ error: 'positions required' }); return; }

    savedLayouts.set(name, positions);
    res.json({ message: `Layout "${name}" saved`, nodeCount: Object.keys(positions).length });
  });

  app.get('/api/graph-engine/layout/:name', (req: Request, res: Response) => {
    const layout = savedLayouts.get(req.params.name!);
    if (!layout) { res.status(404).json({ error: 'Layout not found' }); return; }
    res.json({ name: req.params.name, positions: layout });
  });

  // ── Orphans ─────────────────────────────────────────────────────────────

  app.get('/api/graph-engine/orphans', async (_req: Request, res: Response) => {
    try {
      const orphans = await detectOrphans();
      res.json({ orphans: orphans.map(n => ({ id: n.id, label: n.label, type: n.type })), total: orphans.length });
    } catch (err) {
      res.status(500).json({ error: 'Orphan detection failed' });
    }
  });

  // ── Reciprocal validation ───────────────────────────────────────────────

  app.get('/api/graph-engine/validate/reciprocal', async (_req: Request, res: Response) => {
    try {
      const result = await validateReciprocalLinks();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Validation failed' });
    }
  });

  // ── Stats ───────────────────────────────────────────────────────────────

  app.get('/api/graph-engine/stats', async (_req: Request, res: Response) => {
    try {
      const snapshot = await getGraphSnapshot();
      res.json({ stats: snapshot.stats, generatedAt: snapshot.generatedAt });
    } catch (err) {
      res.status(500).json({ error: 'Stats fetch failed' });
    }
  });
}
