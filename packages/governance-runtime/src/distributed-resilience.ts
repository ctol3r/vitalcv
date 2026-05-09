/**
 * Distributed trust resilience (W2-PR59A).
 *
 * Pure model for partition-aware trust quorum + replay continuity under
 * partial outage. Does NOT speak to a network — caller passes per-node
 * health observations.
 *
 * Quorum semantics: a trust decision requires a configurable quorum of
 * verifier nodes; nodes whose health is UNKNOWN count as NON-VOTING
 * (preserves ambiguity rather than coercing to "healthy").
 */

export const NODE_HEALTH = ["HEALTHY", "DEGRADED", "PARTITIONED", "UNKNOWN"] as const;
export type NodeHealth = (typeof NODE_HEALTH)[number];

export interface NodeObservation {
  readonly nodeId: string;
  readonly health: NodeHealth;
  readonly lastSeenIso: string;
  /** Whether this node carries replay lineage for the current window. */
  readonly carriesReplayLineage: boolean;
}

export interface QuorumConfig {
  readonly totalNodes: number;
  /** Minimum HEALTHY+DEGRADED nodes required for a quorum decision. */
  readonly quorumThreshold: number;
  /** Minimum nodes that must carry replay lineage. */
  readonly replayLineageMin: number;
}

export const RESILIENCE_TIERS = ["RESILIENT", "DEGRADED", "PARTITIONED", "FAILED-CLOSED"] as const;
export type ResilienceTier = (typeof RESILIENCE_TIERS)[number];

export interface ResilienceScore {
  readonly tier: ResilienceTier;
  readonly score: number; // 0..100
  readonly votingNodes: number;
  readonly nonVotingNodes: number;
  readonly partitionedNodes: number;
  readonly replayLineageCarriers: number;
  readonly meetsQuorum: boolean;
  readonly meetsReplayQuorum: boolean;
  readonly partialTrustExplicit: boolean;
}

export function scoreDistributedResilience(
  observations: readonly NodeObservation[],
  config: QuorumConfig,
): ResilienceScore {
  let voting = 0;
  let nonVoting = 0;
  let partitioned = 0;
  let lineage = 0;
  for (const o of observations) {
    if (o.health === "HEALTHY" || o.health === "DEGRADED") voting += 1;
    else if (o.health === "UNKNOWN") nonVoting += 1;
    else if (o.health === "PARTITIONED") partitioned += 1;
    if (o.carriesReplayLineage) lineage += 1;
  }
  const meetsQuorum = voting >= config.quorumThreshold;
  const meetsReplayQuorum = lineage >= config.replayLineageMin;

  let score = 100;
  if (config.totalNodes > 0) {
    const partitionFraction = partitioned / config.totalNodes;
    score -= Math.round(partitionFraction * 50);
    const unknownFraction = nonVoting / config.totalNodes;
    score -= Math.round(unknownFraction * 30);
  }
  if (!meetsQuorum) score -= 30;
  if (!meetsReplayQuorum) score -= 25;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let tier: ResilienceTier;
  if (!meetsQuorum && !meetsReplayQuorum) tier = "FAILED-CLOSED";
  else if (partitioned > 0 && !meetsQuorum) tier = "PARTITIONED";
  else if (score < 70) tier = "DEGRADED";
  else tier = "RESILIENT";

  return Object.freeze({
    tier,
    score,
    votingNodes: voting,
    nonVotingNodes: nonVoting,
    partitionedNodes: partitioned,
    replayLineageCarriers: lineage,
    meetsQuorum,
    meetsReplayQuorum,
    partialTrustExplicit: nonVoting + partitioned > 0,
  });
}

export interface DistributedResilienceReport {
  readonly executedAt: string;
  readonly score: ResilienceScore;
  readonly findings: readonly (
    | { readonly tag: "quorum-not-met"; readonly voting: number; readonly required: number }
    | { readonly tag: "replay-quorum-not-met"; readonly lineage: number; readonly required: number }
    | { readonly tag: "majority-partitioned"; readonly partitionedFraction: number }
  )[];
  readonly hasCiGatingCondition: boolean;
}

export function buildDistributedResilienceReport(
  observations: readonly NodeObservation[],
  config: QuorumConfig,
  nowIso: string,
): DistributedResilienceReport {
  const score = scoreDistributedResilience(observations, config);
  const findings: DistributedResilienceReport["findings"][number][] = [];
  let gating = false;
  if (!score.meetsQuorum) {
    findings.push({ tag: "quorum-not-met", voting: score.votingNodes, required: config.quorumThreshold });
    gating = true;
  }
  if (!score.meetsReplayQuorum) {
    findings.push({ tag: "replay-quorum-not-met", lineage: score.replayLineageCarriers, required: config.replayLineageMin });
    gating = true;
  }
  if (config.totalNodes > 0 && score.partitionedNodes / config.totalNodes > 0.5) {
    findings.push({ tag: "majority-partitioned", partitionedFraction: score.partitionedNodes / config.totalNodes });
    gating = true;
  }
  return Object.freeze({
    executedAt: nowIso,
    score,
    findings: Object.freeze(findings),
    hasCiGatingCondition: gating,
  });
}
