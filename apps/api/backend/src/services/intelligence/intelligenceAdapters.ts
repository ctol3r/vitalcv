import type { TrustScoreV1 } from '../trust/trustScoreV1';
import type { InvestigatorFindingRecord } from '../../../../../../core/investigators/investigatorTypes';
import type { StoredPredictionInsight } from '../predictions/predictionEngineService';
import type { StorylineWithPredictionSnapshot } from '../storylines/storylineService';
import type {
  InstitutionInsight,
  ProviderInsight,
  SpecialtyInsight,
} from './providerIntelligenceService';
import {
  buildExplainableIntelligence,
  buildFeedItem,
  clamp01,
  dedupeStrings,
  formatSourceSignalsForCopilot,
  normalizeDriver,
  normalizeSourceSignal,
  stableIntelligenceId,
  type ExplainableIntelligenceOutput,
  type IntelligenceDirection,
  type IntelligenceEntityRef,
  type IntelligenceFeedItem,
  type IntelligencePriority,
  type IntelligenceSourceSignal,
} from './intelligenceDomain';

type TrustAlertSignalInput = {
  alertId: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  subject: string | null;
  createdAt: string;
  linkedFindingIds?: string[];
  linkedPredictionIds?: string[];
  repeatCount?: number;
};

function predictionEntity(prediction: StoredPredictionInsight): IntelligenceEntityRef {
  return {
    entityType: prediction.entityType,
    entityId: prediction.entityId,
    entityLabel: prediction.entityLabel ?? prediction.entityId,
  };
}

function severityPriority(value: string | null | undefined): IntelligencePriority {
  switch ((value ?? '').toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
    case 'severe':
      return 'high';
    case 'medium':
    case 'moderate':
    case 'watch':
      return 'medium';
    default:
      return 'low';
  }
}

function directionFromDelta(value: number | string | boolean | null): IntelligenceDirection {
  if (typeof value === 'number') {
    if (value > 0) {
      return 'UP';
    }
    if (value < 0) {
      return 'DOWN';
    }
  }
  return 'FLAT';
}

function driverSignals(drivers: Array<{
  label: string;
  value: number | string;
  direction: 'UP' | 'DOWN' | 'FLAT';
  source?: string | null;
  explanation?: string | null;
  observedAt?: string | null;
}>): IntelligenceSourceSignal[] {
  return drivers.map((driver) => normalizeSourceSignal({
    type: 'driver_signal',
    label: driver.label.replace(/_/g, ' '),
    value: driver.value,
    source: driver.source ?? null,
    observedAt: driver.observedAt ?? null,
    explanation: driver.explanation ?? null,
  }));
}

export function trustScoreToSignal(score: TrustScoreV1): ExplainableIntelligenceOutput {
  const sourceSignals = Object.entries(score.dimensions).map(([key, dimension]) => normalizeSourceSignal({
    id: stableIntelligenceId('trust_score', score.npi, key),
    type: 'trust_dimension',
    label: key,
    value: dimension.score,
    source: dimension.sources[0] ?? null,
    confidence: dimension.confidence,
    observedAt: score.computedAt,
    explanation: dimension.explanation,
    metadata: {
      max: dimension.max,
      pct: dimension.pct,
      status: dimension.status,
      sources: dimension.sources,
      gaps: dimension.gaps,
    },
  }));

  return buildExplainableIntelligence({
    id: stableIntelligenceId('trust_score', score.npi),
    type: 'trust_score',
    entity: {
      entityType: 'provider',
      entityId: score.npi,
      entityLabel: `Provider ${score.npi}`,
    },
    state: score.band.toLowerCase(),
    score: score.score,
    confidence: score.confidence,
    explanation: {
      summary: `Trust score is ${score.score}/100 (${score.bandLabel}).`,
      details: [
        ...score.gaps,
        ...score.trustLimits,
        ...score.recommendations.slice(0, 3),
      ],
      insufficientSignal: sourceSignals.length === 0,
    },
    drivers: Object.entries(score.dimensions).map(([key, dimension]) => normalizeDriver({
      key,
      value: dimension.score,
      direction: 'FLAT',
      importance: dimension.max > 0 ? dimension.score / dimension.max : 0,
      source: dimension.sources[0] ?? null,
      observedAt: score.computedAt,
      explanation: dimension.explanation,
    })),
    sourceSignals,
    lastUpdated: score.computedAt,
    linkedEvidenceRefs: score.contradictions.map((contradiction) => (
      stableIntelligenceId(
        'contradiction',
        score.npi,
        contradiction.dimension,
        contradiction.claimType,
        contradiction.description,
      )
    )),
    recommendedActionRefs: score.recommendations,
    metadata: {
      methodology: score.methodology,
      band: score.band,
      bandLabel: score.bandLabel,
      penaltyApplied: score.penaltyApplied,
      totalPenalty: score.totalPenalty,
      contradictionCount: score.contradictions.length,
    },
  });
}

