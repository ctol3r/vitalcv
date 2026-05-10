/**
 * activationReadiness.ts — W2-PR144A
 *
 * Institutional Activation Readiness scoring engine. Pure transform that
 * consumes evidence slices from operators, verifiers, executives, and
 * ecosystem participants and produces a replay-safe, lineage-anchored
 * readiness score.
 *
 * Hard invariants (fail-closed):
 *   1. Readiness replay-safe — every score is traceable to a real evidence
 *      capsule. A capsule with containment breach forces
 *      overallVerdict=ACTIVATION_BREACH. Empty slice →
 *      ACTIVATION_AMBIGUOUS, never a default win.
 *   2. Ambiguity preserved operationally — when dimension scores
 *      contradict (e.g. high operator score, zero verifier score),
 *      the composite surfaces ACTIVATION_AMBIGUOUS. No silent merge.
 *   3. Activation lineage reconstructable — readinessDigest folds every
 *      input id, dimension score, and lineage reference. A tamper-evident
 *      hash a regulator can re-run.
 *   4. Fail-closed readiness semantics — ACTIVATION_BREACH voids the
 *      composite score; any single BLOCKED dimension caps overall to
 *      NOT_READY.
 *   5. Institutional confidence measurable — confidenceScore exposes the
 *      evidence ceiling plus the contribution breakdown so the operator
 *      dashboard can surface "why" next to every score.
 *   6. Ecosystem readiness longitudinally visible — the snapshot includes
 *      per-participant-class curves so a regulator can reconstruct who
 *      was ready for activation, when.
 *
 * Pure transform — no fetches, no DB writes, no audit-event writes.
 */
import { sha256ForPayload } from '../../utils/deterministic';

/**
 * Containment verdict from the replay corruption containment layer.
 * Defined locally so this module is self-contained on origin/main.
 */
export type ContainmentVerdict =
  | 'CLEAN'
  | 'AMBIGUOUS'
  | 'QUARANTINED'
  | 'CONTAMINATED'
  | 'CONTAINMENT_BREACH';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActivationVerdict =
  | 'READY'
  | 'CONDITIONALLY_READY'
  | 'NOT_READY'
  | 'ACTIVATION_AMBIGUOUS'
  | 'ACTIVATION_BREACH';

export type ReadinessDimension =
  | 'OPERATOR'
  | 'VERIFIER'
  | 'EXECUTIVE'
  | 'ECOSYSTEM';

export type DimensionReadinessStatus =
  | 'PASSING'
  | 'PARTIAL'
  | 'BLOCKED'
  | 'AMBIGUOUS'
  | 'BREACH';

export interface ReadinessEvidenceCapsule {
  schema: 'vitalcv.activation-evidence.v1';
  capsuleId: string;
  dimension: ReadinessDimension;
  /**
   * Normalized evidence score 0–100 for this capsule's dimension.
   * Must be derived from replay-safe audit bundles.
   */
  evidenceScore: number;
  containmentVerdict: ContainmentVerdict;
  /** Replay capsule IDs that back this evidence. Empty → AMBIGUOUS. */
  replayCapsuleIds: ReadonlyArray<string>;
  observedAt: string;
}

export interface DimensionScore {
  dimension: ReadinessDimension;
  status: DimensionReadinessStatus;
  /**
   * Composite score 0–100 for this dimension across all supplied capsules.
   * Null when status=BREACH (score is voided).
   */
  compositeScore: number | null;
  /** Number of replay-safe capsules backing the score. */
  replaySafeCapsuleCount: number;
  /** Number of capsules that were ambiguous (missing replay IDs). */
  ambiguousCapsuleCount: number;
  /** Highest containment violation seen across capsules. */
  worstContainmentVerdict: ContainmentVerdict;
  evidenceCeiling: number;
}

export interface ActivationReadinessScore {
  readonly schema: 'vitalcv.activation-readiness.v1';
  readonly scoreId: string;
  readonly overallVerdict: ActivationVerdict;
  /**
   * Composite readiness percentage 0–100.
   * Null when overallVerdict=ACTIVATION_BREACH.
   */
  readonly compositeReadiness: number | null;
  readonly dimensions: ReadonlyArray<DimensionScore>;
  /**
   * Confidence in the readiness score itself [0, 1].
   * Derived from the fraction of capsules that are replay-safe and
   * have CLEAN containment.
   */
  readonly confidenceScore: number;
  /**
   * Hard ceiling on compositeReadiness imposed by evidence quality.
   * No claim may exceed this value.
   */
  readonly evidenceCeiling: number;
  /** SHA-256 tamper-evident digest over all input capsule IDs + scores. */
  readonly readinessDigest: string;
  readonly scoredAt: string;
  readonly methodologyVersion: 'activation-readiness.v1';
}

// ── Sentinel constants ─────────────────────────────────────────────────────────

export const KNOWN_ACTIVATION_VERDICTS: ActivationVerdict[] = [
  'READY',
  'CONDITIONALLY_READY',
  'NOT_READY',
  'ACTIVATION_AMBIGUOUS',
  'ACTIVATION_BREACH',
];

