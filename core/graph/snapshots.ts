import { analyzeGraph } from './algorithms';
import { scoreProviderInfluence, type ProviderInfluenceScore } from './intelligence';
import { projectDualGraph, type DualGraph } from './model';
import type { GraphAlgorithmBundle, GraphEdge, GraphProjection } from './types';
import {
  clamp01,
  createDeterministicId,
  endOfUtcWeek,
  normalizeTimestamp,
  roundTo,
  sha256Hex,
  stableStringify,
  startOfUtcWeek,
} from './utils';

export interface WeeklyGraphSnapshot {
  snapshotId: string;
  graphId: string;
  weekStart: string;
  weekEnd: string;
  capturedAt: string;
  ontologyHash: string;
  eventHash: string;
  projectionHash: string;
  dualGraph: DualGraph;
  projection: GraphProjection;
  algorithms: GraphAlgorithmBundle;
  providerInfluence: ProviderInfluenceScore[];
}

export interface CentralityShiftRecord {
  nodeId: string;
  previousPageRank: number;
  currentPageRank: number;
  previousBetweenness: number;
  currentBetweenness: number;
  combinedShift: number;
  previousRank: number | null;
  currentRank: number | null;
}

export interface ClusterChangeRecord {
  changeType: 'community_created' | 'community_dissolved' | 'node_moved';
  communityId: string;
  nodeIds: string[];
  previousCommunityId?: string | null;
  currentCommunityId?: string | null;
}

export interface GraphSnapshotDelta {
  deltaId: string;
  fromSnapshotId: string;
  toSnapshotId: string;
  detectedAt: string;
  newEdges: GraphEdge[];
  lostEdges: GraphEdge[];
  centralityShifts: CentralityShiftRecord[];
  clusterChanges: ClusterChangeRecord[];
  severityScore: number;
}

export interface WeeklyGraphSnapshotStore {
  put(snapshot: WeeklyGraphSnapshot): WeeklyGraphSnapshot;
  get(graphId: string, weekStart: string): WeeklyGraphSnapshot | null;
  latest(graphId: string): WeeklyGraphSnapshot | null;
  list(graphId: string): WeeklyGraphSnapshot[];
}

export class InMemoryWeeklyGraphSnapshotStore implements WeeklyGraphSnapshotStore {
  private readonly snapshots = new Map<string, Map<string, WeeklyGraphSnapshot>>();

  put(snapshot: WeeklyGraphSnapshot): WeeklyGraphSnapshot {
    const byWeek = this.snapshots.get(snapshot.graphId) ?? new Map<string, WeeklyGraphSnapshot>();
    byWeek.set(snapshot.weekStart, snapshot);
    this.snapshots.set(snapshot.graphId, byWeek);
    return snapshot;
  }

  get(graphId: string, weekStart: string): WeeklyGraphSnapshot | null {
    return this.snapshots.get(graphId)?.get(weekStart) ?? null;
  }

  latest(graphId: string): WeeklyGraphSnapshot | null {
    const snapshots = this.list(graphId);
    return snapshots.at(-1) ?? null;
  }

  list(graphId: string): WeeklyGraphSnapshot[] {
    return [...(this.snapshots.get(graphId)?.values() ?? [])]
      .sort((left, right) => left.weekStart.localeCompare(right.weekStart));
  }
}

function edgeKey(edge: GraphEdge): string {
  return stableStringify({
    source: edge.source,
    target: edge.target,
    relation: edge.relation,
    directed: edge.directed,
    layer: edge.layer,
  });
}

function scoreMap(scores: GraphAlgorithmBundle['pageRank']): Map<string, GraphAlgorithmBundle['pageRank'][number]> {
  return new Map(scores.map((entry) => [entry.nodeId, entry]));
}

function communityMembership(snapshot: WeeklyGraphSnapshot): Map<string, string> {
  const membership = new Map<string, string>();
  for (const community of snapshot.algorithms.communities) {
    for (const nodeId of community.memberNodeIds) {
      membership.set(nodeId, community.communityId);
    }
  }
  return membership;
}

export function createWeeklyGraphSnapshot(input: {
  dualGraph: DualGraph;
  capturedAt?: string;
}): WeeklyGraphSnapshot {
  const capturedAt = normalizeTimestamp(input.capturedAt ?? input.dualGraph.createdAt);
  const projection = projectDualGraph(input.dualGraph, {
    mode: 'dual',
    now: capturedAt,
  });
  const algorithms = analyzeGraph(projection);
  const providerInfluence = scoreProviderInfluence(input.dualGraph, { now: capturedAt });
  const weekStart = startOfUtcWeek(capturedAt);
  const weekEnd = endOfUtcWeek(capturedAt);
  const ontologyHash = sha256Hex(input.dualGraph.ontology);
  const eventHash = sha256Hex(input.dualGraph.events);
  const projectionHash = sha256Hex({
    nodes: projection.nodes,
    edges: projection.edges,
  });

  return {
    snapshotId: createDeterministicId('gws', {
      graphId: input.dualGraph.graphId,
      weekStart,
      projectionHash,
    }),
    graphId: input.dualGraph.graphId,
    weekStart,
    weekEnd,
    capturedAt,
    ontologyHash,
    eventHash,
    projectionHash,
    dualGraph: input.dualGraph,
    projection,
    algorithms,
    providerInfluence,
  };
}

export function storeWeeklyGraphSnapshot(
  store: WeeklyGraphSnapshotStore,
  input: {
    dualGraph: DualGraph;
    capturedAt?: string;
  },
): WeeklyGraphSnapshot {
  const snapshot = createWeeklyGraphSnapshot(input);
  return store.put(snapshot);
}