export function predictionToSignal(prediction: StoredPredictionInsight): ExplainableIntelligenceOutput {
  const sourceSignals = prediction.evidenceSignals.map((signal, index) => normalizeSourceSignal({
    id: stableIntelligenceId('prediction', prediction.predictionId, signal.label, String(index)),
    type: prediction.type.toLowerCase(),
    label: signal.label.replace(/_/g, ' '),
    value: signal.value,
    source: signal.source ?? null,
    observedAt: signal.observedAt ?? prediction.updatedAt,
    explanation: null,
  }));

  return buildExplainableIntelligence({
    id: prediction.predictionId,
    type: prediction.type.toLowerCase(),
    entity: predictionEntity(prediction),
    state: prediction.state,
    score: prediction.score,
    scoreScale: 'ratio',
    confidence: prediction.confidence,
    explanation: {
      summary: prediction.summary || prediction.explanation,
      details: [prediction.explanation, ...formatSourceSignalsForCopilot(sourceSignals)],
      insufficientSignal: prediction.insufficientSignal,
    },
    drivers: (prediction.drivers ?? []).map((driver) => normalizeDriver({
      key: driver.label,
      label: driver.label.replace(/_/g, ' '),
      value: driver.value,
      direction: driver.direction,
      importance: typeof driver.value === 'number' ? clamp01(Math.abs(driver.value)) : 0.5,
      source: driver.source,
      observedAt: driver.observedAt ?? prediction.updatedAt,
      explanation: driver.explanation,
    })),
    sourceSignals,
    lastUpdated: prediction.lastUpdated ?? prediction.updatedAt,
    metadata: {
      predictionId: prediction.predictionId,
      predictionType: prediction.predictionType,
      probability: prediction.probability,
      timeHorizon: prediction.timeHorizon,
      forecast: prediction.forecast,
    },
  });
}

export function providerInsightToTrajectorySignal(insight: ProviderInsight): ExplainableIntelligenceOutput {
  const sourceSignals = driverSignals(insight.drivers);
  return buildExplainableIntelligence({
    id: stableIntelligenceId('provider_trajectory', insight.entity.entityId),
    type: 'provider_trajectory',
    entity: insight.entity,
    state: insight.scoreLabel,
    score: insight.score,
    scoreScale: 'ratio',
    confidence: insight.confidence,
    explanation: {
      summary: insight.explanation,
      details: [
        `Network hub score: ${Math.round(insight.networkHubScore * 100)}.`,
        ...formatSourceSignalsForCopilot(sourceSignals),
      ],
      insufficientSignal: sourceSignals.length === 0,
    },
    drivers: insight.drivers.map((driver) => normalizeDriver({
      key: driver.label,
      label: driver.label.replace(/_/g, ' '),
      value: driver.value,
      direction: driver.direction,
      importance: typeof driver.value === 'number' ? clamp01(Math.abs(driver.value)) : 0.5,
      source: driver.source,
      explanation: driver.explanation,
    })),
    sourceSignals,
    lastUpdated: insight.lastUpdated,
    linkedStorylineIds: insight.relatedStorylineIds,
    recommendedActionRefs: insight.relatedActionIds,
    metadata: {
      networkHubScore: insight.networkHubScore,
    },
  });
}

