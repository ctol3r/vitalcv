'use client';

import Link from 'next/link';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CircleDot,
  Network,
  Radar,
  Route,
} from 'lucide-react';
import GraphCanvas, {
  type GraphHoverDetail,
  type GraphLayoutSnapshot,
} from '@/components/graph-system/GraphCanvas';
import { GraphMiniMap } from '@/components/graph-system/GraphMiniMap';
import GraphTooltip from '@/components/graph-system/GraphTooltip';
import NodeDetail from '@/components/graph-system/NodeDetail';
import type { NodeNeighborSummary } from '@/components/graph-system/nodeDetailModel';
import { GraphControls } from '@/components/graph/GraphControls';
import { GraphLegend } from '@/components/graph/GraphLegend';
import { applyPhysicsPreset } from '@/components/graph/physics/presets';
import {
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
import {
  type GraphEdge,
  type GraphNode,
  type InvestigationEdgeKind,
  type InvestigationNodeKind,
} from '@/components/graph-system/types';
import { OperationsShell } from '@/components/intelligence-ops/shell';
import { OpsCard, SurfaceBanner, SurfaceEmptyState } from '@/components/intelligence-ops/primitives';
import { Drawer } from '@/components/ui/Drawer';
import {
  type InvestigationGraphResponse,
} from '@/lib/intelligence/contracts';
import { useInvestigationGraph } from '@/hooks/useInvestigationGraph';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type TimeRange = '30d' | '90d' | '365d' | 'all';
type InvestigationPresetId = 'risk' | 'research' | 'industry' | 'clinical' | 'all' | 'custom';

interface InvestigationToolbarState {
  preset: InvestigationPresetId;
  entityTypes: InvestigationNodeKind[];
  relationshipTypes: InvestigationEdgeKind[];
  timeRange: TimeRange;
  onlyFlagged: boolean;
  onlyStorylineRelated: boolean;
}

interface ResolvedPath {
  nodeIds: string[];
  edgeIds: string[];
  explanation: string;
}

interface SemanticProjection {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeAlias: Map<string, string>;
  clusterCards: Array<{
    id: string;
    label: string;
    nodeCount: number;
    nodeTypes: string[];
  }>;
}

const DEFAULT_TOOLBAR_STATE: InvestigationToolbarState = {
  preset: 'all',
  entityTypes: [],
  relationshipTypes: [],
  timeRange: 'all',
  onlyFlagged: false,
  onlyStorylineRelated: false,
};

const PRESET_FILTERS: Record<Exclude<InvestigationPresetId, 'custom'>, Omit<InvestigationToolbarState, 'preset'>> = {
  risk: {
    entityTypes: ['provider', 'company', 'payment', 'regulatory', 'evidence'],
    relationshipTypes: ['financial', 'regulatory', 'storyline_related', 'evidence_link'],
    timeRange: 'all',
    onlyFlagged: true,
    onlyStorylineRelated: false,
  },
  research: {
    entityTypes: ['provider', 'institution', 'trial', 'publication', 'evidence'],
    relationshipTypes: ['co_author', 'co_investigator', 'storyline_related', 'evidence_link'],
    timeRange: 'all',
    onlyFlagged: false,
    onlyStorylineRelated: false,
  },
  industry: {
    entityTypes: ['provider', 'company', 'payment', 'evidence'],
    relationshipTypes: ['financial', 'regulatory', 'evidence_link'],
    timeRange: 'all',
    onlyFlagged: false,
    onlyStorylineRelated: false,
  },
  clinical: {
    entityTypes: ['provider', 'institution', 'trial', 'regulatory', 'evidence'],
    relationshipTypes: ['institutional', 'co_investigator', 'regulatory', 'evidence_link'],
    timeRange: 'all',
    onlyFlagged: false,
    onlyStorylineRelated: false,
  },
  all: {
    entityTypes: [],
    relationshipTypes: [],
    timeRange: 'all',
    onlyFlagged: false,
    onlyStorylineRelated: false,
  },
};

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

function resolveDateFrom(timeRange: TimeRange): string | null {
  if (timeRange === 'all') {
    return null;
  }

  const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function formatToken(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function applyLegacyFilters(
  nodes: GraphNode[],
  edges: GraphEdge[],
  filters: GraphFilterState,
  viewMode: GraphViewMode,
  rootNodeId: string | null,
) {
  const normalizedSearch = filters.searchTerm.trim().toLowerCase();
  const visibleEdgeTypes = new Set(filters.linkClasses);

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

    return visibleEdgeTypes.has('trust')
      || visibleEdgeTypes.size === 0
      || visibleEdgeTypes.has('explicit')
      || visibleEdgeTypes.has('backlink')
      || visibleEdgeTypes.has('ai')
      || visibleEdgeTypes.has('inferred');
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
    const nextVisibleNodeIds = new Set(nextNodes.map((node) => node.id));
    nextEdges = nextEdges.filter((edge) => nextVisibleNodeIds.has(edge.source) && nextVisibleNodeIds.has(edge.target));
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

function applyToolbarFilters(
  graph: InvestigationGraphResponse | null,
  toolbar: InvestigationToolbarState,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (!graph) {
    return { nodes: [], edges: [] };
  }

  const dateFrom = resolveDateFrom(toolbar.timeRange);
  const nodes = graph.nodes.filter((node) => {
    const projectedType = (node.projectedType ?? node.type) as InvestigationNodeKind;
    if (toolbar.entityTypes.length > 0 && !toolbar.entityTypes.includes(projectedType)) {
      return false;
    }

    if (toolbar.onlyFlagged && !node.flagged) {
      return false;
    }

    if (toolbar.onlyStorylineRelated && (node.storylineIds?.length ?? 0) === 0) {
      return false;
    }

    return true;
  });

  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => {
    const projectedType = (edge.projectedType ?? edge.type) as InvestigationEdgeKind;
    const lastSeenAt = edge.lastSeenAt ?? edge.updatedAt ?? null;
    const isStorylineEdge = projectedType === 'storyline_related' || (edge.storylineIds?.length ?? 0) > 0;

    if (toolbar.relationshipTypes.length > 0 && !toolbar.relationshipTypes.includes(projectedType)) {
      return false;
    }

    if (toolbar.onlyFlagged && !edge.flagged) {
      return false;
    }

    if (toolbar.onlyStorylineRelated && !isStorylineEdge) {
      return false;
    }

    if (dateFrom && lastSeenAt && Date.parse(lastSeenAt) < Date.parse(dateFrom)) {
      return false;
    }

    return visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);
  });

  return { nodes, edges };
}

function applySemanticProjection(
  nodes: GraphNode[],
  edges: GraphEdge[],
  zoomBand: GraphLayoutSnapshot['viewport']['zoomBand'],
): SemanticProjection {
  if (zoomBand === 'network') {
    const visibleNodes = nodes.filter((node) => node.type !== 'evidence');
    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
    return {
      nodes: visibleNodes,
      edges: edges.filter((edge) => edge.type !== 'evidence_link' && visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
      nodeAlias: new Map(nodes.map((node) => [node.id, node.id])),
      clusterCards: [],
    };
  }

  if (zoomBand === 'evidence') {
    return {
      nodes,
      edges,
      nodeAlias: new Map(nodes.map((node) => [node.id, node.id])),
      clusterCards: [],
    };
  }

  const clusterMap = new Map<string, {
    id: string;
    label: string;
    nodes: GraphNode[];
    nodeTypes: Set<string>;
  }>();
  const nodeAlias = new Map<string, string>();
  const visibleNodes = nodes.filter((node) => node.type !== 'evidence');

  for (const node of visibleNodes) {
    const clusterLabel = node.communityId ?? node.group ?? formatToken(node.type);
    const clusterId = `cluster:${clusterLabel}`;
    const cluster = clusterMap.get(clusterId) ?? {
      id: clusterId,
      label: clusterLabel,
      nodes: [],
      nodeTypes: new Set<string>(),
    };
    cluster.nodes.push(node);
    cluster.nodeTypes.add(node.type);
    clusterMap.set(clusterId, cluster);
    nodeAlias.set(node.id, clusterId);
  }

  const clusterNodes: GraphNode[] = [...clusterMap.values()].map((cluster) => ({
    id: cluster.id,
    type: 'group',
    label: cluster.label,
    title: `${cluster.nodes.length} entities`,
    color: '',
    group: cluster.label,
    degree: 0,
    inDegree: 0,
    outDegree: 0,
    layer: 'blended',
    metadata: {
      semanticCluster: true,
      nodeTypes: [...cluster.nodeTypes],
      nodeCount: cluster.nodes.length,
    },
    tags: [...cluster.nodeTypes].slice(0, 4),
    sourceRefs: [],
    createdAt: cluster.nodes[0]?.createdAt ?? new Date().toISOString(),
    updatedAt: cluster.nodes[0]?.updatedAt ?? new Date().toISOString(),
    flagged: cluster.nodes.some((node) => node.flagged),
    findingIds: [...new Set(cluster.nodes.flatMap((node) => node.findingIds ?? []))],
    storylineIds: [...new Set(cluster.nodes.flatMap((node) => node.storylineIds ?? []))],
    communityId: cluster.label,
    originNodeIds: cluster.nodes.map((node) => node.id),
  }));

  const clusterEdgeMap = new Map<string, GraphEdge>();
  for (const edge of edges) {
    if (edge.type === 'evidence_link') {
      continue;
    }
    const sourceClusterId = nodeAlias.get(edge.source);
    const targetClusterId = nodeAlias.get(edge.target);
    if (!sourceClusterId || !targetClusterId || sourceClusterId === targetClusterId) {
      continue;
    }

    const key = `${sourceClusterId}:${targetClusterId}:${edge.type}`;
    const existing = clusterEdgeMap.get(key);
    if (existing) {
      existing.weight += 1;
      existing.evidenceCount = (existing.evidenceCount ?? 0) + (edge.evidenceCount ?? 0);
      existing.findingIds = [...new Set([...(existing.findingIds ?? []), ...(edge.findingIds ?? [])])];
      existing.storylineIds = [...new Set([...(existing.storylineIds ?? []), ...(edge.storylineIds ?? [])])];
      existing.flagged = existing.flagged || edge.flagged;
      continue;
    }

    clusterEdgeMap.set(key, {
      ...edge,
      id: key,
      source: sourceClusterId,
      target: targetClusterId,
      metadata: {
        ...edge.metadata,
        semanticCluster: true,
      },
      metadataSummary: edge.metadataSummary ?? `${formatToken(edge.type)} relationship`,
      openEvidenceTarget: edge.openEvidenceTarget ?? null,
    });
  }

  return {
    nodes: clusterNodes,
    edges: [...clusterEdgeMap.values()],
    nodeAlias,
    clusterCards: [...clusterMap.values()].map((cluster) => ({
      id: cluster.id,
      label: cluster.label,
      nodeCount: cluster.nodes.length,
      nodeTypes: [...cluster.nodeTypes],
    })),
  };
}

function buildAdjacency(edges: GraphEdge[]): Map<string, Array<{ nodeId: string; edgeId: string }>> {
  const adjacency = new Map<string, Array<{ nodeId: string; edgeId: string }>>();
  for (const edge of edges) {
    const sourceList = adjacency.get(edge.source) ?? [];
    sourceList.push({ nodeId: edge.target, edgeId: edge.id });
    adjacency.set(edge.source, sourceList);

    const targetList = adjacency.get(edge.target) ?? [];
    targetList.push({ nodeId: edge.source, edgeId: edge.id });
    adjacency.set(edge.target, targetList);
  }

  return adjacency;
}

function resolveShortestPath(
  nodes: GraphNode[],
  edges: GraphEdge[],
  sourceNodeId: string | null,
  targetNodeId: string | null,
): ResolvedPath | null {
  if (!sourceNodeId || !targetNodeId) {
    return null;
  }

  if (sourceNodeId === targetNodeId) {
    const node = nodes.find((candidate) => candidate.id === sourceNodeId);
    return {
      nodeIds: [sourceNodeId],
      edgeIds: [],
      explanation: `${node?.label ?? 'The selected node'} is already the current anchor.`,
    };
  }

  const adjacency = buildAdjacency(edges);
  const queue: Array<{ nodeId: string; nodeIds: string[]; edgeIds: string[] }> = [{
    nodeId: sourceNodeId,
    nodeIds: [sourceNodeId],
    edgeIds: [],
  }];
  const visited = new Set<string>([sourceNodeId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of adjacency.get(current.nodeId) ?? []) {
      if (visited.has(edge.nodeId)) {
        continue;
      }

      const nextNodeIds = [...current.nodeIds, edge.nodeId];
      const nextEdgeIds = [...current.edgeIds, edge.edgeId];
      if (edge.nodeId === targetNodeId) {
        const nodeById = new Map(nodes.map((node) => [node.id, node]));
        const intermediateLabels = nextNodeIds
          .slice(1, -1)
          .map((nodeId) => nodeById.get(nodeId)?.label)
          .filter((label): label is string => Boolean(label));
        const sourceLabel = nodeById.get(sourceNodeId)?.label ?? 'Source';
        const targetLabel = nodeById.get(targetNodeId)?.label ?? 'Target';
        const explanation = intermediateLabels.length > 0
          ? `${sourceLabel} is connected to ${targetLabel} through ${intermediateLabels.join(' and ')}.`
          : `${sourceLabel} is directly connected to ${targetLabel}.`;

        return {
          nodeIds: nextNodeIds,
          edgeIds: nextEdgeIds,
          explanation,
        };
      }

      visited.add(edge.nodeId);
      queue.push({
        nodeId: edge.nodeId,
        nodeIds: nextNodeIds,
        edgeIds: nextEdgeIds,
      });
    }
  }

  return null;
}

function ToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'border-cyan-400/30 bg-cyan-400/12 text-cyan-100'
          : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-2)] hover:border-[var(--vt-text-3)]/30 hover:text-[var(--vt-text-1)]'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs text-[var(--vt-text-2)]">
      <span className="text-[var(--vt-text-3)]">{label}</span> {value}
    </div>
  );
}

