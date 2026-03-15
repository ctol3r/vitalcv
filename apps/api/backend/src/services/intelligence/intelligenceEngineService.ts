import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { sha256Hex } from '../../utils/deterministic';
import { SOURCE_CATALOG } from '../identity/sourceCatalog';
import { edgeLayer, nodeLayer, type EdgeType, type GraphLayer, type NodeType } from '../graph-engine/schema';
import {
  createIntelligenceEngine,
  type IntelligencePersistenceAdapter,
  type SuggestionOutcomeInput,
} from '../../../../../../core/intelligence/intelligenceEngine';
import type { AnomalyMemorySnapshot, AnomalyObservation } from '../../../../../../core/intelligence/anomalyMemory';
import type { GraphInsightRecord, IntelligenceGraphEdge, IntelligenceGraphNode } from '../../../../../../core/intelligence/graphInsights';
import type { LearningEventInput, LearningEventRecord } from '../../../../../../core/intelligence/learningMemory';
import type { SourceReliabilityComputation, SourceReliabilityEvidence } from '../../../../../../core/intelligence/sourceReliability';
import type { TrustEvolutionRecord } from '../../../../../../core/intelligence/trustEvolution';

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function mapSeverity(value: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (value === 'CRITICAL' || value === 'HIGH' || value === 'LOW') {
    return value;
  }

  return 'MEDIUM';
}

function graphModeMatches(mode: string | null | undefined, layer: GraphLayer): boolean {
  if (!mode || mode === 'blended') {
    return true;
  }

  return mode === layer;
}

function buildSourceReliabilityEvidence(
  sourceId: string,
  params: {
    contradictionCount: number;
    artifactRows: Array<{ verifiedAt: Date }>;
    sourceRunRows: Array<{ status: string }>;
    learningEvents: Array<{ eventType: string }>;
  },
): SourceReliabilityEvidence {
  const sourceDefinition = SOURCE_CATALOG[sourceId];
  const slaHours = sourceDefinition?.refreshSlaHours ?? 168;
  let freshRecordCount = 0;
  let agingRecordCount = 0;
  let staleRecordCount = 0;

  for (const artifact of params.artifactRows) {
    const ageHours = (Date.now() - artifact.verifiedAt.getTime()) / 3_600_000;
    if (ageHours <= slaHours) {
      freshRecordCount += 1;
    } else if (ageHours <= (slaHours * 2)) {
      agingRecordCount += 1;
    } else {
      staleRecordCount += 1;
    }
  }

  let successfulRuns = 0;
  let partialRuns = 0;
  let failedRuns = 0;
  for (const row of params.sourceRunRows) {
    if (['FETCHED', 'PARSED', 'NORMALIZED', 'VERIFIED', 'ALERTED'].includes(row.status)) {
      successfulRuns += 1;
    } else if (['QUEUED', 'FETCHING'].includes(row.status)) {
      partialRuns += 1;
    } else {
      failedRuns += 1;
    }
  }

  let accurateOutcomes = 0;
  let inaccurateOutcomes = 0;
  for (const event of params.learningEvents) {
    if ([
      'SOURCE_VERIFICATION_CONFIRMED',
      'ALERT_TRUE_POSITIVE',
      'SOURCE_INGESTION_SUCCEEDED',
      'ANOMALY_REJECTED',
    ].includes(event.eventType)) {
      accurateOutcomes += 1;
    } else if ([
      'USER_CORRECTION',
      'ANOMALY_CONFIRMED',
      'ALERT_FALSE_POSITIVE',
      'SOURCE_INGESTION_FAILED',
    ].includes(event.eventType)) {
      inaccurateOutcomes += 1;
    }
  }

  return {
    sourceId,
    contradictionCount: params.contradictionCount,
    totalObservations: Math.max(params.artifactRows.length + params.sourceRunRows.length, 1),
    freshRecordCount,
    agingRecordCount,
    staleRecordCount,
    successfulRuns,
    partialRuns,
    failedRuns,
    accurateOutcomes,
    inaccurateOutcomes,
  };
}

