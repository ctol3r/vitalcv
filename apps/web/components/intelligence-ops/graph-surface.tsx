'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import GraphCanvas, { type GraphHoverDetail } from '@/components/graph-system/GraphCanvas';
import GraphTooltip from '@/components/graph-system/GraphTooltip';
import NodeDetail from '@/components/graph-system/NodeDetail';
import type { GraphEdge, GraphLayer, GraphNode } from '@/components/graph-system/types';
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
} from '@/components/graph/state/graphDisplayState';
import { useGraph } from '@/hooks/useGraph';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { OperationsShell } from './shell';
import { OpsCard, SurfaceBanner, SurfaceEmptyState, SurfaceErrorState } from './primitives';

function extractNpi(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getNodeNpi(node: GraphNode | null): string | null {
  if (!node) {
    return null;
  }

  const metadata = node.metadata as Record<string, unknown>;
  return extractNpi(metadata?.providerNpi)
    ?? extractNpi(metadata?.npi)
    ?? (node.type === 'provider' ? extractNpi(node.id) : null);
}

function filterGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: {
    searchTerm: string;
    nodeTypes: string[];
    trustTiers: string[];
    linkClasses: string[];
    showDirected: boolean;
    showOrphans: boolean;
    localRootId: string | null;
  },
) {
  const normalizedSearch = options.searchTerm.trim().toLowerCase();
  let visibleNodeIds = new Set(
    nodes
      .filter((node) => {
        if (options.nodeTypes.length > 0 && !options.nodeTypes.includes(node.type)) {
          return false;
        }

        if (options.trustTiers.length > 0 && (!node.trustTier || !options.trustTiers.includes(node.trustTier))) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const metadataText = Object.values(node.metadata ?? {}).join(' ').toLowerCase();
        return [
          node.id,
          node.label,
          node.title,
          metadataText,
        ]
          .filter((value) => value.length > 0)
          .some((value) => value.toLowerCase().includes(normalizedSearch));
      })
      .map((node) => node.id),
  );

  if (options.localRootId && visibleNodeIds.has(options.localRootId)) {
    const localIds = new Set<string>([options.localRootId]);
    for (const edge of edges) {
      if (edge.source === options.localRootId || edge.target === options.localRootId) {
        localIds.add(edge.source);
        localIds.add(edge.target);
      }
    }

    visibleNodeIds = new Set([...visibleNodeIds].filter((nodeId) => localIds.has(nodeId)));
  }

  let filteredEdges = edges.filter((edge) => {
    if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
      return false;
    }

    if (!options.showDirected && edge.directed) {
      return false;
    }

    return options.linkClasses.includes(classifyEdgeType(edge));
  });

  if (!options.showOrphans) {
    const connectedNodeIds = new Set<string>();
    for (const edge of filteredEdges) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }

    visibleNodeIds = new Set([...visibleNodeIds].filter((nodeId) => connectedNodeIds.has(nodeId)));
    filteredEdges = filteredEdges.filter((edge) => (
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    ));
  }

  return {
    nodes: nodes.filter((node) => visibleNodeIds.has(node.id)),
    edges: filteredEdges,
  };
}

function buildNodeNeighbors(node: GraphNode, nodes: GraphNode[], edges: GraphEdge[]) {
  const nodeById = new Map(nodes.map((entry) => [entry.id, entry]));
  return edges
    .filter((edge) => edge.source === node.id || edge.target === node.id)
    .map((edge) => {
      const neighborId = edge.source === node.id ? edge.target : edge.source;
      const neighbor = nodeById.get(neighborId);
      if (!neighbor) {
        return null;
      }

      return {
        id: neighbor.id,
        label: neighbor.label,
        type: neighbor.type,
        degree: neighbor.degree,
      };
    })
    .filter((neighbor): neighbor is NonNullable<typeof neighbor> => Boolean(neighbor));
}