export function providerInsightToInfluenceSignal(
  insight: ProviderInsight,
  relatedFindingTypes: string[] = [],
): ExplainableIntelligenceOutput {
  const influenceScore = clamp01(
    (insight.networkHubScore * 0.6)
      + (insight.score * 0.3)
      + (relatedFindingTypes.some((entry) => entry === 'industry_influence') ? 0.1 : 0),
  );
  const sourceSignals = driverSignals(insight.drivers);

  return buildExplainableIntelligence({
    id: stableIntelligenceId('influence_score', insight.entity.entityId),
    type: 'influence_score',
    entity: insight.entity,
    state: influenceScore >= 0.75 ? 'high' : influenceScore >= 0.45 ? 'elevated' : 'emerging',
    score: influenceScore,
    scoreScale: 'ratio',
    confidence: Math.max(insight.confidence, influenceScore * 0.85),
    explanation: {
      summary: `${insight.entity.entityLabel ?? insight.entity.entityId} has ${Math.round(influenceScore * 100)} influence score driven by graph centrality and provider momentum.`,
      details: [
        `Provider trajectory state: ${insight.scoreLabel}.`,
        `Network hub score: ${Math.round(insight.networkHubScore * 100)}.`,
        ...(relatedFindingTypes.length > 0 ? [`Related findings: ${dedupeStrings(relatedFindingTypes).join(', ')}.`] : []),
        ...formatSourceSignalsForCopilot(sourceSignals),
      ],
      insufficientSignal: sourceSignals.length === 0,
    },
    drivers: [
      ...insight.drivers.map((driver) => normalizeDriver({
        key: driver.label,
        label: driver.label.replace(/_/g, ' '),
        value: driver.value,
        direction: driver.direction,
        importance: typeof driver.value === 'number' ? clamp01(Math.abs(driver.value)) : 0.5,
        source: driver.source,
        explanation: driver.explanation,
      })),
      normalizeDriver({
        key: 'network_hub_score',
        value: insight.networkHubScore,
        direction: directionFromDelta(insight.networkHubScore),
        importance: insight.networkHubScore,
        source: 'GRAPH_RUNTIME',
        explanation: 'Graph centrality and articulation contribute to provider influence.',
      }),
    ],
    sourceSignals,
    lastUpdated: insight.lastUpdated,
    linkedStorylineIds: insight.relatedStorylineIds,
    recommendedActionRefs: insight.relatedActionIds,
    metadata: {
      providerTrajectoryScore: insight.score,
      networkHubScore: insight.networkHubScore,
      relatedFindingTypes: dedupeStrings(relatedFindingTypes),
    },
  });
}

export function specialtyInsightToSignal(insight: SpecialtyInsight): ExplainableIntelligenceOutput {
  const sourceSignals = driverSignals(insight.drivers);
  return buildExplainableIntelligence({
    id: stableIntelligenceId('workforce_pressure', insight.entity.entityId),
    type: 'workforce_pressure',
    entity: insight.entity,
    state: insight.scoreLabel,
    score: insight.score,
    scoreScale: 'ratio',
    confidence: insight.confidence,
    explanation: {
      summary: insight.explanation,
      details: formatSourceSignalsForCopilot(sourceSignals),
      insufficientSignal: sourceSignals.length === 0,
    },
    drivers: insight.drivers.map((driver) => normalizeDriver({
      key: driver.label,
      label: driver.label.replace(/_/g, ' '),
      value: driver.value,
      direction: driver.direction,
      importance: typeof driver.value === 'number' ? clamp01(Math.abs(driver.value)) : 0.5,
      source: driver.source,
      explanation: driver.explanation,
    })),
    sourceSignals,
    lastUpdated: insight.lastUpdated,
    metadata: {
      scoreLabel: insight.scoreLabel,
    },
  });
}

