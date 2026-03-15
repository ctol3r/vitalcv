'use client';

import { RefreshCw, Sparkles, Target } from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { NodeNeighborSummary } from '@/components/graph-system/nodeDetailModel';
import type { GraphEdge, GraphLayer, GraphNode } from '@/components/graph-system/types';
import GraphCanvas from '@/components/graph-system/GraphCanvas';
import { GraphControls } from '@/components/graph/GraphControls';
import { GraphLegend } from '@/components/graph/GraphLegend';
import { useGraphInteractions } from '@/components/graph/hooks/useGraphInteractions';
import { applyPhysicsPreset } from '@/components/graph/physics/presets';
import {
  classifyEdgeType,
  collectNodeTypes,
  collectTrustTiers,
  DEFAULT_GRAPH_DISPLAY_STATE,
  deriveClusterId,
  resolveGraphStats,
  type GraphDisplayState,
} from '@/components/graph/state/graphDisplayState';
import { AppShell } from '@/components/shell/AppShell';
import { ContextPanel } from '@/components/shell/ContextPanel';
import { Sidebar } from '@/components/shell/Sidebar';
import { TopNav } from '@/components/shell/TopNav';

const GRAPH_API = '/api/graph-engine';
const GRAPH_SLICE_CACHE_TTL_MS = 60_000;

const GraphInspector = dynamic(
  () => import('@/components/graph/GraphInspector').then((module) => module.GraphInspector),
  { ssr: false, loading: () => null },
);

interface GraphQueryResponse {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
}

interface NodeDetailState {
  node: GraphNode;
  edges: GraphEdge[];
  neighbors: NodeNeighborSummary[];
}

interface CachedGraphSlice {
  graphData: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  cachedAt: number;
}

async function fetchGlobalGraph(layer: GraphLayer, fresh = false) {
  const params = new URLSearchParams();
  if (layer !== 'blended') {
    params.set('graphMode', layer);
  }
  params.set('orphans', 'true');
  if (fresh) {
    params.set('ts', String(Date.now()));
  }

  const response = await fetch(`${GRAPH_API}/global?${params.toString()}`, { cache: 'no-store' });
  return response.json() as Promise<GraphQueryResponse>;
}

async function fetchLocalGraph(nodeId: string, layer: GraphLayer, fresh = false) {
  const params = new URLSearchParams({
    depth: '2',
    limit: '240',
    orphans: 'true',
  });

  if (layer !== 'blended') {
    params.set('graphMode', layer);
  }

  if (fresh) {
    params.set('ts', String(Date.now()));
  }

  const response = await fetch(
    `${GRAPH_API}/local/${encodeURIComponent(nodeId)}?${params.toString()}`,
    { cache: 'no-store' },
  );
  return response.json() as Promise<GraphQueryResponse>;
}

async function triggerRebuild() {
  const response = await fetch(`${GRAPH_API}/rebuild`, { method: 'POST' });
  return response.json();
}

