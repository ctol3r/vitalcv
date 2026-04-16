import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { buildPassportByNpi } from '../entity/passportService';
import { getIssuer } from '../registry/trustRegistry';
import { LAUNCH_SPINE_SOURCE_IDS, type CanonicalSourceCoverage } from '@vitalcv/trust-state';

type DecisionEventType =
  | 'EMPLOYER_ACCEPTED'
  | 'EMPLOYER_REJECTED'
  | 'EMPLOYER_REQUESTED_INFO';

type ConfidenceBand = 'HIGH' | 'MEDIUM' | 'LOW';
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
type RecommendedActionBias = 'PROCEED' | 'REVERIFY' | 'REVIEW';

interface LearningPattern {
  role: string;
  orgType: string;
  readinessLevel: string;
  missingLanes: string[];
}

interface PatternAggregate {
  successCount: number;
  failureCount: number;
  timeToStartDays: number[];
}

export interface LearningSignal {
  recommendedActionBias: RecommendedActionBias;
  riskLevel: RiskLevel;
  expectedOutcome: {
    successRate: number | null;
    failureRate: number | null;
    avgTimeToStartDays: number | null;
    sampleSize: number;
  };
  confidenceBand: ConfidenceBand;
  confidenceScore: number;
  evidenceCompleteness: number;
  freshnessScore: number;
  issuerTrustScore: number;
  historicalSuccessRate: number | null;
  varianceScore: number | null;
  lowSample: boolean;
  reason: string;
}

const LOOP_TYPE = 'USAGE_TRACKING';
const DECISION_EVENT_TYPES: readonly DecisionEventType[] = [
  'EMPLOYER_ACCEPTED',
  'EMPLOYER_REJECTED',
  'EMPLOYER_REQUESTED_INFO',
] as const;
const HISTORY_LOOKBACK_DAYS = 180;
const HISTORY_LIMIT = 500;
const MIN_HISTORY_SAMPLE = 3;

const SOURCE_ISSUER_MAP: Record<string, string> = {
  NPPES_API: 'did:vitalcv:issuer:npi-registry',
  OIG_LEIE: 'did:vitalcv:issuer:oig-leie',
  PECOS_PUBLIC: 'did:vitalcv:issuer:pecos-public',
  STATE_BOARD: 'did:vitalcv:issuer:ca-medical-board',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .map((item) => readString(item))
      .filter((item): item is string => item !== null),
  )].sort((left, right) => left.localeCompare(right));
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function patternKey(pattern: LearningPattern): string {
  return [
    pattern.role,
    pattern.orgType,
    pattern.readinessLevel,
    pattern.missingLanes.join('|'),
  ].join('::');
}

function normalizePattern(metadata: unknown): LearningPattern {
  const record = asRecord(metadata);

  return {
    role: readString(record.role) ?? 'UNKNOWN',
    orgType: readString(record.orgType) ?? 'UNKNOWN',
    readinessLevel: readString(record.readinessLevel) ?? 'UNKNOWN',
    missingLanes: readStringArray(record.missingLanes),
  };
}

function classifyOutcome(
  eventType: string,
  metadata: unknown,
): 'success' | 'failure' | null {
  const outcome = readString(asRecord(metadata).outcome)?.toUpperCase();

  if (outcome === 'START_ACTIVATED' || outcome === 'SUCCESS') {
    return 'success';
  }

  if (
    eventType === 'EMPLOYER_REJECTED'
    || outcome === 'DRIFT_OCCURRED'
    || outcome === 'FAILURE'
    || outcome === 'DID_NOT_START'
  ) {
    return 'failure';
  }

  return null;
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(1));
}

function currentFreshnessScore(check: CanonicalSourceCoverage | undefined): number {
  if (!check) {
    return 0;
  }

  if (check.state === 'checked') {
    if (check.freshness?.status === 'stale') {
      return 0.25;
    }

    return check.freshness?.status === 'current' ? 1 : 0.75;
  }

  if (check.state === 'stale') {
    return 0;
  }

  if (check.state === 'reviewRequired' || check.state === 'accessRequired') {
    return 0.25;
  }

  return 0;
}

function deriveEvidenceCompleteness(checks: readonly CanonicalSourceCoverage[]): number {
  const checkedCount = checks.filter((check) => check.state === 'checked').length;
  return clamp01(checkedCount / LAUNCH_SPINE_SOURCE_IDS.length);
}

function deriveFreshnessScore(checks: readonly CanonicalSourceCoverage[]): number {
  if (checks.length === 0) {
    return 0;
  }

  const total = checks.reduce((sum, check) => sum + currentFreshnessScore(check), 0);
  return clamp01(total / checks.length);
}