function mapAnomalySnapshot(row: {
  anomalyKey: string;
  anomalyType: string;
  subjectType: string;
  subjectId: string;
  sourceIds: string[];
  severity: string;
  status: string;
  confidence: number;
  occurrenceCount: number;
  confirmationCount: number;
  rejectionCount: number;
  lastFingerprint: string;
  firstDetectedAt: Date;
  lastDetectedAt: Date;
  resolvedAt: Date | null;
  metadata: Prisma.JsonValue;
}): AnomalyMemorySnapshot {
  return {
    anomalyKey: row.anomalyKey,
    anomalyType: row.anomalyType,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    sourceIds: [...row.sourceIds],
    severity: mapSeverity(row.severity),
    status: row.status as AnomalyMemorySnapshot['status'],
    confidence: row.confidence,
    occurrenceCount: row.occurrenceCount,
    confirmationCount: row.confirmationCount,
    rejectionCount: row.rejectionCount,
    lastFingerprint: row.lastFingerprint,
    firstDetectedAt: row.firstDetectedAt.toISOString(),
    lastDetectedAt: row.lastDetectedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };
}

function mapTrustEvolution(row: {
  subjectType: string;
  subjectId: string;
  previousScore: number | null;
  newScore: number;
  scoreDelta: number;
  triggerEvent: string;
  confidence: number | null;
  band: string | null;
  methodologyVersion: string | null;
  metadata: Prisma.JsonValue;
  recordedAt: Date;
}): TrustEvolutionRecord {
  return {
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    previousScore: row.previousScore,
    newScore: row.newScore,
    scoreDelta: row.scoreDelta,
    triggerEvent: row.triggerEvent,
    confidence: row.confidence,
    band: row.band,
    methodologyVersion: row.methodologyVersion,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    recordedAt: row.recordedAt.toISOString(),
  };
}

async function loadGraphData(
  prismaClient: PrismaClient,
  input: {
    nodeId?: string | null;
    graphMode?: string | null;
  },
): Promise<{
  nodes: IntelligenceGraphNode[];
  edges: IntelligenceGraphEdge[];
}> {
  const [nodeRows, edgeRows] = await Promise.all([
    prismaClient.graphNode.findMany({
      where: { active: true },
      orderBy: [{ degree: 'desc' }, { id: 'asc' }],
    }),
    prismaClient.graphEdge.findMany({
      where: { status: { in: ['ACTIVE', 'PENDING'] } },
      orderBy: [{ confidence: 'desc' }, { id: 'asc' }],
    }),
  ]);

  let nodes = nodeRows
    .map((row) => ({
      id: row.id,
      type: row.type,
      label: row.label,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      tags: [...row.tags],
    }))
    .filter((node) => graphModeMatches(input.graphMode, nodeLayer(node.type as NodeType)));

  let edges = edgeRows
    .map((row) => ({
      source: row.sourceNodeId,
      target: row.targetNodeId,
      type: row.edgeType,
      confidence: row.confidence,
      metadata: (row.provenance ?? {}) as Record<string, unknown>,
    }))
    .filter((edge) => graphModeMatches(input.graphMode, edgeLayer(edge.type as EdgeType)));

  if (input.nodeId) {
    const adjacency = new Map<string, Set<string>>();
    for (const edge of edges) {
      const sourceNeighbors = adjacency.get(edge.source) ?? new Set<string>();
      sourceNeighbors.add(edge.target);
      adjacency.set(edge.source, sourceNeighbors);
      const targetNeighbors = adjacency.get(edge.target) ?? new Set<string>();
      targetNeighbors.add(edge.source);
      adjacency.set(edge.target, targetNeighbors);
    }

    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: input.nodeId, depth: 0 }];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current.nodeId)) {
        continue;
      }

      visited.add(current.nodeId);
      if (current.depth >= 2) {
        continue;
      }

      for (const neighbor of adjacency.get(current.nodeId) ?? []) {
        if (!visited.has(neighbor)) {
          queue.push({ nodeId: neighbor, depth: current.depth + 1 });
        }
      }
    }

    nodes = nodes.filter((node) => visited.has(node.id));
    const nodeIds = new Set(nodes.map((node) => node.id));
    edges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  }

  return { nodes, edges };
}

