'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import GraphCanvas, { type GraphHoverDetail } from '@/components/graph-system/GraphCanvas';
import GraphTooltip from '@/components/graph-system/GraphTooltip';
import NodeDetail from '@/components/graph-system/NodeDetail';
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
  type GraphViewMode,
} from '@/components/graph/state/graphDisplayState';
import type { GraphEdge, GraphNode } from '@/components/graph-system/types';
import { SurfaceEmptyState, SurfaceErrorState } from '@/components/intelligence-ops/primitives';
import { OperationsShell } from '@/components/intelligence-ops/shell';
import { useGraph } from '@/hooks/useGraph';

function matchesSearch(node: GraphNode, searchTerm: string): boolean {
  if (searchTerm.trim().length === 0) {
    return true;
  }

  const haystack = [
    node.id,
    node.label,
    node.title,
    node.group,
    node.trustTier ?? '',
    ...(node.tags ?? []),
  ].join(' ').toLowerCase();

  return haystack.includes(searchTerm.trim().toLowerCase());
}

function buildLocalNodeIds(rootId: string, edges: GraphEdge[]): Set<string> {
  const ids = new Set<string>([rootId]);

  for (const edge of edges) {
    if (edge.source === rootId || edge.target === rootId) {
      ids.add(edge.source);
      ids.add(edge.target);
    }
  }

  return ids;
}