export function diffWeeklyGraphSnapshots(
  previousSnapshot: WeeklyGraphSnapshot,
  currentSnapshot: WeeklyGraphSnapshot,
  options: {
    minCombinedShift?: number;
  } = {},
): GraphSnapshotDelta {
  const minCombinedShift = options.minCombinedShift ?? 0.05;
  const previousEdgesByKey = new Map(previousSnapshot.projection.edges.map((edge) => [edgeKey(edge), edge]));
  const currentEdgesByKey = new Map(currentSnapshot.projection.edges.map((edge) => [edgeKey(edge), edge]));

  const newEdges = [...currentEdgesByKey.entries()]
    .filter(([key]) => !previousEdgesByKey.has(key))
    .map(([, edge]) => edge);
  const lostEdges = [...previousEdgesByKey.entries()]
    .filter(([key]) => !currentEdgesByKey.has(key))
    .map(([, edge]) => edge);

  const previousPageRank = scoreMap(previousSnapshot.algorithms.pageRank);
  const currentPageRank = scoreMap(currentSnapshot.algorithms.pageRank);
  const previousBetweenness = scoreMap(previousSnapshot.algorithms.betweennessCentrality);
  const currentBetweenness = scoreMap(currentSnapshot.algorithms.betweennessCentrality);
  const allNodeIds = new Set([
    ...previousPageRank.keys(),
    ...currentPageRank.keys(),
    ...previousBetweenness.keys(),
    ...currentBetweenness.keys(),
  ]);

  const centralityShifts = [...allNodeIds].map((nodeId) => {
    const previousPageRankScore = previousPageRank.get(nodeId)?.score ?? 0;
    const currentPageRankScore = currentPageRank.get(nodeId)?.score ?? 0;
    const previousBetweennessScore = previousBetweenness.get(nodeId)?.score ?? 0;
    const currentBetweennessScore = currentBetweenness.get(nodeId)?.score ?? 0;
    return {
      nodeId,
      previousPageRank: previousPageRankScore,
      currentPageRank: currentPageRankScore,
      previousBetweenness: previousBetweennessScore,
      currentBetweenness: currentBetweennessScore,
      combinedShift: roundTo(
        Math.abs(currentPageRankScore - previousPageRankScore)
          + Math.abs(currentBetweennessScore - previousBetweennessScore),
      ),
      previousRank: previousPageRank.get(nodeId)?.rank ?? null,
      currentRank: currentPageRank.get(nodeId)?.rank ?? null,
    };
  })
    .filter((entry) => entry.combinedShift >= minCombinedShift)
    .sort((left, right) => right.combinedShift - left.combinedShift || left.nodeId.localeCompare(right.nodeId));

  const previousCommunityMembership = communityMembership(previousSnapshot);
  const currentCommunityMembership = communityMembership(currentSnapshot);
  const clusterChanges: ClusterChangeRecord[] = [];
  const previousCommunityIds = new Set(previousSnapshot.algorithms.communities.map((community) => community.communityId));
  const currentCommunityIds = new Set(currentSnapshot.algorithms.communities.map((community) => community.communityId));

  for (const community of currentSnapshot.algorithms.communities) {
    if (!previousCommunityIds.has(community.communityId)) {
      clusterChanges.push({
        changeType: 'community_created',
        communityId: community.communityId,
        nodeIds: community.memberNodeIds,
      });
    }
  }

  for (const community of previousSnapshot.algorithms.communities) {
    if (!currentCommunityIds.has(community.communityId)) {
      clusterChanges.push({
        changeType: 'community_dissolved',
        communityId: community.communityId,
        nodeIds: community.memberNodeIds,
      });
    }
  }

  for (const nodeId of new Set([...previousCommunityMembership.keys(), ...currentCommunityMembership.keys()])) {
    const previousCommunityId = previousCommunityMembership.get(nodeId) ?? null;
    const currentCommunityId = currentCommunityMembership.get(nodeId) ?? null;
    if (previousCommunityId !== currentCommunityId) {
      clusterChanges.push({
        changeType: 'node_moved',
        communityId: currentCommunityId ?? previousCommunityId ?? 'unassigned',
        nodeIds: [nodeId],
        previousCommunityId,
        currentCommunityId,
      });
    }
  }

  const changeRatio = currentSnapshot.projection.nodes.length === 0
    ? 0
    : clusterChanges.filter((change) => change.changeType === 'node_moved').length / currentSnapshot.projection.nodes.length;
  const maxShift = Math.max(0, ...centralityShifts.map((entry) => entry.combinedShift));
  const edgeChangeRatio = currentSnapshot.projection.edges.length === 0
    ? 0
    : (newEdges.length + lostEdges.length) / currentSnapshot.projection.edges.length;

  return {
    deltaId: createDeterministicId('gdelta', {
      fromSnapshotId: previousSnapshot.snapshotId,
      toSnapshotId: currentSnapshot.snapshotId,
      projectionHash: currentSnapshot.projectionHash,
    }),
    fromSnapshotId: previousSnapshot.snapshotId,
    toSnapshotId: currentSnapshot.snapshotId,
    detectedAt: currentSnapshot.capturedAt,
    newEdges,
    lostEdges,
    centralityShifts,
    clusterChanges,
    severityScore: roundTo(clamp01(
      (edgeChangeRatio * 0.3)
        + (maxShift * 0.4)
        + (changeRatio * 0.3),
    )),
  };
}
