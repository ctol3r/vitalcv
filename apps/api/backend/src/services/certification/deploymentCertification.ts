/**
 * deploymentCertification.ts — W2-PR104A: Institutional Deployment Certification
 *
 * Pure-transform synthesis layer that converts evidence from the existing
 * certification primitives into a single institutional deployment
 * certification verdict, with longitudinal drift tracking and a
 * deterministic, tamper-evident certification id.
 *
 * Sits on top of (does not replace) the upstream evidence sources:
 *   - scripts/deploy/lineage.mjs              — deployment manifest lineage
 *   - scripts/deploy/replay-manifest.mjs      — manifest replay drift code
 *   - scripts/deploy/chaos.mjs                — deploy-layer chaos modes
 *   - replayCorruptionContainment.ts          — replay corruption boundary
 *   - rolloutSurvivability.ts                 — institutional rollout boundary
 *
 * Hard invariants (fail-closed):
 *   - A dimension with no evidence is AMBIGUOUS, never silently GRANTED.
 *     The silent-collapse anti-pattern is the primary thing this module
 *     defends against — a deployment that produced no evidence MUST be
 *     visible as "evidence-missing", not coerced to a clean cert.
 *   - A dimension whose floor is breached forces the verdict to CERT_DENIED.
 *     One breach is enough; we do not average a breach away.
 *   - The certificationId is sha256 over the canonical (sorted) shape of
 *     evidence + dimension verdicts. Re-emitting on the same evidence yields
 *     the same id; tampering with any field changes it.
 *   - Lineage drift is reconstructable: every certification carries the
 *     deployment manifest id and the previous certification id (when known)
 *     so an auditor can walk the chain.
 *   - Drift tracking is order-independent on certificationId and produces a
 *     deterministic driftDigest.
 *
 * No fetches, no DB writes, no audit-event writes. Callers (CI gate,
 * dashboards) feed evidence in and get a certification record out.
 */

import { sha256ForPayload } from '../../utils/deterministic';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CertificationDimension =
  | 'LINEAGE_INTEGRITY'        // manifest replays clean (or SHA-only drift)
  | 'REPLAY_FIDELITY'          // replay corruption boundary intact
  | 'CHAOS_CONTAINMENT'        // deploy chaos modes all fail-closed
  | 'ROLLOUT_SURVIVABILITY'    // institutional rollout boundary partitioned
  | 'CONFIG_DETERMINISM';      // config hash deterministic across runs

export type CertificationVerdict =
  | 'CERT_GRANTED'             // every dim passes its floor
  | 'CERT_PROVISIONAL'         // every dim passes, but at least one is ambiguous
  | 'CERT_AMBIGUOUS'           // missing evidence dominates — cannot decide
  | 'CERT_DENIED';             // at least one dim breached its floor

export type CertificationViolationKind =
  | 'AMBIGUOUS_FORCED_GRANTED'
  | 'DIMENSION_BREACH'
  | 'CERTIFICATION_FLOOR_BREACHED'
  | 'EVIDENCE_OPEN_FAILURE';

export type CertificationDrift = 'STABLE' | 'GAIN' | 'LOSS' | 'UNKNOWN';

export class DeploymentCertificationError extends Error {
  readonly code = 'DEPLOYMENT_CERTIFICATION_VIOLATION' as const;
  readonly violation: CertificationViolationKind;
  readonly dimension: CertificationDimension | null;
  readonly score: number | null;

  constructor(args: {
    violation: CertificationViolationKind;
    message: string;
    dimension?: CertificationDimension | null;
    score?: number | null;
  }) {
    super(args.message);
    this.name = 'DeploymentCertificationError';
    this.violation = args.violation;
    this.dimension = args.dimension ?? null;
    this.score = args.score ?? null;
  }
}

/** Disjoint, named drift codes emitted by replay-manifest.mjs. */
export type LineageDriftCode =
  | 'DRIFT-CODE-CLEAN'
  | 'DRIFT-CODE-SHA'
  | 'DRIFT-CODE-CONFIG'
  | 'DRIFT-CODE-LOCK'
  | 'DRIFT-CODE-ORPHAN'
  | 'DRIFT-CODE-TAMPER';

