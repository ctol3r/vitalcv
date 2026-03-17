'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import GraphCanvas, { type GraphHoverDetail } from '@/components/graph-system/GraphCanvas';
import GraphTooltip from '@/components/graph-system/GraphTooltip';
import NodeDetail from '@/components/graph-system/NodeDetail';
import type { NodeNeighborSummary } from '@/components/graph-system/nodeDetailModel';
import { GraphControls } from '@/components/graph/GraphControls';
import { applyPhysicsPreset } from '@/components/graph/physics/presets';
import {
  classifyEdgeType,
  collectNodeTypes,
  collectTrustTiers,
  DEFAULT_GRAPH_FILTERS,
  DEFAULT_GRAPH_PHYSICS,
  DEFAULT_GRAPH_VISUALS,
  resolveGraphStats,
  type GraphFilterState,
  type GraphPhysicsPresetId,
  type GraphPhysicsState,
  type GraphViewMode,
  type GraphVisualState,
} from '@/components/graph/state/graphDisplayState';
import type { GraphEdge, GraphLayer, GraphNode } from '@/components/graph-system/types';
import { useGraph } from '@/hooks/useGraph';
import { OperationsShell } from '@/components/intelligence-ops/shell';
import { OpsCard, SurfaceBanner, SurfaceEmptyState } from '@/components/intelligence-ops/primitives';
import { useSearchParams } from 'next/navigation';

function createNeighborSummaries(nodes: GraphNode[], edges: GraphEdge[], nodeId: string | null): NodeNeighborSummary[] {
  if (!nodeId) {
    return [];
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const neighborIds = new Set<string>();
  for (const edge of edges) {
    if (edge.source === nodeId) {
      neighborIds.add(edge.target);
    }
    if (edge.target === nodeId) {
      neighborIds.add(edge.source);
    }
  }

  return [...neighborIds]
    .map((neighborId) => nodeById.get(neighborId))
    .filter((node): node is GraphNode => Boolean(node))
    .map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      degree: node.degree,
    }));
}

function applyGraphFilters(
  nodes: GraphNode[],
  edges: GraphEdge[],
  filters: GraphFilterState,
  viewMode: GraphViewMode,
  rootNodeId: string | null,
) {
  const normalizedSearch = filters.searchTerm.trim().toLowerCase();
  const visibleEdgeClasses = new Set(filters.linkClasses);

  let nextNodes = nodes.filter((node) => {
    if (filters.nodeTypes.length > 0 && !filters.nodeTypes.includes(node.type)) {
      return false;
    }

    if (filters.trustTiers.length > 0 && (!node.trustTier || !filters.trustTiers.includes(node.trustTier))) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const haystack = [
      node.id,
      node.label,
      node.title,
      node.group,
      ...(node.tags ?? []),
    ].join(' ').toLowerCase();

    return haystack.includes(normalizedSearch);
  });

  const visibleNodeIds = new Set(nextNodes.map((node) => node.id));
  let nextEdges = edges.filter((edge) => {
    if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
      return false;
    }

    if (!visibleEdgeClasses.has(classifyEdgeType(edge))) {
      return false;
    }

    if (!filters.showDirected && edge.directed) {
      return false;
    }

    return true;
  });

  const activeRootId = viewMode === 'local' ? rootNodeId : null;
  if (activeRootId) {
    const localNodeIds = new Set<string>([activeRootId]);
    for (const edge of nextEdges) {
      if (edge.source === activeRootId || edge.target === activeRootId) {
        localNodeIds.add(edge.source);
        localNodeIds.add(edge.target);
      }
    }

    nextNodes = nextNodes.filter((node) => localNodeIds.has(node.id));
    visibleNodeIds.clear();
    for (const node of nextNodes) {
      visibleNodeIds.add(node.id);
    }
    nextEdges = nextEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
  }

  if (!filters.showOrphans) {
    const connectedNodeIds = new Set<string>();
    for (const edge of nextEdges) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }
    nextNodes = nextNodes.filter((node) => connectedNodeIds.has(node.id) || node.id === activeRootId);
  }

  return {
    nodes: nextNodes,
    edges: nextEdges,
  };
}

