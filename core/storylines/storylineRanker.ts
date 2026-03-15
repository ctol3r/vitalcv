import type {
  StorylineCluster,
  StorylineEngineConfig,
  StorylineSeverity,
  StorylineSnapshot,
} from './storylineEngine';
import {
  type StorylineGraphSignal,
  weightStorylineSeverity,
} from '../graph/intelligence';

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function severityToValue(severity: StorylineSeverity): number {
  switch (severity) {
    case 'critical':
      return 1;
    case 'high':
      return 0.8;
    case 'medium':
      return 0.6;
    case 'low':
      return 0.35;
    case 'info':
    default:
      return 0.15;
  }
}

function valueToSeverity(value: number): StorylineSeverity {
  if (value >= 0.92) {
    return 'critical';
  }
  if (value >= 0.75) {
    return 'high';
  }
  if (value >= 0.5) {
    return 'medium';
  }
  if (value >= 0.25) {
    return 'low';
  }
  return 'info';
}

function hoursSince(timestamp: string, now: string): number {
  return Math.max(0, (Date.parse(now) - Date.parse(timestamp)) / (1000 * 60 * 60));
}

function averageEvidenceConfidence(cluster: StorylineCluster): number {
  const evidence = cluster.findings.flatMap((finding) => finding.evidence.map((item) => item.confidence));
  if (evidence.length === 0) {
    return 0.55;
  }
  return evidence.reduce((sum, value) => sum + value, 0) / evidence.length;
}

function readGraphSignal(cluster: StorylineCluster): StorylineGraphSignal | null {
  const candidate = cluster.metadata?.graphSignal;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const signal = candidate as Record<string, unknown>;
  return {
    influencePercentile: typeof signal.influencePercentile === 'number' ? clamp(signal.influencePercentile) : 0,
    bridgePercentile: typeof signal.bridgePercentile === 'number' ? clamp(signal.bridgePercentile) : 0,
    articulationPoint: signal.articulationPoint === true,
    centralityShift: typeof signal.centralityShift === 'number' ? clamp(signal.centralityShift) : 0,
    communityShift: typeof signal.communityShift === 'number' ? clamp(signal.communityShift) : 0,
  };
}

export interface StorylineRanking {
  severity: StorylineSeverity;
  confidence: number;
  progressionScore: number;
  noveltyScore: number;
  persistenceScore: number;
  escalationThreshold: number;
  shouldEscalate: boolean;
}

export function rankStoryline(input: {
  cluster: StorylineCluster;
  existingStoryline?: StorylineSnapshot;
  now: string;
  config: StorylineEngineConfig;
}): StorylineRanking {
  const { cluster, existingStoryline, now, config } = input;
  const severityBase = Math.max(...cluster.findings.map((finding) => severityToValue(finding.severity)));
  const evidenceConfidence = averageEvidenceConfidence(cluster);
  const firstObservedMs = Date.parse(cluster.firstObservedAt);
  const lastObservedMs = Date.parse(cluster.lastObservedAt);
  const spanDays = Math.max(0, (lastObservedMs - firstObservedMs) / (1000 * 60 * 60 * 24));
  const recencyScore = clamp(1 - hoursSince(cluster.lastObservedAt, now) / config.resolveThresholdHours);
  const persistenceScore = clamp(
    (spanDays / config.persistenceWindowDays) * 0.35
      + cluster.featureScores.recurrence * 0.35
      + cluster.featureScores.cohesion * 0.3,
  );
  const existingFindingIds = new Set(existingStoryline?.findingIds ?? []);
  const newFindingCount = cluster.findings.filter((finding) => !existingFindingIds.has(finding.findingId)).length;
  const noveltyScore = clamp(
    (!existingStoryline ? 0.92 : 0.28)
      + (cluster.findings.length > 0 ? newFindingCount / cluster.findings.length : 0) * 0.45
      + cluster.featureScores.typeAffinity * 0.15
      - (existingStoryline ? 0.15 : 0),
  );
  const confidence = clamp(
    evidenceConfidence * 0.52
      + cluster.featureScores.cohesion * 0.18
      + cluster.featureScores.entityOverlap * 0.12
      + cluster.featureScores.graphProximity * 0.1
      + cluster.featureScores.recurrence * 0.08,
  );
  const baseSeverityScore = clamp(
    severityBase * 0.68
      + confidence * 0.12
      + persistenceScore * 0.12
      + cluster.featureScores.entityOverlap * 0.08,
  );
  const graphSignal = readGraphSignal(cluster);
  const severityScore = graphSignal
    ? weightStorylineSeverity({
      baselineScore: baseSeverityScore,
      signal: graphSignal,
    }).adjustedScore
    : baseSeverityScore;
  const progressionScore = clamp(
    severityScore * 0.38
      + recencyScore * 0.24
      + persistenceScore * 0.22
      + noveltyScore * 0.16,
  );
  const escalationThreshold = clamp(
    0.82
      - severityScore * 0.16
      - persistenceScore * 0.12
      + (existingStoryline?.status === 'quiet' ? 0.04 : 0),
  );
  const shouldEscalate =
    (severityScore >= 0.9 && confidence >= 0.72)
    || (progressionScore >= escalationThreshold && severityScore >= 0.72);

  return {
    severity: valueToSeverity(shouldEscalate ? Math.max(severityScore, 0.9) : severityScore),
    confidence,
    progressionScore,
    noveltyScore,
    persistenceScore,
    escalationThreshold,
    shouldEscalate,
  };
}
