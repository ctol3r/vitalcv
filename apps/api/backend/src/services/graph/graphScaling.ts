/**
 * graphScaling.ts — Wave 144: Trust Graph Performance Scaling
 *
 * Enables the trust graph to scale to large credential networks via:
 *   - clusterNodes()          — group low-value nodes into clusters
 *   - loadGraphSegment()      — lazy-load a subgraph around a focus node
 *   - aggregateGraph()        — server-side aggregation for overview rendering
 *   - getGraphPerformance()   — render-time + node/edge telemetry
 *
 * These utilities are consumed by the /api/network/global endpoint options
 * and by the GraphScaling API routes.
 */

import { log } from '../../obs/logger';
import type { GlobalNode, GlobalEdge, GlobalGraphData } from '../network/globalGraph';
import { generateGlobalGraph } from '../network/globalGraph';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ClusterNode extends GlobalNode {
  /** Indicates this is a cluster aggregate, not a real node */
  isCluster: true;
  /** Number of nodes collapsed into this cluster */
  clusterSize: number;
  /** IDs of nodes represented by this cluster */
  memberIds: string[];
}

export interface ScaledGraphData {
  nodes: Array<GlobalNode | ClusterNode>;
  edges: GlobalEdge[];
  stats: GlobalGraphData['stats'] & {
    clustersCreated: number;
    nodesCollapsed: number;
    renderBudgetNodes: number;
  };
  generatedAt: string;
  scalingApplied: boolean;
}

export interface GraphSegment {
  focusNodeId: string;
  depth: number;
  nodes: GlobalNode[];
  edges: GlobalEdge[];
  totalNodesInGraph: number;
  loadedAt: string;
}

