import { buildReadinessNextActions } from '../entity/readinessActions';
import { SOURCE_GOVERNANCE } from '../identity/sourceGovernance';

export type SourceCoverageState =
  | 'CHECKED'
  | 'PENDING'
  | 'UNAVAILABLE'
  | 'GATED'
  | 'HUMAN_REQUIRED';

export type TrustDimensionId =
  | 'identity'
  | 'exclusion'
  | 'licensure'
  | 'enrollment';

export interface TrustSourceCoverage {
  sourceId: string;
  state: SourceCoverageState;
  reason: string;
  checkedAt?: string | null;
  artifactId?: string | null;
  sourceUrl?: string | null;
  rawArtifactRef?: string | null;
  checksum?: string | null;
}

export interface TrustDimensionAssessment {
  dimension: TrustDimensionId;
  status: 'MET' | 'BLOCKED' | 'REVIEW_REQUIRED' | 'UNMET';
  confidence: number;
  blocker?: string | null;
  gap?: string | null;
  sourceCoverage: readonly TrustSourceCoverage[];
}

export interface DeterministicTrustReadiness {
  overallStatus: 'CLEAR_TO_START' | 'PENDING_VERIFICATION' | 'MISSING_CREDENTIALS' | 'BLOCKED';
  readinessScore: number;
  readiness_score: number;
  blockers: string[];
  gaps: string[];
  nextActions: string[];
  confidenceWeighting: Record<TrustDimensionId, number>;
  sourceCoverage: TrustSourceCoverage[];
}

const DIMENSION_WEIGHTS: Record<TrustDimensionId, number> = {
  identity: 20,
  exclusion: 30,
  licensure: 30,
  enrollment: 20,
};

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

export function defaultCoverageStateForSource(sourceId: string): SourceCoverageState {
  const governance = SOURCE_GOVERNANCE[sourceId];
  if (!governance) {
    return 'PENDING';
  }
  if (governance.accessBoundary === 'human_lookup_only') {
    return 'HUMAN_REQUIRED';
  }
  if (
    governance.accessBoundary === 'gated'
    || governance.accessBoundary === 'institutional'
    || governance.accessBoundary === 'registration_required'
  ) {
    return 'GATED';
  }

  return 'PENDING';
}

export function resolveSourceCoverageState(input: {
  sourceId: string;
  checked?: boolean;
  fresh?: boolean;
  unavailable?: boolean;
  humanRequired?: boolean;
}): SourceCoverageState {
  if (input.humanRequired) {
    return 'HUMAN_REQUIRED';
  }
  if (input.unavailable) {
    return 'UNAVAILABLE';
  }
  if (input.checked && input.fresh !== false) {
    return 'CHECKED';
  }
  if (input.checked && input.fresh === false) {
    return 'PENDING';
  }

  return defaultCoverageStateForSource(input.sourceId);
}

function normalizeCoverage(input: TrustSourceCoverage): TrustSourceCoverage {
  return {
    ...input,
    state: input.state,
    reason: input.reason,
    checkedAt: input.checkedAt ?? null,
    artifactId: input.artifactId ?? null,
    sourceUrl: input.sourceUrl ?? null,
    rawArtifactRef: input.rawArtifactRef ?? input.artifactId ?? null,
    checksum: input.checksum ?? null,
  };
}

function hardBlockDimensions(
  dimensions: Record<TrustDimensionId, TrustDimensionAssessment>,
): ReadonlySet<TrustDimensionId> {
  const blocked = new Set<TrustDimensionId>();

  if (dimensions.identity.status !== 'MET') {
    blocked.add('identity');
  }
  if (dimensions.exclusion.status === 'BLOCKED') {
    blocked.add('exclusion');
  }
  if (dimensions.licensure.status === 'BLOCKED') {
    blocked.add('licensure');
  }

  return blocked;
}

function dimensionContribution(
  dimension: TrustDimensionAssessment,
  weight: number,
): number {
  if (dimension.status !== 'MET') {
    return 0;
  }

  return weight * clampConfidence(dimension.confidence);
}

