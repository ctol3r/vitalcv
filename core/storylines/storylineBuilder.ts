import type {
  StorylineCluster,
  StorylineEngineConfig,
  StorylineSnapshot,
} from './storylineEngine';
import { explainStoryline } from './storylineExplainer';
import { rankStoryline } from './storylineRanker';
import { advanceStorylineTimeline } from './storylineTimeline';

export function buildStorylineFromCluster(input: {
  cluster: StorylineCluster;
  existingStoryline?: StorylineSnapshot;
  now: string;
  config: StorylineEngineConfig;
}): StorylineSnapshot {
  const ranking = rankStoryline({
    cluster: input.cluster,
    existingStoryline: input.existingStoryline,
    now: input.now,
    config: input.config,
  });
  const explanation = explainStoryline({
    cluster: input.cluster,
    ranking,
    existingStoryline: input.existingStoryline,
    config: input.config,
  });
  const timeline = advanceStorylineTimeline({
    cluster: input.cluster,
    ranking,
    existingStoryline: input.existingStoryline,
    now: input.now,
    config: input.config,
  });

  return {
    storylineId: input.existingStoryline?.storylineId ?? `stl_${input.cluster.fingerprint}`,
    fingerprint: input.cluster.fingerprint,
    storylineType: input.cluster.storylineType,
    perspective: input.cluster.perspective,
    title: explanation.title,
    summary: explanation.summary,
    whyItMatters: explanation.whyItMatters,
    recommendedActions: explanation.recommendedActions,
    severity: ranking.severity,
    confidence: ranking.confidence,
    entityIds: input.cluster.entityIds,
    findingIds: input.cluster.findings.map((finding) => finding.findingId),
    supportingEvidence: explanation.supportingEvidence,
    createdAt: input.existingStoryline?.createdAt ?? input.cluster.firstObservedAt,
    updatedAt: timeline.lastEventAt,
    lastActivityAt: timeline.lastActivityAt,
    status: timeline.currentStatus,
    progressionScore: ranking.progressionScore,
    noveltyScore: ranking.noveltyScore,
    persistenceScore: ranking.persistenceScore,
    escalationThreshold: ranking.escalationThreshold,
    timeline,
    metadata: {
      clusterId: input.cluster.clusterId,
      dominantKeywords: input.cluster.dominantKeywords,
      recurrencePattern: input.cluster.recurrencePattern,
      featureScores: input.cluster.featureScores,
    },
  };
}
