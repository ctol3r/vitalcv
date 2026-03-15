'use client';

/**
 * /graph — Full graph explorer page
 *
 * Dual graph system: Knowledge + Trust, with AI bi-directional linking,
 * full controls, and premium dark-theme visuals.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import GraphCanvas from '../../components/graph-system/GraphCanvas';
import GraphControls from '../../components/graph-system/GraphControls';
import NodeDetail from '../../components/graph-system/NodeDetail';
import type {
  GraphNode, GraphEdge, FilterConfig, DisplayConfig, PhysicsConfig,
  GraphLayer,
} from '../../components/graph-system/types';
import type { NodeNeighborSummary } from '../../components/graph-system/nodeDetailModel';

// ── Default config ────────────────────────────────────────────────────────────

const defaultFilters: FilterConfig = {
  nodeTypes: [],
  edgeTypes: [],
  trustTiers: ['GOLD', 'SILVER', 'BRONZE'],
  tags: [],
  showOrphans: false,
  showAttachments: true,
  showExplicit: true,
  showInferred: true,
  showAiLinks: true,
  showDirected: true,
  searchTerm: '',
  groups: [],
};

const defaultDisplay: DisplayConfig = {
  showArrows: true,
  showLabels: true,
  animate: true,
  nodeSize: 6,
  linkThickness: 1.5,
  textFadeThreshold: 0.5,
  colorMode: 'type',
  clusterMode: 'type',
};

const defaultPhysics: PhysicsConfig = {
  centerForce: 0.3,
  repelForce: 120,
  linkForce: 0.4,
  linkDistance: 100,
  clusterSpacing: 60,
  frozen: false,
};

// ── API helpers ───────────────────────────────────────────────────────────────

const API = '/api/graph-engine';

interface GraphQueryResponse {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  stats?: {
    totalNodes: number;
    totalEdges: number;
    orphanCount: number;
    aiSuggestedLinks: number;
  };
}

interface NodeDetailState {
  node: GraphNode;
  edges: GraphEdge[];
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
  const params = new URLSearchParams({
    depth: '2',
    limit: '200',
    orphans: 'true',
  });
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
  const focusNode = allNodes.find((candidate) => candidate.id === nodeId);
  if (!focusNode) return null;

  const connectedEdges = allEdges
    .filter((edge) => edge.source === nodeId || edge.target === nodeId)
    .sort((left, right) =>
      (Date.parse(right.createdAt ?? right.updatedAt ?? '') || 0) - (Date.parse(left.createdAt ?? left.updatedAt ?? '') || 0)
      || (right.confidence ?? 0) - (left.confidence ?? 0),
    );

  const neighbors = connectedEdges
    .map((edge) => {
      const neighborId = edge.source === nodeId ? edge.target : edge.source;
      const neighborNode = allNodes.find((candidate) => candidate.id === neighborId);
      if (!neighborNode) return null;
      const neighbor: NodeNeighborSummary = {
        id: neighborNode.id,
        label: neighborNode.label,
        type: neighborNode.type,
        degree: neighborNode.degree,
      };
      return neighbor;
    })
    .filter((neighbor): neighbor is NodeNeighborSummary => neighbor !== null)
    .sort((left, right) => right.degree - left.degree || left.label.localeCompare(right.label));

  return {
    node: focusNode,
    edges: connectedEdges,
    neighbors,
  };
}

// ── Page component ────────────────────────────────────────────────────────────

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
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [nodeDetail, setNodeDetail] = useState<NodeDetailState | null>(null);

  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const containerRef = useRef<HTMLDivElement>(null);
  const detailRequestRef = useRef(0);

  // ── Resize handler ──────────────────────────────────────────────────────

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

  // ── Load graph data ─────────────────────────────────────────────────────

  const loadGraph = useCallback(async (fresh?: boolean) => {
    setLoading(true);
    try {
      const data = await fetchGraph(layer, filters.searchTerm || undefined, fresh);

      let filteredNodes: GraphNode[] = (data.nodes ?? []).map((n: GraphNode) => ({
        ...n,
        visible: true,
        clusterId: display.clusterMode === 'type' ? n.type : display.clusterMode === 'group' ? n.group : display.clusterMode === 'tier' ? (n.trustTier ?? 'NONE') : undefined,
      }));

      let filteredEdges: GraphEdge[] = (data.edges ?? []).map((e: GraphEdge) => ({
        ...e,
        visible: true,
      }));

      // Apply filters
      if (!filters.showOrphans) {
        const connected = new Set<string>();
        for (const e of filteredEdges) { connected.add(e.source); connected.add(e.target); }
        filteredNodes = filteredNodes.filter(n => connected.has(n.id));
      }

      if (!filters.showAiLinks) {
        filteredEdges = filteredEdges.filter(e => e.createdBy !== 'ai');
      }

      if (!filters.showInferred) {
        filteredEdges = filteredEdges.filter(e => e.type !== 'semantic_similarity' && e.type !== 'ai_suggested_link');
      }

      if (!filters.showExplicit) {
        filteredEdges = filteredEdges.filter(e => e.type !== 'explicit_link');
      }

      if (filters.trustTiers.length > 0) {
        filteredNodes = filteredNodes.filter((node) =>
          !node.trustTier || filters.trustTiers.includes(node.trustTier),
        );
      }

      // Filter to visible node IDs
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = filteredEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
      if (!filters.showOrphans) {
        const connected = new Set<string>();
        for (const edge of filteredEdges) {
          connected.add(edge.source);
          connected.add(edge.target);
        }
        filteredNodes = filteredNodes.filter((node) => connected.has(node.id));
      }

      setNodes(filteredNodes);
      setEdges(filteredEdges);
      setStats({
        totalNodes: filteredNodes.length,
        totalEdges: filteredEdges.length,
        orphanCount: filteredNodes.filter((node) => node.degree === 0).length,
        aiSuggestedLinks: filteredEdges.filter((edge) => edge.type === 'ai_suggested_link').length,
      });
    } catch (err) {
      console.error('Graph load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [layer, filters, display.clusterMode]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  useEffect(() => {
    if (!selectedNodeId) return;
    if (!nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
      setNodeDetail(null);
      return;
    }
    setNodeDetail((current) => {
      if (!current || current.node.id !== selectedNodeId) return current;
      return summarizeNodeDetail(selectedNodeId, nodes, edges) ?? current;
    });
  }, [edges, nodes, selectedNodeId]);

  // ── Node selection ──────────────────────────────────────────────────────

  const loadNodeDetail = useCallback(async (id: string) => {
    const requestId = ++detailRequestRef.current;
    try {
      const detailGraph = await fetchNodeNeighborhood(id, layer);
      if (detailRequestRef.current !== requestId) return;
      const detail = summarizeNodeDetail(
        id,
        detailGraph.nodes ?? nodes,
        detailGraph.edges ?? edges,
      );
      setNodeDetail(detail);
    } catch {
      if (detailRequestRef.current === requestId) {
        setNodeDetail(summarizeNodeDetail(id, nodes, edges));
      }
    }
  }, [edges, layer, nodes]);

  const handleSelectNode = useCallback(async (id: string | null) => {
    setSelectedNodeId(id);
    if (id) {
      await loadNodeDetail(id);
    } else {
      setNodeDetail(null);
    }
  }, [loadNodeDetail]);

  const handleDoubleClick = useCallback((id: string) => {
    // Focus: load local graph around this node
    handleSelectNode(id);
  }, [handleSelectNode]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleRebuild = useCallback(async () => {
    await triggerRebuild();
    await loadGraph(true);
    if (selectedNodeId) {
      await loadNodeDetail(selectedNodeId);
    }
  }, [loadGraph, loadNodeDetail, selectedNodeId]);

  const handleRunAiLinks = useCallback(async () => {
    await triggerAiLinks(selectedNodeId ?? undefined);
    await loadGraph(true);
    if (selectedNodeId) {
      await loadNodeDetail(selectedNodeId);
    }
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

  const handleDragNode = useCallback((id: string, x: number, y: number) => {
    // Update node position after drag
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
    if (selectedNodeId) {
      await loadNodeDetail(selectedNodeId);
    }
  }, [loadGraph, loadNodeDetail, selectedNodeId]);

  const handleRejectSuggestion = useCallback(async (suggestionId: string) => {
    await fetch(`${API}/ai-links/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestionIds: [suggestionId], action: 'reject' }),
    });
    await loadGraph(true);
    if (selectedNodeId) {
      await loadNodeDetail(selectedNodeId);
    }
  }, [loadGraph, loadNodeDetail, selectedNodeId]);

  return (
    <div ref={containerRef} className="fixed inset-0 bg-[#080e1a] overflow-hidden">
      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 text-xs text-cyan-400 bg-slate-900/80 px-3 py-1.5 rounded-full border border-cyan-800/30">
          Loading graph…
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
        onHoverNode={setHoveredNodeId}
        onDoubleClickNode={handleDoubleClick}
        onDragNode={handleDragNode}
        onPinNode={handlePinNode}
        width={dimensions.width}
        height={dimensions.height}
      />

      {/* Controls panel */}
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
        onRebuild={handleRebuild}
        onRunAiLinks={handleRunAiLinks}
        onResetLayout={handleResetLayout}
        onSavePreset={handleSavePreset}
      />

      {/* Node detail panel */}
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

      {/* Bottom status bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-1.5 bg-slate-900/80 border-t border-slate-800/50 text-[10px] text-slate-500">
        <div className="flex gap-4">
          <span>{stats.totalNodes} nodes</span>
          <span>{stats.totalEdges} edges</span>
          <span>{stats.orphanCount} orphans</span>
          {stats.aiSuggestedLinks > 0 && <span className="text-amber-500">{stats.aiSuggestedLinks} AI suggestions</span>}
        </div>
        <div className="flex gap-4">
          <span className="uppercase">{layer}</span>
          <span>{display.clusterMode !== 'none' ? `clustered: ${display.clusterMode}` : 'flat'}</span>
          {physics.frozen && <span className="text-cyan-400">frozen</span>}
        </div>
      </div>
    </div>
  );
}