function buildNeighborSummaries(selectedNodeId: string | null, nodes: GraphNode[], edges: GraphEdge[]) {
  if (!selectedNodeId) {
    return [];
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const neighborIds = new Set<string>();

  for (const edge of edges) {
    if (edge.source === selectedNodeId) {
      neighborIds.add(edge.target);
    } else if (edge.target === selectedNodeId) {
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

export function GraphWorkspace() {
  const [layer, setLayer] = useState<'knowledge' | 'trust' | 'blended'>('blended');
  const [viewMode, setViewMode] = useState<GraphViewMode>('global');
  const [filters, setFilters] = useState<GraphFilterState>(DEFAULT_GRAPH_FILTERS);
  const [visuals, setVisuals] = useState(DEFAULT_GRAPH_VISUALS);
  const [physics, setPhysics] = useState(DEFAULT_GRAPH_PHYSICS);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoverDetail, setHoverDetail] = useState<GraphHoverDetail | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const graph = useGraph({ layer, limit: 240 });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const [canvasSize, setCanvasSize] = useState({ width: 920, height: 640 });

  useEffect(() => {
    const element = canvasContainerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const width = Math.max(320, Math.floor(entry.contentRect.width));
      setCanvasSize({
        width,
        height: Math.max(420, Math.floor(Math.min(760, width * 0.72))),
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const filteredGraph = useMemo(() => {
    const allNodes = graph.data?.nodes ?? [];
    const allEdges = graph.data?.edges ?? [];

    let edges = allEdges.filter((edge) => (
      filters.linkClasses.length === 0 || filters.linkClasses.includes(classifyEdgeType(edge))
    ));
    if (!filters.showDirected) {
      edges = edges.filter((edge) => !edge.directed || edge.reciprocal);
    }

    let nodes = allNodes.filter((node) => (
      (filters.nodeTypes.length === 0 || filters.nodeTypes.includes(node.type))
      && (filters.trustTiers.length === 0 || (node.trustTier ? filters.trustTiers.includes(node.trustTier) : false))
      && matchesSearch(node, filters.searchTerm)
    ));

    const visibleNodeIds = new Set(nodes.map((node) => node.id));
    edges = edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));

    if (!filters.showOrphans) {
      const connectedNodeIds = new Set<string>();
      for (const edge of edges) {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      }
      nodes = nodes.filter((node) => connectedNodeIds.has(node.id));
    }

    const localRootId = selectedNodeId ?? graph.data?.focusNodeId ?? nodes[0]?.id ?? null;
    if (viewMode === 'local' && localRootId) {
      const localNodeIds = buildLocalNodeIds(localRootId, edges);
      nodes = nodes.filter((node) => localNodeIds.has(node.id));
      edges = edges.filter((edge) => localNodeIds.has(edge.source) && localNodeIds.has(edge.target));
    }

    return { nodes, edges };
  }, [
    filters,
    graph.data?.edges,
    graph.data?.focusNodeId,
    graph.data?.nodes,
    selectedNodeId,
    viewMode,
  ]);

  useEffect(() => {
    const nodeIds = new Set(filteredGraph.nodes.map((node) => node.id));
    const fallbackNodeId = graph.data?.focusNodeId ?? filteredGraph.nodes[0]?.id ?? null;

    if (!selectedNodeId && fallbackNodeId) {
      setSelectedNodeId(fallbackNodeId);
      return;
    }

    if (selectedNodeId && !nodeIds.has(selectedNodeId)) {
      setSelectedNodeId(fallbackNodeId);
    }
  }, [filteredGraph.nodes, graph.data?.focusNodeId, selectedNodeId]);

  const stats = useMemo(
    () => resolveGraphStats(filteredGraph.nodes, filteredGraph.edges),
    [filteredGraph.edges, filteredGraph.nodes],
  );
  const availableNodeTypes = useMemo(
    () => collectNodeTypes(graph.data?.nodes ?? []),
    [graph.data?.nodes],
  );
  const availableTrustTiers = useMemo(
    () => collectTrustTiers(graph.data?.nodes ?? []),
    [graph.data?.nodes],
  );
  const selectedNode = useMemo(
    () => filteredGraph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [filteredGraph.nodes, selectedNodeId],
  );
  const neighbors = useMemo(
    () => buildNeighborSummaries(selectedNodeId, filteredGraph.nodes, filteredGraph.edges),
    [filteredGraph.edges, filteredGraph.nodes, selectedNodeId],
  );
  const highlightSeed = hoveredNodeId ?? selectedNodeId;
  const highlighted = useMemo(() => {
    if (!highlightSeed) {
      return {
        nodeIds: new Set<string>(),
        edgeIds: new Set<string>(),
      };
    }

    const nodeIds = new Set<string>([highlightSeed]);
    const edgeIds = new Set<string>();
    for (const edge of filteredGraph.edges) {
      if (edge.source === highlightSeed || edge.target === highlightSeed) {
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
        edgeIds.add(edge.id);
      }
    }

    return { nodeIds, edgeIds };
  }, [filteredGraph.edges, highlightSeed]);

  const canvasContent = (() => {
    if (graph.error && !graph.data) {
      return (
        <SurfaceErrorState
          title="Graph unavailable"
          description={graph.error}
          onRetry={graph.refresh}
        />
      );
    }

    if (!graph.loading && filteredGraph.nodes.length === 0) {
      return (
        <SurfaceEmptyState
          title="No relationships yet"
          description="The intelligence graph has no visible relationships for this scope."
        />
      );
    }

    return (
      <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
        <div ref={canvasContainerRef} className="relative min-h-[420px]">
          <GraphCanvas
            nodes={filteredGraph.nodes}
            edges={filteredGraph.edges}
            physics={physics}
            visuals={visuals}
            selectedNodeId={selectedNodeId}
            hoveredNodeId={hoveredNodeId}
            highlightedNodeIds={highlighted.nodeIds}
            highlightedEdgeIds={highlighted.edgeIds}
            onSelectNode={setSelectedNodeId}
            onHoverNode={setHoveredNodeId}
            onHoverDetailChange={setHoverDetail}
            onDoubleClickNode={(nodeId) => {
              setSelectedNodeId(nodeId);
              setViewMode('local');
            }}
            onDragNode={() => {}}
            onPinNode={() => {}}
            onViewportChange={() => {}}
            disableInternalTooltip
            width={canvasSize.width}
            height={canvasSize.height}
            layoutVersion={layoutVersion}
          />
        </div>
      </div>
    );
  })();

  return (
    <OperationsShell
      activeHref="/graph"
      title="Trust Graph"
      description="Explore live intelligence relationships, focus the evidence neighborhood around a node, and inspect graph structure without dropping back into the dashboard shell."
      breadcrumbs={[{ label: 'Graph' }]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Graph health</p>
          <p>{stats.totalNodes} nodes</p>
          <p>{stats.totalEdges} edges</p>
        </div>
      )}
      actions={null}
    >
      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_24rem]">
        <div className="space-y-4">
          <GraphControls
            layer={layer}
            viewMode={viewMode}
            filters={filters}
            visuals={visuals}
            physics={physics}
            stats={stats}
            availableNodeTypes={availableNodeTypes}
            availableTrustTiers={availableTrustTiers}
            canUseLocalMode={filteredGraph.nodes.length > 0}
            onLayerChange={setLayer}
            onViewModeChange={setViewMode}
            onFiltersChange={setFilters}
            onVisualsChange={setVisuals}
            onPhysicsChange={setPhysics}
            onPresetChange={(preset) => setPhysics(applyPhysicsPreset(preset, physics.frozen))}
            onResetLayout={() => setLayoutVersion((current) => current + 1)}
            onRunAiLinks={() => {}}
            onRebuild={() => {
              graph.refresh();
              setLayoutVersion((current) => current + 1);
            }}
          />
        </div>

        <div className="space-y-4">
          {canvasContent}
        </div>

        <div className="space-y-4">
          {selectedNode ? (
            <NodeDetail
              node={selectedNode}
              edges={filteredGraph.edges}
              neighbors={neighbors}
              onClose={() => setSelectedNodeId(null)}
              onFocusNode={setSelectedNodeId}
              onAcceptSuggestion={() => {}}
              onRejectSuggestion={() => {}}
            />
          ) : (
            <SurfaceEmptyState
              title="Select a node"
              description="Choose a graph node to inspect connected evidence, relationships, and pending suggestions."
            />
          )}
        </div>
      </div>

      <GraphTooltip
        node={hoverDetail?.node ?? null}
        edges={filteredGraph.edges}
        screenX={hoverDetail?.screenX ?? 0}
        screenY={hoverDetail?.screenY ?? 0}
        canvasW={viewport.width}
        canvasH={viewport.height}
      />
    </OperationsShell>
  );
}