function buildAdapter(prismaClient: PrismaClient): IntelligencePersistenceAdapter {
  return {
    async persistLearningEvent(event) {
      const row = await prismaClient.learningEvent.upsert({
        where: { dedupeKey: event.dedupeKey },
        update: {
          status: event.status,
          confidence: event.confidence,
          scoreDelta: event.scoreDelta,
          signalStrength: event.signalStrength,
          metadata: toJsonValue(event.metadata),
          occurredAt: new Date(event.occurredAt),
        },
        create: {
          dedupeKey: event.dedupeKey,
          eventType: event.eventType,
          loopType: event.loopType,
          subjectType: event.subjectType,
          subjectId: event.subjectId,
          sourceId: event.sourceId,
          relatedId: event.relatedId,
          status: event.status,
          confidence: event.confidence,
          scoreDelta: event.scoreDelta,
          signalStrength: event.signalStrength,
          metadata: toJsonValue(event.metadata),
          occurredAt: new Date(event.occurredAt),
        },
      });

      return {
        ...event,
        occurredAt: row.occurredAt.toISOString(),
      };
    },

    async loadSourceReliabilityEvidence(sourceId) {
      const [anomalies, artifactRows, sourceRunRows, learningEvents] = await Promise.all([
        prismaClient.anomalyHistory.findMany({
          where: {
            sourceIds: { has: sourceId },
            status: { not: 'REJECTED' },
          },
          select: {
            occurrenceCount: true,
            confirmationCount: true,
          },
        }),
        prismaClient.verificationArtifact.findMany({
          where: { source: sourceId },
          select: { verifiedAt: true },
        }),
        prismaClient.sourceRun.findMany({
          where: { sourceId },
          select: { status: true },
        }),
        prismaClient.learningEvent.findMany({
          where: { sourceId },
          select: { eventType: true },
        }),
      ]);

      const contradictionCount = anomalies.reduce(
        (sum, row) => sum + Math.max(row.confirmationCount, row.occurrenceCount > 0 ? 1 : 0),
        0,
      );

      return buildSourceReliabilityEvidence(sourceId, {
        contradictionCount,
        artifactRows,
        sourceRunRows: sourceRunRows.map((row) => ({ status: row.status })),
        learningEvents,
      });
    },

    async upsertSourceReliability(computation) {
      await prismaClient.sourceReliabilityScore.upsert({
        where: { sourceId: computation.sourceId },
        update: {
          contradictionFrequency: computation.contradictionFrequency,
          freshnessConsistency: computation.freshnessConsistency,
          coverageReliability: computation.coverageReliability,
          verificationAccuracy: computation.verificationAccuracy,
          sourceReliabilityScore: computation.sourceReliabilityScore,
          evidenceCount: computation.evidenceCount,
          explanation: computation.explanation,
          metadata: toJsonValue({ components: computation.components }),
          lastComputedAt: new Date(),
        },
        create: {
          sourceId: computation.sourceId,
          contradictionFrequency: computation.contradictionFrequency,
          freshnessConsistency: computation.freshnessConsistency,
          coverageReliability: computation.coverageReliability,
          verificationAccuracy: computation.verificationAccuracy,
          sourceReliabilityScore: computation.sourceReliabilityScore,
          evidenceCount: computation.evidenceCount,
          explanation: computation.explanation,
          metadata: toJsonValue({ components: computation.components }),
        },
      });

      return computation;
    },

    async loadAnomalyMemory(anomalyKey) {
      const row = await prismaClient.anomalyHistory.findUnique({
        where: { anomalyKey },
      });

      return row ? mapAnomalySnapshot(row) : null;
    },

    async upsertAnomalyMemory(snapshot) {
      const row = await prismaClient.anomalyHistory.upsert({
        where: { anomalyKey: snapshot.anomalyKey },
        update: {
          anomalyType: snapshot.anomalyType,
          subjectType: snapshot.subjectType,
          subjectId: snapshot.subjectId,
          sourceIds: [...snapshot.sourceIds],
          severity: snapshot.severity,
          status: snapshot.status,
          confidence: snapshot.confidence,
          occurrenceCount: snapshot.occurrenceCount,
          confirmationCount: snapshot.confirmationCount,
          rejectionCount: snapshot.rejectionCount,
          lastFingerprint: snapshot.lastFingerprint,
          firstDetectedAt: new Date(snapshot.firstDetectedAt),
          lastDetectedAt: new Date(snapshot.lastDetectedAt),
          resolvedAt: snapshot.resolvedAt ? new Date(snapshot.resolvedAt) : null,
          metadata: toJsonValue(snapshot.metadata),
        },
        create: {
          anomalyKey: snapshot.anomalyKey,
          anomalyType: snapshot.anomalyType,
          subjectType: snapshot.subjectType,
          subjectId: snapshot.subjectId,
          sourceIds: [...snapshot.sourceIds],
          severity: snapshot.severity,
          status: snapshot.status,
          confidence: snapshot.confidence,
          occurrenceCount: snapshot.occurrenceCount,
          confirmationCount: snapshot.confirmationCount,
          rejectionCount: snapshot.rejectionCount,
          lastFingerprint: snapshot.lastFingerprint,
          firstDetectedAt: new Date(snapshot.firstDetectedAt),
          lastDetectedAt: new Date(snapshot.lastDetectedAt),
          resolvedAt: snapshot.resolvedAt ? new Date(snapshot.resolvedAt) : null,
          metadata: toJsonValue(snapshot.metadata),
        },
      });

      return mapAnomalySnapshot(row);
    },

    async persistSuggestionOutcome(outcome) {
      const row = await prismaClient.suggestionOutcome.create({
        data: {
          suggestionType: outcome.suggestionType,
          suggestionKey: outcome.suggestionKey,
          subjectType: outcome.subjectType,
          subjectId: outcome.subjectId,
          accepted: outcome.accepted,
          confidence: outcome.confidence,
          feedbackSource: outcome.feedbackSource,
          graphSuggestionId: outcome.graphSuggestionId,
          sourceNodeId: outcome.sourceNodeId,
          targetNodeId: outcome.targetNodeId,
          outcomeScore: outcome.outcomeScore,
          rationale: outcome.rationale,
          metadata: toJsonValue(outcome.metadata),
          createdAt: new Date(outcome.createdAt),
        },
      });

      return {
        ...outcome,
        createdAt: row.createdAt.toISOString(),
      };
    },

    async loadLatestTrustEvolution(subjectType, subjectId) {
      const row = await prismaClient.trustScoreHistory.findFirst({
        where: {
          subjectType,
          subjectId,
        },
        orderBy: { recordedAt: 'desc' },
      });

      return row ? mapTrustEvolution(row) : null;
    },

    async persistTrustEvolution(record) {
      const row = await prismaClient.trustScoreHistory.create({
        data: {
          subjectType: record.subjectType,
          subjectId: record.subjectId,
          previousScore: record.previousScore,
          newScore: record.newScore,
          scoreDelta: record.scoreDelta,
          triggerEvent: record.triggerEvent,
          confidence: record.confidence,
          band: record.band,
          methodologyVersion: record.methodologyVersion,
          metadata: toJsonValue(record.metadata),
          recordedAt: new Date(record.recordedAt),
        },
      });

      return mapTrustEvolution(row);
    },

    async loadGraphData(input) {
      return loadGraphData(prismaClient, input);
    },

    async replaceGraphInsights(input) {
      if (input.nodeIds && input.nodeIds.length > 0) {
        await prismaClient.graphInsight.deleteMany({
          where: {
            nodeId: { in: input.nodeIds },
          },
        });
      } else {
        await prismaClient.graphInsight.deleteMany({});
      }

      if (input.insights.length === 0) {
        return [];
      }

      await prismaClient.graphInsight.createMany({
        data: input.insights.map((insight) => ({
          nodeId: insight.nodeId,
          insightType: insight.insightType,
          confidence: insight.confidence,
          explanation: insight.explanation,
          insightScore: insight.insightScore,
          relatedNodeIds: insight.relatedNodeIds,
          metadata: toJsonValue(insight.metadata),
          timestamp: new Date(insight.timestamp),
        })),
      });

      return input.insights;
    },
  };
}