export function institutionInsightToSignal(insight: InstitutionInsight): ExplainableIntelligenceOutput {
  const sourceSignals = driverSignals(insight.drivers);
  return buildExplainableIntelligence({
    id: stableIntelligenceId('institution_momentum', insight.entity.entityId),
    type: 'institution_momentum',
    entity: insight.entity,
    state: insight.scoreLabel,
    score: insight.score,
    scoreScale: 'ratio',
    confidence: insight.confidence,
    explanation: {
      summary: insight.explanation,
      details: formatSourceSignalsForCopilot(sourceSignals),
      insufficientSignal: sourceSignals.length === 0,
    },
    drivers: insight.drivers.map((driver) => normalizeDriver({
      key: driver.label,
      label: driver.label.replace(/_/g, ' '),
      value: driver.value,
      direction: driver.direction,
      importance: typeof driver.value === 'number' ? clamp01(Math.abs(driver.value)) : 0.5,
      source: driver.source,
      explanation: driver.explanation,
    })),
    sourceSignals,
    lastUpdated: insight.lastUpdated,
    metadata: {
      scoreLabel: insight.scoreLabel,
    },
  });
}

export function investigatorFindingToWarningSignal(
  finding: InvestigatorFindingRecord,
): ExplainableIntelligenceOutput {
  const entity = finding.entities.find((entry) => entry.relationship === 'subject')
    ?? finding.entities[0]
    ?? {
      entityType: 'entity',
      entityId: finding.entityIds[0] ?? finding.findingId,
      entityLabel: finding.entityIds[0] ?? finding.findingId,
    };
  const sourceSignals = finding.supportingEvidence.map((evidence) => normalizeSourceSignal({
    id: evidence.evidenceId,
    type: evidence.evidenceType,
    label: evidence.evidenceType.replace(/_/g, ' '),
    value: evidence.snippet ?? evidence.recordId ?? evidence.recordType ?? 'evidence',
    source: evidence.sourceLabel ?? evidence.sourceId ?? null,
    observedAt: evidence.observedAt ?? finding.updatedAt,
    metadata: {
      recordId: evidence.recordId,
      recordType: evidence.recordType,
      url: evidence.url,
    },
  }));

  return buildExplainableIntelligence({
    id: finding.dedupeKey || stableIntelligenceId('early_warning', finding.findingId),
    type: 'early_warning',
    entity: {
      entityType: entity.entityType,
      entityId: entity.entityId,
      entityLabel: entity.entityLabel ?? entity.entityId,
    },
    state: finding.status,
    score: finding.priorityScore,
    scoreScale: 'ratio',
    confidence: finding.confidence,
    explanation: {
      summary: finding.summary || finding.title,
      details: [finding.explanation, ...formatSourceSignalsForCopilot(sourceSignals)],
    },
    drivers: [
      normalizeDriver({
        key: 'priority_score',
        value: finding.priorityScore,
        direction: directionFromDelta(finding.priorityScore),
        importance: finding.priorityScore,
        source: finding.investigatorId,
        observedAt: finding.updatedAt,
        explanation: 'Investigator priority score ranks early warning urgency.',
      }),
      normalizeDriver({
        key: 'occurrence_count',
        value: finding.occurrenceCount,
        direction: finding.occurrenceCount > 1 ? 'UP' : 'FLAT',
        importance: clamp01(finding.occurrenceCount / 5),
        source: finding.investigatorId,
        observedAt: finding.updatedAt,
        explanation: 'Repeat occurrences increase early warning urgency.',
      }),
    ],
    sourceSignals,
    lastUpdated: finding.updatedAt,
    linkedEvidenceRefs: finding.supportingEvidence.map((evidence) => evidence.evidenceId),
    linkedStorylineIds: finding.storylineKey ? [finding.storylineKey] : [],
    metadata: {
      findingId: finding.findingId,
      findingType: finding.findingType,
      severity: finding.severity,
      status: finding.status,
      occurrenceCount: finding.occurrenceCount,
    },
  });
}