/**
 * Evidence inputs the synthesizer consumes. Every field is nullable: a
 * `null` is the operator-visible signal that "this layer produced no
 * evidence" — preserved as AMBIGUOUS, never coerced to clean.
 */
export interface CertificationEvidence {
  /** Manifest id from the latest deployment lineage emit. */
  deploymentManifestId: string | null;

  /** Replay drift code reported by scripts/deploy/replay-manifest.mjs. */
  lineageDriftCode: LineageDriftCode | null;

  /** True iff config-hash run1 === run2 on the same source tree. */
  configHashDeterministic: boolean | null;

  /** Number of deploy-chaos modes that fail-closed as required. */
  chaosModesPassed: number | null;
  /** Number of deploy-chaos modes attempted. */
  chaosModesTotal: number | null;
  /** Fingerprint over the chaos verdicts (already produced by chaos.mjs). */
  chaosFingerprint: string | null;

  /** Replay corruption boundary's `partitioned` flag. */
  replayBoundaryPartitioned: boolean | null;
  /** Replay corruption boundary's `partialSurvivabilityPct` (0..100). */
  replayPartialSurvivabilityPct: number | null;

  /** Rollout boundary's `partitioned` flag. */
  rolloutBoundaryPartitioned: boolean | null;
  /** Rollout boundary's `partialAdoptionResiliencePct` (0..100). */
  rolloutPartialAdoptionResiliencePct: number | null;
}

export interface CertificationFloors {
  /** Min replay survivability % (default 80). */
  minReplayPartialSurvivabilityPct?: number;
  /** Min rollout adoption resilience % (default 60 — matches rollout default). */
  minRolloutPartialAdoptionResiliencePct?: number;
  /** Min chaos pass-rate fraction (default 1.0 — must all pass). */
  minChaosPassFraction?: number;
  /** Min weighted certification score (0..1; default 0.8). */
  minCertificationScore?: number;
}

export interface CertificationDimensionResult {
  dimension: CertificationDimension;
  passed: boolean;
  score: number;            // 0..1
  ambiguous: boolean;       // evidence missing or contradictory
  reason: string;
  evidenceFingerprint: string;
}

export interface CertificationLineage {
  deploymentManifestId: string | null;
  previousCertificationId: string | null;
  /** current.score - previous.score; null when previous is absent. */
  deltaScore: number | null;
  drift: CertificationDrift;
}

export interface CertificationAmbiguity {
  /** Dimensions whose evidence inputs were null. */
  missingEvidence: CertificationDimension[];
  /** Dimensions whose verdict is ambiguous (evidence present but contradictory). */
  unresolvedDimensions: CertificationDimension[];
}

export interface DeploymentCertification {
  schema: 'vitalcv.deployment-certification.v1';
  certificationId: string;
  verdict: CertificationVerdict;
  certifiedAt: string;
  evidenceFingerprint: string;
  dimensions: CertificationDimensionResult[];
  /** Weighted across passed dims, 0..1. */
  score: number;
  ambiguity: CertificationAmbiguity;
  lineage: CertificationLineage;
  reason: string;
}