function deriveIssuerTrustScore(checks: readonly CanonicalSourceCoverage[]): number {
  const trustedScores = checks
    .filter((check) => check.state === 'checked')
    .map((check) => SOURCE_ISSUER_MAP[check.sourceId])
    .map((issuerId) => (issuerId ? getIssuer(issuerId) : null))
    .map((issuer) => issuer?.trustScore)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));

  if (trustedScores.length === 0) {
    return 0.4;
  }

  return clamp01(
    trustedScores.reduce((sum, score) => sum + score, 0)
      / (trustedScores.length * 100),
  );
}

function deriveBand(input: {
  authorityVerified: boolean;
  lowSample: boolean;
  evidenceCompleteness: number;
  freshnessScore: number;
  issuerTrustScore: number;
  historicalSuccessRate: number | null;
  varianceScore: number | null;
}): ConfidenceBand {
  if (!input.authorityVerified || input.lowSample) {
    return 'LOW';
  }

  if (
    input.evidenceCompleteness === 1
    && input.freshnessScore >= 0.85
    && input.issuerTrustScore >= 0.8
    && (input.historicalSuccessRate ?? 0) >= 0.7
    && (input.varianceScore ?? 0) >= 0.45
  ) {
    return 'HIGH';
  }

  if (
    input.evidenceCompleteness < 0.75
    || input.freshnessScore < 0.5
    || input.issuerTrustScore < 0.6
    || (input.varianceScore !== null && input.varianceScore < 0.35)
  ) {
    return 'LOW';
  }

  return 'MEDIUM';
}