export interface GraphPerformanceTelemetry {
  nodeCount: number;
  edgeCount: number;
  clusterCount: number;
  /** Estimated canvas render time in milliseconds (model-based) */
  estimatedRenderMs: number;
  /** Node density score (edges / nodes) */
  density: number;
  /** Whether clustering is recommended */
  clusteringRecommended: boolean;
  /** Recommended render budget */
  recommendedNodeBudget: number;
  measuredAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

/** Nodes above this threshold trigger clustering */
const CLUSTER_THRESHOLD = 150;

/** Max nodes to render without clustering */
const DEFAULT_RENDER_BUDGET = 200;

/** Estimated ms per node for a 60fps canvas render */
const MS_PER_NODE = 0.35;

// ── Helpers ────────────────────────────────────────────────────────────────────

function isClusterNode(n: GlobalNode | ClusterNode): n is ClusterNode {
  return 'isCluster' in n && n.isCluster === true;
}

function buildAdjacencyMap(edges: GlobalEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }
  return adj;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Cluster low-degree nodes of the same group into aggregate cluster nodes.
 * Credential and decision nodes with val < 3 are prime candidates.
 */
export function clusterNodes(
  graph: GlobalGraphData,
  opts?: { renderBudget?: number; minDegreeToKeep?: number },
): ScaledGraphData {
  const budget = opts?.renderBudget ?? DEFAULT_RENDER_BUDGET;
  const minDegree = opts?.minDegreeToKeep ?? 2;

  if (graph.nodes.length <= budget) {
    // No clustering needed
    return {
      ...graph,
      stats: { ...graph.stats, clustersCreated: 0, nodesCollapsed: 0, renderBudgetNodes: graph.nodes.length },
      scalingApplied: false,
    };
  }

  const adj = buildAdjacencyMap(graph.edges);

  // Identify low-degree clusterizable nodes (credentials + decisions with few connections)
  const clusterableGroups = new Set(['credential', 'decision']);
  const keepNodes = new Set<string>();
  const clusterCandidates = new Map<string, GlobalNode[]>(); // group key → nodes

  for (const node of graph.nodes) {
    const degree = (adj.get(node.id)?.size ?? 0);
    if (clusterableGroups.has(node.group) && degree < minDegree) {
      const key = node.group;
      if (!clusterCandidates.has(key)) clusterCandidates.set(key, []);
      clusterCandidates.get(key)!.push(node);
    } else {
      keepNodes.add(node.id);
    }
  }

  const resultNodes: Array<GlobalNode | ClusterNode> = graph.nodes
    .filter((n) => keepNodes.has(n.id));

  let clustersCreated = 0;
  let nodesCollapsed = 0;
  const collapsedIds = new Set<string>();

  for (const [groupKey, candidates] of clusterCandidates.entries()) {
    if (candidates.length === 0) continue;

    // Create one cluster node per group
    const clusterId = `cluster-${groupKey}-${Date.now()}`;
    const clusterNode: ClusterNode = {
      id: clusterId,
      label: `${candidates.length} ${groupKey}s`,
      group: candidates[0].group,
      val: Math.min(20, candidates.length / 2),
      isCluster: true,
      clusterSize: candidates.length,
      memberIds: candidates.map((c) => c.id),
      metadata: { clusterGroup: groupKey, memberCount: candidates.length },
    };

    resultNodes.push(clusterNode);
    candidates.forEach((c) => collapsedIds.add(c.id));
    clustersCreated++;
    nodesCollapsed += candidates.length;
  }

  // Remap edges — redirect edges to/from collapsed nodes to their cluster
  const collapseToCluster = new Map<string, string>();
  for (const node of resultNodes) {
    if (isClusterNode(node)) {
      for (const memberId of node.memberIds) {
        collapseToCluster.set(memberId, node.id);
      }
    }
  }

  const resultEdges: GlobalEdge[] = [];
  const seenEdges = new Set<string>();

  for (const edge of graph.edges) {
    const src = collapseToCluster.get(edge.source) ?? edge.source;
    const tgt = collapseToCluster.get(edge.target) ?? edge.target;

    if (src === tgt) continue; // self-loop after clustering
    const key = `${src}__${tgt}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    resultEdges.push({ source: src, target: tgt, label: edge.label, weight: edge.weight });
  }

  log('info', 'graph_clustering_applied', {
    original: graph.nodes.length,
    after: resultNodes.length,
    clustersCreated,
    nodesCollapsed,
  });

  return {
    nodes: resultNodes,
    edges: resultEdges,
    stats: {
      ...graph.stats,
      totalNodes: resultNodes.length,
      totalEdges: resultEdges.length,
      clustersCreated,
      nodesCollapsed,
      renderBudgetNodes: budget,
    },
    generatedAt: new Date().toISOString(),
    scalingApplied: true,
  };
}

/**
 * Lazy-load a subgraph segment centered on a specific node, up to `depth` hops.
 */
export async function loadGraphSegment(
  focusNodeId: string,
  depth = 2,
): Promise<GraphSegment> {
  const full = await generateGlobalGraph();
  const adj = buildAdjacencyMap(full.edges);

  const visited = new Set<string>();
  const queue: Array<{ id: string; d: number }> = [{ id: focusNodeId, d: 0 }];

  while (queue.length > 0) {
    const item = queue.shift()!;
    if (visited.has(item.id)) continue;
    visited.add(item.id);
    if (item.d < depth) {
      for (const neighbor of (adj.get(item.id) ?? [])) {
        if (!visited.has(neighbor)) queue.push({ id: neighbor, d: item.d + 1 });
      }
    }
  }

  const segmentNodes = full.nodes.filter((n) => visited.has(n.id));
  const segmentEdges = full.edges.filter(
    (e) => visited.has(e.source) && visited.has(e.target),
  );

  log('info', 'graph_segment_loaded', {
    focusNodeId,
    depth,
    segmentNodes: segmentNodes.length,
    segmentEdges: segmentEdges.length,
  });

  return {
    focusNodeId,
    depth,
    nodes: segmentNodes,
    edges: segmentEdges,
    totalNodesInGraph: full.nodes.length,
    loadedAt: new Date().toISOString(),
  };
}

/**
 * Server-side graph aggregation — returns a drastically reduced overview graph
 * suitable for initial paint, then segments can be lazy-loaded.
 */
export async function aggregateGraph(opts?: {
  renderBudget?: number;
}): Promise<ScaledGraphData> {
  const full = await generateGlobalGraph();
  return clusterNodes(full, opts);
}

/**
 * Get performance telemetry for the current trust graph.
 */
export async function getGraphPerformance(): Promise<GraphPerformanceTelemetry> {
  const full = await generateGlobalGraph();
  const nodeCount = full.nodes.length;
  const edgeCount = full.edges.length;
  const density = nodeCount > 0 ? edgeCount / nodeCount : 0;
  const estimatedRenderMs = nodeCount * MS_PER_NODE + edgeCount * 0.05;
  const clusteringRecommended = nodeCount > CLUSTER_THRESHOLD;
  const recommendedNodeBudget = clusteringRecommended ? DEFAULT_RENDER_BUDGET : nodeCount;

  return {
    nodeCount,
    edgeCount,
    clusterCount: 0, // Will be > 0 after aggregation
    estimatedRenderMs: Math.round(estimatedRenderMs * 10) / 10,
    density: Math.round(density * 100) / 100,
    clusteringRecommended,
    recommendedNodeBudget,
    measuredAt: new Date().toISOString(),
  };
}