export function trustAlertToWarningSignal(input: TrustAlertSignalInput): ExplainableIntelligenceOutput {
  const entity: IntelligenceEntityRef = {
    entityType: 'provider',
    entityId: input.subject ?? 'unknown',
    entityLabel: input.subject ? `Provider ${input.subject}` : null,
  };
  return buildExplainableIntelligence({
    id: input.alertId,
    type: 'early_warning',
    entity,
    state: input.severity.toLowerCase(),
    score: input.severity.toUpperCase() === 'HIGH' ? 92 : 74,
    confidence: input.severity.toUpperCase() === 'HIGH' ? 0.9 : 0.76,
    explanation: {
      summary: input.title,
      details: [
        input.description,
        input.repeatCount && input.repeatCount > 1 ? `Repeated ${input.repeatCount} times in the current warning window.` : null,
      ],
    },
    drivers: [
      normalizeDriver({
        key: 'severity',
        value: input.severity,
        direction: 'UP',
        importance: input.severity.toUpperCase() === 'HIGH' ? 0.9 : 0.7,
        source: input.type,
        observedAt: input.createdAt,
        explanation: 'Alert severity reflects the current warning escalation level.',
      }),
      normalizeDriver({
        key: 'repeat_count',
        value: input.repeatCount ?? 1,
        direction: (input.repeatCount ?? 1) > 1 ? 'UP' : 'FLAT',
        importance: clamp01((input.repeatCount ?? 1) / 5),
        source: 'TRUST_ALERTS',
        observedAt: input.createdAt,
        explanation: 'Repeated threshold crossings increase alert urgency.',
      }),
    ],
    sourceSignals: [
      normalizeSourceSignal({
        id: stableIntelligenceId('alert', input.alertId, 'summary'),
        type: input.type.toLowerCase(),
        label: input.type.replace(/_/g, ' '),
        value: input.description,
        source: 'TRUST_ALERTS',
        observedAt: input.createdAt,
      }),
    ],
    lastUpdated: input.createdAt,
    linkedEvidenceRefs: input.linkedFindingIds,
    recommendedActionRefs: input.linkedPredictionIds,
    metadata: {
      alertType: input.type,
      severity: input.severity,
      repeatCount: input.repeatCount ?? 1,
    },
  });
}

export function findingToFeedItem(finding: InvestigatorFindingRecord): IntelligenceFeedItem {
  return buildFeedItem({
    id: finding.findingId,
    type: 'finding',
    headline: finding.title,
    summary: finding.summary || finding.explanation,
    entityRefs: finding.entities.length > 0
      ? finding.entities.map((entity) => ({
        entityType: entity.entityType,
        entityId: entity.entityId,
        entityLabel: entity.entityLabel ?? entity.entityId,
      }))
      : finding.entityIds.map((entityId) => ({
        entityType: 'entity',
        entityId,
        entityLabel: entityId,
      })),
    confidence: finding.confidence,
    priority: severityPriority(finding.severity),
    impact: severityPriority(finding.severity),
    linkedEvidenceRefs: finding.supportingEvidence.map((evidence) => evidence.evidenceId),
    createdAt: finding.createdAt,
    updatedAt: finding.updatedAt,
    metadata: {
      findingId: finding.findingId,
      findingType: finding.findingType,
      status: finding.status,
      storylineKey: finding.storylineKey,
    },
  });
}