export function computeDeterministicTrustReadiness(input: {
  identity: TrustDimensionAssessment;
  exclusion: TrustDimensionAssessment;
  licensure: TrustDimensionAssessment;
  enrollment: TrustDimensionAssessment;
}): DeterministicTrustReadiness {
  const dimensions: Record<TrustDimensionId, TrustDimensionAssessment> = {
    identity: input.identity,
    exclusion: input.exclusion,
    licensure: input.licensure,
    enrollment: input.enrollment,
  };

  const sourceCoverage = Object.values(dimensions)
    .flatMap((dimension) => dimension.sourceCoverage.map(normalizeCoverage))
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId));

  const blockers = Object.values(dimensions)
    .map((dimension) => dimension.blocker?.trim())
    .filter((value): value is string => Boolean(value));
  const gaps = Object.values(dimensions)
    .map((dimension) => dimension.gap?.trim())
    .filter((value): value is string => Boolean(value));

  const confidenceWeighting = {
    identity: clampConfidence(dimensions.identity.confidence),
    exclusion: clampConfidence(dimensions.exclusion.confidence),
    licensure: clampConfidence(dimensions.licensure.confidence),
    enrollment: clampConfidence(dimensions.enrollment.confidence),
  };

  const readinessScore = Math.round(
    dimensionContribution(dimensions.identity, DIMENSION_WEIGHTS.identity)
    + dimensionContribution(dimensions.exclusion, DIMENSION_WEIGHTS.exclusion)
    + dimensionContribution(dimensions.licensure, DIMENSION_WEIGHTS.licensure)
    + dimensionContribution(dimensions.enrollment, DIMENSION_WEIGHTS.enrollment),
  );

  const hardBlocks = hardBlockDimensions(dimensions);
  const reviewRequired = Object.values(dimensions).some((dimension) => dimension.status === 'REVIEW_REQUIRED');
  const unmet = Object.values(dimensions).some((dimension) => dimension.status === 'UNMET');

  const overallStatus: DeterministicTrustReadiness['overallStatus'] =
    hardBlocks.size > 0 || dimensions.enrollment.status === 'BLOCKED'
      ? 'BLOCKED'
      : reviewRequired
        ? 'PENDING_VERIFICATION'
        : unmet
          ? 'MISSING_CREDENTIALS'
          : 'CLEAR_TO_START';

  const missingBlockingDomains: string[] = [];
  if (dimensions.identity.status !== 'MET') {
    missingBlockingDomains.push('IDENTITY');
  }
  if (dimensions.licensure.status !== 'MET') {
    missingBlockingDomains.push('LICENSURE');
  }
  if (dimensions.exclusion.status !== 'MET') {
    missingBlockingDomains.push('EXCLUSION_CHECK');
  }

  const nextActions = buildReadinessNextActions({
    missingBlockingDomains,
    blockers,
    gaps,
  }).map((action) => action.title);

  return {
    overallStatus,
    readinessScore,
    readiness_score: readinessScore,
    blockers: Array.from(new Set(blockers)),
    gaps: Array.from(new Set(gaps)),
    nextActions,
    confidenceWeighting,
    sourceCoverage,
  };
}

export function deriveTrustBandFromReadiness(input: {
  readiness: DeterministicTrustReadiness;
  identityMet: boolean;
  reviewRequired: boolean;
}): 'L0' | 'L1' | 'L2' | 'L3' {
  if (!input.identityMet) {
    return 'L0';
  }
  if (input.readiness.blockers.some((blocker) => /excluded|license expired|discipline|revoked|suspended/i.test(blocker))) {
    return 'L0';
  }
  if (input.readiness.blockers.some((blocker) => /pecos|enrollment not found/i.test(blocker))) {
    return 'L1';
  }
  if (input.reviewRequired || input.readiness.overallStatus === 'PENDING_VERIFICATION') {
    return 'L1';
  }
  if (input.readiness.readinessScore >= 90 && input.readiness.overallStatus === 'CLEAR_TO_START') {
    return 'L3';
  }
  if (input.readiness.readinessScore >= 60) {
    return 'L2';
  }
  if (input.readiness.readinessScore >= 20) {
    return 'L1';
  }
  return 'L0';
}
