'use client';

import { useSearchParams } from 'next/navigation';
import {
  Suspense,
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
import type { GraphViewportState } from '@/components/graph-system/viewportModel';
import GraphCanvas from '@/components/graph-system/GraphCanvas';
import { GraphLegend } from '@/components/graph/GraphLegend';
import { useGraphInteractions } from '@/components/graph/hooks/useGraphInteractions';
import { applyPhysicsPreset } from '@/components/graph/physics/presets';
import {
  classifyEdgeType,
  DEFAULT_GRAPH_DISPLAY_STATE,
  deriveClusterId,
  resolveGraphStats,
  type GraphDisplayState,
} from '@/components/graph/state/graphDisplayState';
import { LeftSidebar } from '@/components/intelligence/LeftSidebar';
import { MainWorkspace } from '@/components/intelligence/MainWorkspace';
import { RightContextPanel, type IntelligenceCopilotState } from '@/components/intelligence/RightContextPanel';
import {
  buildAlertSummaries,
  buildDashboardMetrics,
  buildEvidenceList,
  buildProviderProfiles,
  buildVerificationRunSummary,
  buildWatchlist,
  filterProfilesBySearch,
  findBestMatchingNode,
  type MainWorkspaceSection,
  type ProviderProfileSummary,
  type VerificationRunSummary,
} from '@/components/intelligence/intelligenceModel';
import { AppShell } from '@/components/shell/AppShell';
import { TopNav } from '@/components/shell/TopNav';

const GRAPH_API = '/api/graph-engine';
const GRAPH_SLICE_CACHE_TTL_MS = 60_000;

interface GraphQueryResponse {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
}

interface CopilotResponsePayload {
  results?: Array<{
    id: string;
    title: string;
    summary: string;
    trustScore?: number;
    sourceCoverage?: string[];
  }>;
  graphInsights?: Array<{
    summary: string;
  }>;
  message?: string;
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

function GraphWorkspacePage() {
  const searchParams = useSearchParams();
  const processedCommandRef = useRef<string | null>(null);
  const detailRequestRef = useRef(0);
  const sliceRequestRef = useRef(0);
  const graphSliceCacheRef = useRef(new Map<string, CachedGraphSlice>());
  const stageRef = useRef<HTMLDivElement>(null);

  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({
    nodes: [],
    edges: [],
  });
  const [displayState, setDisplayState] = useState<GraphDisplayState>(DEFAULT_GRAPH_DISPLAY_STATE);
  const [loading, setLoading] = useState(true);
  const [nodeDetail, setNodeDetail] = useState<NodeDetailState | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 360 });
  const [activeSection, setActiveSection] = useState<MainWorkspaceSection>('dashboards');
  const [viewport, setViewport] = useState<GraphViewportState>({
    x: 0,
    y: 0,
    zoom: 1,
    zoomBand: 'network',
  });
  const [copilot, setCopilot] = useState<IntelligenceCopilotState>({
    query: '',
    loading: false,
    error: null,
    results: [],
    insights: [],
  });
  const [verificationRun, setVerificationRun] = useState<VerificationRunSummary | null>(null);
  const deferredSearchTerm = useDeferredValue(displayState.filters.searchTerm);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) {
      return;
    }

    const updateDimensions = () => {
      setDimensions({
        width: element.clientWidth,
        height: Math.max(element.clientHeight, 320),
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

    setActiveSection('profiles');
    await loadNodeDetail(nodeId);
  }, [loadNodeDetail]);

  const handleIsolateNode = useCallback(async (nodeId: string) => {
    setActiveSection('profiles');
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

  const handleResetWorkspace = useCallback(() => {
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
    setDisplayState((current) => ({
      ...current,
      viewMode: 'global',
      localRootId: null,
      physics: applyPhysicsPreset(current.physics.preset, false),
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

  const allProfiles = useMemo(
    () => buildProviderProfiles(graphData.nodes, graphData.edges),
    [graphData.edges, graphData.nodes],
  );
  const alerts = useMemo(
    () => buildAlertSummaries(graphData.nodes, graphData.edges),
    [graphData.edges, graphData.nodes],
  );
  const watchlist = useMemo(() => buildWatchlist(allProfiles), [allProfiles]);
  const searchResults = useMemo(
    () => filterProfilesBySearch(allProfiles, displayState.filters.searchTerm),
    [allProfiles, displayState.filters.searchTerm],
  );
  const selectedProfile = useMemo<ProviderProfileSummary | null>(() => {
    if (!selectedNodeId) {
      return null;
    }

    return allProfiles.find((profile) => profile.id === selectedNodeId) ?? null;
  }, [allProfiles, selectedNodeId]);
  const metrics = useMemo(() => buildDashboardMetrics({
    profiles: allProfiles,
    alerts,
    nodes: filteredGraph.nodes,
    edges: filteredGraph.edges,
    zoomBand: viewport.zoomBand,
  }), [alerts, allProfiles, filteredGraph.edges, filteredGraph.nodes, viewport.zoomBand]);
  const evidence = useMemo(() => buildEvidenceList({
    node: nodeDetail?.node ?? null,
    edges: nodeDetail?.edges ?? [],
    neighbors: nodeDetail?.neighbors ?? [],
  }), [nodeDetail]);

  const runVerification = useCallback((target: string) => {
    const matchedNode = findBestMatchingNode(target, graphData.nodes);
    const matchedProfile = matchedNode
      ? allProfiles.find((profile) => profile.id === matchedNode.id) ?? null
      : null;

    setVerificationRun(buildVerificationRunSummary({
      target,
      matchedProfile,
      alerts,
    }));

    if (matchedNode) {
      startTransition(() => {
        setDisplayState((current) => ({
          ...current,
          viewMode: 'global',
          localRootId: null,
          filters: { ...current.filters, searchTerm: target },
        }));
      });
      setActiveSection('profiles');
      void interactions.handleNodeClick(matchedNode.id);
    }
  }, [alerts, allProfiles, graphData.nodes, interactions.handleNodeClick]);

  const runCopilot = useCallback(async (queryOverride?: string) => {
    const query = (queryOverride ?? copilot.query).trim();

    if (query.length < 3) {
      setCopilot((current) => ({
        ...current,
        error: 'Copilot queries must be at least 3 characters.',
      }));
      return;
    }

    setCopilot((current) => ({
      ...current,
      query,
      loading: true,
      error: null,
      results: current.query === query ? current.results : [],
      insights: current.query === query ? current.insights : [],
    }));

    try {
      const response = await fetch('/api/copilot/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 5 }),
      });

      const payload = await response.json() as CopilotResponsePayload;

      if (!response.ok) {
        throw new Error(payload.message ?? 'Copilot query failed.');
      }

      setCopilot({
        query,
        loading: false,
        error: null,
        results: (payload.results ?? []).map((result) => ({
          id: result.id,
          title: result.title,
          summary: result.summary,
          trustScore: result.trustScore,
          sourceCoverage: result.sourceCoverage ?? [],
        })),
        insights: (payload.graphInsights ?? []).map((insight) => ({
          summary: insight.summary,
        })),
      });
    } catch (error) {
      setCopilot((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Copilot query failed.',
      }));
    }
  }, [copilot.query]);

  const openCommandPalette = useCallback(() => {
    window.dispatchEvent(new Event('vital:open-command-palette'));
  }, []);

  const navigateSection = useCallback((section: MainWorkspaceSection) => {
    setActiveSection(section);

    const element = document.getElementById(`workspace-${section}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const setSearchTerm = useCallback((searchTerm: string) => {
    navigateSection('results');
    startTransition(() => {
      setDisplayState((current) => ({
        ...current,
        filters: { ...current.filters, searchTerm },
      }));
    });
  }, [navigateSection]);

  const selectProfile = useCallback((nodeId: string) => {
    navigateSection('profiles');
    void interactions.handleNodeClick(nodeId);
  }, [interactions, navigateSection]);

  const focusNode = useMemo(() => {
    const focusNodeId = interactions.hoveredNodeId ?? selectedNodeId;
    if (!focusNodeId) {
      return null;
    }

    return filteredGraph.nodes.find((node) => node.id === focusNodeId) ?? null;
  }, [filteredGraph.nodes, interactions.hoveredNodeId, selectedNodeId]);

  const focusSummary = focusNode
    ? `${focusNode.degree} visible relationships. ${focusNode.sourceRefs.length} source references in the current slice.`
    : 'Hover a node for focus context. Double-click expands a provider neighborhood into a local graph slice.';

  const searchParamSignature = searchParams.toString();

  useEffect(() => {
    if (!searchParamSignature) {
      processedCommandRef.current = null;
      return;
    }

    const command = searchParams.get('command');
    const query = searchParams.get('q')?.trim() ?? '';
    const prompt = searchParams.get('prompt')?.trim() ?? '';
    const requestId = searchParams.get('rid') ?? '';
    const signature = JSON.stringify({ command, query, prompt, requestId });

    if (!command || processedCommandRef.current === signature) {
      return;
    }

    processedCommandRef.current = signature;

    if (command === 'provider-search' && query.length > 0) {
      setSearchTerm(query);
      const matchedNode = findBestMatchingNode(query, graphData.nodes);
      if (matchedNode) {
        void interactions.handleNodeClick(matchedNode.id);
      }
      return;
    }

    if (command === 'copilot' && prompt.length > 0) {
      navigateSection('dashboards');
      setCopilot((current) => ({
        ...current,
        query: prompt,
        error: null,
      }));
      void runCopilot(prompt);
      return;
    }

    if (command === 'verify' && query.length > 0) {
      runVerification(query);
    }
  }, [
    graphData.nodes,
    interactions.handleNodeClick,
    navigateSection,
    runCopilot,
    runVerification,
    searchParamSignature,
    searchParams,
    setSearchTerm,
  ]);

  const graphView = (
    <div ref={stageRef} className="vital-graph-stage vital-graph-stage--context">
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
        onViewportChange={setViewport}
        physics={displayState.physics}
        selectedNodeId={selectedNodeId}
        visuals={displayState.visuals}
        width={dimensions.width}
      />

      <div className="vital-graph-statusbar">
        <div className="vital-graph-statusbar__group">
          <span className="vital-graph-badge vital-graph-badge--accent">{displayState.layer}</span>
          <span className="vital-graph-badge">{displayState.viewMode}</span>
          <span className="vital-graph-badge">{viewport.zoomBand}</span>
        </div>
        <div className="vital-graph-statusbar__group">
          <span className="vital-graph-badge">{filteredGraph.stats.totalNodes} nodes</span>
          <span className="vital-graph-badge">{filteredGraph.stats.totalEdges} edges</span>
          <span className="vital-graph-badge">{filteredGraph.stats.orphanCount} orphans</span>
        </div>
      </div>
    </div>
  );

  return (
    <AppShell
      topNav={(
        <TopNav
          layer={displayState.layer}
          onOpenCommandPalette={openCommandPalette}
          onReload={handleRebuild}
          onResetLayout={handleResetWorkspace}
          onRunAiLinks={handleRunAiLinks}
          stats={filteredGraph.stats}
          viewMode={displayState.viewMode}
          zoomBand={viewport.zoomBand}
        />
      )}
      sidebar={(
        <LeftSidebar
          activeSection={activeSection}
          alerts={alerts}
          onNavigate={navigateSection}
          onOpenCommandPalette={openCommandPalette}
          onSearchChange={setSearchTerm}
          onSelectNode={selectProfile}
          resultCount={searchResults.length}
          searchTerm={displayState.filters.searchTerm}
          watchlist={watchlist}
        />
      )}
      context={(
        <RightContextPanel
          copilot={copilot}
          evidence={evidence}
          focusSummary={focusSummary}
          focusTitle={focusNode?.title || focusNode?.label || 'Graph context'}
          graphView={graphView}
          legend={(
            <GraphLegend
              colorMode={displayState.visuals.colorMode}
              edges={filteredGraph.edges}
              maxNodeTypes={5}
              nodes={filteredGraph.nodes}
            />
          )}
          onCopilotQueryChange={(value) => {
            setCopilot((current) => ({ ...current, query: value, error: null }));
          }}
          onRunCopilot={() => {
            void runCopilot();
          }}
          viewport={viewport}
        />
      )}
    >
      <MainWorkspace
        activeSection={activeSection}
        metrics={metrics}
        onNavigate={navigateSection}
        onRunVerification={runVerification}
        onSelectProfile={selectProfile}
        profiles={allProfiles}
        searchResults={searchResults}
        searchTerm={displayState.filters.searchTerm}
        selectedProfile={selectedProfile}
        verificationRun={verificationRun}
      />
    </AppShell>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background text-foreground" />}>
      <GraphWorkspacePage />
    </Suspense>
  );
}
