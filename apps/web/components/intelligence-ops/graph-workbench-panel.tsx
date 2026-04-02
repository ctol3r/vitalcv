'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Layers, Maximize2, RefreshCw } from 'lucide-react';
import GraphCanvas, {
  type GraphEdgeHoverDetail,
  type GraphHoverDetail,
} from '@/components/graph-system/GraphCanvas';
import { colorForNodeType } from '@/components/graph/graphPalette';
import {
  DEFAULT_GRAPH_PHYSICS,
  DEFAULT_GRAPH_VISUALS,
} from '@/components/graph/state/graphDisplayState';
import type { GraphEdge, GraphNode, NodeType } from '@/components/graph-system/types';
import { SectionFrame, SurfaceState, ToneBadge } from '@/components/intelligence/shared';
import type {
  IntelligenceGraphResponse,
  IntelligenceProvider,
} from '@/lib/intelligence/contracts';
import { findGraphNodeIdForProvider, findProviderForGraphNode } from '@/lib/intelligence/contracts';
import {
  buildIntelligenceGraphHref,
  buildIntelligenceHref,
  normalizeIntelligenceHref,
} from '@/lib/intelligence/routes';

interface GraphWorkbenchPanelProps {
  graph: IntelligenceGraphResponse | null;
  providers: IntelligenceProvider[];
  selectedProvider: IntelligenceProvider | null;
  selectedFindingId?: string | null;
  selectedStorylineId?: string | null;
  openFullGraphHref?: string;
  loading?: boolean;
  error?: string | null;
  onSelectProvider: (provider: IntelligenceProvider) => void;
  onRetry?: () => void;
  focusNodeId?: string | null;
  highlightNodeId?: string | null;
  highlightNodeIds?: string[];
  getTooltipContext?: ((nodeId: string) => import('@/lib/intelligence/entity-registry').TooltipEntityContext | null) | null;
  onSelectGraphNode?: (nodeId: string | null) => void;
}

interface GraphSummary {
  eyebrow: string;
  title: string;
  description: string;
  meta: string[];
  tone: 'neutral' | 'success' | 'warning' | 'critical';
}

interface CountSummary {
  value: string;
  label: string;
  count: number;
}

function formatGraphToken(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function summarizeValues(values: string[], limit = 4): CountSummary[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([value, count]) => ({
      value,
      label: formatGraphToken(value),
      count,
    }));
}

function collectHighlightedContext(graph: IntelligenceGraphResponse | null, seedNodeIds: Iterable<string>) {
  const nodeIds = new Set<string>(seedNodeIds);
  const edgeIds = new Set<string>();

  if (!graph) {
    return { nodeIds, edgeIds };
  }

  for (const edge of graph.edges) {
    if (nodeIds.has(edge.source) || nodeIds.has(edge.target)) {
      edgeIds.add(edge.id);
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }
  }

  return { nodeIds, edgeIds };
}

function toneClasses(tone: GraphSummary['tone']) {
  switch (tone) {
    case 'success':
      return 'border-[var(--vt-text-1)] bg-[var(--vt-surface-2)] text-[var(--vt-text-1)]';
    case 'warning':
      return 'border-[var(--vt-text-3)] bg-[var(--vt-surface-2)] text-[var(--vt-text-2)]';
    case 'critical':
      return 'border-[var(--vt-text-2)] bg-[var(--vt-surface-2)] text-[var(--vt-text-1)]';
    case 'neutral':
    default:
      return 'border-[var(--vt-border)] bg-[var(--vt-surface-dim)] text-[var(--vt-text-2)]';
  }
}