export function GraphSurface() {
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 620 });
  const [viewportSize, setViewportSize] = useState({ width: 1440, height: 900 });
  const [layer, setLayer] = useState<GraphLayer>('blended');
  const [viewMode, setViewMode] = useState<'global' | 'local'>('global');
  const [filters, setFilters] = useState(DEFAULT_GRAPH_FILTERS);
  const [visuals, setVisuals] = useState(DEFAULT_GRAPH_VISUALS);
  const [physics, setPhysics] = useState(DEFAULT_GRAPH_PHYSICS);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoverDetail, setHoverDetail] = useState<GraphHoverDetail | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const focusedNpi = searchParams.get('npi');
  const requestedLayer = searchParams.get('layer');

  const graph = useGraph({
    npi: focusedNpi,
    layer,
    pollIntervalMs: 45_000,
  });

  useEffect(() => {
    if (requestedLayer === 'knowledge' || requestedLayer === 'trust' || requestedLayer === 'blended') {
      setLayer(requestedLayer);
    }
  }, [requestedLayer]);

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
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.max(320, Math.floor(entry.contentRect.width));
      const nextHeight = nextWidth < 720 ? 440 : 620;
      setCanvasSize({ width: nextWidth, height: nextHeight });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedNodeId && graph.data?.focusNodeId) {
      setSelectedNodeId(graph.data.focusNodeId);
    }
  }, [graph.data?.focusNodeId, selectedNodeId]);

  const filteredGraph = useMemo(() => {
    return filterGraph(
      graph.data?.nodes ?? [],
      graph.data?.edges ?? [],
      {
        searchTerm: filters.searchTerm,
        nodeTypes: filters.nodeTypes,
        trustTiers: filters.trustTiers,
        linkClasses: filters.linkClasses,
        showDirected: filters.showDirected,
        showOrphans: filters.showOrphans,
        localRootId: viewMode === 'local' ? (selectedNodeId ?? graph.data?.focusNodeId ?? null) : null,
      },
    );
  }, [
    filters.linkClasses,
    filters.nodeTypes,
    filters.searchTerm,
    filters.showDirected,
    filters.showOrphans,
    filters.trustTiers,
    graph.data?.edges,
    graph.data?.focusNodeId,
    graph.data?.nodes,
    selectedNodeId,
    viewMode,
  ]);

  const stats = useMemo(
    () => resolveGraphStats(filteredGraph.nodes, filteredGraph.edges),
    [filteredGraph.edges, filteredGraph.nodes],
  );
  const activeHighlightNodeId = hoveredNodeId ?? selectedNodeId;
  const highlightedNodeIds = useMemo(() => {
    const result = new Set<string>();
    if (!activeHighlightNodeId) {
      return result;
    }

    result.add(activeHighlightNodeId);
    for (const edge of filteredGraph.edges) {
      if (edge.source === activeHighlightNodeId || edge.target === activeHighlightNodeId) {
        result.add(edge.source);
        result.add(edge.target);
      }
    }

    return result;
  }, [activeHighlightNodeId, filteredGraph.edges]);
  const highlightedEdgeIds = useMemo(() => {
    const result = new Set<string>();
    if (!activeHighlightNodeId) {
      return result;
    }

    for (const edge of filteredGraph.edges) {
      if (edge.source === activeHighlightNodeId || edge.target === activeHighlightNodeId) {
        result.add(edge.id);
      }
    }

    return result;
  }, [activeHighlightNodeId, filteredGraph.edges]);

  const selectedNode = useMemo(
    () => filteredGraph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [filteredGraph.nodes, selectedNodeId],
  );
  const selectedNodeNpi = useMemo(() => getNodeNpi(selectedNode), [selectedNode]);
  const selectedNodeEdges = useMemo(
    () => selectedNode ? filteredGraph.edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id) : [],
    [filteredGraph.edges, selectedNode],
  );
  const selectedNodeNeighbors = useMemo(
    () => selectedNode ? buildNodeNeighbors(selectedNode, filteredGraph.nodes, filteredGraph.edges) : [],
    [filteredGraph.edges, filteredGraph.nodes, selectedNode],
  );
  const openFullGraphHref = useMemo(() => {
    const params = new URLSearchParams();
    const nodeNpi = selectedNodeNpi ?? focusedNpi;

    if (nodeNpi) {
      params.set('npi', nodeNpi);
      params.set('providerId', nodeNpi);
    }

    if (selectedNodeId) {
      params.set('focusNodeId', selectedNodeId);
    }

    const serialized = params.toString();
    return serialized.length > 0 ? `/graph?${serialized}` : '/graph';
  }, [focusedNpi, selectedNodeId, selectedNodeNpi]);

  return (
    <OperationsShell
      activeHref="/intelligence"
      activeNavKey="graph"
      title="Relationship Graph"
      description="Explore live provider, credential, and evidence relationships with graph-native controls and node-level inspection."
      breadcrumbs={[{ label: 'Graph' }]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Graph state</p>
          <p>{stats.totalNodes} nodes • {stats.totalEdges} edges</p>
          {graph.lastUpdated ? (
            <p title={formatAbsoluteTime(graph.lastUpdated)}>Updated {formatRelativeTime(graph.lastUpdated)}</p>
          ) : null}
        </div>
      )}
      actions={(
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={graph.refresh}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-4 py-2 text-sm font-medium text-[var(--vt-text-1)] transition hover:bg-[var(--vt-surface-2)]"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link
            href={openFullGraphHref}
            className="inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/15"
          >
            Open full graph
          </Link>
        </div>
      )}
      banner={(
        <>
          {graph.recovering && graph.error ? (
            <SurfaceBanner tone="warning">
              Live graph refresh failed. Showing the last successful relationship snapshot while the data plane recovers.
            </SurfaceBanner>
          ) : null}
        </>
      )}
    >
      {graph.error && !(graph.data?.nodes?.length ?? 0) ? (
        <SurfaceErrorState
          title="Graph unavailable"
          description={graph.error}
          onRetry={graph.refresh}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_24rem]">
        <div className="space-y-4">
          <GraphControls
            layer={layer}
            viewMode={viewMode}
            filters={filters}
            visuals={visuals}
            physics={physics}
            stats={stats}
            availableNodeTypes={collectNodeTypes(graph.data?.nodes ?? [])}
            availableTrustTiers={collectTrustTiers(graph.data?.nodes ?? [])}
            canUseLocalMode={Boolean(selectedNodeId ?? graph.data?.focusNodeId)}
            onLayerChange={setLayer}
            onViewModeChange={setViewMode}
            onFiltersChange={setFilters}
            onVisualsChange={setVisuals}
            onPhysicsChange={setPhysics}
            onPresetChange={(preset) => setPhysics(applyPhysicsPreset(preset, physics.frozen))}
            onResetLayout={() => setLayoutVersion((current) => current + 1)}
            onRunAiLinks={graph.refresh}
            onRebuild={graph.refresh}
          />
        </div>

        <OpsCard className="space-y-4">
          <div ref={containerRef} className="relative min-h-[440px]">
            {graph.loading && filteredGraph.nodes.length === 0 ? (
              <div className="flex h-[440px] items-center justify-center text-sm text-[var(--vt-text-3)]">
                Loading relationships…
              </div>
            ) : filteredGraph.nodes.length === 0 ? (
              <SurfaceEmptyState
                title="No relationships yet"
                description="The relationship graph has not observed any visible nodes for this scope."
              />
            ) : (
              <>
                <GraphCanvas
                  nodes={filteredGraph.nodes}
                  edges={filteredGraph.edges}
                  physics={physics}
                  visuals={visuals}
                  selectedNodeId={selectedNodeId}
                  hoveredNodeId={hoveredNodeId}
                  highlightedNodeIds={highlightedNodeIds}
                  highlightedEdgeIds={highlightedEdgeIds}
                  onSelectNode={setSelectedNodeId}
                  onHoverNode={setHoveredNodeId}
                  onHoverDetailChange={setHoverDetail}
                  onDoubleClickNode={(nodeId) => {
                    setSelectedNodeId(nodeId);
                    setViewMode('local');
                  }}
                  onDragNode={() => {}}
                  onPinNode={() => {}}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  layoutVersion={layoutVersion}
                  disableInternalTooltip
                />
                <GraphTooltip
                  node={hoverDetail?.node ?? null}
                  edges={filteredGraph.edges}
                  screenX={hoverDetail?.screenX ?? 0}
                  screenY={hoverDetail?.screenY ?? 0}
                  canvasW={viewportSize.width}
                  canvasH={viewportSize.height}
                />
              </>
            )}
          </div>
        </OpsCard>

        <div className="space-y-4">
          {selectedNode ? (
            <NodeDetail
              node={selectedNode}
              edges={selectedNodeEdges}
              neighbors={selectedNodeNeighbors}
              onClose={() => setSelectedNodeId(null)}
              onFocusNode={(nodeId) => {
                setSelectedNodeId(nodeId);
                setViewMode('local');
              }}
              onAcceptSuggestion={() => {}}
              onRejectSuggestion={() => {}}
            />
          ) : (
            <OpsCard className="space-y-3">
              <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Node detail</h2>
              <p className="text-sm text-[var(--vt-text-2)]">
                Select a node to inspect evidence, relationships, and pending graph suggestions.
              </p>
            </OpsCard>
          )}
        </div>
      </div>
    </OperationsShell>
  );
}
