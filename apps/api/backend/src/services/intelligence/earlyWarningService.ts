import prisma from '../../graphql/prisma_client';
import { listInvestigatorFindings } from '../investigators/investigatorEngineService';
import {
  listPredictionInsights,
  type PredictionQuery,
  type StoredPredictionInsight,
} from '../predictions/predictionEngineService';
import {
  investigatorFindingToWarningSignal,
  predictionToSignal,
  trustAlertToWarningSignal,
  warningToFeedItem,
} from './intelligenceAdapters';
import {
  buildExplainableIntelligence,
  dedupeStrings,
  selectSignalTimestamp,
  stableIntelligenceId,
  type ExplainableIntelligenceOutput,
  type IntelligenceFeedItem,
} from './intelligenceDomain';

const ACTIVE_FINDING_STATUSES = ['new', 'acknowledged', 'investigating', 'escalated'];
const EARLY_WARNING_FINDING_TYPES = ['trust_decline', 'divergence'];
const WARNING_LOOKBACK_DAYS = 120;
const ALERT_SUPPRESSION_WINDOW_HOURS = 72;

function daysAgo(days: number): Date {
  return new Date(Date.now() - (days * 86_400_000));
}

function parseRepeatCount(signal: ExplainableIntelligenceOutput): number {
  const metadataCount = signal.metadata.repeatCount;
  return typeof metadataCount === 'number' && Number.isFinite(metadataCount)
    ? metadataCount
    : 1;
}

function asWarningSignalFromPrediction(prediction: StoredPredictionInsight): ExplainableIntelligenceOutput {
  const base = predictionToSignal(prediction);
  return buildExplainableIntelligence({
    id: stableIntelligenceId('early_warning', prediction.predictionId),
    type: 'early_warning',
    entity: {
      entityType: base.entityType,
      entityId: base.entityId,
      entityLabel: base.entityLabel,
    },
    state: prediction.state,
    score: base.score,
    confidence: base.confidence.score,
    explanation: {
      summary: prediction.summary || prediction.explanation,
      details: [prediction.explanation, ...base.explanation.details],
      insufficientSignal: prediction.insufficientSignal,
    },
    drivers: base.drivers,
    sourceSignals: base.sourceSignals,
    lastUpdated: base.lastUpdated,
    recommendedActionRefs: [prediction.predictionId],
    metadata: {
      ...base.metadata,
      warningSource: 'prediction',
      predictionId: prediction.predictionId,
      predictionType: prediction.predictionType,
    },
  });
}

function sameEntity(
  signal: ExplainableIntelligenceOutput,
  entityType?: string,
  entityId?: string,
): boolean {
  if (!entityType || !entityId) {
    return true;
  }

  return signal.entityType === entityType && signal.entityId === entityId;
}

function warningGroupKey(signal: ExplainableIntelligenceOutput): string {
  const warningSource = typeof signal.metadata.warningSource === 'string'
    ? signal.metadata.warningSource
    : signal.type;
  const warningType = typeof signal.metadata.alertType === 'string'
    ? signal.metadata.alertType
    : typeof signal.metadata.predictionType === 'string'
      ? signal.metadata.predictionType
      : typeof signal.metadata.findingType === 'string'
        ? signal.metadata.findingType
        : warningSource;
  return stableIntelligenceId(
    'warning_group',
    signal.entityType,
    signal.entityId,
    warningType,
  );
}

function dedupeWarnings(
  warnings: ExplainableIntelligenceOutput[],
): ExplainableIntelligenceOutput[] {
  const grouped = new Map<string, ExplainableIntelligenceOutput[]>();
  for (const warning of warnings) {
    const key = warningGroupKey(warning);
    const bucket = grouped.get(key) ?? [];
    bucket.push(warning);
    grouped.set(key, bucket);
  }

  return [...grouped.values()].map((bucket) => {
    const sorted = [...bucket].sort((left, right) => (
      Date.parse(right.lastUpdated) - Date.parse(left.lastUpdated)
    ));
    const latest = sorted[0]!;
    const windowStart = Date.parse(latest.lastUpdated) - (ALERT_SUPPRESSION_WINDOW_HOURS * 3_600_000);
    const repeated = sorted.filter((entry) => Date.parse(entry.lastUpdated) >= windowStart);
    const repeatCount = repeated.reduce((sum, entry) => sum + parseRepeatCount(entry), 0);

    return {
      ...latest,
      linkedEvidenceRefs: dedupeStrings(repeated.flatMap((entry) => entry.linkedEvidenceRefs)),
      linkedStorylineIds: dedupeStrings(repeated.flatMap((entry) => entry.linkedStorylineIds)),
      recommendedActionRefs: dedupeStrings(repeated.flatMap((entry) => entry.recommendedActionRefs)),
      sourceSignals: repeated.flatMap((entry) => entry.sourceSignals),
      lastUpdated: selectSignalTimestamp(...repeated.map((entry) => entry.lastUpdated)),
      explanation: {
        ...latest.explanation,
        details: dedupeStrings([
          ...latest.explanation.details,
          repeatCount > 1 ? `Repeated ${repeatCount} time(s) within the last ${ALERT_SUPPRESSION_WINDOW_HOURS}h.` : null,
        ]),
        formatted: '',
      },
      metadata: {
        ...latest.metadata,
        repeatCount,
        suppressedRepeatCount: Math.max(0, repeatCount - 1),
      },
    };
  }).map((warning) => ({
    ...warning,
    explanation: {
      ...warning.explanation,
      formatted: [warning.explanation.summary, ...warning.explanation.details].join(' '),
    },
  }));
}

