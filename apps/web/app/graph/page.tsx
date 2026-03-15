'use client';

/**
 * /graph — Foundry-class graph explorer
 *
 * Dual graph system: Knowledge + Trust + Blended, with:
 * - Named physics presets (balanced / clustered / explore / dense / presentation)
 * - DOM tooltip overlay at hover position
 * - Cluster hull visualization
 * - Semantic edge color vocabulary
 * - Collision-aware force physics
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import GraphCanvas from '../../components/graph-system/GraphCanvas';
import GraphControls from '../../components/graph-system/GraphControls';
import NodeDetail from '../../components/graph-system/NodeDetail';
import GraphTooltip from '../../components/graph-system/GraphTooltip';
import type {
  GraphNode, GraphEdge, FilterConfig, DisplayConfig, PhysicsConfig,
  GraphLayer, PhysicsPreset,
} from '../../components/graph-system/types';
import { PHYSICS_PRESETS } from '../../components/graph-system/types';
import type { NodeNeighborSummary } from '../../components/graph-system/nodeDetailModel';

// ── Default config ────────────────────────────────────────────────────────────

const defaultFilters: FilterConfig = {
  nodeTypes:       [],
  edgeTypes:       [],
  trustTiers:      ['GOLD', 'SILVER', 'BRONZE'],
  tags:            [],
  showOrphans:     false,
  showAttachments: true,
  showExplicit:    true,
  showInferred:    true,
  showAiLinks:     true,
  showDirected:    true,
  searchTerm:      '',
  groups:          [],
};

const defaultDisplay: DisplayConfig = {
  showArrows:        true,
  showLabels:        true,
  showClusterHulls:  true,
  animate:           true,
  nodeSize:          6,
  linkThickness:     1.5,
  textFadeThreshold: 0.5,
  colorMode:         'type',
  clusterMode:       'type',
};

// Start with the "balanced" preset
const defaultPhysics: PhysicsConfig = PHYSICS_PRESETS[0]!.config;

// ── API helpers ───────────────────────────────────────────────────────────────

const API = '/api/graph-engine';

interface GraphQueryResponse {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  stats?: {
    totalNodes:      number;
    totalEdges:      number;
    orphanCount:     number;
    aiSuggestedLinks: number;
  };
}

interface NodeDetailState {
  node:      GraphNode;
  edges:     GraphEdge[];
  neighbors: NodeNeighborSummary[];
}

async function fetchGraph(layer: GraphLayer, search?: string, fresh?: boolean) {
  const params = new URLSearchParams();
  if (layer !== 'blended') params.set('graphMode', layer);
  if (search) params.set('search', search);
  params.set('orphans', 'true');
  if (fresh) params.set('ts', String(Date.now()));
  const res = await fetch(`${API}/global?${params}`, { cache: 'no-store' });
  return res.json() as Promise<GraphQueryResponse>;
}

async function fetchNodeNeighborhood(id: string, layer: GraphLayer) {
  const params = new URLSearchParams({ depth: '2', limit: '200', orphans: 'true' });
  if (layer !== 'blended') params.set('graphMode', layer);
  const res = await fetch(`${API}/local/${encodeURIComponent(id)}?${params}`, { cache: 'no-store' });
  return res.json() as Promise<GraphQueryResponse>;
}

async function triggerRebuild() {
  const res = await fetch(`${API}/rebuild`, { method: 'POST' });
  return res.json();
}

async function triggerAiLinks(nodeId?: string) {
  const res = await fetch(`${API}/ai-links/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nodeId ? { targetNodeId: nodeId } : { graphMode: 'blended' }),
  });
  return res.json();
}

function summarizeNodeDetail(
  nodeId: string,
  allNodes: GraphNode[],
  allEdges: GraphEdge[],
): NodeDetailState | null {
  const focusNode = allNodes.find(n => n.id === nodeId);
  if (!focusNode) return null;

  const connectedEdges = allEdges
    .filter(e => e.source === nodeId || e.target === nodeId)
    .sort((a, b) =>
      (Date.parse(b.createdAt ?? b.updatedAt ?? '') || 0) - (Date.parse(a.createdAt ?? a.updatedAt ?? '') || 0) ||
      (b.confidence ?? 0) - (a.confidence ?? 0),
    );

  const neighbors = connectedEdges
    .map(edge => {
      const neighborId = edge.source === nodeId ? edge.target : edge.source;
      const n = allNodes.find(candidate => candidate.id === neighborId);
      if (!n) return null;
      return { id: n.id, label: n.label, type: n.type, degree: n.degree } as NodeNeighborSummary;
    })
    .filter((n): n is NodeNeighborSummary => n !== null)
    .sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label));

  return { node: focusNode, edges: connectedEdges, neighbors };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [stats, setStats] = useState({ totalNodes: 0, totalEdges: 0, orphanCount: 0, aiSuggestedLinks: 0 });
  const [loading, setLoading] = useState(true);

  const [layer, setLayer] = useState<GraphLayer>('blended');
  const [filters, setFilters] = useState<FilterConfig>(defaultFilters);
  const [display, setDisplay] = useState<DisplayConfig>(defaultDisplay);
  const [physics, setPhysics] = useState<PhysicsConfig>(defaultPhysics);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeDetail, setNodeDetail] = useState<NodeDetailState | null>(null);

  // Tooltip state: hovered node + its screen position
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const containerRef = useRef<HTMLDivElement>(null);
  const detailRequestRef = useRef(0);

  // ── Resize ──────────────────────────────────────────────────────────────

  useEffect(() => {
    function onResize() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Load graph ──────────────────────────────────────────────────────────

  const loadGraph = useCallback(async (fresh?: boolean) => {
    setLoading(true);
    try {
      const data = await fetchGraph(layer, filters.searchTerm || undefined, fresh);

      let filteredNodes: GraphNode[] = (data.nodes ?? []).map((n: GraphNode) => ({
        ...n,
        visible: true,
        clusterId: display.clusterMode === 'type'  ? n.type
                 : display.clusterMode === 'group' ? n.group
                 : display.clusterMode === 'tier'  ? (n.trustTier ?? 'NONE')
                 : undefined,
      }));

      let filteredEdges: GraphEdge[] = (data.edges ?? []).map((e: GraphEdge) => ({
        ...e, visible: true,
      }));

      // Apply filters
      if (!filters.showAiLinks) {
        filteredEdges = filteredEdges.filter(e => e.createdBy !== 'ai');
      }
      if (!filters.showInferred) {
        filteredEdges = filteredEdges.filter(
          e => e.type !== 'semantic_similarity' && e.type !== 'ai_suggested_link',
        );
      }
      if (!filters.showExplicit) {
        filteredEdges = filteredEdges.filter(e => e.type !== 'explicit_link');
      }
      if (filters.trustTiers.length > 0) {
        filteredNodes = filteredNodes.filter(
          n => !n.trustTier || filters.trustTiers.includes(n.trustTier),
        );
      }

      // Remove edges to filtered-out nodes
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = filteredEdges.filter(
        e => nodeIds.has(e.source) && nodeIds.has(e.target),
      );

      // Remove orphans unless requested
      if (!filters.showOrphans) {
        const connected = new Set<string>();
        for (const e of filteredEdges) { connected.add(e.source); connected.add(e.target); }
        filteredNodes = filteredNodes.filter(n => connected.has(n.id));
      }

      setNodes(filteredNodes);
      setEdges(filteredEdges);
      setStats({
        totalNodes:       filteredNodes.length,
        totalEdges:       filteredEdges.length,
        orphanCount:      filteredNodes.filter(n => n.degree === 0).length,
        aiSuggestedLinks: filteredEdges.filter(e => e.type === 'ai_suggested_link').length,
      });
    } catch (err) {
      console.error('Graph load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [layer, filters, display.clusterMode]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // ── Node selection ──────────────────────────────────────────────────────

  const loadNodeDetail = useCallback(async (id: string) => {
    const reqId = ++detailRequestRef.current;
    try {
      const detailGraph = await fetchNodeNeighborhood(id, layer);
      if (detailRequestRef.current !== reqId) return;
      setNodeDetail(summarizeNodeDetail(id, detailGraph.nodes ?? nodes, detailGraph.edges ?? edges));
    } catch {
      if (detailRequestRef.current === reqId) {
        setNodeDetail(summarizeNodeDetail(id, nodes, edges));
      }
    }
  }, [edges, layer, nodes]);

  const handleSelectNode = useCallback(async (id: string | null) => {
    setSelectedNodeId(id);
    if (id) await loadNodeDetail(id);
    else setNodeDetail(null);
  }, [loadNodeDetail]);

  // ── Hover + tooltip ─────────────────────────────────────────────────────

  const handleHoverNode = useCallback((id: string | null, sx?: number, sy?: number) => {
    setHoveredNodeId(id);
    if (id && sx !== undefined && sy !== undefined) {
      setTooltipPos({ x: sx, y: sy });
    }
  }, []);

  const hoveredNode = hoveredNodeId ? (nodes.find(n => n.id === hoveredNodeId) ?? null) : null;

  // ── Physics preset ──────────────────────────────────────────────────────

  const handlePresetChange = useCallback((preset: PhysicsPreset) => {
    setPhysics(preset.config);
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleRebuild = useCallback(async () => {
    await triggerRebuild();
    await loadGraph(true);
    if (selectedNodeId) await loadNodeDetail(selectedNodeId);
  }, [loadGraph, loadNodeDetail, selectedNodeId]);

  const handleRunAiLinks = useCallback(async () => {
    await triggerAiLinks(selectedNodeId ?? undefined);
    await loadGraph(true);
    if (selectedNodeId) await loadNodeDetail(selectedNodeId);
  }, [selectedNodeId, loadGraph, loadNodeDetail]);

  const handleResetLayout = useCallback(() => {
    setNodes(prev => prev.map(n => ({ ...n, fx: null, fy: null, x: undefined, y: undefined })));
  }, []);

  const handleSavePreset = useCallback(async (name: string) => {
    const positions: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) {
      if (n.x !== undefined && n.y !== undefined) {
        positions[n.id] = { x: n.x, y: n.y };
      }
    }
    await fetch(`${API}/layout/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, positions }),
    });
  }, [nodes]);

  const handleDragNode = useCallback((_id: string, _x: number, _y: number) => {
    // Position updated in-canvas; no server sync on drag (only on pin)
  }, []);

  const handlePinNode = useCallback(async (id: string, x: number, y: number) => {
    await fetch(`${API}/node/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId: id, x, y }),
    });
  }, []);

  const handleAcceptSuggestion = useCallback(async (suggestionId: string) => {
    await fetch(`${API}/ai-links/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestionIds: [suggestionId], action: 'accept' }),
    });
    await loadGraph(true);
    if (selectedNodeId) await loadNodeDetail(selectedNodeId);
  }, [loadGraph, loadNodeDetail, selectedNodeId]);

  const handleRejectSuggestion = useCallback(async (suggestionId: string) => {
    await fetch(`${API}/ai-links/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestionIds: [suggestionId], action: 'reject' }),
    });
    await loadGraph(true);
    if (selectedNodeId) await loadNodeDetail(selectedNodeId);
  }, [loadGraph, loadNodeDetail, selectedNodeId]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden"
      style={{ background: 'var(--gf-canvas)', fontFamily: 'var(--gf-font-ui)' }}
    >
      {/* Loading pill */}
      {loading && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-50 text-[11px] px-4 py-1.5 rounded-full gf-statusbar"
          style={{
            background: 'rgba(13,20,33,0.9)',
            border: '1px solid rgba(56,189,248,0.2)',
            color: '#38bdf8',
            fontFamily: 'var(--gf-font-ui)',
          }}
        >
          Fetching graph…
        </div>
      )}

      {/* Canvas */}
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        physics={physics}
        display={display}
        selectedNodeId={selectedNodeId}
        hoveredNodeId={hoveredNodeId}
        onSelectNode={handleSelectNode}
        onHoverNode={handleHoverNode}
        onDoubleClickNode={handleSelectNode}
        onDragNode={handleDragNode}
        onPinNode={handlePinNode}
        width={dimensions.width}
        height={dimensions.height}
      />

      {/* Tooltip overlay */}
      {!selectedNodeId && hoveredNode && (
        <GraphTooltip
          node={hoveredNode}
          edges={edges}
          screenX={tooltipPos.x}
          screenY={tooltipPos.y}
          canvasW={dimensions.width}
          canvasH={dimensions.height}
        />
      )}

      {/* Control panel */}
      <GraphControls
        filters={filters}
        display={display}
        physics={physics}
        layer={layer}
        stats={stats}
        onFiltersChange={setFilters}
        onDisplayChange={setDisplay}
        onPhysicsChange={setPhysics}
        onLayerChange={setLayer}
        onPresetChange={handlePresetChange}
        onRebuild={handleRebuild}
        onRunAiLinks={handleRunAiLinks}
        onResetLayout={handleResetLayout}
        onSavePreset={handleSavePreset}
      />

      {/* Node inspector drawer */}
      {nodeDetail && selectedNodeId && (
        <NodeDetail
          node={nodeDetail.node}
          edges={nodeDetail.edges}
          neighbors={nodeDetail.neighbors}
          onClose={() => handleSelectNode(null)}
          onFocusNode={handleSelectNode}
          onAcceptSuggestion={handleAcceptSuggestion}
          onRejectSuggestion={handleRejectSuggestion}
        />
      )}

      {/* Status bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-5 py-1.5 gf-statusbar"
        style={{
          background: 'rgba(13,20,33,0.85)',
          borderTop: '1px solid var(--gf-separator)',
          color: 'var(--gf-text-tertiary)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="flex gap-5 font-mono">
          <span>{stats.totalNodes} nodes</span>
          <span>{stats.totalEdges} edges</span>
          {stats.orphanCount > 0 && <span>{stats.orphanCount} orphans</span>}
          {stats.aiSuggestedLinks > 0 && (
            <span style={{ color: '#f59e0b' }}>{stats.aiSuggestedLinks} AI suggestions</span>
          )}
        </div>
        <div className="flex gap-4 font-mono">
          <span className="uppercase tracking-wider">{layer}</span>
          {display.clusterMode !== 'none' && (
            <span style={{ color: 'var(--gf-text-secondary)' }}>cluster:{display.clusterMode}</span>
          )}
          {physics.frozen && <span style={{ color: '#38bdf8' }}>FROZEN</span>}
        </div>
      </div>
    </div>
  );
}
