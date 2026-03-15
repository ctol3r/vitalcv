import { analyzeGraph, pageRank } from './algorithms';
import { projectDualGraph, type DualGraph } from './model';
import { toOntologyProjection } from './ontology';
import type { GraphAlgorithmBundle, GraphScore } from './types';
import { clamp01, rankScores, roundTo } from './utils';
import type { GraphSnapshotDelta, WeeklyGraphSnapshot } from './snapshots';

export interface ProviderInfluenceScore {
  providerId: string;
  ontologyPageRank: number;
  networkPageRank: number;
  betweennessCentrality: number;
  communitySpan: number;
  articulationPoint: boolean;
  influenceScore: number;
  rank: number;
  percentile: number;
}

export interface StorylineGraphSignal {
  influencePercentile: number;
  bridgePercentile: number;
  articulationPoint: boolean;
  centralityShift: number;
  communityShift: number;
}

export interface WeightedStorylineSeverity {
  adjustedScore: number;
  boost: number;
  reasons: string[];
}

function scoreByNodeId(scores: GraphScore[]): Map<string, GraphScore> {
  return new Map(scores.map((entry) => [entry.nodeId, entry]));
}

function buildCommunitySpanMap(
  analysis: GraphAlgorithmBundle,
  nodeIds: string[],
  edges: Array<{ source: string; target: string }>,
): Map<string, number> {
  const communityByNode = new Map<string, string>();
  for (const community of analysis.communities) {
    for (const memberNodeId of community.memberNodeIds) {
      communityByNode.set(memberNodeId, community.communityId);
    }
  }

  const communityCount = Math.max(1, analysis.communities.length);
  const trackedNodeIds = new Set(nodeIds);
  const neighborCommunities = new Map<string, Set<string>>();

  for (const nodeId of nodeIds) {
    neighborCommunities.set(nodeId, new Set());
  }

  for (const edge of edges) {
    if (trackedNodeIds.has(edge.source)) {
      const communityId = communityByNode.get(edge.target);
      if (communityId) {
        neighborCommunities.get(edge.source)?.add(communityId);
      }
    }

    if (trackedNodeIds.has(edge.target)) {
      const communityId = communityByNode.get(edge.source);
      if (communityId) {
        neighborCommunities.get(edge.target)?.add(communityId);
      }
    }
  }

  return new Map(nodeIds.map((nodeId) => {
    const span = (neighborCommunities.get(nodeId)?.size ?? 0) / communityCount;
    return [nodeId, roundTo(span)];
  }));
}

export function scoreProviderInfluence(
  graph: DualGraph,
  options: {
    now?: string;
  } = {},
): ProviderInfluenceScore[] {
  const ontologyProjection = toOntologyProjection(graph.ontology);
  const dualProjection = projectDualGraph(graph, {
    mode: 'dual',
    now: options.now ?? graph.createdAt,
  });
  const ontologyPageRanks = scoreByNodeId(pageRank(ontologyProjection));
  const analysis = analyzeGraph(dualProjection);
  const networkPageRanks = scoreByNodeId(analysis.pageRank);
  const betweenness = scoreByNodeId(analysis.betweennessCentrality);
  const articulationPoints = new Set(analysis.articulationPoints);
  const providerIds = graph.ontology.entities
    .filter((entity) => entity.entityType === 'provider')
    .map((entity) => entity.entityId)
    .sort((left, right) => left.localeCompare(right));
  const communitySpanByProvider = buildCommunitySpanMap(
    analysis,
    providerIds,
    dualProjection.edges,
  );

  const ranked = rankScores(providerIds.map((providerId) => {
    const ontologyPageRank = ontologyPageRanks.get(providerId)?.score ?? 0;
    const networkPageRank = networkPageRanks.get(providerId)?.score ?? 0;
    const betweennessCentrality = betweenness.get(providerId)?.score ?? 0;
    const communitySpan = communitySpanByProvider.get(providerId) ?? 0;
    const articulationPoint = articulationPoints.has(providerId);
    const influenceScore = roundTo(clamp01(
      (ontologyPageRank * 0.35)
        + (networkPageRank * 0.25)
        + (betweennessCentrality * 0.25)
        + (communitySpan * 0.1)
        + (articulationPoint ? 0.05 : 0),
    ));

    return {
      nodeId: providerId,
      score: influenceScore,
    };
  }));

  return ranked.map((entry) => {
    const providerId = entry.nodeId;
    return {
      providerId,
      ontologyPageRank: ontologyPageRanks.get(providerId)?.score ?? 0,
      networkPageRank: networkPageRanks.get(providerId)?.score ?? 0,
      betweennessCentrality: betweenness.get(providerId)?.score ?? 0,
      communitySpan: communitySpanByProvider.get(providerId) ?? 0,
      articulationPoint: articulationPoints.has(providerId),
      influenceScore: entry.score,
      rank: entry.rank,
      percentile: entry.percentile,
    };
  });
}

