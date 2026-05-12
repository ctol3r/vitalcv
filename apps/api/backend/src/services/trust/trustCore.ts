import { buildReadinessNextActions } from '../entity/readinessActions';
import { SOURCE_GOVERNANCE } from '../identity/sourceGovernance';
import {
  coverageSatisfiesDecisionGradeTruth,
  createCanonicalSourceCoverage,
  deriveReadinessState,
  findPriorityCanonicalSourceCoverage,
  resolveCanonicalSourceCoverageState,
  type CanonicalSourceCoverage,
  type CanonicalSourceCoverageState,
  type ReadinessState,
} from '@vitalcv/trust-state';
import {
  derivePassportReadiness,
  deriveCanonicalTrustLevel,
  stringsToBlockers,
  categorizeBlocker,
  type CanonicalBlocker,
} from '../readiness/canonical';

export type SourceCoverageState = CanonicalSourceCoverageState;

export type TrustDimensionId =
  | 'identity'
  | 'exclusion'
  | 'licensure'
  | 'enrollment';

export type TrustSourceCoverage = CanonicalSourceCoverage;

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
  readinessState: ReadinessState;
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

const READINESS_GAP_SOURCE_PRIORITY: readonly SourceCoverageState[] = [
  'stale',
  'accessRequired',
  'gated',
  'notDecisionGrade',
  'unavailable',
  'previewOnly',
  'pending',
];

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

export function defaultCoverageStateForSource(sourceId: string): SourceCoverageState {
  const governance = SOURCE_GOVERNANCE[sourceId];
  if (!governance) {
    return 'notDecisionGrade';
  }
  if (governance.accessBoundary === 'human_lookup_only') {
    return 'accessRequired';
  }
  if (
    governance.accessBoundary === 'gated'
    || governance.accessBoundary === 'institutional'
    || governance.accessBoundary === 'registration_required'
  ) {
    return 'gated';
  }

  return 'pending';
}

export function resolveSourceCoverageState(input: {
  sourceId: string;
  checked?: boolean;
  fresh?: boolean;
  unavailable?: boolean;
  humanRequired?: boolean;
  gated?: boolean;
  reviewRequired?: boolean;
  notDecisionGrade?: boolean;
  pending?: boolean;
  partial?: boolean;
  accessRequired?: boolean;
  previewOnly?: boolean;
  /** Backward-compatible alias for preview-only/mock data. */
  mock?: boolean;
}): SourceCoverageState {
  const defaultState = defaultCoverageStateForSource(input.sourceId);
  const isUnsupported = !SOURCE_GOVERNANCE[input.sourceId] && input.sourceId !== 'UNKNOWN' && !input.sourceId.startsWith('MOCK_');

  return resolveCanonicalSourceCoverageState({
    checked: input.checked,
    fresh: input.fresh,
    unavailable: input.unavailable,
    gated: input.gated ?? (defaultState === 'gated' && !input.checked),
    accessRequired: input.accessRequired ?? (defaultState === 'accessRequired' && !input.checked),
    reviewRequired: input.reviewRequired ?? input.humanRequired,
    notDecisionGrade: input.notDecisionGrade || isUnsupported,
    pending: input.pending,
    partial: input.partial,
    previewOnly: input.previewOnly,
    mock: input.mock,
  });
}

function normalizeCoverage(input: TrustSourceCoverage): TrustSourceCoverage {
  return createCanonicalSourceCoverage({
    sourceId: input.sourceId,
    state: input.state,
    reason: input.reason,
    checkedAt: input.checkedAt ?? null,
    observedAt: input.observedAt ?? input.checkedAt ?? null,
    expiresAt: input.expiresAt ?? null,
    artifactId: input.artifactId ?? null,
    sourceUrl: input.sourceUrl ?? null,
    rawArtifactRef: input.rawArtifactRef ?? input.artifactId ?? null,
    checksum: input.checksum ?? null,
    parserVersion: input.parserVersion ?? null,
    freshnessWindowHours: input.freshnessWindowHours ?? null,
    proof: input.proof ?? null,
  });
}

function normalizeAssessmentForCoverage(
  dimension: TrustDimensionAssessment,
): TrustDimensionAssessment {
  const sourceCoverage = dimension.sourceCoverage.map(normalizeCoverage);
  const hasLiveCoverage = sourceCoverage.some(coverageSatisfiesDecisionGradeTruth);

  if (sourceCoverage.length === 0 || hasLiveCoverage) {
    return {
      ...dimension,
      sourceCoverage,
    };
  }

  const reviewCoverage = findPriorityCanonicalSourceCoverage(
    sourceCoverage,
    ['reviewRequired'],
  );
  if (reviewCoverage) {
    return {
      ...dimension,
      status: 'REVIEW_REQUIRED',
      confidence: Math.min(dimension.confidence, 0.55),
      blocker: dimension.blocker ?? reviewCoverage.reason,
      gap: dimension.gap ?? reviewCoverage.reason,
      sourceCoverage,
    };
  }

  const fallbackCoverage = findPriorityCanonicalSourceCoverage(
    sourceCoverage,
    READINESS_GAP_SOURCE_PRIORITY,
  );
  const fallbackGap = dimension.gap ?? fallbackCoverage?.reason ?? null;

  return {
    ...dimension,
    status: 'UNMET',
    confidence: Math.min(dimension.confidence, 0.25),
    blocker: null,
    gap: fallbackGap,
    sourceCoverage,
  };
}