export interface CertificationDriftReport {
  schema: 'vitalcv.deployment-certification-drift.v1';
  certifications: ReadonlyArray<{
    certificationId: string;
    certifiedAt: string;
    verdict: CertificationVerdict;
    score: number;
  }>;
  /** Last.score - first.score, when ≥ 2 certifications. */
  longitudinalDelta: number | null;
  /** Drift over the whole window. */
  drift: CertificationDrift;
  /** Per-dimension drift across the window's first → last delta. */
  perDimensionDrift: Array<{
    dimension: CertificationDimension;
    firstScore: number;
    lastScore: number;
    delta: number;
    drift: CertificationDrift;
  }>;
  driftDigest: string;
  reconstructedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SCHEMA_CERT  = 'vitalcv.deployment-certification.v1' as const;
const SCHEMA_DRIFT = 'vitalcv.deployment-certification-drift.v1' as const;

const DEFAULT_MIN_REPLAY_PARTIAL_SURVIVABILITY_PCT = 80;
const DEFAULT_MIN_ROLLOUT_PARTIAL_ADOPTION_RESILIENCE_PCT = 60;
const DEFAULT_MIN_CHAOS_PASS_FRACTION = 1.0;
const DEFAULT_MIN_CERTIFICATION_SCORE = 0.8;

/** Stable per-dimension weights. Sum to 1.0. */
const DIMENSION_WEIGHTS: Record<CertificationDimension, number> = Object.freeze({
  LINEAGE_INTEGRITY:     0.25,
  REPLAY_FIDELITY:       0.25,
  CHAOS_CONTAINMENT:     0.20,
  ROLLOUT_SURVIVABILITY: 0.20,
  CONFIG_DETERMINISM:    0.10,
}) as Record<CertificationDimension, number>;

function clampUnit(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function pctToUnit(pct: number): number {
  return clampUnit(pct / 100);
}

function evidenceFingerprint(scope: string, payload: unknown): string {
  return sha256ForPayload({ scope, payload });
}

// ── Per-dimension evaluators ──────────────────────────────────────────────────

function evaluateLineageIntegrity(
  e: CertificationEvidence,
): CertificationDimensionResult {
  const fp = evidenceFingerprint('LINEAGE_INTEGRITY', {
    deploymentManifestId: e.deploymentManifestId,
    lineageDriftCode: e.lineageDriftCode,
  });
  if (e.lineageDriftCode === null || e.deploymentManifestId === null) {
    return {
      dimension: 'LINEAGE_INTEGRITY',
      passed: false,
      score: 0,
      ambiguous: true,
      reason: 'No deployment manifest replay verdict supplied — lineage integrity cannot be certified.',
      evidenceFingerprint: fp,
    };
  }
  const cleanCodes: LineageDriftCode[] = ['DRIFT-CODE-CLEAN', 'DRIFT-CODE-SHA'];
  const passed = cleanCodes.includes(e.lineageDriftCode);
  return {
    dimension: 'LINEAGE_INTEGRITY',
    passed,
    score: passed ? 1 : 0,
    ambiguous: false,
    reason: passed
      ? `Manifest ${e.deploymentManifestId.slice(0, 12)}… replay verdict ${e.lineageDriftCode} — manifest matches current source.`
      : `Manifest ${e.deploymentManifestId.slice(0, 12)}… replay verdict ${e.lineageDriftCode} — lineage cannot certify deployment.`,
    evidenceFingerprint: fp,
  };
}

function evaluateReplayFidelity(
  e: CertificationEvidence,
  floor: number,
): CertificationDimensionResult {
  const fp = evidenceFingerprint('REPLAY_FIDELITY', {
    replayBoundaryPartitioned: e.replayBoundaryPartitioned,
    replayPartialSurvivabilityPct: e.replayPartialSurvivabilityPct,
  });
  if (
    e.replayBoundaryPartitioned === null ||
    e.replayPartialSurvivabilityPct === null
  ) {
    return {
      dimension: 'REPLAY_FIDELITY',
      passed: false,
      score: 0,
      ambiguous: true,
      reason: 'No replay corruption boundary supplied — replay fidelity cannot be certified.',
      evidenceFingerprint: fp,
    };
  }
  const pct = e.replayPartialSurvivabilityPct;
  const passed = e.replayBoundaryPartitioned && pct >= floor;
  return {
    dimension: 'REPLAY_FIDELITY',
    passed,
    score: clampUnit(pctToUnit(pct)),
    ambiguous: false,
    reason: passed
      ? `Replay boundary partitioned at ${pct.toFixed(2)}% partial-survivability (floor ${floor}%).`
      : `Replay boundary breach: partitioned=${e.replayBoundaryPartitioned}, survivability=${pct.toFixed(2)}% (floor ${floor}%).`,
    evidenceFingerprint: fp,
  };
}

function evaluateChaosContainment(
  e: CertificationEvidence,
  minPassFraction: number,
): CertificationDimensionResult {
  const fp = evidenceFingerprint('CHAOS_CONTAINMENT', {
    chaosModesPassed: e.chaosModesPassed,
    chaosModesTotal: e.chaosModesTotal,
    chaosFingerprint: e.chaosFingerprint,
  });
  if (
    e.chaosModesPassed === null ||
    e.chaosModesTotal === null ||
    e.chaosFingerprint === null
  ) {
    return {
      dimension: 'CHAOS_CONTAINMENT',
      passed: false,
      score: 0,
      ambiguous: true,
      reason: 'No chaos verdicts supplied — chaos containment cannot be certified.',
      evidenceFingerprint: fp,
    };
  }
  if (e.chaosModesTotal <= 0) {
    return {
      dimension: 'CHAOS_CONTAINMENT',
      passed: false,
      score: 0,
      ambiguous: true,
      reason: 'Chaos run reported zero modes — cannot establish containment.',
      evidenceFingerprint: fp,
    };
  }
  const fraction = clampUnit(e.chaosModesPassed / e.chaosModesTotal);
  const passed = fraction >= minPassFraction;
  return {
    dimension: 'CHAOS_CONTAINMENT',
    passed,
    score: fraction,
    ambiguous: false,
    reason: passed
      ? `Chaos modes ${e.chaosModesPassed}/${e.chaosModesTotal} fail-closed; fingerprint=${e.chaosFingerprint.slice(0, 12)}…`
      : `Chaos pass-rate ${(fraction * 100).toFixed(2)}% below floor ${(minPassFraction * 100).toFixed(2)}% — at least one mode did not fail closed.`,
    evidenceFingerprint: fp,
  };
}

function evaluateRolloutSurvivability(
  e: CertificationEvidence,
  floor: number,
): CertificationDimensionResult {
  const fp = evidenceFingerprint('ROLLOUT_SURVIVABILITY', {
    rolloutBoundaryPartitioned: e.rolloutBoundaryPartitioned,
    rolloutPartialAdoptionResiliencePct: e.rolloutPartialAdoptionResiliencePct,
  });
  if (
    e.rolloutBoundaryPartitioned === null ||
    e.rolloutPartialAdoptionResiliencePct === null
  ) {
    return {
      dimension: 'ROLLOUT_SURVIVABILITY',
      passed: false,
      score: 0,
      ambiguous: true,
      reason: 'No rollout boundary supplied — institutional survivability cannot be certified.',
      evidenceFingerprint: fp,
    };
  }
  const pct = e.rolloutPartialAdoptionResiliencePct;
  const passed = e.rolloutBoundaryPartitioned && pct >= floor;
  return {
    dimension: 'ROLLOUT_SURVIVABILITY',
    passed,
    score: clampUnit(pctToUnit(pct)),
    ambiguous: false,
    reason: passed
      ? `Rollout boundary partitioned at ${pct.toFixed(2)}% partial-adoption resilience (floor ${floor}%).`
      : `Rollout boundary breach: partitioned=${e.rolloutBoundaryPartitioned}, resilience=${pct.toFixed(2)}% (floor ${floor}%).`,
    evidenceFingerprint: fp,
  };
}

function evaluateConfigDeterminism(
  e: CertificationEvidence,
): CertificationDimensionResult {
  const fp = evidenceFingerprint('CONFIG_DETERMINISM', {
    configHashDeterministic: e.configHashDeterministic,
  });
  if (e.configHashDeterministic === null) {
    return {
      dimension: 'CONFIG_DETERMINISM',
      passed: false,
      score: 0,
      ambiguous: true,
      reason: 'No determinism check supplied — config-hash reproducibility cannot be certified.',
      evidenceFingerprint: fp,
    };
  }
  return {
    dimension: 'CONFIG_DETERMINISM',
    passed: e.configHashDeterministic === true,
    score: e.configHashDeterministic === true ? 1 : 0,
    ambiguous: false,
    reason: e.configHashDeterministic === true
      ? 'Config hash deterministic across two consecutive runs on the same source.'
      : 'Config hash NON-DETERMINISTIC across two consecutive runs — certification denied.',
    evidenceFingerprint: fp,
  };
}

// ── Certification digest ──────────────────────────────────────────────────────

export function certificationDigest(input: {
  evidence: CertificationEvidence;
  dimensions: ReadonlyArray<CertificationDimensionResult>;
}): string {
  return sha256ForPayload({
    schema: 'vitalcv.deployment-certification-id.v1',
    evidence: {
      deploymentManifestId: input.evidence.deploymentManifestId,
      lineageDriftCode: input.evidence.lineageDriftCode,
      configHashDeterministic: input.evidence.configHashDeterministic,
      chaosModesPassed: input.evidence.chaosModesPassed,
      chaosModesTotal: input.evidence.chaosModesTotal,
      chaosFingerprint: input.evidence.chaosFingerprint,
      replayBoundaryPartitioned: input.evidence.replayBoundaryPartitioned,
      replayPartialSurvivabilityPct: input.evidence.replayPartialSurvivabilityPct,
      rolloutBoundaryPartitioned: input.evidence.rolloutBoundaryPartitioned,
      rolloutPartialAdoptionResiliencePct:
        input.evidence.rolloutPartialAdoptionResiliencePct,
    },
    dimensions: input.dimensions
      .slice()
      .sort((a, b) => a.dimension.localeCompare(b.dimension))
      .map((d) => ({
        dimension: d.dimension,
        passed: d.passed,
        score: d.score,
        ambiguous: d.ambiguous,
      })),
  });
}

// ── Synthesizer ───────────────────────────────────────────────────────────────

/**
 * Synthesize the certification verdict. Pure — never throws.
 *
 * Order of decisions (highest priority first):
 *   1. If any dimension breached its non-ambiguous floor → CERT_DENIED.
 *   2. Else if any dimension is ambiguous → CERT_AMBIGUOUS or CERT_PROVISIONAL,
 *      depending on whether all evidence-present dims passed.
 *   3. Else if score >= floor → CERT_GRANTED.
 *   4. Else → CERT_DENIED (score floor breach).
 */
export function certifyDeployment(input: {
  evidence: CertificationEvidence;
  floors?: CertificationFloors;
  previousCertificationId?: string | null;
  previousScore?: number | null;
  certifiedAt?: string;
}): DeploymentCertification {
  const floors = input.floors ?? {};
  const minReplay =
    floors.minReplayPartialSurvivabilityPct ??
    DEFAULT_MIN_REPLAY_PARTIAL_SURVIVABILITY_PCT;
  const minRollout =
    floors.minRolloutPartialAdoptionResiliencePct ??
    DEFAULT_MIN_ROLLOUT_PARTIAL_ADOPTION_RESILIENCE_PCT;
  const minChaos =
    floors.minChaosPassFraction ?? DEFAULT_MIN_CHAOS_PASS_FRACTION;
  const minScore =
    floors.minCertificationScore ?? DEFAULT_MIN_CERTIFICATION_SCORE;

  const dimensions: CertificationDimensionResult[] = [
    evaluateLineageIntegrity(input.evidence),
    evaluateReplayFidelity(input.evidence, minReplay),
    evaluateChaosContainment(input.evidence, minChaos),
    evaluateRolloutSurvivability(input.evidence, minRollout),
    evaluateConfigDeterminism(input.evidence),
  ];

  const missingEvidence = dimensions
    .filter((d) => d.ambiguous)
    .map((d) => d.dimension);
  const unresolvedDimensions = missingEvidence.slice();

  // Weighted score across all dims (passed or not).
  const score = dimensions.reduce(
    (acc, d) => acc + d.score * DIMENSION_WEIGHTS[d.dimension],
    0,
  );

  const dimensionFloorBreaches = dimensions.filter(
    (d) => !d.ambiguous && !d.passed,
  );
  const evidencePresentDims = dimensions.filter((d) => !d.ambiguous);
  const allEvidencePresentPassed =
    evidencePresentDims.length > 0 &&
    evidencePresentDims.every((d) => d.passed);

  let verdict: CertificationVerdict;
  let reason: string;
  if (dimensionFloorBreaches.length > 0) {
    verdict = 'CERT_DENIED';
    const failed = dimensionFloorBreaches.map((d) => d.dimension).join(', ');
    reason = `Dimension floor breach: ${failed}.`;
  } else if (missingEvidence.length === dimensions.length) {
    verdict = 'CERT_AMBIGUOUS';
    reason = 'No evidence supplied for any certification dimension.';
  } else if (missingEvidence.length > 0) {
    // Every dim with evidence passed — degrade GRANTED to PROVISIONAL.
    // Don't apply the weighted-score floor here: a missing dim's weight is
    // unrecoverable, so the floor would make PROVISIONAL unreachable. The
    // operator sees a partial-but-clean cert; strict CI gates can opt to
    // treat PROVISIONAL as DENIED.
    if (allEvidencePresentPassed) {
      verdict = 'CERT_PROVISIONAL';
      reason = `Provisional: ${missingEvidence.join(', ')} lack evidence; remaining dims pass at score ${score.toFixed(3)}.`;
    } else {
      verdict = 'CERT_AMBIGUOUS';
      reason = `Ambiguous: ${missingEvidence.join(', ')} lack evidence; remaining dims insufficient at score ${score.toFixed(3)}.`;
    }
  } else if (score >= minScore) {
    verdict = 'CERT_GRANTED';
    reason = `All dimensions pass; weighted score ${score.toFixed(3)} ≥ floor ${minScore.toFixed(3)}.`;
  } else {
    verdict = 'CERT_DENIED';
    reason = `Weighted score ${score.toFixed(3)} below certification floor ${minScore.toFixed(3)}.`;
  }

  const certifiedAt = input.certifiedAt ?? new Date().toISOString();
  const certificationId = certificationDigest({
    evidence: input.evidence,
    dimensions,
  });
  const evidenceFp = sha256ForPayload(
    dimensions.map((d) => ({ d: d.dimension, fp: d.evidenceFingerprint })),
  );

  const previousCertificationId = input.previousCertificationId ?? null;
  const previousScore = typeof input.previousScore === 'number' ? input.previousScore : null;
  const deltaScore = previousScore === null ? null : score - previousScore;
  const drift: CertificationDrift =
    deltaScore === null
      ? 'UNKNOWN'
      : Math.abs(deltaScore) < 1e-9
        ? 'STABLE'
        : deltaScore > 0
          ? 'GAIN'
          : 'LOSS';

  return {
    schema: SCHEMA_CERT,
    certificationId,
    verdict,
    certifiedAt,
    evidenceFingerprint: evidenceFp,
    dimensions,
    score,
    ambiguity: { missingEvidence, unresolvedDimensions },
    lineage: {
      deploymentManifestId: input.evidence.deploymentManifestId,
      previousCertificationId,
      deltaScore,
      drift,
    },
    reason,
  };
}

// ── Asserts (used by CI gate) ─────────────────────────────────────────────────

/**
 * Throw a DeploymentCertificationError if the certification has been forged
 * to GRANTED while at least one dimension is ambiguous. The silent-collapse
 * canary.
 */
export function assertCertificationAmbiguityPreserved(
  cert: DeploymentCertification,
): void {
  if (cert.verdict === 'CERT_GRANTED' && cert.ambiguity.missingEvidence.length > 0) {
    throw new DeploymentCertificationError({
      violation: 'AMBIGUOUS_FORCED_GRANTED',
      message: `Certification ${cert.certificationId.slice(0, 12)}… is GRANTED while ${cert.ambiguity.missingEvidence.length} dim(s) lack evidence: ${cert.ambiguity.missingEvidence.join(', ')}.`,
      score: cert.score,
    });
  }
}

/**
 * Throw a DeploymentCertificationError if the certification fails closed.
 * Use at CI gate boundary so a denied or open-failure cert breaks the build.
 */
export function assertCertification(cert: DeploymentCertification): void {
  assertCertificationAmbiguityPreserved(cert);
  if (cert.verdict === 'CERT_DENIED') {
    const failed = cert.dimensions
      .filter((d) => !d.ambiguous && !d.passed)
      .map((d) => d.dimension);
    throw new DeploymentCertificationError({
      violation: failed.length > 0 ? 'DIMENSION_BREACH' : 'CERTIFICATION_FLOOR_BREACHED',
      message:
        failed.length > 0
          ? `Certification denied — dimensions breached: ${failed.join(', ')}.`
          : `Certification denied — weighted score ${cert.score.toFixed(3)} below floor.`,
      dimension: failed[0] ?? null,
      score: cert.score,
    });
  }
}

/**
 * Non-throwing variant. Mirrors evaluateRollout / evaluateContainment — if
 * the synthesizer itself throws (it never should), produce an
 * EVIDENCE_OPEN_FAILURE record so the swallowed error cannot masquerade as a
 * GRANTED cert.
 */
export function evaluateCertification(input: {
  evidence: CertificationEvidence;
  floors?: CertificationFloors;
  previousCertificationId?: string | null;
  previousScore?: number | null;
}): DeploymentCertification {
  try {
    return certifyDeployment(input);
  } catch (err) {
    const certifiedAt = new Date().toISOString();
    const reason = `Certification evaluator failed: ${err instanceof Error ? err.message : String(err)}`;
    const dimensions: CertificationDimensionResult[] = (
      [
        'LINEAGE_INTEGRITY',
        'REPLAY_FIDELITY',
        'CHAOS_CONTAINMENT',
        'ROLLOUT_SURVIVABILITY',
        'CONFIG_DETERMINISM',
      ] as CertificationDimension[]
    ).map((dimension) => ({
      dimension,
      passed: false,
      score: 0,
      ambiguous: true,
      reason,
      evidenceFingerprint: sha256ForPayload({ scope: 'OPEN_FAILURE', dimension }),
    }));
    const certificationId = certificationDigest({
      evidence: input.evidence,
      dimensions,
    });
    return {
      schema: SCHEMA_CERT,
      certificationId,
      verdict: 'CERT_DENIED',
      certifiedAt,
      evidenceFingerprint: sha256ForPayload(['OPEN_FAILURE', certificationId]),
      dimensions,
      score: 0,
      ambiguity: {
        missingEvidence: dimensions.map((d) => d.dimension),
        unresolvedDimensions: dimensions.map((d) => d.dimension),
      },
      lineage: {
        deploymentManifestId: input.evidence.deploymentManifestId,
        previousCertificationId: input.previousCertificationId ?? null,
        deltaScore: null,
        drift: 'UNKNOWN',
      },
      reason,
    };
  }
}

// ── Drift tracking ────────────────────────────────────────────────────────────

/**
 * Reduce a window of certifications into a single longitudinal drift report.
 * Pure — never throws. Order-independent: the input is sorted by certifiedAt
 * then certificationId so two callers with the same set produce the same
 * driftDigest.
 */
export function trackCertificationDrift(input: {
  certifications: ReadonlyArray<DeploymentCertification>;
}): CertificationDriftReport {
  const sorted = input.certifications
    .slice()
    .sort((a, b) => {
      if (a.certifiedAt < b.certifiedAt) return -1;
      if (a.certifiedAt > b.certifiedAt) return 1;
      return a.certificationId.localeCompare(b.certificationId);
    });

  const summaries = sorted.map((c) => ({
    certificationId: c.certificationId,
    certifiedAt: c.certifiedAt,
    verdict: c.verdict,
    score: c.score,
  }));

  let longitudinalDelta: number | null = null;
  let drift: CertificationDrift = 'UNKNOWN';
  if (sorted.length >= 2) {
    longitudinalDelta = sorted[sorted.length - 1].score - sorted[0].score;
    drift =
      Math.abs(longitudinalDelta) < 1e-9
        ? 'STABLE'
        : longitudinalDelta > 0
          ? 'GAIN'
          : 'LOSS';
  } else if (sorted.length === 1) {
    longitudinalDelta = 0;
    drift = 'STABLE';
  }

  const dimNames: CertificationDimension[] = [
    'LINEAGE_INTEGRITY',
    'REPLAY_FIDELITY',
    'CHAOS_CONTAINMENT',
    'ROLLOUT_SURVIVABILITY',
    'CONFIG_DETERMINISM',
  ];
  const perDimensionDrift = dimNames.map((dimension) => {
    const first = sorted[0]?.dimensions.find((d) => d.dimension === dimension);
    const last = sorted[sorted.length - 1]?.dimensions.find(
      (d) => d.dimension === dimension,
    );
    const firstScore = first?.score ?? 0;
    const lastScore = last?.score ?? 0;
    const delta = lastScore - firstScore;
    let dDrift: CertificationDrift;
    if (sorted.length === 0) {
      dDrift = 'UNKNOWN';
    } else if (sorted.length === 1) {
      dDrift = 'STABLE';
    } else {
      dDrift =
        Math.abs(delta) < 1e-9 ? 'STABLE' : delta > 0 ? 'GAIN' : 'LOSS';
    }
    return { dimension, firstScore, lastScore, delta, drift: dDrift };
  });

  const reconstructedAt = new Date().toISOString();
  const driftDigest = sha256ForPayload({
    schema: SCHEMA_DRIFT,
    summaries,
    perDimensionDrift,
  });

  return {
    schema: SCHEMA_DRIFT,
    certifications: summaries,
    longitudinalDelta,
    drift,
    perDimensionDrift,
    driftDigest,
    reconstructedAt,
  };
}

// ── Sentinels (exported for tests / CI gates) ─────────────────────────────────

export const DEPLOYMENT_CERTIFICATION_SENTINELS = Object.freeze({
  DEFAULT_MIN_REPLAY_PARTIAL_SURVIVABILITY_PCT,
  DEFAULT_MIN_ROLLOUT_PARTIAL_ADOPTION_RESILIENCE_PCT,
  DEFAULT_MIN_CHAOS_PASS_FRACTION,
  DEFAULT_MIN_CERTIFICATION_SCORE,
  SCHEMA_CERT,
  SCHEMA_DRIFT,
  DIMENSION_WEIGHTS,
});

export const KNOWN_CERTIFICATION_DIMENSIONS = Object.freeze([
  'LINEAGE_INTEGRITY',
  'REPLAY_FIDELITY',
  'CHAOS_CONTAINMENT',
  'ROLLOUT_SURVIVABILITY',
  'CONFIG_DETERMINISM',
] as const);

export const KNOWN_CERTIFICATION_VERDICTS = Object.freeze([
  'CERT_GRANTED',
  'CERT_PROVISIONAL',
  'CERT_AMBIGUOUS',
  'CERT_DENIED',
] as const);

export const KNOWN_CERTIFICATION_VIOLATIONS = Object.freeze([
  'AMBIGUOUS_FORCED_GRANTED',
  'DIMENSION_BREACH',
  'CERTIFICATION_FLOOR_BREACHED',
  'EVIDENCE_OPEN_FAILURE',
] as const);

export const KNOWN_LINEAGE_DRIFT_CODES = Object.freeze([
  'DRIFT-CODE-CLEAN',
  'DRIFT-CODE-SHA',
  'DRIFT-CODE-CONFIG',
  'DRIFT-CODE-LOCK',
  'DRIFT-CODE-ORPHAN',
  'DRIFT-CODE-TAMPER',
] as const);