export function deriveStorylineGraphSignal(input: {
  snapshot: WeeklyGraphSnapshot;
  delta?: GraphSnapshotDelta | null;
  entityIds: string[];
}): StorylineGraphSignal {
  const pageRankByNode = scoreByNodeId(input.snapshot.algorithms.pageRank);
  const betweennessByNode = scoreByNodeId(input.snapshot.algorithms.betweennessCentrality);
  const articulationPoints = new Set(input.snapshot.algorithms.articulationPoints);
  const shiftedNodes = new Map(
    (input.delta?.centralityShifts ?? []).map((shift) => [shift.nodeId, shift]),
  );
  const clusterChangedNodes = new Set(
    (input.delta?.clusterChanges ?? [])
      .flatMap((change) => change.nodeIds),
  );

  let influencePercentile = 0;
  let bridgePercentile = 0;
  let articulationPoint = false;
  let centralityShift = 0;
  let communityShift = 0;

  for (const entityId of input.entityIds) {
    influencePercentile = Math.max(influencePercentile, pageRankByNode.get(entityId)?.percentile ?? 0);
    bridgePercentile = Math.max(bridgePercentile, betweennessByNode.get(entityId)?.percentile ?? 0);
    articulationPoint = articulationPoint || articulationPoints.has(entityId);
    centralityShift = Math.max(centralityShift, shiftedNodes.get(entityId)?.combinedShift ?? 0);
    if (clusterChangedNodes.has(entityId)) {
      communityShift = 1;
    }
  }

  return {
    influencePercentile: roundTo(influencePercentile),
    bridgePercentile: roundTo(bridgePercentile),
    articulationPoint,
    centralityShift: roundTo(centralityShift),
    communityShift: roundTo(communityShift),
  };
}

export function weightStorylineSeverity(input: {
  baselineScore: number;
  signal: StorylineGraphSignal;
}): WeightedStorylineSeverity {
  const boost = roundTo(clamp01(
    (input.signal.influencePercentile * 0.15)
      + (input.signal.bridgePercentile * 0.15)
      + (input.signal.centralityShift * 0.3)
      + (input.signal.communityShift * 0.18)
      + (input.signal.articulationPoint ? 0.22 : 0),
  ));

  const reasons: string[] = [];
  if (input.signal.influencePercentile >= 0.8) {
    reasons.push('high_influence_entity');
  }
  if (input.signal.bridgePercentile >= 0.8) {
    reasons.push('bridge_entity');
  }
  if (input.signal.centralityShift >= 0.15) {
    reasons.push('centrality_shift');
  }
  if (input.signal.communityShift > 0) {
    reasons.push('community_shift');
  }
  if (input.signal.articulationPoint) {
    reasons.push('articulation_point');
  }

  return {
    adjustedScore: roundTo(clamp01(input.baselineScore * (1 + (boost * 0.45)))),
    boost,
    reasons,
  };
}