function buildGraphSummary(input: {
  graph: IntelligenceGraphResponse | null;
  selectedProvider: IntelligenceProvider | null;
  selectedNode: GraphNode | null;
  selectedEdge: GraphEdge | null;
  hoveredNodeDetail: GraphHoverDetail | null;
  hoveredEdgeDetail: GraphEdgeHoverDetail | null;
  graphNodes: GraphNode[];
}): GraphSummary {
  const nodeCount = input.graph?.stats.totalNodes ?? input.graphNodes.length;
  const edgeCount = input.graph?.stats.totalEdges ?? input.graph?.edges.length ?? 0;
  const orphanCount = input.graph?.stats.orphanCount ?? 0;
  const aiSuggestedLinks = input.graph?.stats.aiSuggestedLinks ?? 0;

  if (input.hoveredEdgeDetail) {
    const edge = input.hoveredEdgeDetail.edge;
    const source = input.hoveredEdgeDetail.sourceNode?.label ?? edge.source;
    const target = input.hoveredEdgeDetail.targetNode?.label ?? edge.target;
    const relationshipLabel = formatGraphToken(edge.projectedType ?? edge.type);
    const evidenceCount = edge.evidenceCount ?? edge.evidenceRefs?.length ?? 0;

    return {
      eyebrow: 'Hovered relationship',
      title: `${source} -> ${target}`,
      description: `${relationshipLabel} | confidence ${Math.round(edge.confidence * 100)}% | ${evidenceCount} evidence reference${evidenceCount === 1 ? '' : 's'}`,
      meta: [
        `Source ${input.hoveredEdgeDetail.sourceNode?.type ? formatGraphToken(input.hoveredEdgeDetail.sourceNode.type) : 'unknown'}`,
        `Target ${input.hoveredEdgeDetail.targetNode?.type ? formatGraphToken(input.hoveredEdgeDetail.targetNode.type) : 'unknown'}`,
        `${edge.findingIds?.length ?? 0} linked finding${(edge.findingIds?.length ?? 0) === 1 ? '' : 's'}`,
      ],
      tone: 'success',
    };
  }

  if (input.hoveredNodeDetail) {
    const node = input.hoveredNodeDetail.node;
    const findingCount = node.findingIds?.length ?? 0;
    const storylineCount = node.storylineIds?.length ?? 0;

    return {
      eyebrow: 'Hovered node',
      title: node.label,
      description: `${input.hoveredNodeDetail.relationshipCount} relationship${input.hoveredNodeDetail.relationshipCount === 1 ? '' : 's'} | ${findingCount} linked finding${findingCount === 1 ? '' : 's'} | ${storylineCount} linked storyline${storylineCount === 1 ? '' : 's'}`,
      meta: [
        `Type ${formatGraphToken(node.type)}`,
        `Degree ${node.degree}`,
        node.trustBand ? `Trust ${node.trustBand}` : 'Trust unavailable',
      ],
      tone: 'success',
    };
  }

  if (input.selectedEdge) {
    const edge = input.selectedEdge;
    const sourceNode = input.graphNodes.find((node) => node.id === edge.source) ?? null;
    const targetNode = input.graphNodes.find((node) => node.id === edge.target) ?? null;
    const sourceLabel = sourceNode?.label ?? edge.source;
    const targetLabel = targetNode?.label ?? edge.target;
    const relationLabel = formatGraphToken(edge.projectedType ?? edge.type);
    const evidenceCount = edge.evidenceCount ?? edge.evidenceRefs?.length ?? 0;

    return {
      eyebrow: 'Selected relationship',
      title: `${sourceLabel} -> ${targetLabel}`,
      description: `${relationLabel} | confidence ${Math.round(edge.confidence * 100)}% | ${evidenceCount} evidence reference${evidenceCount === 1 ? '' : 's'}`,
      meta: [
        `Source ${sourceNode ? formatGraphToken(sourceNode.type) : 'unknown'}`,
        `Target ${targetNode ? formatGraphToken(targetNode.type) : 'unknown'}`,
        `${edge.findingIds?.length ?? 0} linked finding${(edge.findingIds?.length ?? 0) === 1 ? '' : 's'}`,
      ],
      tone: 'success',
    };
  }

  if (input.selectedNode) {
    const node = input.selectedNode;
    const findingCount = node.findingIds?.length ?? 0;
    const storylineCount = node.storylineIds?.length ?? 0;

    return {
      eyebrow: 'Focused node',
      title: node.label,
      description: `${node.degree} relationship${node.degree === 1 ? '' : 's'} in scope | ${findingCount} linked finding${findingCount === 1 ? '' : 's'} | ${storylineCount} linked storyline${storylineCount === 1 ? '' : 's'}`,
      meta: [
        `Type ${formatGraphToken(node.type)}`,
        `Layer ${formatGraphToken(node.layer)}`,
        node.flagged ? 'Flagged node' : 'Unflagged node',
      ],
      tone: 'neutral',
    };
  }

  if (input.selectedProvider) {
    return {
      eyebrow: 'Provider scope',
      title: input.selectedProvider.name,
      description: input.selectedProvider.summary,
      meta: [
        `NPI ${input.selectedProvider.npi}`,
        `Trust score ${input.selectedProvider.trustScore}`,
        `${input.selectedProvider.activeCredentials} active credential${input.selectedProvider.activeCredentials === 1 ? '' : 's'}`,
      ],
      tone: 'neutral',
    };
  }

  const summaryTitle = input.graph
    ? 'Graph returned no nodes'
    : 'Graph data unavailable';

  return {
    eyebrow: 'Graph slice',
    title: summaryTitle,
    description: input.graph
      ? `The backend returned ${nodeCount} node${nodeCount === 1 ? '' : 's'} and ${edgeCount} edge${edgeCount === 1 ? '' : 's'} for this scope.`
      : 'No graph payload was returned for the current scope.',
    meta: [
      `${nodeCount} node${nodeCount === 1 ? '' : 's'}`,
      `${edgeCount} edge${edgeCount === 1 ? '' : 's'}`,
      `${orphanCount} orphan${orphanCount === 1 ? '' : 's'} | ${aiSuggestedLinks} AI link${aiSuggestedLinks === 1 ? '' : 's'}`,
    ],
    tone: 'warning',
  };
}

