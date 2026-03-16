import type { PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import type { InvestigatorFindingRecord } from '../../../../../../core/investigators/investigatorTypes';
import type {
  HardenedStorylineDetail,
  StorylineConsolePayload,
  StorylineEvidenceRef,
  StorylineLifecycleStage,
  StorylineMergeSuggestion,
  StorylineNarrativeVersion,
  StorylineScoreBreakdown,
  StorylineScoreHistoryPoint,
  StorylineSplitSuggestion,
  StorylineTimelineNode,
} from './contracts';
import {
  getStorylineDetail,
  listStorylines,
  type StorylineDetailContract,
  type StorylineWithPredictionSnapshot,
} from '../storylines/storylineService';

function clamp01(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function severityWeight(severity: string): number {
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

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4);
}

function hoursSince(timestamp: string, now: string): number {
  return Math.max(0, (Date.parse(now) - Date.parse(timestamp)) / (1000 * 60 * 60));
}

function sharedKeywordScore(left: StorylineWithPredictionSnapshot, right: StorylineWithPredictionSnapshot): number {
  const leftWords = new Set(normalizeWords(`${left.title} ${left.summary} ${left.whyItMatters}`));
  const rightWords = new Set(normalizeWords(`${right.title} ${right.summary} ${right.whyItMatters}`));
  if (leftWords.size === 0 || rightWords.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) {
      shared += 1;
    }
  }

  return clamp01(shared / Math.max(1, Math.min(leftWords.size, rightWords.size)));
}

function entityOverlapScore(left: StorylineWithPredictionSnapshot, right: StorylineWithPredictionSnapshot): number {
  const leftIds = new Set(left.entityIds);
  const rightIds = new Set(right.entityIds);
  if (leftIds.size === 0 || rightIds.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const entityId of leftIds) {
    if (rightIds.has(entityId)) {
      shared += 1;
    }
  }

  return clamp01(shared / Math.max(1, Math.min(leftIds.size, rightIds.size)));
}

function findingCountNormalized(count: number): number {
  return clamp01(count / 6);
}

function lifecycleStage(
  storyline: StorylineWithPredictionSnapshot,
  score: StorylineScoreBreakdown,
  findingCount: number,
): StorylineLifecycleStage {
  if (storyline.status === 'archived') {
    return 'archived';
  }
  if (storyline.status === 'resolved') {
    return 'resolved';
  }
  if (score.total >= 0.8 || findingCount >= 5 || storyline.persistenceScore >= 0.65) {
    return 'mature';
  }
  if (score.total >= 0.5 || findingCount >= 2 || storyline.progressionScore >= 0.55) {
    return 'developing';
  }
  return 'emerging';
}

function buildScore(
  storyline: StorylineWithPredictionSnapshot,
  findingRecords: InvestigatorFindingRecord[],
  now: string,
): StorylineScoreBreakdown {
  const maxFindingConfidence = findingRecords.length > 0
    ? Math.max(...findingRecords.map((finding) => finding.confidence))
    : storyline.supportingEvidence.length > 0
      ? Math.max(...storyline.supportingEvidence.map((evidence) => evidence.confidence))
      : storyline.confidence;
  const findingCount = storyline.findingIds.length;
  const investigatorDiversity = clamp01(unique(findingRecords.map((finding) => finding.investigatorId)).length / 4);
  const recency = clamp01(1 - (hoursSince(storyline.lastActivityAt, now) / (24 * 45)));
  const riskTierWeighting = severityWeight(storyline.severity);
  const total = clamp01(
    (maxFindingConfidence * 0.3)
      + (findingCountNormalized(findingCount) * 0.2)
      + (investigatorDiversity * 0.2)
      + (recency * 0.15)
      + (riskTierWeighting * 0.15),
  );

  return {
    maxFindingConfidence,
    findingCount,
    investigatorDiversity,
    recency,
    riskTierWeighting,
    total,
  };
}

function buildScoreHistory(
  storyline: StorylineWithPredictionSnapshot,
  detail: StorylineDetailContract,
  score: StorylineScoreBreakdown,
): StorylineScoreHistoryPoint[] {
  const points = detail.statusEvents.map((event, index) => {
    const weight = clamp01((index + 1) / Math.max(detail.statusEvents.length, 1));
    const eventScore = clamp01((score.total * 0.7) + (weight * 0.3));
    return {
      observedAt: event.occurredAt,
      score: eventScore,
      confidence: clamp01((storyline.confidence * 0.7) + (weight * 0.3)),
      label: event.summary,
    };
  });

  return points.length > 0
    ? points
    : [{
        observedAt: storyline.lastActivityAt,
        score: score.total,
        confidence: storyline.confidence,
        label: storyline.summary,
      }];
}

