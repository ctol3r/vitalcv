import {
  buildLearningEvent,
  type LearningEventInput,
  type LearningEventRecord,
} from './learningMemory';
import {
  mergeAnomalyMemory,
  type AnomalyMemorySnapshot,
  type AnomalyObservation,
} from './anomalyMemory';
import {
  computeSourceReliability,
  type SourceReliabilityComputation,
  type SourceReliabilityEvidence,
} from './sourceReliability';
import {
  buildTrustEvolution,
  shouldPersistTrustEvolution,
  type TrustEvolutionInput,
  type TrustEvolutionRecord,
} from './trustEvolution';
import {
  deriveGraphInsights,
  type GraphInsightRecord,
  type IntelligenceGraphEdge,
  type IntelligenceGraphNode,
} from './graphInsights';

export interface SuggestionOutcomeInput {
  suggestionType: string;
  suggestionKey: string;
  subjectType: string;
  subjectId: string;
  accepted: boolean;
  confidence?: number | null;
  feedbackSource?: string | null;
  graphSuggestionId?: string | null;
  sourceNodeId?: string | null;
  targetNodeId?: string | null;
  outcomeScore?: number | null;
  rationale?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: Date | string;
}

export interface SuggestionOutcomeRecord extends SuggestionOutcomeInput {
  confidence: number | null;
  feedbackSource: string | null;
  graphSuggestionId: string | null;
  sourceNodeId: string | null;
  targetNodeId: string | null;
  outcomeScore: number | null;
  rationale: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface IntelligencePersistenceAdapter {
  persistLearningEvent(event: LearningEventRecord): Promise<LearningEventRecord>;
  loadSourceReliabilityEvidence(sourceId: string): Promise<SourceReliabilityEvidence>;
  upsertSourceReliability(
    computation: SourceReliabilityComputation,
  ): Promise<SourceReliabilityComputation>;
  loadAnomalyMemory(anomalyKey: string): Promise<AnomalyMemorySnapshot | null>;
  upsertAnomalyMemory(snapshot: AnomalyMemorySnapshot): Promise<AnomalyMemorySnapshot>;
  persistSuggestionOutcome(outcome: SuggestionOutcomeRecord): Promise<SuggestionOutcomeRecord>;
  loadLatestTrustEvolution(
    subjectType: string,
    subjectId: string,
  ): Promise<TrustEvolutionRecord | null>;
  persistTrustEvolution(record: TrustEvolutionRecord): Promise<TrustEvolutionRecord>;
  loadGraphData(input: {
    nodeId?: string | null;
    graphMode?: string | null;
  }): Promise<{
    nodes: IntelligenceGraphNode[];
    edges: IntelligenceGraphEdge[];
  }>;
  replaceGraphInsights(input: {
    nodeIds: string[] | null;
    insights: GraphInsightRecord[];
  }): Promise<GraphInsightRecord[]>;
}

function toIsoString(value: Date | string | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeSuggestionOutcome(input: SuggestionOutcomeInput): SuggestionOutcomeRecord {
  return {
    suggestionType: input.suggestionType.trim().toUpperCase(),
    suggestionKey: input.suggestionKey.trim(),
    subjectType: input.subjectType.trim().toUpperCase(),
    subjectId: input.subjectId.trim(),
    accepted: input.accepted,
    confidence: typeof input.confidence === 'number' ? Math.min(1, Math.max(0, input.confidence)) : null,
    feedbackSource: input.feedbackSource?.trim() ?? null,
    graphSuggestionId: input.graphSuggestionId?.trim() ?? null,
    sourceNodeId: input.sourceNodeId?.trim() ?? null,
    targetNodeId: input.targetNodeId?.trim() ?? null,
    outcomeScore: typeof input.outcomeScore === 'number' ? Math.round(input.outcomeScore * 10_000) / 10_000 : null,
    rationale: input.rationale?.trim() ?? null,
    metadata: input.metadata ?? {},
    createdAt: toIsoString(input.createdAt),
  };
}

export function createIntelligenceEngine(adapter: IntelligencePersistenceAdapter) {
  return {
    async recordLearningSignal(input: LearningEventInput): Promise<LearningEventRecord> {
      return adapter.persistLearningEvent(buildLearningEvent(input));
    },

    async recomputeSourceReliability(sourceId: string): Promise<SourceReliabilityComputation> {
      const evidence = await adapter.loadSourceReliabilityEvidence(sourceId);
      return adapter.upsertSourceReliability(computeSourceReliability(evidence));
    },

    async recordSourceIngestionFeedback(input: {
      sourceId: string;
      subjectType: string;
      subjectId: string;
      status: 'SUCCEEDED' | 'FAILED' | 'PARTIAL';
      confidence?: number | null;
      metadata?: Record<string, unknown>;
      occurredAt?: Date | string;
    }): Promise<{
      learningEvent: LearningEventRecord;
      sourceReliability: SourceReliabilityComputation;
    }> {
      const learningEvent = await adapter.persistLearningEvent(buildLearningEvent({
        eventType: input.status === 'SUCCEEDED'
          ? 'SOURCE_INGESTION_SUCCEEDED'
          : input.status === 'FAILED'
            ? 'SOURCE_INGESTION_FAILED'
            : 'SOURCE_INGESTION_PARTIAL',
        loopType: 'SOURCE_INGESTION',
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        sourceId: input.sourceId,
        confidence: input.confidence ?? null,
        metadata: input.metadata,
        occurredAt: input.occurredAt,
      }));
      const sourceReliability = await this.recomputeSourceReliability(input.sourceId);

      return {
        learningEvent,
        sourceReliability,
      };
    },

    async recordDivergenceFeedback(input: {
      observations: AnomalyObservation[];
    }): Promise<{
      anomalies: AnomalyMemorySnapshot[];
      learningEvents: LearningEventRecord[];
      sourceReliability: SourceReliabilityComputation[];
    }> {
      const anomalies: AnomalyMemorySnapshot[] = [];
      const learningEvents: LearningEventRecord[] = [];
      const affectedSourceIds = new Set<string>();

      for (const observation of input.observations) {
        const existing = await adapter.loadAnomalyMemory(observation.anomalyKey);
        const snapshot = mergeAnomalyMemory(existing, observation);
        anomalies.push(await adapter.upsertAnomalyMemory(snapshot));
        learningEvents.push(await adapter.persistLearningEvent(buildLearningEvent({
          eventType: observation.outcome === 'REJECTED' ? 'ANOMALY_REJECTED' : 'ANOMALY_CONFIRMED',
          loopType: 'DIVERGENCE_DETECTION',
          subjectType: observation.subjectType,
          subjectId: observation.subjectId,
          confidence: observation.confidence,
          metadata: {
            anomalyKey: observation.anomalyKey,
            anomalyType: observation.anomalyType,
            severity: observation.severity,
            sourceIds: observation.sourceIds,
            ...(observation.metadata ?? {}),
          },
          occurredAt: observation.detectedAt,
        })));

        for (const sourceId of observation.sourceIds) {
          affectedSourceIds.add(sourceId);
        }
      }

      const sourceReliability = await Promise.all(
        [...affectedSourceIds].map((sourceId) => this.recomputeSourceReliability(sourceId)),
      );

      return {
        anomalies,
        learningEvents,
        sourceReliability,
      };
    },

    async recordSuggestionOutcome(input: SuggestionOutcomeInput): Promise<{
      suggestionOutcome: SuggestionOutcomeRecord;
      learningEvent: LearningEventRecord;
    }> {
      const suggestionOutcome = await adapter.persistSuggestionOutcome(normalizeSuggestionOutcome(input));
      const learningEvent = await adapter.persistLearningEvent(buildLearningEvent({
        eventType: input.accepted ? 'SUGGESTION_ACCEPTED' : 'SUGGESTION_REJECTED',
        loopType: 'AI_SUGGESTION',
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        confidence: input.confidence ?? null,
        relatedId: input.graphSuggestionId ?? input.suggestionKey,
        metadata: {
          suggestionType: input.suggestionType,
          suggestionKey: input.suggestionKey,
          feedbackSource: input.feedbackSource ?? null,
          sourceNodeId: input.sourceNodeId ?? null,
          targetNodeId: input.targetNodeId ?? null,
          accepted: input.accepted,
          ...(input.metadata ?? {}),
        },
        occurredAt: input.createdAt,
      }));

      return {
        suggestionOutcome,
        learningEvent,
      };
    },

    async recordAlertOutcome(input: {
      sourceId?: string | null;
      subjectType: string;
      subjectId: string;
      outcome: 'TRUE_POSITIVE' | 'FALSE_POSITIVE' | 'ESCALATED' | 'DISMISSED';
      confidence?: number | null;
      metadata?: Record<string, unknown>;
      occurredAt?: Date | string;
    }): Promise<{
      learningEvent: LearningEventRecord;
      sourceReliability: SourceReliabilityComputation | null;
    }> {
      const eventType = input.outcome === 'TRUE_POSITIVE'
        ? 'ALERT_TRUE_POSITIVE'
        : input.outcome === 'FALSE_POSITIVE'
          ? 'ALERT_FALSE_POSITIVE'
          : 'ALERT_ESCALATED';
      const learningEvent = await adapter.persistLearningEvent(buildLearningEvent({
        eventType,
        loopType: 'ALERT_OUTCOME',
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        sourceId: input.sourceId,
        confidence: input.confidence ?? null,
        metadata: {
          outcome: input.outcome,
          ...(input.metadata ?? {}),
        },
        occurredAt: input.occurredAt,
      }));

      if (!input.sourceId) {
        return {
          learningEvent,
          sourceReliability: null,
        };
      }

      return {
        learningEvent,
        sourceReliability: await this.recomputeSourceReliability(input.sourceId),
      };
    },

    async recordTrustEvolution(input: TrustEvolutionInput): Promise<TrustEvolutionRecord | null> {
      const latest = await adapter.loadLatestTrustEvolution(input.subjectType, input.subjectId);
      const candidate = buildTrustEvolution({
        ...input,
        previousScore: input.previousScore ?? latest?.newScore ?? null,
      });

      if (!shouldPersistTrustEvolution(latest, candidate)) {
        return null;
      }

      return adapter.persistTrustEvolution(candidate);
    },

    async rebuildGraphInsights(input: {
      nodeId?: string | null;
      graphMode?: string | null;
    }): Promise<GraphInsightRecord[]> {
      const graph = await adapter.loadGraphData(input);
      const insights = deriveGraphInsights(graph.nodes, graph.edges);
      const nodeIds = input.nodeId
        ? [input.nodeId]
        : [...new Set(insights.map((insight) => insight.nodeId))];

      return adapter.replaceGraphInsights({
        nodeIds: nodeIds.length > 0 ? nodeIds : null,
        insights,
      });
    },
  };
}