function hardBlockDimensions(
  dimensions: Record<TrustDimensionId, TrustDimensionAssessment>,
): ReadonlySet<TrustDimensionId> {
  const blocked = new Set<TrustDimensionId>();

  if (dimensions.identity.status === 'BLOCKED') {
    blocked.add('identity');
  }
  if (dimensions.exclusion.status === 'BLOCKED') {
    blocked.add('exclusion');
  }
  if (dimensions.licensure.status === 'BLOCKED') {
    blocked.add('licensure');
  }
  if (dimensions.enrollment.status === 'BLOCKED') {
    blocked.add('enrollment');
  }

  return blocked;
}

/**
 * @deprecated Legacy weighted-confidence contribution. Score derivation now
 * runs through `derivePassportReadiness` in `../readiness/canonical`. Kept
 * only so external consumers that imported the symbol don't break at
 * compile time; the value is no longer summed into the readiness score.
 */
function dimensionContribution(
  dimension: TrustDimensionAssessment,
  weight: number,
): number {
  if (dimension.status !== 'MET') {
    return 0;
  }

  return weight * clampConfidence(dimension.confidence);
}
void dimensionContribution; // retained for type-export compatibility

export function computeDeterministicTrustReadiness(input: {
  identity: TrustDimensionAssessment;
  exclusion: TrustDimensionAssessment;
  licensure: TrustDimensionAssessment;
  enrollment: TrustDimensionAssessment;
}): DeterministicTrustReadiness {
  const dimensions: Record<TrustDimensionId, TrustDimensionAssessment> = {
    identity: normalizeAssessmentForCoverage(input.identity),
    exclusion: normalizeAssessmentForCoverage(input.exclusion),
    licensure: normalizeAssessmentForCoverage(input.licensure),
    enrollment: normalizeAssessmentForCoverage(input.enrollment),
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

  const hardBlocks = hardBlockDimensions(dimensions);
  const reviewRequired = Object.values(dimensions).some((dimension) => dimension.status === 'REVIEW_REQUIRED');
  const unmet = Object.values(dimensions).some((dimension) => dimension.status === 'UNMET');

  const readinessState = deriveReadinessState(sourceCoverage);

  // ── Canonical readiness derivation ──────────────────────────────────────
  // All score/level math runs through `derivePassportReadiness`. This
  // function no longer computes a weighted-confidence score independently;
  // the dimension confidence is preserved on `confidenceWeighting` for
  // informational use only.
  //
  // String blockers from dimensions are categorized into structured
  // CanonicalBlocker values via `stringsToBlockers`. A HARD-blocked
  // dimension (`status: 'BLOCKED'`) without a blocker message still needs
  // to force L0 — we synthesize a HARD blocker for that case so canonical
  // sees the severity.
  const dedupedBlockerStrings = Array.from(new Set(blockers));
  const canonicalBlockers: CanonicalBlocker[] = stringsToBlockers(dedupedBlockerStrings);
  if (hardBlocks.size > 0 && !canonicalBlockers.some((b) => b.severity === 'HARD')) {
    const synthesized = categorizeBlocker(`${Array.from(hardBlocks).join(', ').toUpperCase()} dimension blocked`);
    if (synthesized) {
      // Force HARD severity regardless of categorizer output.
      canonicalBlockers.push({ ...synthesized, severity: 'HARD' });
    }
  }

  const canonical = derivePassportReadiness({
    sourceCoverage,
    blockers: canonicalBlockers,
    gaps: Array.from(new Set(gaps)),
    readinessStatus: readinessState,
  });
  const readinessScore = canonical.score;

  // overallStatus retains its legacy semantics (BLOCKED / PENDING / MISSING
  // / CLEAR_TO_START) for downstream consumers — these enum values do not
  // appear on the public passport response and are stable surface area.
  const overallStatus: DeterministicTrustReadiness['overallStatus'] =
    hardBlocks.size > 0
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
    readinessState,
    readinessScore,
    readiness_score: readinessScore,
    blockers: dedupedBlockerStrings,
    gaps: Array.from(new Set(gaps)),
    nextActions,
    confidenceWeighting,
    sourceCoverage,
  };
}

/**
 * Trust-band derivation routes through canonical level logic.
 *
 * Behavior:
 *  - `identityMet=false` is an independent hard pre-check; if identity
 *    isn't met we return L0 regardless of score/blockers. This preserves
 *    the legacy invariant that an unverified identity can never produce
 *    a non-L0 band.
 *  - All blocker → level logic flows through `deriveCanonicalTrustLevel`
 *    in `../readiness/canonical`. The regex authority that previously
 *    lived here has moved to `categorizeBlocker`, where it produces
 *    structured (category, severity) values that the canonical engine
 *    consumes. Hard-licensure / OIG matches become HARD severity → L0;
 *    PECOS / enrollment matches become SOFT severity → score-capped → L1.
 *  - `reviewRequired` or `overallStatus === 'PENDING_VERIFICATION'`
 *    promotes to at least L1 (preserves legacy behavior where a clinician
 *    in review never appears as L0 when there are no blockers).
 */
export function deriveTrustBandFromReadiness(input: {
  readiness: DeterministicTrustReadiness;
  identityMet: boolean;
  reviewRequired: boolean;
}): 'L0' | 'L1' | 'L2' | 'L3' {
  if (!input.identityMet) {
    return 'L0';
  }

  const canonicalBlockers = stringsToBlockers(input.readiness.blockers);
  const canonicalLevel = deriveCanonicalTrustLevel({
    score: input.readiness.readinessScore,
    status: input.readiness.readinessState,
    blockers: canonicalBlockers,
  });

  // PENDING_VERIFICATION / reviewRequired floor at L1 — overrides L0 from
  // a zero score when the clinician is actively in review.
  if (
    canonicalLevel === 'L0'
    && (input.reviewRequired || input.readiness.overallStatus === 'PENDING_VERIFICATION')
    && !canonicalBlockers.some((b) => b.severity === 'HARD')
  ) {
    return 'L1';
  }

  return canonicalLevel;
}