function buildEvidenceRefs(detail: StorylineDetailContract): StorylineEvidenceRef[] {
  return detail.storyline.supportingEvidence.map((evidence, index) => ({
    evidenceId: `${detail.storyline.storylineId}:evidence:${index}`,
    source: evidence.source,
    observedAt: evidence.observedAt,
    findingId: evidence.findingId,
    artifactId: evidence.artifactId,
    summary: evidence.bullet,
  }));
}

function buildTimelineNodes(detail: StorylineDetailContract): StorylineTimelineNode[] {
  const evidenceRefs = buildEvidenceRefs(detail);
  return detail.statusEvents.map((event) => ({
    nodeId: event.eventKey,
    eventType: event.type,
    label: event.summary,
    occurredAt: event.occurredAt,
    findingIds: [...event.findingIds],
    evidenceRefs: evidenceRefs
      .filter((ref) => !ref.findingId || event.findingIds.includes(ref.findingId))
      .map((ref) => ref.evidenceId),
  }));
}

function buildNarrativeVersions(
  storyline: StorylineWithPredictionSnapshot,
  detail: StorylineDetailContract,
): StorylineNarrativeVersion[] {
  const versions: StorylineNarrativeVersion[] = [
    {
      versionId: `${storyline.storylineId}:origin`,
      createdAt: storyline.createdAt,
      label: 'origin',
      narrative: `${storyline.title}. ${storyline.summary}`,
    },
    {
      versionId: `${storyline.storylineId}:current`,
      createdAt: storyline.updatedAt,
      label: 'current',
      narrative: `${storyline.title}. ${storyline.summary} ${storyline.whyItMatters}`.trim(),
    },
  ];

  const latestAction = detail.actionEvents[0];
  if (latestAction) {
    versions.push({
      versionId: `${storyline.storylineId}:action:${latestAction.eventKey}`,
      createdAt: latestAction.occurredAt,
      label: latestAction.actionType,
      narrative: latestAction.note
        ? `${storyline.title}. Analyst note: ${latestAction.note}`
        : `${storyline.title}. Analyst action recorded: ${latestAction.actionType}.`,
    });
  }

  return versions;
}

function buildSplitSuggestions(
  detail: StorylineDetailContract,
  findingRecords: InvestigatorFindingRecord[],
): StorylineSplitSuggestion[] {
  const groups = new Map<string, { label: string; findingIds: string[] }>();

  for (const finding of findingRecords) {
    const key = `${finding.investigatorId}:${finding.findingType}`;
    const existing = groups.get(key) ?? {
      label: `${finding.investigatorId} / ${finding.findingType}`,
      findingIds: [],
    };
    existing.findingIds.push(finding.findingId);
    groups.set(key, existing);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.findingIds.length > 1 && groups.size > 1)
    .map(([key, group]) => ({
      key,
      label: group.label,
      findingIds: group.findingIds,
      rationale: `${group.findingIds.length} findings cluster around a distinct investigator/finding-type axis inside this storyline.`,
    }));
}

function buildMergeSuggestions(
  storyline: StorylineWithPredictionSnapshot,
  candidates: StorylineWithPredictionSnapshot[],
): StorylineMergeSuggestion[] {
  return candidates
    .filter((candidate) => candidate.storylineId !== storyline.storylineId)
    .map((candidate) => {
      const similarityScore = clamp01(
        (entityOverlapScore(storyline, candidate) * 0.65)
          + (sharedKeywordScore(storyline, candidate) * 0.35),
      );
      return {
        storylineId: candidate.storylineId,
        title: candidate.title,
        similarityScore,
        reason: `Shared entity overlap and narrative vocabulary suggest these storylines may describe the same investigative arc.`,
      };
    })
    .filter((candidate) => candidate.similarityScore >= 0.45)
    .sort((left, right) => right.similarityScore - left.similarityScore)
    .slice(0, 3);
}