function intelligenceEngine(prismaClient: PrismaClient = prisma) {
  return createIntelligenceEngine(buildAdapter(prismaClient));
}

export async function recordLearningSignal(
  input: LearningEventInput,
  prismaClient: PrismaClient = prisma,
): Promise<LearningEventRecord> {
  return intelligenceEngine(prismaClient).recordLearningSignal(input);
}

export async function recordSourceIngestionFeedback(
  input: {
    sourceId: string;
    subjectType: string;
    subjectId: string;
    status: 'SUCCEEDED' | 'FAILED' | 'PARTIAL';
    confidence?: number | null;
    metadata?: Record<string, unknown>;
    occurredAt?: Date | string;
  },
  prismaClient: PrismaClient = prisma,
) {
  return intelligenceEngine(prismaClient).recordSourceIngestionFeedback(input);
}

export async function recordAlertOutcome(
  input: {
    sourceId?: string | null;
    subjectType: string;
    subjectId: string;
    outcome: 'TRUE_POSITIVE' | 'FALSE_POSITIVE' | 'ESCALATED' | 'DISMISSED';
    confidence?: number | null;
    metadata?: Record<string, unknown>;
    occurredAt?: Date | string;
  },
  prismaClient: PrismaClient = prisma,
) {
  return intelligenceEngine(prismaClient).recordAlertOutcome(input);
}