function EdgeDetailDrawer({
  edge,
  sourceNode,
  targetNode,
  open,
  onClose,
}: {
  edge: GraphEdge | null;
  sourceNode: GraphNode | null;
  targetNode: GraphNode | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={open && Boolean(edge)}
      onClose={onClose}
      title="Relationship Evidence"
      width="md"
      actions={edge?.openEvidenceTarget ? (
        <Link
          className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/14"
          href={edge.openEvidenceTarget}
          target={edge.openEvidenceTarget.startsWith('http') ? '_blank' : undefined}
          rel={edge.openEvidenceTarget.startsWith('http') ? 'noreferrer' : undefined}
        >
          Open evidence
        </Link>
      ) : null}
    >
      {edge ? (
        <div className="space-y-4 p-6">
          <OpsCard className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Relationship</p>
              <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">{formatToken(edge.type)}</h2>
              <p className="text-sm text-[var(--vt-text-2)]">
                {sourceNode?.label ?? edge.source} <ArrowRight className="mx-1 inline h-3 w-3" /> {targetNode?.label ?? edge.target}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <MetricPill label="Evidence" value={String(edge.evidenceCount ?? 0)} />
              <MetricPill label="First seen" value={edge.firstSeenAt ? new Date(edge.firstSeenAt).toLocaleDateString() : 'n/a'} />
              <MetricPill label="Last seen" value={edge.lastSeenAt ? new Date(edge.lastSeenAt).toLocaleDateString() : 'n/a'} />
            </div>

            <p className="text-sm leading-6 text-[var(--vt-text-2)]">
              {edge.metadataSummary ?? edge.explanation}
            </p>
          </OpsCard>

          <OpsCard className="space-y-3">
            <div className="flex items-center gap-2">
              <CircleDot className="h-4 w-4 text-cyan-300" />
              <p className="text-sm font-semibold text-[var(--vt-text-1)]">Evidence refs</p>
            </div>
            {edge.evidenceRefs && edge.evidenceRefs.length > 0 ? (
              <div className="space-y-2">
                {edge.evidenceRefs.map((ref) => (
                  <div key={ref.evidenceId} className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-3">
                    <p className="text-sm font-medium text-[var(--vt-text-1)]">{ref.summary}</p>
                    <p className="mt-1 text-xs text-[var(--vt-text-3)]">
                      {(ref.source ?? 'Unknown source')}
                      {ref.observedAt ? ` • ${new Date(ref.observedAt).toLocaleString()}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--vt-text-3)]">No direct evidence refs were resolved for this visible edge. Metadata summary retained instead.</p>
            )}
          </OpsCard>
        </div>
      ) : null}
    </Drawer>
  );
}

export function GraphWorkspacePage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const requestedNpi = searchParams.get('npi');
  const requestedProviderId = searchParams.get('providerId');
  const findingId = searchParams.get('findingId');
  const storylineId = searchParams.get('storylineId');
  const querySourceNodeId = searchParams.get('sourceNodeId');
  const queryTargetNodeId = searchParams.get('targetNodeId');
  const requestedFocusNodeId = searchParams.get('focusNodeId');

  const [toolbarFilters, setToolbarFilters] = useState<InvestigationToolbarState>(DEFAULT_TOOLBAR_STATE);
  const [viewMode, setViewMode] = useState<GraphViewMode>('global');
  const [legacyFilters, setLegacyFilters] = useState<GraphFilterState>(DEFAULT_GRAPH_FILTERS);
  const [visuals, setVisuals] = useState<GraphVisualState>(DEFAULT_GRAPH_VISUALS);
  const [physics, setPhysics] = useState<GraphPhysicsState>(DEFAULT_GRAPH_PHYSICS);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoverDetail, setHoverDetail] = useState<GraphHoverDetail | null>(null);
  const [layoutSnapshot, setLayoutSnapshot] = useState<GraphLayoutSnapshot | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [expansionVersion, setExpansionVersion] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 620 });
  const [viewportSize, setViewportSize] = useState({ width: 1440, height: 900 });
  const [pathSourceNodeId, setPathSourceNodeId] = useState<string | null>(querySourceNodeId);
  const [pathTargetNodeId, setPathTargetNodeId] = useState<string | null>(queryTargetNodeId);
  const [zoomBand, setZoomBand] = useState<GraphLayoutSnapshot['viewport']['zoomBand']>('network');
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const graph = useInvestigationGraph({
    npi: requestedNpi,
    providerId: requestedProviderId,
    findingId,
    storylineId,
    focusNodeId: requestedFocusNodeId,
    sourceNodeId: querySourceNodeId,
    targetNodeId: queryTargetNodeId,
    entityTypes: toolbarFilters.entityTypes,
    relationshipTypes: toolbarFilters.relationshipTypes,
    dateFrom: resolveDateFrom(toolbarFilters.timeRange),
    onlyFlagged: toolbarFilters.onlyFlagged,
    onlyStorylineRelated: toolbarFilters.onlyStorylineRelated,
    limit: 40,
    depth: 2,
    pollIntervalMs: 45_000,
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
      const height = Math.max(460, Math.floor(Math.min(780, width * 0.72)));
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

    const requestedFocusNode = requestedFocusNodeId ? graph.data.nodes.find((node) => node.id === requestedFocusNodeId) ?? null : null;
    const candidateNodeId = requestedFocusNode?.id
      ?? graph.data.focusNodeId
      ?? graph.data.highlights.nodeIds[0]
      ?? graph.data.nodes.find((node) => node.type === 'provider')?.id
      ?? graph.data.nodes[0]?.id
      ?? null;

    if (
      !selectedNodeId
      || (requestedFocusNodeId && requestedFocusNodeId !== selectedNodeId)
      || !graph.data.nodes.some((node) => node.id === selectedNodeId)
    ) {
      setSelectedNodeId(
        candidateNodeId
      );
    }

    if (!pathSourceNodeId && graph.data.focusNodeId) {
      setPathSourceNodeId(graph.data.focusNodeId);
    }
  }, [graph.data, pathSourceNodeId, requestedFocusNodeId, selectedNodeId]);

  function syncFocusNodeContext(nodeId: string | null) {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nodeId) {
      nextParams.set('focusNodeId', nodeId);
    } else {
      nextParams.delete('focusNodeId');
    }
    const query = nextParams.toString();
    const nextUrl = query.length > 0 ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  }

  const availableEntityTypes = useMemo(
    () => [...new Set((graph.data?.nodes ?? []).map((node) => (node.projectedType ?? node.type) as InvestigationNodeKind))],
    [graph.data?.nodes],
  );
  const availableRelationshipTypes = useMemo(
    () => [...new Set((graph.data?.edges ?? []).map((edge) => (edge.projectedType ?? edge.type) as InvestigationEdgeKind))],
    [graph.data?.edges],
  );

  const toolbarFilteredGraph = useMemo(
    () => applyToolbarFilters(graph.data, toolbarFilters),
    [graph.data, toolbarFilters],
  );

  const detailPath = useMemo(
    () => resolveShortestPath(toolbarFilteredGraph.nodes, toolbarFilteredGraph.edges, pathSourceNodeId, pathTargetNodeId)
      ?? (graph.data?.paths.shortestPath
        ? {
          nodeIds: graph.data.paths.shortestPath.nodeIds,
          edgeIds: graph.data.paths.shortestPath.edgeIds,
          explanation: graph.data.paths.shortestPath.explanation,
        }
        : null),
    [graph.data?.paths.shortestPath, pathSourceNodeId, pathTargetNodeId, toolbarFilteredGraph.edges, toolbarFilteredGraph.nodes],
  );

  const semanticProjection = useMemo(
    () => applySemanticProjection(toolbarFilteredGraph.nodes, toolbarFilteredGraph.edges, zoomBand),
    [toolbarFilteredGraph.edges, toolbarFilteredGraph.nodes, zoomBand],
  );

  const filteredGraph = useMemo(() => applyLegacyFilters(
    semanticProjection.nodes,
    semanticProjection.edges,
    legacyFilters,
    viewMode,
    viewMode === 'local' ? (selectedNodeId ? semanticProjection.nodeAlias.get(selectedNodeId) ?? selectedNodeId : null) : null,
  ), [legacyFilters, semanticProjection.edges, semanticProjection.nodeAlias, semanticProjection.nodes, selectedNodeId, viewMode]);

  const nodeById = useMemo(
    () => new Map(filteredGraph.nodes.map((node) => [node.id, node])),
    [filteredGraph.nodes],
  );
  const detailNodeById = useMemo(
    () => new Map(toolbarFilteredGraph.nodes.map((node) => [node.id, node])),
    [toolbarFilteredGraph.nodes],
  );

  const selectedNode = useMemo(() => {
    const projectedSelectedId = zoomBand === 'overview'
      ? (selectedNodeId ? semanticProjection.nodeAlias.get(selectedNodeId) ?? selectedNodeId : null)
      : selectedNodeId;

    return projectedSelectedId
      ? filteredGraph.nodes.find((node) => node.id === projectedSelectedId) ?? null
      : null;
  }, [filteredGraph.nodes, selectedNodeId, semanticProjection.nodeAlias, zoomBand]);

  const selectedDetailNode = useMemo(
    () => selectedNodeId ? detailNodeById.get(selectedNodeId) ?? null : null,
    [detailNodeById, selectedNodeId],
  );

  const selectedEdge = useMemo(
    () => filteredGraph.edges.find((edge) => edge.id === selectedEdgeId) ?? toolbarFilteredGraph.edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [filteredGraph.edges, selectedEdgeId, toolbarFilteredGraph.edges],
  );

  const edgeSourceNode = selectedEdge ? (detailNodeById.get(selectedEdge.source) ?? nodeById.get(selectedEdge.source) ?? null) : null;
  const edgeTargetNode = selectedEdge ? (detailNodeById.get(selectedEdge.target) ?? nodeById.get(selectedEdge.target) ?? null) : null;

  const neighbors = useMemo(
    () => createNeighborSummaries(toolbarFilteredGraph.nodes, toolbarFilteredGraph.edges, selectedNodeId),
    [selectedNodeId, toolbarFilteredGraph.edges, toolbarFilteredGraph.nodes],
  );

  const highlightSets = useMemo(() => {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();

    const baseNodeIds = new Set<string>(graph.data?.highlights.nodeIds ?? []);
    const baseEdgeIds = new Set<string>(graph.data?.highlights.edgeIds ?? []);
    const focusNodeId = hoveredNodeId ?? selectedNodeId;

    for (const nodeId of baseNodeIds) {
      nodeIds.add(zoomBand === 'overview' ? (semanticProjection.nodeAlias.get(nodeId) ?? nodeId) : nodeId);
    }
    for (const edgeId of baseEdgeIds) {
      edgeIds.add(edgeId);
    }

    if (focusNodeId) {
      const projectedFocusId = zoomBand === 'overview'
        ? semanticProjection.nodeAlias.get(focusNodeId) ?? focusNodeId
        : focusNodeId;
      nodeIds.add(projectedFocusId);

      for (const edge of filteredGraph.edges) {
        if (edge.source === projectedFocusId || edge.target === projectedFocusId) {
          nodeIds.add(edge.source);
          nodeIds.add(edge.target);
          edgeIds.add(edge.id);
        }
      }
    }

    if (detailPath) {
      for (const nodeId of detailPath.nodeIds) {
        nodeIds.add(zoomBand === 'overview' ? (semanticProjection.nodeAlias.get(nodeId) ?? nodeId) : nodeId);
      }
      for (const edgeId of detailPath.edgeIds) {
        edgeIds.add(edgeId);
      }
    }

    if (selectedEdge) {
      edgeIds.add(selectedEdge.id);
      nodeIds.add(zoomBand === 'overview' ? (semanticProjection.nodeAlias.get(selectedEdge.source) ?? selectedEdge.source) : selectedEdge.source);
      nodeIds.add(zoomBand === 'overview' ? (semanticProjection.nodeAlias.get(selectedEdge.target) ?? selectedEdge.target) : selectedEdge.target);
    }

    return {
      nodeIds,
      edgeIds,
    };
  }, [detailPath, filteredGraph.edges, graph.data?.highlights.edgeIds, graph.data?.highlights.nodeIds, hoveredNodeId, selectedEdge, selectedNodeId, semanticProjection.nodeAlias, zoomBand]);

  const availableNodeTypes = useMemo(
    () => collectNodeTypes(filteredGraph.nodes),
    [filteredGraph.nodes],
  );
  const availableTrustTiers = useMemo(
    () => collectTrustTiers(filteredGraph.nodes),
    [filteredGraph.nodes],
  );
  const stats = useMemo(
    () => resolveGraphStats(filteredGraph.nodes, filteredGraph.edges),
    [filteredGraph.edges, filteredGraph.nodes],
  );

  const empty = !graph.loading && filteredGraph.nodes.length === 0;
  const selectedCluster = useMemo(
    () => semanticProjection.clusterCards.find((cluster) => cluster.id === selectedNode?.id) ?? null,
    [selectedNode?.id, semanticProjection.clusterCards],
  );

  const pathSourceNode = pathSourceNodeId ? detailNodeById.get(pathSourceNodeId) ?? null : null;
  const pathTargetNode = pathTargetNodeId ? detailNodeById.get(pathTargetNodeId) ?? null : null;

  function applyPreset(presetId: Exclude<InvestigationPresetId, 'custom'>) {
    setToolbarFilters({
      preset: presetId,
      ...PRESET_FILTERS[presetId],
    });
  }

  return (
    <OperationsShell
      activeHref="/intelligence/graph"
      activeNavKey="graph"
      title="Relationship Graph"
      description="Investigation-native graph workspace for provider-centric risk tracing, evidence linkage, and storyline path exploration."
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
          {graph.error}
        </SurfaceBanner>
      ) : graph.recovering ? (
        <SurfaceBanner tone="info">
          Refreshing the current investigation slice without dropping your expanded view.
        </SurfaceBanner>
      ) : null}
    >
      {empty ? (
        <SurfaceEmptyState
          title="No relationships available yet"
          description="This provider, finding, or storyline does not have a visible relationship slice yet. The graph shell stays honest and avoids rendering a misleading duplicate console."
        />
      ) : null}

      <div className="space-y-4">
        <OpsCard className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['risk', 'research', 'industry', 'clinical', 'all'] as Exclude<InvestigationPresetId, 'custom'>[]).map((presetId) => (
              <ToggleChip
                key={presetId}
                active={toolbarFilters.preset === presetId}
                label={formatToken(presetId)}
                onClick={() => applyPreset(presetId)}
              />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_1.2fr_0.8fr_0.9fr]">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Entity type</p>
              <div className="flex flex-wrap gap-2">
                {availableEntityTypes.map((entityType) => (
                  <ToggleChip
                    key={entityType}
                    active={toolbarFilters.entityTypes.includes(entityType)}
                    label={formatToken(entityType)}
                    onClick={() => setToolbarFilters((current) => ({
                      ...current,
                      preset: 'custom',
                      entityTypes: current.entityTypes.includes(entityType)
                        ? current.entityTypes.filter((value) => value !== entityType)
                        : [...current.entityTypes, entityType],
                    }))}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Relationship type</p>
              <div className="flex flex-wrap gap-2">
                {availableRelationshipTypes.map((relationshipType) => (
                  <ToggleChip
                    key={relationshipType}
                    active={toolbarFilters.relationshipTypes.includes(relationshipType)}
                    label={formatToken(relationshipType)}
                    onClick={() => setToolbarFilters((current) => ({
                      ...current,
                      preset: 'custom',
                      relationshipTypes: current.relationshipTypes.includes(relationshipType)
                        ? current.relationshipTypes.filter((value) => value !== relationshipType)
                        : [...current.relationshipTypes, relationshipType],
                    }))}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Time range</p>
              <div className="flex flex-wrap gap-2">
                {(['30d', '90d', '365d', 'all'] as TimeRange[]).map((timeRange) => (
                  <ToggleChip
                    key={timeRange}
                    active={toolbarFilters.timeRange === timeRange}
                    label={timeRange.toUpperCase()}
                    onClick={() => setToolbarFilters((current) => ({
                      ...current,
                      preset: 'custom',
                      timeRange,
                    }))}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Focus filters</p>
              <div className="flex flex-wrap gap-2">
                <ToggleChip
                  active={toolbarFilters.onlyFlagged}
                  label="Only flagged"
                  onClick={() => setToolbarFilters((current) => ({
                    ...current,
                    preset: 'custom',
                    onlyFlagged: !current.onlyFlagged,
                  }))}
                />
                <ToggleChip
                  active={toolbarFilters.onlyStorylineRelated}
                  label="Only storyline-related"
                  onClick={() => setToolbarFilters((current) => ({
                    ...current,
                    preset: 'custom',
                    onlyStorylineRelated: !current.onlyStorylineRelated,
                  }))}
                />
              </div>
            </div>
          </div>
        </OpsCard>

        <div className="grid gap-4 xl:grid-cols-[19rem_minmax(0,1fr)_24rem]">
          <div className="space-y-4">
            <GraphControls
              availableNodeTypes={availableNodeTypes}
              availableTrustTiers={availableTrustTiers}
              canUseLocalMode={Boolean(selectedNodeId)}
              filters={legacyFilters}
              hideLayerControls
              hideTrustTierFilters
              layer="blended"
              onFiltersChange={setLegacyFilters}
              onLayerChange={() => {}}
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
              tertiaryMetricLabel="Flagged"
              tertiaryMetricValue={String(graph.data?.stats.flaggedNodes ?? 0)}
              viewMode={viewMode}
              visuals={visuals}
            />

            <GraphLegend
              colorMode={visuals.colorMode}
              edges={filteredGraph.edges}
              nodes={filteredGraph.nodes}
            />
          </div>

          <OpsCard className="space-y-4 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Graph canvas</h2>
                <p className="text-sm text-[var(--vt-text-3)]">
                  Provider-centric by default. Double-click expands one hop, click edges for evidence, and use the path explorer to trace relationships.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MetricPill label="Flagged nodes" value={String(graph.data?.stats.flaggedNodes ?? 0)} />
                <MetricPill label="Evidence links" value={String(graph.data?.stats.evidenceEdges ?? 0)} />
                <MetricPill label="Storylines" value={String(graph.data?.stats.storylineEdges ?? 0)} />
              </div>
            </div>

            <div ref={canvasContainerRef} className="relative min-h-[30rem] rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-2">
              {!empty ? (
                <>
                  <GraphCanvas
                    disableInternalTooltip
                    edges={filteredGraph.edges}
                    edgeCap={480}
                    height={canvasSize.height}
                    highlightedEdgeIds={highlightSets.edgeIds}
                    highlightedNodeIds={highlightSets.nodeIds}
                    hoveredEdgeId={null}
                    hoveredNodeId={hoveredNodeId}
                    layoutScopeKey={[
                      requestedNpi ?? requestedProviderId ?? 'global',
                      findingId ?? 'no-finding',
                      storylineId ?? 'no-storyline',
                      toolbarFilters.entityTypes.join('|'),
                      toolbarFilters.relationshipTypes.join('|'),
                      toolbarFilters.timeRange,
                      toolbarFilters.onlyFlagged ? 'flagged' : 'all',
                      toolbarFilters.onlyStorylineRelated ? 'storyline' : 'mixed',
                      expansionVersion,
                    ].join('::')}
                    layoutVersion={layoutVersion}
                    miniMapThrottleMs={120}
                    nodeCap={180}
                    nodes={filteredGraph.nodes}
                    onDoubleClickNode={async (nodeId) => {
                      setSelectedNodeId(nodeId);
                      syncFocusNodeContext(nodeId);
                      await graph.expandNode(nodeId);
                      setExpansionVersion((current) => current + 1);
                    }}
                    onDragNode={() => {}}
                    onEdgeHoverDetailChange={() => {}}
                    onHoverDetailChange={setHoverDetail}
                    onHoverEdge={() => {}}
                    onHoverNode={setHoveredNodeId}
                    onLayoutSnapshotChange={setLayoutSnapshot}
                    onPinNode={() => {}}
                    onSelectEdge={setSelectedEdgeId}
                    onSelectNode={(nodeId) => {
                      setSelectedNodeId(nodeId);
                      syncFocusNodeContext(nodeId);
                      if (!pathSourceNodeId) {
                        setPathSourceNodeId(nodeId);
                      }
                    }}
                    physics={physics}
                    selectedEdgeId={selectedEdgeId}
                    selectedNodeId={zoomBand === 'overview'
                      ? (selectedNodeId ? semanticProjection.nodeAlias.get(selectedNodeId) ?? selectedNodeId : null)
                      : selectedNodeId}
                    visuals={visuals}
                    width={canvasSize.width}
                    onViewportChange={(viewport) => setZoomBand(viewport.zoomBand)}
                  />
                  <GraphTooltip
                    canvasH={viewportSize.height}
                    canvasW={viewportSize.width}
                    edges={filteredGraph.edges}
                    node={hoverDetail?.node ?? null}
                    screenX={hoverDetail?.screenX ?? 0}
                    screenY={hoverDetail?.screenY ?? 0}
                  />

                  <div className="pointer-events-none absolute bottom-4 right-4 w-44 overflow-hidden rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/88 shadow-2xl backdrop-blur">
                    <GraphMiniMap snapshot={layoutSnapshot} className="h-32 w-full" />
                  </div>
                </>
              ) : null}
            </div>

            {detailPath ? (
              <OpsCard className="border-cyan-400/15 bg-cyan-400/[0.03]">
                <div className="flex items-start gap-3">
                  <Route className="mt-0.5 h-4 w-4 text-cyan-300" />
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Path explorer</p>
                    <p className="text-sm font-medium text-[var(--vt-text-1)]">{detailPath.explanation}</p>
                    <p className="text-xs text-[var(--vt-text-3)]">
                      {detailPath.nodeIds.length} nodes • {detailPath.edgeIds.length} edges in the shortest visible path
                    </p>
                  </div>
                </div>
              </OpsCard>
            ) : null}
          </OpsCard>

          <div className="space-y-4">
            <OpsCard className="space-y-4">
              <div className="flex items-center gap-2">
                <Radar className="h-4 w-4 text-cyan-300" />
                <div>
                  <p className="text-sm font-semibold text-[var(--vt-text-1)]">Path explorer</p>
                  <p className="text-xs text-[var(--vt-text-3)]">Select two nodes to highlight the shortest relationship path.</p>
                </div>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-3 text-left text-sm text-[var(--vt-text-2)] transition hover:border-[var(--vt-text-3)]/30 hover:text-[var(--vt-text-1)]"
                  onClick={() => {
                    if (selectedNodeId) {
                      setPathSourceNodeId(selectedNodeId);
                    }
                  }}
                >
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Source</span>
                  <span className="mt-1 block">{pathSourceNode?.label ?? 'Use the selected node as path source'}</span>
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-3 text-left text-sm text-[var(--vt-text-2)] transition hover:border-[var(--vt-text-3)]/30 hover:text-[var(--vt-text-1)]"
                  onClick={() => {
                    if (selectedNodeId) {
                      setPathTargetNodeId(selectedNodeId);
                    }
                  }}
                >
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Target</span>
                  <span className="mt-1 block">{pathTargetNode?.label ?? 'Use the selected node as path target'}</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <ToggleChip active={Boolean(pathSourceNodeId)} label="Reset source" onClick={() => setPathSourceNodeId(null)} />
                <ToggleChip active={Boolean(pathTargetNodeId)} label="Reset target" onClick={() => setPathTargetNodeId(null)} />
              </div>
            </OpsCard>

            {zoomBand === 'overview' && selectedCluster ? (
              <OpsCard className="space-y-3">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-cyan-300" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--vt-text-1)]">Community cluster</p>
                    <p className="text-xs text-[var(--vt-text-3)]">Low-zoom institution/community summary</p>
                  </div>
                </div>
                <p className="text-lg font-semibold text-[var(--vt-text-1)]">{selectedCluster.label}</p>
                <p className="text-sm text-[var(--vt-text-2)]">
                  {selectedCluster.nodeCount} nodes • {selectedCluster.nodeTypes.map(formatToken).join(', ')}
                </p>
              </OpsCard>
            ) : selectedDetailNode ? (
              <NodeDetail
                edges={toolbarFilteredGraph.edges}
                neighbors={neighbors}
                node={selectedDetailNode}
                onAcceptSuggestion={() => {}}
                onClose={() => {
                  setSelectedNodeId(null);
                  syncFocusNodeContext(null);
                }}
                onFocusNode={(nodeId) => {
                  setSelectedNodeId(nodeId);
                  syncFocusNodeContext(nodeId);
                  setViewMode('local');
                }}
                onRejectSuggestion={() => {}}
              />
            ) : (
              <OpsCard>
                <p className="text-sm text-[var(--vt-text-3)]">Select a node to inspect why it is risky, what evidence supports it, and which storyline it belongs to.</p>
              </OpsCard>
            )}
          </div>
        </div>
      </div>

      <EdgeDetailDrawer
        edge={selectedEdge}
        sourceNode={edgeSourceNode}
        targetNode={edgeTargetNode}
        open={Boolean(selectedEdge)}
        onClose={() => setSelectedEdgeId(null)}
      />
    </OperationsShell>
  );
}