async function loadFindingRecords(
  prismaClient: PrismaClient,
  findingIds: string[],
): Promise<InvestigatorFindingRecord[]> {
  if (findingIds.length === 0) {
    return [];
  }

  const rows = await prismaClient.investigatorFinding.findMany({
    where: { findingId: { in: findingIds } },
    include: {
      entityLinks: true,
      evidenceLinks: true,
    },
  });

  return rows.map((row) => ({
    findingId: row.findingId,
    investigatorId: row.investigatorId,
    findingType: row.findingType,
    scope: row.scope as InvestigatorFindingRecord['scope'],
    severity: row.severity as InvestigatorFindingRecord['severity'],
    title: row.title,
    summary: row.summary,
    entityIds: [...row.entityIds],
    entities: row.entityLinks.map((entity) => ({
      entityType: entity.entityType,
      entityId: entity.entityId,
      entityLabel: entity.entityLabel,
      relationship: entity.relationship,
      metadata: entity.metadata as Record<string, unknown>,
    })),
    supportingEvidence: row.evidenceLinks.map((evidence) => ({
      evidenceId: evidence.evidenceId,
      evidenceType: evidence.evidenceType,
      sourceId: evidence.sourceId,
      sourceLabel: evidence.sourceLabel,
      recordType: evidence.recordType,
      recordId: evidence.recordId,
      url: evidence.url,
      snippet: evidence.snippet,
      observedAt: evidence.observedAt?.toISOString() ?? null,
      metadata: evidence.metadata as Record<string, unknown>,
    })),
    confidence: row.confidence,
    explanation: row.explanation,
    status: row.status as InvestigatorFindingRecord['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    occurrenceCount: row.occurrenceCount,
    priorityScore: row.priorityScore,
    scoreSignals: {
      confidence: row.confidence,
      trustImpact: row.trustImpact,
      freshness: row.freshness,
      novelty: row.novelty,
      entityImportance: row.entityImportance,
      graphCentrality: row.graphCentrality,
    },
    rankBreakdown: {
      severity: 0,
      confidence: 0,
      trustImpact: 0,
      freshness: 0,
      novelty: 0,
      entityImportance: 0,
      graphCentrality: 0,
      total: 0,
      weights: {
        severity: 0,
        confidence: 0,
        trustImpact: 0,
        freshness: 0,
        novelty: 0,
        entityImportance: 0,
        graphCentrality: 0,
      },
    },
    audienceRoles: [...row.audienceRoles] as InvestigatorFindingRecord['audienceRoles'],
    metadata: row.metadata as Record<string, unknown>,
    dedupeKey: row.dedupeKey,
    storylineKey: row.storylineKey,
  }));
}

export async function getHardenedStorylineDetail(
  storylineId: string,
  prismaClient: PrismaClient = prisma,
): Promise<HardenedStorylineDetail | null> {
  const [detail, siblingStorylines] = await Promise.all([
    getStorylineDetail(storylineId, { sync: false }),
    listStorylines({ limit: 120, sync: false }),
  ]);

  if (!detail) {
    return null;
  }

  const findingRecords = await loadFindingRecords(prismaClient, detail.storyline.findingIds);
  const now = new Date().toISOString();
  const score = buildScore(detail.storyline, findingRecords, now);
  const lifecycle = lifecycleStage(detail.storyline, score, findingRecords.length);

  return {
    storyline: detail.storyline,
    lifecycleStage: lifecycle,
    score,
    scoreHistory: buildScoreHistory(detail.storyline, detail, score),
    mergeSuggestions: buildMergeSuggestions(detail.storyline, siblingStorylines.storylines),
    splitSuggestions: buildSplitSuggestions(detail, findingRecords),
    timelineNodes: buildTimelineNodes(detail),
    evidenceRefs: buildEvidenceRefs(detail),
    linkedEntities: detail.entityLinks,
    narrativeVersions: buildNarrativeVersions(detail.storyline, detail),
    analystAnnotations: detail.actionEvents.map((event) => ({
      annotationId: event.eventKey,
      actorId: event.actorId,
      note: event.note,
      occurredAt: event.occurredAt,
      actionType: event.actionType,
    })),
    findingLinks: detail.findingLinks,
    statusEvents: detail.statusEvents,
    actionEvents: detail.actionEvents,
  };
}

export async function buildStorylineConsolePayload(
  storylineId: string,
  prismaClient: PrismaClient = prisma,
): Promise<StorylineConsolePayload | null> {
  const hardened = await getHardenedStorylineDetail(storylineId, prismaClient);
  if (!hardened) {
    return null;
  }

  const linkedProviders = unique(
    hardened.linkedEntities
      .filter((entity) => entity.entityType === 'provider')
      .map((entity) => entity.entityKey),
  );

  return {
    generatedAt: new Date().toISOString(),
    storylineId: hardened.storyline.storylineId,
    headline: hardened.storyline.title,
    summary: hardened.storyline.summary,
    severityScore: hardened.score.total,
    lifecycleStage: hardened.lifecycleStage,
    timelineNodes: hardened.timelineNodes,
    linkedProviders,
    narrativeText: hardened.narrativeVersions[hardened.narrativeVersions.length - 1]?.narrative
      ?? hardened.storyline.summary,
    lastUpdated: hardened.storyline.updatedAt,
    mergeSuggestions: hardened.mergeSuggestions,
    splitSuggestions: hardened.splitSuggestions,
    score: hardened.score,
  };
}