function deriveRiskLevel(input: {
  authorityVerified: boolean;
  failureRate: number | null;
  freshnessScore: number;
  evidenceCompleteness: number;
}): RiskLevel {
  if (!input.authorityVerified || (input.failureRate ?? 0) >= 0.6) {
    return 'HIGH';
  }

  if (
    (input.failureRate ?? 0) >= 0.35
    || input.freshnessScore < 0.85
    || input.evidenceCompleteness < 1
  ) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function deriveActionBias(input: {
  confidenceBand: ConfidenceBand;
  failureRate: number | null;
  successRate: number | null;
  authorityVerified: boolean;
}): RecommendedActionBias {
  if (input.confidenceBand === 'LOW' || !input.authorityVerified) {
    return 'REVIEW';
  }

  if ((input.failureRate ?? 0) >= 0.4) {
    return 'REVERIFY';
  }

  if ((input.successRate ?? 0) >= 0.7) {
    return 'PROCEED';
  }

  return 'REVERIFY';
}

function deriveConfidenceScore(input: {
  evidenceCompleteness: number;
  freshnessScore: number;
  issuerTrustScore: number;
  historicalSuccessRate: number | null;
  varianceScore: number | null;
  confidenceBand: ConfidenceBand;
}): number {
  const weighted = (
    input.evidenceCompleteness * 0.3
    + input.freshnessScore * 0.25
    + input.issuerTrustScore * 0.2
    + (input.historicalSuccessRate ?? 0) * 0.15
    + (input.varianceScore ?? 0) * 0.1
  );

  if (input.confidenceBand === 'LOW') {
    return clamp01(Math.min(weighted, 0.4));
  }

  if (input.confidenceBand === 'MEDIUM') {
    return clamp01(Math.max(0.45, Math.min(weighted, 0.79)));
  }

  return clamp01(Math.max(0.8, weighted));
}

function buildReason(input: {
  confidenceBand: ConfidenceBand;
  lowSample: boolean;
  authorityVerified: boolean;
  freshnessScore: number;
  successRate: number | null;
  failureRate: number | null;
}): string {
  if (!input.authorityVerified) {
    return 'Authority verification is incomplete, so confidence is forced low.';
  }

  if (input.lowSample) {
    return 'Historical sample size is too small to raise confidence safely.';
  }

  if (input.freshnessScore < 0.85) {
    return 'One or more critical source checks are stale or only partially fresh.';
  }

  if ((input.failureRate ?? 0) > (input.successRate ?? 0)) {
    return 'Historical outcomes for similar cases skew toward failure or rework.';
  }

  if (input.confidenceBand === 'HIGH') {
    return 'Critical lanes are complete, fresh, and supported by strong historical outcomes.';
  }

  return 'Evidence is usable, but the historical pattern is mixed.';
}

export async function deriveLearningSignal(
  clinicianNpi: string,
): Promise<LearningSignal> {
  const safeDefault: LearningSignal = {
    recommendedActionBias: 'REVIEW',
    riskLevel: 'HIGH',
    expectedOutcome: {
      successRate: null,
      failureRate: null,
      avgTimeToStartDays: null,
      sampleSize: 0,
    },
    confidenceBand: 'LOW',
    confidenceScore: 0.2,
    evidenceCompleteness: 0,
    freshnessScore: 0,
    issuerTrustScore: 0,
    historicalSuccessRate: null,
    varianceScore: null,
    lowSample: true,
    reason: 'No safe confidence signal is available yet.',
  };

  if (!clinicianNpi) {
    return safeDefault;
  }

  try {
    const since = new Date(Date.now() - HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const [passport, latestSubjectDecision, recentRows] = await Promise.all([
      buildPassportByNpi(clinicianNpi).catch(() => null),
      prisma.learningEvent.findFirst({
        where: {
          subjectId: clinicianNpi,
          loopType: LOOP_TYPE,
          eventType: { in: [...DECISION_EVENT_TYPES] },
        },
        orderBy: { occurredAt: 'desc' },
        select: { metadata: true },
      }),
      prisma.learningEvent.findMany({
        where: {
          loopType: LOOP_TYPE,
          eventType: { in: [...DECISION_EVENT_TYPES] },
          occurredAt: { gte: since },
        },
        orderBy: { occurredAt: 'desc' },
        take: HISTORY_LIMIT,
        select: { eventType: true, metadata: true },
      }),
    ]);

    const checksBySource = new Map(
      (passport?.sourceCoverage.checks ?? []).map((check) => [check.sourceId, check] as const),
    );
    const criticalChecks = LAUNCH_SPINE_SOURCE_IDS.map((sourceId) => checksBySource.get(sourceId)).filter(
      (check): check is CanonicalSourceCoverage => Boolean(check),
    );

    const evidenceCompleteness = deriveEvidenceCompleteness(criticalChecks);
    const freshnessScore = deriveFreshnessScore(criticalChecks);
    const issuerTrustScore = deriveIssuerTrustScore(criticalChecks);
    const authorityVerified = passport?.truth.authority.status === 'VERIFIED';
    const currentPattern = normalizePattern(latestSubjectDecision?.metadata ?? {});
    const currentPatternKey = patternKey(currentPattern);

    const aggregate: PatternAggregate = {
      successCount: 0,
      failureCount: 0,
      timeToStartDays: [],
    };

    for (const row of recentRows) {
      const metadata = asRecord(row.metadata);
      if (patternKey(normalizePattern(metadata)) !== currentPatternKey) {
        continue;
      }

      const classification = classifyOutcome(row.eventType, metadata);
      if (classification === 'success') {
        aggregate.successCount += 1;
        const timeToStartDays = readNumber(metadata.timeToStartDays);
        if (timeToStartDays !== null && timeToStartDays >= 0) {
          aggregate.timeToStartDays.push(timeToStartDays);
        }
        continue;
      }

      if (classification === 'failure') {
        aggregate.failureCount += 1;
      }
    }

    const sampleSize = aggregate.successCount + aggregate.failureCount;
    const lowSample = sampleSize < MIN_HISTORY_SAMPLE;
    const successRate = sampleSize > 0 ? clamp01(aggregate.successCount / sampleSize) : null;
    const failureRate = sampleSize > 0 ? clamp01(aggregate.failureCount / sampleSize) : null;
    const varianceScore =
      sampleSize > 0 && successRate !== null && failureRate !== null
        ? clamp01(Math.abs(successRate - failureRate))
        : null;
    const historicalSuccessRate = lowSample ? null : successRate;
    const confidenceBand = deriveBand({
      authorityVerified,
      lowSample,
      evidenceCompleteness,
      freshnessScore,
      issuerTrustScore,
      historicalSuccessRate,
      varianceScore,
    });
    const riskLevel = deriveRiskLevel({
      authorityVerified,
      failureRate,
      freshnessScore,
      evidenceCompleteness,
    });
    const recommendedActionBias = deriveActionBias({
      confidenceBand,
      failureRate,
      successRate,
      authorityVerified,
    });
    const confidenceScore = deriveConfidenceScore({
      evidenceCompleteness,
      freshnessScore,
      issuerTrustScore,
      historicalSuccessRate,
      varianceScore,
      confidenceBand,
    });

    return {
      recommendedActionBias,
      riskLevel,
      expectedOutcome: {
        successRate,
        failureRate,
        avgTimeToStartDays: mean(aggregate.timeToStartDays),
        sampleSize,
      },
      confidenceBand,
      confidenceScore,
      evidenceCompleteness,
      freshnessScore,
      issuerTrustScore,
      historicalSuccessRate,
      varianceScore,
      lowSample,
      reason: buildReason({
        confidenceBand,
        lowSample,
        authorityVerified,
        freshnessScore,
        successRate,
        failureRate,
      }),
    };
  } catch (error) {
    log('warn', 'learning_signal_derivation_failed', {
      subjectId: clinicianNpi,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return safeDefault;
  }
}