export function GraphWorkbenchPanel({
  graph,
  providers,
  selectedProvider,
  selectedFindingId = null,
  selectedStorylineId = null,
  openFullGraphHref = buildIntelligenceGraphHref(),
  loading,
  error,
  onSelectProvider,
  onRetry,
  focusNodeId = null,
  highlightNodeId = null,
  highlightNodeIds = [],
  getTooltipContext,
  onSelectGraphNode,
}: GraphWorkbenchPanelProps) {
  const [dimensions, setDimensions] = useState({ width: 420, height: 420 });
  const [hoveredNodeDetail, setHoveredNodeDetail] = useState<GraphHoverDetail | null>(null);
  const [hoveredEdgeDetail, setHoveredEdgeDetail] = useState<GraphEdgeHoverDetail | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [localSelectedNodeId, setLocalSelectedNodeId] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth >= 1536
        ? 460
        : window.innerWidth >= 1280
          ? 400
          : window.innerWidth >= 1024
            ? 360
            : Math.max(300, window.innerWidth - 72);
      setDimensions({ width, height: Math.round(width * 1.08) });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const graphNodes = graph?.nodes ?? [];
  const graphEdges = graph?.edges ?? [];

  useEffect(() => {
    if (!localSelectedNodeId) {
      return;
    }

    if (!graphNodes.some((node) => node.id === localSelectedNodeId)) {
      setLocalSelectedNodeId(null);
    }
  }, [graphNodes, localSelectedNodeId]);

  useEffect(() => {
    if (!selectedEdgeId) {
      return;
    }

    if (!graphEdges.some((edge) => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(null);
    }
  }, [graphEdges, selectedEdgeId]);

  const selectedProviderNodeId = useMemo(
    () => findGraphNodeIdForProvider(selectedProvider, graphNodes),
    [graphNodes, selectedProvider],
  );

  const selectedNodeId = focusNodeId
    ?? localSelectedNodeId
    ?? graph?.focusNodeId
    ?? selectedProviderNodeId
    ?? null;

  const selectedNode = useMemo(
    () => graphNodes.find((node) => node.id === selectedNodeId) ?? null,
    [graphNodes, selectedNodeId],
  );

  const selectedEdge = useMemo(
    () => graphEdges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [graphEdges, selectedEdgeId],
  );

  const nodeTypeSummaries = useMemo(
    () => summarizeValues(graphNodes.map((node) => node.type), 6),
    [graphNodes],
  );

  const edgeTypeSummaries = useMemo(
    () => summarizeValues(graphEdges.map((edge) => edge.projectedType ?? edge.type), 5),
    [graphEdges],
  );

  const highlightedContext = useMemo(() => {
    const seedNodeIds = new Set<string>();

    if (selectedProviderNodeId) {
      seedNodeIds.add(selectedProviderNodeId);
    }

    if (selectedNodeId) {
      seedNodeIds.add(selectedNodeId);
    }

    if (highlightNodeId) {
      seedNodeIds.add(highlightNodeId);
    }

    for (const nodeId of highlightNodeIds) {
      if (nodeId) {
        seedNodeIds.add(nodeId);
      }
    }

    for (const node of graphNodes) {
      if (selectedFindingId && node.findingIds?.includes(selectedFindingId)) {
        seedNodeIds.add(node.id);
      }

      if (selectedStorylineId && node.storylineIds?.includes(selectedStorylineId)) {
        seedNodeIds.add(node.id);
      }
    }

    if (hoveredNodeDetail) {
      seedNodeIds.add(hoveredNodeDetail.node.id);
    }

    if (hoveredEdgeDetail) {
      seedNodeIds.add(hoveredEdgeDetail.edge.source);
      seedNodeIds.add(hoveredEdgeDetail.edge.target);
    }

    if (selectedEdge) {
      seedNodeIds.add(selectedEdge.source);
      seedNodeIds.add(selectedEdge.target);
    }

    return collectHighlightedContext(graph, seedNodeIds);
  }, [
    graph,
    graphNodes,
    hoveredEdgeDetail,
    hoveredNodeDetail,
    selectedFindingId,
    selectedNodeId,
    selectedEdge,
    selectedProviderNodeId,
    selectedStorylineId,
    highlightNodeId,
    highlightNodeIds,
  ]);

  const summary = useMemo(
    () => buildGraphSummary({
      graph,
      selectedProvider,
      selectedNode,
      hoveredNodeDetail,
      hoveredEdgeDetail,
      selectedEdge,
      graphNodes,
    }),
    [graph, graphNodes, hoveredEdgeDetail, hoveredNodeDetail, selectedEdge, selectedNode, selectedProvider],
  );

  const graphStats = graph?.stats ?? {
    totalNodes: graphNodes.length,
    totalEdges: graphEdges.length,
    orphanCount: 0,
    aiSuggestedLinks: 0,
  };
  const hasGraphNodes = graphStats.totalNodes > 0;

  const nodeCounterLabel = `${graphStats.totalNodes} node${graphStats.totalNodes === 1 ? '' : 's'}`;
  const edgeCounterLabel = `${graphStats.totalEdges} edge${graphStats.totalEdges === 1 ? '' : 's'}`;
  const aiLinkLabel = `${graphStats.aiSuggestedLinks} AI link${graphStats.aiSuggestedLinks === 1 ? '' : 's'}`;
  const topTypeSummary = nodeTypeSummaries[0] ?? null;

  const action = (
    <div className="flex flex-wrap items-center gap-1.5">
      <ToneBadge tone="neutral" label={nodeCounterLabel} />
      <ToneBadge tone="neutral" label={edgeCounterLabel} />
      <ToneBadge tone="neutral" label={aiLinkLabel} />
      <Link
        href={openFullGraphHref}
        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-cyan-300 shadow-sm transition-all hover:bg-cyan-500/20 hover:text-cyan-100"
      >
        <Maximize2 className="h-3.5 w-3.5" />
        Open Full Graph
      </Link>
    </div>
  );

  return (
    <SectionFrame
      eyebrow="Trust Graph"
      title={selectedProvider ? selectedProvider.name : 'Network Graph'}
      detail={selectedProvider
        ? `Live graph context for ${selectedProvider.name} (NPI ${selectedProvider.npi}). Hover nodes or edges to inspect real relationships and pivot with the navigation links below.`
        : 'Live graph context for the current scope. Hover nodes or edges to inspect real relationships and pivot with the navigation links below.'}
      action={action}
    >
      <SurfaceState
        loading={false}
        error={error}
        empty={!loading && !error && !hasGraphNodes}
        emptyTitle="No graph nodes returned"
        emptyCopy={selectedProvider
          ? `The live graph slice for ${selectedProvider.name} returned zero nodes. If findings or storylines are still in scope, the graph route will surface that inconsistency instead of fabricating a fallback canvas.`
          : 'The live graph slice returned zero nodes for the current scope.'}
        onRetry={onRetry}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {selectedProvider ? (
                <ContextChip tone="neutral" label="Provider" value={selectedProvider.name} />
              ) : null}
              {selectedNode ? (
                <ContextChip tone="success" label="Focus" value={selectedNode.label} />
              ) : null}
              {hoveredNodeDetail ? (
                <ContextChip
                  tone="success"
                  label="Hover node"
                  value={`${hoveredNodeDetail.node.label} | ${hoveredNodeDetail.relationshipCount} rel${hoveredNodeDetail.relationshipCount === 1 ? '' : 's'}`}
                />
              ) : null}
              {hoveredEdgeDetail ? (
                <ContextChip
                  tone="success"
                  label="Hover edge"
                  value={`${hoveredEdgeDetail.sourceNode?.label ?? hoveredEdgeDetail.edge.source} -> ${hoveredEdgeDetail.targetNode?.label ?? hoveredEdgeDetail.edge.target}`}
                />
              ) : null}
            </div>

            <div className="flex items-center gap-1">
              <ToolbarButton
                title="Reset graph layout"
                onClick={() => setResetKey((key) => key + 1)}
              >
                <RefreshCw className="h-3 w-3" />
              </ToolbarButton>
              <ToolbarButton
                title={showLegend ? 'Hide legend' : 'Show legend'}
                onClick={() => setShowLegend((value) => !value)}
                active={showLegend}
              >
                <Layers className="h-3 w-3" />
              </ToolbarButton>
              <div className="flex items-center gap-1 text-[10px] text-[var(--vt-text-3)]">
                <Maximize2 className="h-2.5 w-2.5" />
                <span>scroll to zoom | drag to pan | click to select</span>
              </div>
            </div>
          </div>

          <div className="relative min-h-[440px] overflow-hidden rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-2 shadow-inner">
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center py-20">
                <div className="relative flex h-16 w-16 items-center justify-center mb-8">
                  <div className="absolute inset-0 block rounded-full border-[1.5px] border-[var(--vt-accent)]/20" />
                  <div className="absolute inset-0 block rounded-full border-[1.5px] border-[var(--vt-accent)]/40 animate-ping" style={{ animationDuration: '3s' }} />
                  <div className="absolute inset-2 block rounded-full border-[1.5px] border-[var(--vt-accent)]/40" />
                  <div className="absolute inset-2 block rounded-full border-[1.5px] border-[var(--vt-accent)]/60 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                  <Layers className="relative h-5 w-5 text-[var(--vt-accent)]" />
                </div>
                <div className="space-y-2 text-center">
                  <p className="text-[10px] uppercase font-semibold tracking-[0.2em] text-[var(--vt-text-1)]">
                    Warming Graph Substrate
                  </p>
                  <p className="text-xs text-[var(--vt-text-3)] max-w-xs mx-auto">
                    Resolving entity relationships and computing trust paths...
                  </p>
                </div>
              </div>
            ) : (
              <>
                <GraphCanvas
                  key={resetKey}
                  nodes={graphNodes}
                  edges={graphEdges}
                  physics={DEFAULT_GRAPH_PHYSICS}
                  visuals={{
                    ...DEFAULT_GRAPH_VISUALS,
                    animate: true,
                    clusterMode: 'type',
                    showArrows: false,
                    nodeSize: 6,
                    linkThickness: 1.2,
                  }}
                  selectedNodeId={selectedNodeId}
                  hoveredNodeId={hoveredNodeDetail?.node.id ?? null}
                  selectedEdgeId={selectedEdgeId}
                  hoveredEdgeId={hoveredEdgeDetail?.edge.id ?? null}
                  highlightedNodeIds={highlightedContext.nodeIds}
                  highlightedEdgeIds={highlightedContext.edgeIds}
                  getTooltipContext={getTooltipContext}
                  onSelectNode={(nodeId) => {
                    setLocalSelectedNodeId(nodeId);
                    setSelectedEdgeId(null);
                    onSelectGraphNode?.(nodeId);

                    if (!nodeId) {
                      return;
                    }

                    const provider = findProviderForGraphNode(nodeId, graphNodes, providers);
                    if (provider) {
                      onSelectProvider(provider);
                    }
                  }}
                  onSelectEdge={setSelectedEdgeId}
                  onHoverNode={(nodeId) => {
                    if (!nodeId) {
                      setHoveredNodeDetail(null);
                    }
                  }}
                  onHoverEdge={(edgeId) => {
                    if (!edgeId) {
                      setHoveredEdgeDetail(null);
                    }
                  }}
                  onDoubleClickNode={() => {}}
                  onDragNode={() => {}}
                  onPinNode={() => {}}
                  onHoverDetailChange={setHoveredNodeDetail}
                  onEdgeHoverDetailChange={setHoveredEdgeDetail}
                  width={dimensions.width}
                  height={dimensions.height}
                />

                <div className={`pointer-events-none absolute left-3 top-3 max-w-[min(34rem,calc(100%-1.5rem))] rounded-2xl border px-3 py-2 shadow-lg backdrop-blur ${toneClasses(summary.tone)}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">
                    {summary.eyebrow}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--vt-text-1)]">
                    {summary.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--vt-text-2)]">
                    {summary.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {summary.meta.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-border bg-black/20 px-2 py-0.5 text-[10px] text-[var(--vt-text-1)]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
            <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
                    Neighborhood
                  </p>
                  <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">
                    Active relationships
                  </h3>
                </div>
                <p className="text-xs text-[var(--vt-text-3)]">
                  {highlightedContext.nodeIds.size} node{highlightedContext.nodeIds.size === 1 ? '' : 's'} | {highlightedContext.edgeIds.size} edge{highlightedContext.edgeIds.size === 1 ? '' : 's'}
                </p>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <InfoCard
                  label="Selected"
                  title={selectedEdge
                    ? `${graphNodes.find((node) => node.id === selectedEdge.source)?.label ?? selectedEdge.source} -> ${graphNodes.find((node) => node.id === selectedEdge.target)?.label ?? selectedEdge.target}`
                    : selectedNode?.label ?? selectedProvider?.name ?? 'No focus node'}
                  detail={selectedEdge
                    ? `${formatGraphToken(selectedEdge.projectedType ?? selectedEdge.type)} | confidence ${Math.round(selectedEdge.confidence * 100)}%`
                    : selectedNode
                    ? `${selectedNode.degree} relationship${selectedNode.degree === 1 ? '' : 's'} in scope`
                    : selectedProvider
                      ? selectedProvider.summary
                      : 'Select a node to anchor the workbench.'}
                />
                <InfoCard
                  label="Hovered"
                  title={hoveredEdgeDetail
                    ? `${hoveredEdgeDetail.sourceNode?.label ?? hoveredEdgeDetail.edge.source} -> ${hoveredEdgeDetail.targetNode?.label ?? hoveredEdgeDetail.edge.target}`
                    : hoveredNodeDetail?.node.label ?? 'None'}
                  detail={hoveredEdgeDetail
                    ? `${formatGraphToken(hoveredEdgeDetail.edge.projectedType ?? hoveredEdgeDetail.edge.type)} | confidence ${Math.round(hoveredEdgeDetail.edge.confidence * 100)}%`
                    : hoveredNodeDetail
                      ? `${hoveredNodeDetail.relationshipCount} relationship${hoveredNodeDetail.relationshipCount === 1 ? '' : 's'}`
                      : 'Hover a node or edge to reveal its live context.'}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {selectedProvider ? (
                  <>
                    <Link
                      href={normalizeIntelligenceHref(`/providers/${selectedProvider.npi}`)}
                      className="inline-flex items-center rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface)] hover:text-[var(--vt-text-1)]"
                    >
                      Provider Profile
                    </Link>
                    <Link
                      href={buildIntelligenceHref('findings', { provider: selectedProvider.npi })}
                      className="inline-flex items-center rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface)] hover:text-[var(--vt-text-1)]"
                    >
                      View Findings
                    </Link>
                  </>
                ) : null}
                <Link
                  href={openFullGraphHref}
                  className="inline-flex items-center rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface)] hover:text-[var(--vt-text-1)]"
                >
                  Open Full Graph
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
                    Density
                  </p>
                  <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">
                    Real topology
                  </h3>
                </div>
                <p className="text-xs text-[var(--vt-text-3)]">
                  {graphStats.orphanCount} orphan{graphStats.orphanCount === 1 ? '' : 's'}
                </p>
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
                    Top node types
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {nodeTypeSummaries.length > 0 ? nodeTypeSummaries.map((entry) => (
                      <TypePill
                        key={entry.value}
                        color={colorForNodeType(entry.value as NodeType)}
                        label={`${entry.label} x${entry.count}`}
                      />
                    )) : (
                      <span className="text-xs text-[var(--vt-text-3)]">
                        No node types are available for the current slice.
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
                    Top relationship types
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {edgeTypeSummaries.length > 0 ? edgeTypeSummaries.map((entry) => (
                      <TypePill
                        key={entry.value}
                        color="var(--vt-text-2)"
                        label={`${entry.label} x${entry.count}`}
                      />
                    )) : (
                      <span className="text-xs text-[var(--vt-text-3)]">
                        No edges returned for this slice.
                      </span>
                    )}
                  </div>
                </div>

                {showLegend && nodeTypeSummaries.length > 0 ? (
                  <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
                      Legend
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {nodeTypeSummaries.map((entry) => (
                        <TypePill
                          key={entry.value}
                          color={colorForNodeType(entry.value as NodeType)}
                          label={entry.label}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            <MetricCard label="Nodes" value={String(graphStats.totalNodes)} detail={topTypeSummary ? `Top type ${topTypeSummary.label}` : 'No node types'} />
            <MetricCard label="Edges" value={String(graphStats.totalEdges)} detail={edgeTypeSummaries[0] ? `Top relationship ${edgeTypeSummaries[0].label}` : 'No relationships'} />
            <MetricCard label="Orphans" value={String(graphStats.orphanCount)} detail="Disconnected nodes in the live slice" />
            <MetricCard label="AI links" value={String(graphStats.aiSuggestedLinks)} detail="Suggested graph edges awaiting review" />
          </div>
        </div>
      </SurfaceState>
    </SectionFrame>
  );
}

function ToolbarButton({
  children,
  onClick,
  title,
  active = false,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-lg border transition ${
        active
          ? 'border-[var(--vt-text-3)] bg-[var(--vt-surface-dim)] text-[var(--vt-text-1)]'
          : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-3)] hover:border-[var(--vt-border)] hover:text-[var(--vt-text-2)]'
      }`}
    >
      {children}
    </button>
  );
}

function ContextChip({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning' | 'critical';
}) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] ${toneClasses(tone)}`}>
      <span className="uppercase tracking-[0.14em] text-[var(--vt-text-3)]">{label}</span>
      <span className="text-[var(--vt-text-1)]">{value}</span>
    </span>
  );
}

function InfoCard({
  label,
  title,
  detail,
}: {
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--vt-text-1)]">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--vt-text-2)]">{detail}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--vt-text-1)]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--vt-text-3)]">{detail}</p>
    </div>
  );
}

function TypePill({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-black/15 px-2.5 py-1 text-[10px] text-[var(--vt-text-1)]">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </span>
  );
}
