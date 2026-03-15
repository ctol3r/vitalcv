import { buildStorylineFromCluster } from './storylineBuilder';
import { clusterFindings } from './storylineClusterer';
import { carryForwardStoryline } from './storylineTimeline';

export type StorylineStatus = 'active' | 'quiet' | 'escalated' | 'resolved' | 'archived';

export type StorylineType =
  | 'trust decline'
  | 'rising investigator'
  | 'network emergence'
  | 'compliance risk'
  | 'workforce opportunity'
  | 'institution shift'
  | 'industry influence';

export type StorylinePerspective = 'provider' | 'institution' | 'network';

export type StorylineSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type StorylineTimelineEventType =
  | 'origin'
  | 'update'
  | 'quiet_period'
  | 'reactivated'
  | 'resolved'
  | 'escalated'
  | 'archived'
  | 'acknowledged'
  | 'investigation_saved';

export interface StorylineActionRecommendation {
  label: string;
  type: string;
  payload?: Record<string, unknown>;
}

export interface StorylineEvidenceInput {
  source: string;
  claim: string;
  confidence: number;
  timestamp: string;
  artifactId?: string;
}

export interface StorylineFindingInput {
  findingId: string;
  category: string;
  severity: StorylineSeverity;
  title: string;
  summary: string;
  explanation: string;
  entityIds: string[];
  providerIds: string[];
  institutionIds: string[];
  graphEntityIds: string[];
  relatedFindingIds: string[];
  evidence: StorylineEvidenceInput[];
  actions: StorylineActionRecommendation[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface StorylineEvidenceItem {
  bullet: string;
  source: string;
  confidence: number;
  observedAt: string;
  findingId?: string;
  artifactId?: string;
}

export interface StorylineTimelineEvent {
  eventKey: string;
  type: StorylineTimelineEventType;
  summary: string;
  occurredAt: string;
  findingIds: string[];
  fromStatus?: StorylineStatus;
  toStatus?: StorylineStatus;
  metadata: Record<string, unknown>;
}

export interface StorylineTimeline {
  originEvent: StorylineTimelineEvent;
  events: StorylineTimelineEvent[];
  quietPeriods: number;
  reactivations: number;
  lastEventAt: string;
  lastActivityAt: string;
  currentStatus: StorylineStatus;
}

export interface StorylineSnapshot {
  storylineId: string;
  fingerprint: string;
  storylineType: StorylineType;
  perspective: StorylinePerspective;
  title: string;
  summary: string;
  whyItMatters: string;
  recommendedActions: string[];
  severity: StorylineSeverity;
  confidence: number;
  entityIds: string[];
  findingIds: string[];
  supportingEvidence: StorylineEvidenceItem[];
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  status: StorylineStatus;
  progressionScore: number;
  noveltyScore: number;
  persistenceScore: number;
  escalationThreshold: number;
  timeline: StorylineTimeline;
  metadata: Record<string, unknown>;
}

export interface StorylineClusterFeatureScores {
  entityOverlap: number;
  temporalProximity: number;
  graphProximity: number;
  typeAffinity: number;
  recurrence: number;
  cohesion: number;
}

export interface StorylineCluster {
  clusterId: string;
  fingerprint: string;
  storylineType: StorylineType;
  perspective: StorylinePerspective;
  findings: StorylineFindingInput[];
  entityIds: string[];
  providerIds: string[];
  institutionIds: string[];
  firstObservedAt: string;
  lastObservedAt: string;
  recurrencePattern: 'isolated' | 'emerging' | 'recurring' | 'persistent';
  featureScores: StorylineClusterFeatureScores;
  dominantKeywords: string[];
  metadata: Record<string, unknown>;
}

export interface StorylineEngineConfig {
  clusterThreshold: number;
  temporalWindowHours: number;
  quietThresholdHours: number;
  resolveThresholdHours: number;
  archiveThresholdHours: number;
  persistenceWindowDays: number;
  maxEvidenceItems: number;
}

export interface BuildStorylinesInput {
  findings: StorylineFindingInput[];
  existingStorylines?: StorylineSnapshot[];
  now?: string;
}

export interface BuildStorylinesResult {
  storylines: StorylineSnapshot[];
  clusters: StorylineCluster[];
  generatedAt: string;
}

export const defaultStorylineEngineConfig: StorylineEngineConfig = {
  clusterThreshold: 0.58,
  temporalWindowHours: 24 * 21,
  quietThresholdHours: 24 * 7,
  resolveThresholdHours: 24 * 21,
  archiveThresholdHours: 24 * 45,
  persistenceWindowDays: 90,
  maxEvidenceItems: 6,
};

function severityWeight(severity: StorylineSeverity): number {
  switch (severity) {
    case 'critical':
      return 5;
    case 'high':
      return 4;
    case 'medium':
      return 3;
    case 'low':
      return 2;
    case 'info':
    default:
      return 1;
  }
}

function statusWeight(status: StorylineStatus): number {
  switch (status) {
    case 'escalated':
      return 5;
    case 'active':
      return 4;
    case 'quiet':
      return 3;
    case 'resolved':
      return 2;
    case 'archived':
    default:
      return 1;
  }
}

function compareStorylines(left: StorylineSnapshot, right: StorylineSnapshot): number {
  const severityDelta = severityWeight(right.severity) - severityWeight(left.severity);
  if (severityDelta !== 0) {
    return severityDelta;
  }

  const statusDelta = statusWeight(right.status) - statusWeight(left.status);
  if (statusDelta !== 0) {
    return statusDelta;
  }

  const progressionDelta = right.progressionScore - left.progressionScore;
  if (progressionDelta !== 0) {
    return progressionDelta;
  }

  return Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt);
}

export function createStorylineEngine(
  overrides: Partial<StorylineEngineConfig> = {},
): {
  buildStorylines(input: BuildStorylinesInput): BuildStorylinesResult;
} {
  const config: StorylineEngineConfig = {
    ...defaultStorylineEngineConfig,
    ...overrides,
  };

  return {
    buildStorylines(input: BuildStorylinesInput): BuildStorylinesResult {
      const generatedAt = input.now ?? new Date().toISOString();
      const existingStorylines = input.existingStorylines ?? [];
      const activeFindings = [...input.findings].sort(
        (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
      );
      const clusters = clusterFindings({
        findings: activeFindings,
        now: generatedAt,
        config,
      });
      const existingByFingerprint = new Map(
        existingStorylines.map((storyline) => [storyline.fingerprint, storyline] as const),
      );
      const matchedFingerprints = new Set<string>();
      const builtStorylines = clusters.map((cluster) => {
        matchedFingerprints.add(cluster.fingerprint);
        return buildStorylineFromCluster({
          cluster,
          now: generatedAt,
          config,
          existingStoryline: existingByFingerprint.get(cluster.fingerprint),
        });
      });
      const carriedStorylines = existingStorylines
        .filter((storyline) => !matchedFingerprints.has(storyline.fingerprint))
        .map((storyline) => carryForwardStoryline({
          storyline,
          now: generatedAt,
          config,
        }));
      const storylines = [...builtStorylines, ...carriedStorylines].sort(compareStorylines);

      return {
        storylines,
        clusters,
        generatedAt,
      };
    },
  };
}