export function storylineToFeedItem(storyline: StorylineWithPredictionSnapshot): IntelligenceFeedItem {
  const entityRefs = storyline.entityIds.map((entityId) => {
    const [entityType, entityKey] = entityId.includes(':')
      ? entityId.split(':', 2)
      : ['entity', entityId];
    return {
      entityType,
      entityId: entityKey ?? entityId,
      entityLabel: entityKey ?? entityId,
    };
  });

  return buildFeedItem({
    id: storyline.storylineId,
    type: 'storyline',
    headline: storyline.title,
    summary: storyline.summary,
    entityRefs,
    confidence: storyline.confidence,
    priority: severityPriority(storyline.severity),
    impact: severityPriority(storyline.maxSeverity ?? storyline.severity),
    linkedEvidenceRefs: storyline.findingIds,
    recommendedActionRefs: storyline.recommendedActions,
    createdAt: storyline.createdAt,
    updatedAt: storyline.lastActivityAt,
    metadata: {
      storylineType: storyline.storylineType,
      perspective: storyline.perspective,
      status: storyline.status,
    },
  });
}

export function predictionToFeedItem(prediction: StoredPredictionInsight): IntelligenceFeedItem {
  const signal = predictionToSignal(prediction);
  return buildFeedItem({
    id: stableIntelligenceId('prediction', prediction.predictionId),
    type: 'prediction',
    headline: `${prediction.entityLabel ?? prediction.entityId} ${prediction.type.replace(/_/g, ' ').toLowerCase()}`,
    summary: prediction.summary || prediction.explanation,
    entityRefs: [predictionEntity(prediction)],
    confidence: prediction.confidence,
    priority: severityPriority(prediction.state),
    impact: severityPriority(prediction.state),
    linkedEvidenceRefs: prediction.evidenceSignals.map((signalItem) => signalItem.label),
    createdAt: prediction.createdAt,
    updatedAt: prediction.updatedAt,
    signal,
    metadata: {
      predictionId: prediction.predictionId,
      predictionType: prediction.predictionType,
      timeHorizon: prediction.timeHorizon,
    },
  });
}

export function insightToFeedItem(
  insight: ProviderInsight | SpecialtyInsight | InstitutionInsight,
): IntelligenceFeedItem {
  const signal = insight.type === 'provider'
    ? providerInsightToTrajectorySignal(insight)
    : insight.type === 'specialty'
      ? specialtyInsightToSignal(insight)
      : institutionInsightToSignal(insight);

  return buildFeedItem({
    id: stableIntelligenceId('insight', insight.type, insight.entity.entityId),
    type: 'insight',
    headline: `${insight.entity.entityLabel ?? insight.entity.entityId} ${insight.type}`,
    summary: insight.explanation,
    entityRefs: [insight.entity],
    confidence: insight.confidence,
    priority: severityPriority(insight.scoreLabel),
    impact: severityPriority(insight.scoreLabel),
    createdAt: insight.lastUpdated,
    updatedAt: insight.lastUpdated,
    signal,
    metadata: {
      insightType: insight.type,
      scoreLabel: insight.scoreLabel,
    },
  });
}

export function warningToFeedItem(signal: ExplainableIntelligenceOutput): IntelligenceFeedItem {
  return buildFeedItem({
    id: signal.id,
    type: 'early_warning',
    headline: signal.explanation.summary,
    summary: signal.explanation.formatted,
    entityRefs: [{
      entityType: signal.entityType,
      entityId: signal.entityId,
      entityLabel: signal.entityLabel,
    }],
    confidence: signal.confidence.score,
    priority: severityPriority(signal.state),
    impact: severityPriority(signal.state),
    linkedEvidenceRefs: signal.linkedEvidenceRefs,
    recommendedActionRefs: signal.recommendedActionRefs,
    createdAt: signal.lastUpdated,
    updatedAt: signal.lastUpdated,
    signal,
    metadata: signal.metadata,
  });
}