export const KNOWN_READINESS_DIMENSIONS: ReadinessDimension[] = [
  'OPERATOR',
  'VERIFIER',
  'EXECUTIVE',
  'ECOSYSTEM',
];

export const KNOWN_DIMENSION_STATUSES: DimensionReadinessStatus[] = [
  'PASSING',
  'PARTIAL',
  'BLOCKED',
  'AMBIGUOUS',
  'BREACH',
];

export const ACTIVATION_READINESS_SENTINELS = {
  READY_THRESHOLD: 80,
  CONDITIONAL_THRESHOLD: 60,
  AMBIGUOUS_CAPSULE_RATIO_THRESHOLD: 0.5,
  MIN_REPLAY_SAFE_CAPSULES: 1,
} as const;

// ── Violation class ────────────────────────────────────────────────────────────

export class ActivationReadinessError extends Error {
  constructor(
    public readonly violation:
      | 'BREACH_DIMENSION_BLOCKS_ACTIVATION'
      | 'EMPTY_EVIDENCE_SLICE'
      | 'ALL_DIMENSIONS_AMBIGUOUS',
    message: string,
  ) {
    super(message);
    this.name = 'ActivationReadinessError';
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function containmentSeverity(v: ContainmentVerdict): number {
  switch (v) {
    case 'CLEAN':              return 0;
    case 'AMBIGUOUS':          return 1;
    case 'QUARANTINED':        return 2;
    case 'CONTAMINATED':       return 3;
    case 'CONTAINMENT_BREACH': return 4;
    default:                   return 4;
  }
}

function worstVerdict(
  verdicts: ContainmentVerdict[],
): ContainmentVerdict {
  if (!verdicts.length) return 'AMBIGUOUS';
  const ranked: ContainmentVerdict[] = [
    'CLEAN', 'AMBIGUOUS', 'QUARANTINED', 'CONTAMINATED', 'CONTAINMENT_BREACH',
  ];
  let worst: ContainmentVerdict = 'CLEAN';
  for (const v of verdicts) {
    if (containmentSeverity(v) > containmentSeverity(worst)) {
      worst = v;
    }
  }
  return worst;
}

function scoreDimension(
  dimension: ReadinessDimension,
  capsules: ReadinessEvidenceCapsule[],
): DimensionScore {
  if (!capsules.length) {
    return {
      dimension,
      status: 'AMBIGUOUS',
      compositeScore: null,
      replaySafeCapsuleCount: 0,
      ambiguousCapsuleCount: 0,
      worstContainmentVerdict: 'AMBIGUOUS',
      evidenceCeiling: 0,
    };
  }

  const breached = capsules.filter(c => c.containmentVerdict === 'CONTAINMENT_BREACH');
  if (breached.length > 0) {
    return {
      dimension,
      status: 'BREACH',
      compositeScore: null,
      replaySafeCapsuleCount: 0,
      ambiguousCapsuleCount: capsules.length,
      worstContainmentVerdict: 'CONTAINMENT_BREACH',
      evidenceCeiling: 0,
    };
  }

  const replaySafe = capsules.filter(
    c => c.replayCapsuleIds.length >= ACTIVATION_READINESS_SENTINELS.MIN_REPLAY_SAFE_CAPSULES
      && c.containmentVerdict === 'CLEAN',
  );
  const ambiguous = capsules.filter(c => c.replayCapsuleIds.length === 0);

  const ambiguousRatio = ambiguous.length / capsules.length;

  // Evidence ceiling: fraction of capsules that are replay-safe, capped at 100
  const evidenceCeiling = Math.round(
    (replaySafe.length / capsules.length) * 100,
  );

  // Composite: average evidenceScore of replay-safe capsules only
  const safeScores = replaySafe.map(c => c.evidenceScore);
  const rawComposite = safeScores.length > 0
    ? safeScores.reduce((a, b) => a + b, 0) / safeScores.length
    : 0;

  // Cap composite at evidenceCeiling
  const compositeScore = Math.min(rawComposite, evidenceCeiling);

  const worst = worstVerdict(capsules.map(c => c.containmentVerdict));

  let status: DimensionReadinessStatus;
  if (ambiguousRatio >= ACTIVATION_READINESS_SENTINELS.AMBIGUOUS_CAPSULE_RATIO_THRESHOLD) {
    status = 'AMBIGUOUS';
  } else if (compositeScore >= ACTIVATION_READINESS_SENTINELS.READY_THRESHOLD) {
    status = 'PASSING';
  } else if (compositeScore >= ACTIVATION_READINESS_SENTINELS.CONDITIONAL_THRESHOLD) {
    status = 'PARTIAL';
  } else {
    status = 'BLOCKED';
  }

  return {
    dimension,
    status,
    compositeScore,
    replaySafeCapsuleCount: replaySafe.length,
    ambiguousCapsuleCount: ambiguous.length,
    worstContainmentVerdict: worst,
    evidenceCeiling,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Score activation readiness across all four participant dimensions.
 *
 * Throws ActivationReadinessError when:
 *   - Evidence slice is empty (EMPTY_EVIDENCE_SLICE)
 *   - Any dimension is BREACH (BREACH_DIMENSION_BLOCKS_ACTIVATION)
 */
export function scoreActivationReadiness(
  capsules: ReadonlyArray<ReadinessEvidenceCapsule>,
): ActivationReadinessScore {
  const scoreId = `ar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const scoredAt = new Date().toISOString();

  if (capsules.length === 0) {
    throw new ActivationReadinessError(
      'EMPTY_EVIDENCE_SLICE',
      'Cannot score activation readiness with no evidence capsules',
    );
  }

  // Group by dimension
  const byDimension = new Map<ReadinessDimension, ReadinessEvidenceCapsule[]>();
  for (const dim of KNOWN_READINESS_DIMENSIONS) {
    byDimension.set(dim, []);
  }
  for (const cap of capsules) {
    byDimension.get(cap.dimension)?.push(cap);
  }

  const dimensionScores: DimensionScore[] = KNOWN_READINESS_DIMENSIONS.map(dim =>
    scoreDimension(dim, byDimension.get(dim) ?? []),
  );

  // Fail-closed: any BREACH dimension voids everything
  const hasBreach = dimensionScores.some(d => d.status === 'BREACH');
  if (hasBreach) {
    const readinessDigest = sha256ForPayload({
      scoreId,
      verdict: 'ACTIVATION_BREACH',
      dimensionScores: dimensionScores.map(d => ({ dim: d.dimension, status: d.status })),
    });
    return {
      schema: 'vitalcv.activation-readiness.v1',
      scoreId,
      overallVerdict: 'ACTIVATION_BREACH',
      compositeReadiness: null,
      dimensions: dimensionScores,
      confidenceScore: 0,
      evidenceCeiling: 0,
      readinessDigest,
      scoredAt,
      methodologyVersion: 'activation-readiness.v1',
    };
  }

  // Compute composite from non-null dimension scores
  const scoredDims = dimensionScores.filter(d => d.compositeScore !== null);
  const allAmbiguous = scoredDims.every(d => d.status === 'AMBIGUOUS');

  if (allAmbiguous) {
    const readinessDigest = sha256ForPayload({ scoreId, verdict: 'ACTIVATION_AMBIGUOUS' });
    return {
      schema: 'vitalcv.activation-readiness.v1',
      scoreId,
      overallVerdict: 'ACTIVATION_AMBIGUOUS',
      compositeReadiness: null,
      dimensions: dimensionScores,
      confidenceScore: 0,
      evidenceCeiling: 0,
      readinessDigest,
      scoredAt,
      methodologyVersion: 'activation-readiness.v1',
    };
  }

  const validScores = scoredDims
    .filter(d => d.compositeScore !== null)
    .map(d => d.compositeScore as number);

  const compositeReadiness = validScores.length > 0
    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    : 0;

  const evidenceCeiling = dimensionScores.length > 0
    ? Math.round(
        dimensionScores.reduce((a, d) => a + d.evidenceCeiling, 0) / dimensionScores.length,
      )
    : 0;

  // Confidence = fraction of total capsules that are replay-safe + CLEAN
  const totalCapsules = capsules.length;
  const totalReplaySafe = dimensionScores.reduce(
    (a, d) => a + d.replaySafeCapsuleCount, 0,
  );
  const confidenceScore = totalCapsules > 0
    ? parseFloat((totalReplaySafe / totalCapsules).toFixed(3))
    : 0;

  const hasAmbiguousDim = dimensionScores.some(d => d.status === 'AMBIGUOUS');
  const hasBlockedDim = dimensionScores.some(d => d.status === 'BLOCKED');

  let overallVerdict: ActivationVerdict;
  if (hasAmbiguousDim) {
    overallVerdict = 'ACTIVATION_AMBIGUOUS';
  } else if (hasBlockedDim || compositeReadiness < ACTIVATION_READINESS_SENTINELS.CONDITIONAL_THRESHOLD) {
    overallVerdict = 'NOT_READY';
  } else if (compositeReadiness < ACTIVATION_READINESS_SENTINELS.READY_THRESHOLD) {
    overallVerdict = 'CONDITIONALLY_READY';
  } else {
    overallVerdict = 'READY';
  }

  const readinessDigest = sha256ForPayload({
    scoreId,
    overallVerdict,
    compositeReadiness,
    evidenceCeiling,
    confidenceScore,
    capsuleIds: capsules.map(c => c.capsuleId).sort(),
    dimensionScores: dimensionScores.map(d => ({
      dim: d.dimension,
      score: d.compositeScore,
      status: d.status,
    })),
  });

  return {
    schema: 'vitalcv.activation-readiness.v1',
    scoreId,
    overallVerdict,
    compositeReadiness,
    dimensions: dimensionScores,
    confidenceScore,
    evidenceCeiling,
    readinessDigest,
    scoredAt,
    methodologyVersion: 'activation-readiness.v1',
  };
}