export async function listEarlyWarningSignals(options: {
  entityType?: string;
  entityId?: string;
  limit?: number;
} = {}): Promise<ExplainableIntelligenceOutput[]> {
  const predictionQuery: PredictionQuery = {
    type: 'TRUST_RISK_ACCELERATION',
    entityType: options.entityType === 'provider' ? 'provider' : undefined,
    entityId: options.entityType === 'provider' ? options.entityId ?? null : null,
    limit: Math.max(options.limit ?? 25, 25),
    offset: 0,
    sync: false,
  };

  const [findingResult, predictionResult, alertRows] = await Promise.all([
    listInvestigatorFindings({
      findingType: EARLY_WARNING_FINDING_TYPES,
      status: ACTIVE_FINDING_STATUSES,
      provider: options.entityType === 'provider' ? options.entityId ?? null : null,
      institution: options.entityType === 'institution' ? options.entityId ?? null : null,
      limit: Math.max(options.limit ?? 25, 50),
      offset: 0,
    }),
    listPredictionInsights(predictionQuery),
    prisma.trustAlertRecord.findMany({
      where: {
        createdAt: { gte: daysAgo(WARNING_LOOKBACK_DAYS) },
        subject: options.entityType === 'provider' && options.entityId ? options.entityId : undefined,
      },
      select: {
        alertId: true,
        type: true,
        severity: true,
        title: true,
        description: true,
        subject: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(options.limit ?? 25, 100),
    }),
  ]);

  const findingSignals = findingResult.findings
    .map((finding) => investigatorFindingToWarningSignal(finding))
    .filter((signal) => sameEntity(signal, options.entityType, options.entityId));
  const predictionSignals = predictionResult.predictions
    .filter((prediction) => prediction.state === 'watch' || prediction.state === 'accelerating')
    .map((prediction) => asWarningSignalFromPrediction(prediction))
    .filter((signal) => sameEntity(signal, options.entityType, options.entityId));
  const findingIdsByEntity = new Map<string, string[]>();
  for (const finding of findingResult.findings) {
    const providerId = finding.entities.find((entity) => entity.entityType === 'provider')?.entityId
      ?? finding.entityIds.find((entityId) => /^\d{10}$/.test(entityId))
      ?? null;
    if (!providerId) {
      continue;
    }
    const bucket = findingIdsByEntity.get(providerId) ?? [];
    bucket.push(finding.findingId);
    findingIdsByEntity.set(providerId, bucket);
  }
  const predictionIdsByEntity = new Map<string, string[]>();
  for (const prediction of predictionResult.predictions) {
    const bucket = predictionIdsByEntity.get(prediction.entityId) ?? [];
    bucket.push(prediction.predictionId);
    predictionIdsByEntity.set(prediction.entityId, bucket);
  }

  const alertSignals = alertRows
    .map((row) => trustAlertToWarningSignal({
      alertId: row.alertId,
      type: row.type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      subject: row.subject,
      createdAt: row.createdAt.toISOString(),
      linkedFindingIds: row.subject ? findingIdsByEntity.get(row.subject) ?? [] : [],
      linkedPredictionIds: row.subject ? predictionIdsByEntity.get(row.subject) ?? [] : [],
    }))
    .filter((signal) => sameEntity(signal, options.entityType, options.entityId));

  return dedupeWarnings([
    ...findingSignals,
    ...predictionSignals,
    ...alertSignals,
  ])
    .sort((left, right) => (
      right.score - left.score
      || right.confidence.score - left.confidence.score
      || Date.parse(right.lastUpdated) - Date.parse(left.lastUpdated)
    ))
    .slice(0, Math.max(options.limit ?? 25, 1));
}

export async function listEarlyWarningFeedItems(options: {
  entityType?: string;
  entityId?: string;
  limit?: number;
} = {}): Promise<IntelligenceFeedItem[]> {
  const warnings = await listEarlyWarningSignals(options);
  return warnings.map((warning) => warningToFeedItem(warning));
}