export function GraphWorkspacePage() {
  const searchParams = useSearchParams();
  const requestedNpi = searchParams.get('npi');
  const [layer, setLayer] = useState<GraphLayer>('blended');
  const [viewMode, setViewMode] = useState<GraphViewMode>('global');
  const [filters, setFilters] = useState<GraphFilterState>(DEFAULT_GRAPH_FILTERS);
  const [visuals, setVisuals] = useState<GraphVisualState>(DEFAULT_GRAPH_VISUALS);
  const [physics, setPhysics] = useState<GraphPhysicsState>(DEFAULT_GRAPH_PHYSICS);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoverDetail, setHoverDetail] = useState<GraphHoverDetail | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 620 });
  const [viewportSize, setViewportSize] = useState({ width: 1440, height: 900 });
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const graph = useGraph({
    npi: requestedNpi,
    layer,
    limit: 240,
  });

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const width = Math.max(320, Math.floor(entry.contentRect.width));
      const height = Math.max(420, Math.floor(Math.min(760, width * 0.72)));
      setCanvasSize({ width, height });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (!graph.data) {
      return;
    }

    if (!selectedNodeId || !graph.data.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(graph.data.focusNodeId ?? graph.data.nodes[0]?.id ?? null);
    }
  }, [graph.data, selectedNodeId]);

  const filteredGraph = useMemo(() => applyGraphFilters(
    graph.data?.nodes ?? [],
    graph.data?.edges ?? [],
    filters,
    viewMode,
    viewMode === 'local' ? (selectedNodeId ?? graph.data?.focusNodeId ?? null) : null,
  ), [filters, graph.data, selectedNodeId, viewMode]);

  const selectedNode = useMemo(
    () => filteredGraph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [filteredGraph.nodes, selectedNodeId],
  );
  const neighbors = useMemo(
    () => createNeighborSummaries(filteredGraph.nodes, filteredGraph.edges, selectedNodeId),
    [filteredGraph.edges, filteredGraph.nodes, selectedNodeId],
  );
  const highlightedSets = useMemo(() => {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    const focusId = hoveredNodeId ?? selectedNodeId;
    if (!focusId) {
      return {
        nodeIds,
        edgeIds,
      };
    }

    nodeIds.add(focusId);
    for (const edge of filteredGraph.edges) {
      if (edge.source === focusId || edge.target === focusId) {
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
        edgeIds.add(edge.id);
      }
    }

    return {
      nodeIds,
      edgeIds,
    };
  }, [filteredGraph.edges, hoveredNodeId, selectedNodeId]);

  const availableNodeTypes = useMemo(
    () => collectNodeTypes(graph.data?.nodes ?? []),
    [graph.data?.nodes],
  );
  const availableTrustTiers = useMemo(
    () => collectTrustTiers(graph.data?.nodes ?? []),
    [graph.data?.nodes],
  );
  const stats = useMemo(
    () => resolveGraphStats(filteredGraph.nodes, filteredGraph.edges),
    [filteredGraph.edges, filteredGraph.nodes],
  );

  const empty = !graph.loading && filteredGraph.nodes.length === 0;

  return (
    <OperationsShell
      activeHref="/graph"
      activeNavKey="dashboard"
      title="Relationship Graph"
      description="Direct graph exploration for provider, trust, and evidence relationships. Filter the topology, inspect nodes, and pivot into local neighborhoods without routing back through the console dashboard."
      breadcrumbs={[{ label: 'Graph' }]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Graph posture</p>
          <p>{stats.totalNodes} visible nodes • {stats.totalEdges} visible edges</p>
          {graph.data?.generatedAt ? <p>{new Date(graph.data.generatedAt).toLocaleString()}</p> : null}
        </div>
      )}
      banner={graph.error ? (
        <SurfaceBanner tone="warning">
          Graph data is currently unavailable. Showing the current empty-state workspace instead of an upstream failure.
        </SurfaceBanner>
      ) : null}
    >
      {empty ? (
        <SurfaceEmptyState
          title="No relationships yet"
          description="The trust graph has not produced any visible nodes for this scope."
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_24rem]">
        <div className="space-y-4">
          <GraphControls
            availableNodeTypes={availableNodeTypes}
            availableTrustTiers={availableTrustTiers}
            canUseLocalMode={Boolean(selectedNodeId)}
            filters={filters}
            layer={layer}
            onFiltersChange={setFilters}
            onLayerChange={setLayer}
            onPhysicsChange={setPhysics}
            onPresetChange={(preset: GraphPhysicsPresetId) => setPhysics(applyPhysicsPreset(preset, physics.frozen))}
            onRebuild={graph.refresh}
            onResetLayout={() => setLayoutVersion((current) => current + 1)}
            onRunAiLinks={graph.refresh}
            onSavePreset={() => {}}
            onViewModeChange={setViewMode}
            onVisualsChange={setVisuals}
            physics={physics}
            stats={stats}
            viewMode={viewMode}
            visuals={visuals}
          />
        </div>

        <OpsCard className="space-y-4 overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Graph canvas</h2>
              <p className="text-sm text-[var(--vt-text-3)]">Scroll to zoom, drag to pan, click to inspect, double-click to focus local context.</p>
            </div>
          </div>

          <div ref={canvasContainerRef} className="relative min-h-[28rem] rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-2">
            {!empty ? (
              <>
                <GraphCanvas
                  disableInternalTooltip
                  edges={filteredGraph.edges}
                  height={canvasSize.height}
                  highlightedEdgeIds={highlightedSets.edgeIds}
                  highlightedNodeIds={highlightedSets.nodeIds}
                  hoveredNodeId={hoveredNodeId}
                  layoutVersion={layoutVersion}
                  nodes={filteredGraph.nodes}
                  onDoubleClickNode={(nodeId) => {
                    setSelectedNodeId(nodeId);
                    setViewMode('local');
                  }}
                  onDragNode={() => {}}
                  onHoverDetailChange={setHoverDetail}
                  onHoverNode={setHoveredNodeId}
                  onPinNode={() => {}}
                  onSelectNode={setSelectedNodeId}
                  physics={physics}
                  selectedNodeId={selectedNodeId}
                  visuals={visuals}
                  width={canvasSize.width}
                />
                <GraphTooltip
                  canvasH={viewportSize.height}
                  canvasW={viewportSize.width}
                  edges={filteredGraph.edges}
                  node={hoverDetail?.node ?? null}
                  screenX={hoverDetail?.screenX ?? 0}
                  screenY={hoverDetail?.screenY ?? 0}
                />
              </>
            ) : null}
          </div>
        </OpsCard>

        <div className="space-y-4">
          {selectedNode ? (
            <NodeDetail
              edges={filteredGraph.edges}
              neighbors={neighbors}
              node={selectedNode}
              onAcceptSuggestion={() => {}}
              onClose={() => setSelectedNodeId(null)}
              onFocusNode={(nodeId) => {
                setSelectedNodeId(nodeId);
                setViewMode('local');
              }}
              onRejectSuggestion={() => {}}
            />
          ) : (
            <OpsCard>
              <p className="text-sm text-[var(--vt-text-3)]">Select a node to inspect its relationships, evidence stack, and suggestions.</p>
            </OpsCard>
          )}
        </div>
      </div>
    </OperationsShell>
  );
}