async function triggerAiLinks(nodeId?: string) {
  const response = await fetch(`${GRAPH_API}/ai-links/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nodeId ? { targetNodeId: nodeId } : { graphMode: 'blended' }),
  });

  return response.json();
}

function buildGraphSliceCacheKey(
  viewMode: 'global' | 'local',
  layer: GraphLayer,
  localRootId: string | null,
): string {
  return viewMode === 'local' && localRootId
    ? `local:${layer}:${localRootId}`
    : `global:${layer}`;
}

function shouldReuseGraphSlice(cacheEntry: CachedGraphSlice | undefined): cacheEntry is CachedGraphSlice {
  if (!cacheEntry) {
    return false;
  }

  return (Date.now() - cacheEntry.cachedAt) < GRAPH_SLICE_CACHE_TTL_MS;
}

function summarizeNodeDetail(
  nodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): NodeDetailState | null {
  const focusNode = nodes.find((node) => node.id === nodeId);
  if (!focusNode) {
    return null;
  }

  const connectedEdges = edges
    .filter((edge) => edge.source === nodeId || edge.target === nodeId)
    .sort((left, right) =>
      (Date.parse(right.createdAt ?? right.updatedAt ?? '') || 0) -
        (Date.parse(left.createdAt ?? left.updatedAt ?? '') || 0) ||
      (right.confidence ?? 0) - (left.confidence ?? 0)
    );

  const neighbors = connectedEdges
    .map((edge) => {
      const neighborId = edge.source === nodeId ? edge.target : edge.source;
      const neighbor = nodes.find((node) => node.id === neighborId);

      if (!neighbor) {
        return null;
      }

      return {
        id: neighbor.id,
        label: neighbor.label,
        type: neighbor.type,
        degree: neighbor.degree,
      } satisfies NodeNeighborSummary;
    })
    .filter((neighbor): neighbor is NodeNeighborSummary => neighbor != null)
    .sort((left, right) => right.degree - left.degree || left.label.localeCompare(right.label));

  return {
    node: focusNode,
    edges: connectedEdges,
    neighbors,
  };
}

export default function GraphPage() {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({
    nodes: [],
    edges: [],
  });
  const [displayState, setDisplayState] = useState<GraphDisplayState>(DEFAULT_GRAPH_DISPLAY_STATE);
  const [loading, setLoading] = useState(true);
  const [nodeDetail, setNodeDetail] = useState<NodeDetailState | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 820 });

  const detailRequestRef = useRef(0);
  const sliceRequestRef = useRef(0);
  const graphSliceCacheRef = useRef(new Map<string, CachedGraphSlice>());
  const stageRef = useRef<HTMLDivElement>(null);
  const deferredSearchTerm = useDeferredValue(displayState.filters.searchTerm);

  useEffect(() => {
    const preloadGraphInspector = () => {
      void import('@/components/graph/GraphInspector');
    };

    if (typeof window === 'undefined') {
      return;
    }

    const browserWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof browserWindow.requestIdleCallback === 'function') {
      const handle = browserWindow.requestIdleCallback(preloadGraphInspector);
      return () => {
        browserWindow.cancelIdleCallback?.(handle);
      };
    }

    const timeoutId = browserWindow.setTimeout(preloadGraphInspector, 250);
    return () => {
      browserWindow.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) {
      return;
    }

    const updateDimensions = () => {
      setDimensions({
        width: element.clientWidth,
        height: Math.max(element.clientHeight, 560),
      });
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const loadGraphSlice = useCallback(async (fresh = false) => {
    const cacheKey = buildGraphSliceCacheKey(
      displayState.viewMode,
      displayState.layer,
      displayState.localRootId,
    );
    const cachedGraphSlice = !fresh ? graphSliceCacheRef.current.get(cacheKey) : undefined;
    const requestId = ++sliceRequestRef.current;

    if (cachedGraphSlice) {
      startTransition(() => {
        setGraphData(cachedGraphSlice.graphData);
      });
      setLoading(false);

      if (shouldReuseGraphSlice(cachedGraphSlice)) {
        return;
      }
    } else {
      setLoading(true);
    }

    try {
      const response = displayState.viewMode === 'local' && displayState.localRootId
        ? await fetchLocalGraph(displayState.localRootId, displayState.layer, fresh)
        : await fetchGlobalGraph(displayState.layer, fresh);

      const nextNodes = (response.nodes ?? []).map((node) => ({
        ...node,
        visible: true,
        clusterId: deriveClusterId(node, displayState.visuals.clusterMode),
      }));
      const nextEdges = (response.edges ?? []).map((edge) => ({
        ...edge,
        visible: true,
      }));

      const nextGraphData = { nodes: nextNodes, edges: nextEdges };

      graphSliceCacheRef.current.set(cacheKey, {
        graphData: nextGraphData,
        cachedAt: Date.now(),
      });

      if (sliceRequestRef.current === requestId) {
        startTransition(() => {
          setGraphData(nextGraphData);
        });
      }
    } finally {
      if (sliceRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [
    displayState.layer,
    displayState.localRootId,
    displayState.viewMode,
    displayState.visuals.clusterMode,
  ]);

  useEffect(() => {
    void loadGraphSlice();
  }, [loadGraphSlice]);

  const filteredGraph = useMemo(() => {
    const query = deferredSearchTerm.trim().toLowerCase();

    let nodes = graphData.nodes.map((node) => ({
      ...node,
      clusterId: deriveClusterId(node, displayState.visuals.clusterMode),
    }));
    let edges = graphData.edges.filter((edge) =>
      displayState.filters.linkClasses.includes(classifyEdgeType(edge)),
    );

    if (displayState.filters.nodeTypes.length > 0) {
      nodes = nodes.filter((node) => displayState.filters.nodeTypes.includes(node.type));
    }

    if (displayState.filters.trustTiers.length > 0) {
      nodes = nodes.filter((node) =>
        !node.trustTier || displayState.filters.trustTiers.includes(node.trustTier),
      );
    }

    if (!displayState.filters.showDirected) {
      edges = edges.filter((edge) => !edge.directed || edge.reciprocal);
    }

    if (query.length > 0) {
      nodes = nodes.filter((node) => {
        const searchTargets = [
          node.id,
          node.label,
          node.title,
          node.group,
          ...(node.tags ?? []),
        ].join(' ').toLowerCase();

        return searchTargets.includes(query);
      });
    }

    let visibleNodeIds = new Set(nodes.map((node) => node.id));
    edges = edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));

    if (!displayState.filters.showOrphans) {
      const connectedNodeIds = new Set<string>();

      for (const edge of edges) {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      }

      nodes = nodes.filter((node) => connectedNodeIds.has(node.id));
      visibleNodeIds = new Set(nodes.map((node) => node.id));
      edges = edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
    }

    return {
      nodes,
      edges,
      stats: resolveGraphStats(nodes, edges),
    };
  }, [
    deferredSearchTerm,
    displayState.filters.linkClasses,
    displayState.filters.nodeTypes,
    displayState.filters.showDirected,
    displayState.filters.showOrphans,
    displayState.filters.trustTiers,
    displayState.visuals.clusterMode,
    graphData.edges,
    graphData.nodes,
  ]);

  const loadNodeDetail = useCallback(async (nodeId: string) => {
    const requestId = ++detailRequestRef.current;
    const cachedSlice = graphSliceCacheRef.current.get(
      buildGraphSliceCacheKey('local', displayState.layer, nodeId),
    );

    if (cachedSlice) {
      const cachedDetail = summarizeNodeDetail(
        nodeId,
        cachedSlice.graphData.nodes,
        cachedSlice.graphData.edges,
      );

      if (cachedDetail) {
        startTransition(() => {
          setNodeDetail(cachedDetail);
        });
      }

      if (shouldReuseGraphSlice(cachedSlice)) {
        return;
      }
    }

    try {
      const response = await fetchLocalGraph(nodeId, displayState.layer);
      if (detailRequestRef.current !== requestId) {
        return;
      }

      const detail = summarizeNodeDetail(
        nodeId,
        response.nodes ?? filteredGraph.nodes,
        response.edges ?? filteredGraph.edges,
      );
      graphSliceCacheRef.current.set(
        buildGraphSliceCacheKey('local', displayState.layer, nodeId),
        {
          graphData: {
            nodes: response.nodes ?? filteredGraph.nodes,
            edges: response.edges ?? filteredGraph.edges,
          },
          cachedAt: Date.now(),
        },
      );
      startTransition(() => {
        setNodeDetail(detail);
      });
    } catch {
      if (detailRequestRef.current === requestId) {
        startTransition(() => {
          setNodeDetail(summarizeNodeDetail(nodeId, filteredGraph.nodes, filteredGraph.edges));
        });
      }
    }
  }, [displayState.layer, filteredGraph.edges, filteredGraph.nodes]);

  const handlePinNode = useCallback(async (nodeId: string, x: number, y: number) => {
    setGraphData((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (
        node.id === nodeId
          ? { ...node, x, y, fx: x, fy: y }
          : node
      )),
    }));

    try {
      await fetch(`${GRAPH_API}/node/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, x, y }),
      });
    } catch {
      // Keep the local pin even if persistence is not available.
    }
  }, []);

  const handleSelectNode = useCallback(async (nodeId: string | null) => {
    if (!nodeId) {
      setNodeDetail(null);
      return;
    }

    await loadNodeDetail(nodeId);
  }, [loadNodeDetail]);

  const handleIsolateNode = useCallback(async (nodeId: string) => {
    setDisplayState((current) => ({
      ...current,
      viewMode: 'local',
      localRootId: nodeId,
    }));
  }, []);

  const interactions = useGraphInteractions({
    nodes: filteredGraph.nodes,
    edges: filteredGraph.edges,
    onSelectNode: handleSelectNode,
    onIsolateNode: handleIsolateNode,
    onPinNode: handlePinNode,
  });

  const selectedNodeId = interactions.selectedNodeId;

  useEffect(() => {
    if (!selectedNodeId) {
      setNodeDetail(null);
      return;
    }

    setNodeDetail((current) => {
      if (!current || current.node.id !== selectedNodeId) {
        return current;
      }

      return summarizeNodeDetail(selectedNodeId, filteredGraph.nodes, filteredGraph.edges) ?? current;
    });
  }, [filteredGraph.edges, filteredGraph.nodes, selectedNodeId]);

  const handleDragNode = useCallback((nodeId: string, x: number, y: number) => {
    setGraphData((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (
        node.id === nodeId
          ? { ...node, x, y }
          : node
      )),
    }));
  }, []);

  const handleResetLayout = useCallback(() => {
    setGraphData((current) => ({
      ...current,
      nodes: current.nodes.map((node) => ({
        ...node,
        x: undefined,
        y: undefined,
        fx: null,
        fy: null,
      })),
    }));
  }, []);

  const handleRebuild = useCallback(async () => {
    graphSliceCacheRef.current.clear();
    await triggerRebuild();
    await loadGraphSlice(true);
    if (selectedNodeId) {
      await loadNodeDetail(selectedNodeId);
    }
  }, [loadGraphSlice, loadNodeDetail, selectedNodeId]);

  const handleRunAiLinks = useCallback(async () => {
    graphSliceCacheRef.current.clear();
    await triggerAiLinks(selectedNodeId ?? undefined);
    await loadGraphSlice(true);
    if (selectedNodeId) {
      await loadNodeDetail(selectedNodeId);
    }
  }, [loadGraphSlice, loadNodeDetail, selectedNodeId]);

  const handleAcceptSuggestion = useCallback(async (suggestionId: string) => {
    graphSliceCacheRef.current.clear();
    await fetch(`${GRAPH_API}/ai-links/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestionIds: [suggestionId], action: 'accept' }),
    });
    await loadGraphSlice(true);
    if (selectedNodeId) {
      await loadNodeDetail(selectedNodeId);
    }
  }, [loadGraphSlice, loadNodeDetail, selectedNodeId]);

  const handleRejectSuggestion = useCallback(async (suggestionId: string) => {
    graphSliceCacheRef.current.clear();
    await fetch(`${GRAPH_API}/ai-links/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestionIds: [suggestionId], action: 'reject' }),
    });
    await loadGraphSlice(true);
    if (selectedNodeId) {
      await loadNodeDetail(selectedNodeId);
    }
  }, [loadGraphSlice, loadNodeDetail, selectedNodeId]);

  const handleSavePreset = useCallback(async (name: string) => {
    const positions = filteredGraph.nodes.reduce<Record<string, { x: number; y: number }>>((accumulator, node) => {
      if (typeof node.x === 'number' && typeof node.y === 'number') {
        accumulator[node.id] = { x: node.x, y: node.y };
      }
      return accumulator;
    }, {});

    await fetch(`${GRAPH_API}/layout/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, positions }),
    });
  }, [filteredGraph.nodes]);

  const sidebarActions = [
    {
      id: 'rebuild',
      label: 'Rebuild slice',
      icon: <RefreshCw className="h-3.5 w-3.5" />,
      onClick: handleRebuild,
    },
    {
      id: 'ai',
      label: 'AI link sweep',
      icon: <Sparkles className="h-3.5 w-3.5" />,
      onClick: handleRunAiLinks,
    },
    {
      id: 'reset',
      label: 'Reset layout',
      icon: <Target className="h-3.5 w-3.5" />,
      onClick: handleResetLayout,
    },
  ];

  const availableNodeTypes = useMemo(() => collectNodeTypes(graphData.nodes), [graphData.nodes]);
  const availableTrustTiers = useMemo(() => collectTrustTiers(graphData.nodes), [graphData.nodes]);

  return (
    <>
      <AppShell
        topNav={(
          <TopNav
            layer={displayState.layer}
            onReload={handleRebuild}
            onResetLayout={handleResetLayout}
            onRunAiLinks={handleRunAiLinks}
            onSearchChange={(searchTerm) => {
              startTransition(() => {
                setDisplayState((current) => ({
                  ...current,
                  filters: { ...current.filters, searchTerm },
                }));
              });
            }}
            searchValue={displayState.filters.searchTerm}
            stats={filteredGraph.stats}
            viewMode={displayState.viewMode}
          />
        )}
        sidebar={(
          <Sidebar
            actions={sidebarActions}
            subtitle="Control link classes, node classes, physics, and focus mode from one panel."
            title="Graph Controls"
          >
            <GraphControls
              availableNodeTypes={availableNodeTypes}
              availableTrustTiers={availableTrustTiers}
              canUseLocalMode={selectedNodeId != null || displayState.localRootId != null}
              filters={displayState.filters}
              layer={displayState.layer}
              onFiltersChange={(filters) => setDisplayState((current) => ({ ...current, filters }))}
              onLayerChange={(layer) => setDisplayState((current) => ({ ...current, layer }))}
              onPhysicsChange={(physics) => setDisplayState((current) => ({ ...current, physics }))}
              onPresetChange={(preset) => setDisplayState((current) => ({
                ...current,
                physics: applyPhysicsPreset(preset, current.physics.frozen),
              }))}
              onRebuild={handleRebuild}
              onResetLayout={handleResetLayout}
              onRunAiLinks={handleRunAiLinks}
              onSavePreset={handleSavePreset}
              onViewModeChange={(viewMode) => setDisplayState((current) => ({
                ...current,
                viewMode,
                localRootId: viewMode === 'global'
                  ? null
                  : current.localRootId ?? selectedNodeId,
              }))}
              onVisualsChange={(visuals) => setDisplayState((current) => ({ ...current, visuals }))}
              physics={displayState.physics}
              stats={filteredGraph.stats}
              viewMode={displayState.viewMode}
              visuals={displayState.visuals}
            />
          </Sidebar>
        )}
        context={(
          <ContextPanel
            subtitle="Operational context stays visible while the inspector handles the selected node."
            title="Legend + Focus"
          >
            <div className="vital-panel vital-panel--dense">
              <div className="vital-panel__header">
                <div>
                  <p className="vital-panel__eyebrow">Selected node</p>
                  <h2 className="vital-panel__title">
                    {nodeDetail?.node.title || nodeDetail?.node.label || 'Nothing selected'}
                  </h2>
                </div>
              </div>
              <p className="vital-panel__copy">
                {nodeDetail
                  ? `${nodeDetail.edges.length} visible relationships and ${nodeDetail.neighbors.length} inspectable neighbors.`
                  : 'Click a node to open the inspector. Double-click to isolate a local neighborhood.'}
              </p>
            </div>
            <GraphLegend
              colorMode={displayState.visuals.colorMode}
              edges={filteredGraph.edges}
              nodes={filteredGraph.nodes}
            />
          </ContextPanel>
        )}
      >
        <div ref={stageRef} className="vital-graph-stage">
          {loading ? (
            <div className="vital-graph-loading">Loading graph slice...</div>
          ) : null}

          <GraphCanvas
            edges={filteredGraph.edges}
            height={dimensions.height}
            highlightedEdgeIds={interactions.highlightedEdgeIds}
            highlightedNodeIds={interactions.highlightedNodeIds}
            hoveredNodeId={interactions.hoveredNodeId}
            nodes={filteredGraph.nodes}
            onDoubleClickNode={interactions.handleNodeDoubleClick}
            onDragNode={handleDragNode}
            onHoverNode={interactions.handleNodeHover}
            onPinNode={interactions.handleNodePin}
            onSelectNode={interactions.handleNodeClick}
            physics={displayState.physics}
            selectedNodeId={interactions.selectedNodeId}
            visuals={displayState.visuals}
            width={dimensions.width}
          />

          <div className="vital-graph-statusbar">
            <div className="vital-graph-statusbar__group">
              <span className="vital-graph-badge vital-graph-badge--accent">{displayState.layer}</span>
              <span className="vital-graph-badge">{displayState.viewMode}</span>
              <span className="vital-graph-badge">{displayState.physics.preset}</span>
              {displayState.physics.frozen ? <span className="vital-graph-badge">frozen</span> : null}
            </div>
            <div className="vital-graph-statusbar__group">
              <span className="vital-graph-badge">{filteredGraph.stats.totalNodes} nodes</span>
              <span className="vital-graph-badge">{filteredGraph.stats.totalEdges} edges</span>
              <span className="vital-graph-badge">{filteredGraph.stats.orphanCount} orphans</span>
            </div>
          </div>
        </div>
      </AppShell>

      <GraphInspector
        edges={nodeDetail?.edges ?? []}
        neighbors={nodeDetail?.neighbors ?? []}
        node={nodeDetail?.node ?? null}
        onAcceptSuggestion={handleAcceptSuggestion}
        onClose={() => {
          void interactions.closeInspector();
        }}
        onFocusNode={(nodeId) => {
          void interactions.handleNodeClick(nodeId);
        }}
        onRejectSuggestion={handleRejectSuggestion}
        open={interactions.inspectorOpen}
      />
    </>
  );
}