export async function recordSuggestionOutcome(
  input: SuggestionOutcomeInput,
  prismaClient: PrismaClient = prisma,
) {
  return intelligenceEngine(prismaClient).recordSuggestionOutcome(input);
}

export async function recordTrustScoreSnapshot(
  input: {
    subjectType: string;
    subjectId: string;
    newScore: number;
    triggerEvent: string;
    confidence?: number | null;
    band?: string | null;
    methodologyVersion?: string | null;
    metadata?: Record<string, unknown>;
    recordedAt?: Date | string;
  },
  prismaClient: PrismaClient = prisma,
): Promise<TrustEvolutionRecord | null> {
  const result = await intelligenceEngine(prismaClient).recordTrustEvolution({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    previousScore: null,
    newScore: input.newScore,
    triggerEvent: input.triggerEvent,
    confidence: input.confidence,
    band: input.band,
    methodologyVersion: input.methodologyVersion,
    metadata: input.metadata,
    recordedAt: input.recordedAt,
  });

  if (result) {
    await intelligenceEngine(prismaClient).recordLearningSignal({
      eventType: 'TRUST_SCORE_CHANGED',
      loopType: 'TRUST_EVOLUTION',
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      confidence: input.confidence ?? null,
      scoreDelta: result.scoreDelta,
      metadata: {
        band: input.band ?? null,
        methodologyVersion: input.methodologyVersion ?? null,
        ...(input.metadata ?? {}),
      },
      occurredAt: input.recordedAt,
    });
  }

  return result;
}

export async function recordFreshnessDecaySignals(
  input: {
    subjectType: string;
    subjectId: string;
    computedAt: string;
    dimensions: Array<{
      claimClass: string;
      status: string;
      ageHours: number;
      freshnessScore: number;
      sources: string[];
    }>;
  },
  prismaClient: PrismaClient = prisma,
): Promise<LearningEventRecord[]> {
  const events = await Promise.all(
    input.dimensions
      .filter((dimension) => ['AGING', 'STALE'].includes(dimension.status))
      .map((dimension) => intelligenceEngine(prismaClient).recordLearningSignal({
        eventType: 'VERIFICATION_FRESHNESS_DECAY',
        loopType: 'SOURCE_INGESTION',
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        sourceId: dimension.sources[0] ?? null,
        confidence: Math.max(0, Math.min(1, 1 - dimension.freshnessScore)),
        metadata: {
          claimClass: dimension.claimClass,
          status: dimension.status,
          ageHours: dimension.ageHours,
          sources: dimension.sources,
        },
        occurredAt: input.computedAt,
        dedupeKey: sha256Hex(
          `freshness:${input.subjectType}:${input.subjectId}:${dimension.claimClass}:${dimension.status}:${dimension.sources.join('|')}`,
        ),
      })),
  );

  const sourceIds = [...new Set(input.dimensions.flatMap((dimension) => dimension.sources))];
  await Promise.all(sourceIds.map((sourceId) => intelligenceEngine(prismaClient).recomputeSourceReliability(sourceId)));

  return events;
}

export async function syncDivergenceReport(
  input: {
    subjectType: string;
    subjectId: string;
    conflicts: Array<{
      id: string;
      claimType: string;
      severity: string;
      description: string;
      sources: string[];
      values: string[];
      detectedAt: string;
      resolution: string;
    }>;
  },
  prismaClient: PrismaClient = prisma,
) {
  const observations: AnomalyObservation[] = input.conflicts.map((conflict) => ({
    anomalyKey: conflict.id,
    anomalyType: conflict.claimType,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    sourceIds: conflict.sources,
    severity: mapSeverity(conflict.severity),
    confidence: conflict.severity === 'CRITICAL' ? 0.95 : conflict.severity === 'MODERATE' ? 0.8 : 0.65,
    fingerprint: sha256Hex(JSON.stringify({
      id: conflict.id,
      claimType: conflict.claimType,
      sources: conflict.sources,
      values: conflict.values,
      resolution: conflict.resolution,
    })),
    outcome: conflict.resolution === 'RESOLVED' ? 'RESOLVED' : 'CONFIRMED',
    detectedAt: conflict.detectedAt,
    metadata: {
      description: conflict.description,
      values: conflict.values,
    },
  }));

  return intelligenceEngine(prismaClient).recordDivergenceFeedback({ observations });
}

export async function rebuildGraphInsights(
  input: {
    nodeId?: string | null;
    graphMode?: string | null;
  },
  prismaClient: PrismaClient = prisma,
): Promise<GraphInsightRecord[]> {
  return intelligenceEngine(prismaClient).rebuildGraphInsights(input);
}

export async function getSourceReliabilityScore(
  sourceId: string,
  prismaClient: PrismaClient = prisma,
): Promise<SourceReliabilityComputation> {
  const existing = await prismaClient.sourceReliabilityScore.findUnique({
    where: { sourceId },
  });

  if (existing) {
    return {
      sourceId,
      contradictionFrequency: existing.contradictionFrequency,
      freshnessConsistency: existing.freshnessConsistency,
      coverageReliability: existing.coverageReliability,
      verificationAccuracy: existing.verificationAccuracy,
      sourceReliabilityScore: existing.sourceReliabilityScore,
      evidenceCount: existing.evidenceCount,
      explanation: existing.explanation ?? '',
      components: {
        contradictionScore: Math.max(0, 1 - existing.contradictionFrequency),
        freshnessScore: existing.freshnessConsistency,
        coverageScore: existing.coverageReliability,
        accuracyScore: existing.verificationAccuracy,
      },
    };
  }

  return intelligenceEngine(prismaClient).recomputeSourceReliability(sourceId);
}

export async function listAnomalyHistory(
  subjectType: string,
  subjectId: string,
  prismaClient: PrismaClient = prisma,
): Promise<AnomalyMemorySnapshot[]> {
  const rows = await prismaClient.anomalyHistory.findMany({
    where: {
      subjectType: subjectType.trim().toUpperCase(),
      subjectId,
    },
    orderBy: [
      { lastDetectedAt: 'desc' },
      { confidence: 'desc' },
    ],
  });

  return rows.map((row) => mapAnomalySnapshot(row));
}

export async function listTrustScoreHistory(
  subjectType: string,
  subjectId: string,
  prismaClient: PrismaClient = prisma,
): Promise<TrustEvolutionRecord[]> {
  const rows = await prismaClient.trustScoreHistory.findMany({
    where: {
      subjectType: subjectType.trim().toUpperCase(),
      subjectId,
    },
    orderBy: { recordedAt: 'desc' },
  });

  return rows.map((row) => mapTrustEvolution(row));
}

export async function listGraphInsights(
  nodeId: string,
  prismaClient: PrismaClient = prisma,
): Promise<GraphInsightRecord[]> {
  const rows = await prismaClient.graphInsight.findMany({
    where: { nodeId },
    orderBy: [
      { timestamp: 'desc' },
      { confidence: 'desc' },
    ],
  });

  return rows.map((row) => ({
    nodeId: row.nodeId,
    insightType: row.insightType as GraphInsightRecord['insightType'],
    confidence: row.confidence,
    explanation: row.explanation,
    relatedNodeIds: [...row.relatedNodeIds],
    insightScore: row.insightScore ?? row.confidence,
    timestamp: row.timestamp.toISOString(),
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  }));
}
