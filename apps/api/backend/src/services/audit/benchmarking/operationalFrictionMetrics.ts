/**
 * operationalFrictionMetrics.ts — W2-PR70A
 *
 * Operational-friction benchmark. Pure transform that distills the
 * runtime trust cohesion telemetry into a single composite friction
 * score (lower = less friction) plus its decomposed parts. The friction
 * score blends:
 *   - mutation throughput (mutations / second)
 *   - denial-rate drift vs. expected
 *   - ambiguity preservation (R-CAT-5 + denialReason co-occurrence)
 *   - replay-fingerprint stability (no silent collapse under load)
 *
 * Hard invariants:
 *   - empty-sample slices fail closed to AMBIGUOUS — friction is not zero
 *     when no friction has been observed.
 *   - any silent reclassification (denied event missing denialReason or
 *     R-CAT-5) raises FRICTION_AMBIGUITY_LOST so the operator sees the
 *     loss verbatim.
 *   - fingerprint collisions raise FRICTION_FINGERPRINT_COLLAPSE.
 *   - inputs are never deduplicated upstream; the metric is order- and
 *     duplicate-stable.
 */
import { sha256ForPayload } from '../../../utils/deterministic';
import type {
  RuntimeMutationClassification,
  RuntimeReplayCategory,
} from '../../runtimeTrustCohesion';
import type {
  BenchmarkBaselineModel,
  BenchmarkVerdict,
} from './trustOperationalBenchmark';

// ── Types ────────────────────────────────────────────────────────────────────

export type FrictionVerdict =
  | 'FRICTION_OBSERVED_LOWER'         // VitalCV operationally lighter than baseline
  | 'FRICTION_PARITY'
  | 'FRICTION_OBSERVED_HIGHER'        // VitalCV heavier than baseline (regression)
  | 'FRICTION_AMBIGUITY_LOST'         // ambiguity collapsed under load — fail closed
  | 'FRICTION_FINGERPRINT_COLLAPSE'   // fingerprint collisions detected
  | 'FRICTION_AMBIGUOUS';             // slice empty / inputs missing

export interface RuntimeMutationSample {
  mutationFingerprint: string;
  classification: RuntimeMutationClassification;
  replayCategory: RuntimeReplayCategory;
  outcome: 'allowed' | 'denied' | 'replayed';
  denialReason?: string | null;
  observedAtMs: number;
  elapsedMs: number;
}

export interface OperationalFrictionMetrics {
  schema: 'vitalcv.operational-friction-metrics.v1';
  sampleCount: number;
  uniqueFingerprintCount: number;
  duplicateFingerprintCount: number;
  /** Mutations per second observed across the slice. Null when window unknown. */
  mutationsPerSec: number | null;
  meanElapsedMs: number;
  p95ElapsedMs: number;
  observedDeniedCount: number;
  observedAllowedCount: number;
  observedReplayedCount: number;
  /** Denied events that have neither R-CAT-5 nor a denialReason — silent collapse. */
  silentReclassificationCount: number;
  /**
   * Composite friction units. Lower = lighter. Built from elapsed-mean +
   * silent-reclassification penalty + fingerprint-collision penalty.
   */
  frictionUnits: number;
  ambiguityPreservationPct: number;
}

export interface OperationalFrictionComparison {
  schema: 'vitalcv.operational-friction-comparison.v1';
  baselineId: string;
  baselineLabel: string;
  baselineDerivation: string;
  vitalcvFrictionUnits: number | null;
  baselineFrictionUnits: number | null;
  delta: number | null;
  ratio: number | null;
  metrics: OperationalFrictionMetrics | null;
  verdict: BenchmarkVerdict;
  frictionVerdict: FrictionVerdict;
  ambiguous: boolean;
  reason: string;
  comparisonDigest: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SILENT_RECLASSIFICATION_PENALTY = 500;
const FINGERPRINT_COLLISION_PENALTY = 1000;

function percentile(values: ReadonlyArray<number>, p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

function mean(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function isSilentReclassification(sample: RuntimeMutationSample): boolean {
  if (sample.outcome !== 'denied') return false;
  // Denied outcomes MUST carry both R-CAT-5 and a denialReason. Either missing
  // is silent reclassification — the runtime cohesion module exists to
  // prevent exactly this collapse.
  if (sample.replayCategory !== 'R-CAT-5') return true;
  if (sample.classification !== 'DENIED_MUTATION') return true;
  if (typeof sample.denialReason !== 'string' || sample.denialReason.trim().length === 0) return true;
  return false;
}

// ── Reduction ────────────────────────────────────────────────────────────────

export function reduceOperationalFrictionMetrics(
  samples: ReadonlyArray<RuntimeMutationSample>,
): OperationalFrictionMetrics {
  if (samples.length === 0) {
    return {
      schema: 'vitalcv.operational-friction-metrics.v1',
      sampleCount: 0,
      uniqueFingerprintCount: 0,
      duplicateFingerprintCount: 0,
      mutationsPerSec: null,
      meanElapsedMs: 0,
      p95ElapsedMs: 0,
      observedDeniedCount: 0,
      observedAllowedCount: 0,
      observedReplayedCount: 0,
      silentReclassificationCount: 0,
      frictionUnits: 0,
      ambiguityPreservationPct: 100,
    };
  }

  let observedDeniedCount = 0;
  let observedAllowedCount = 0;
  let observedReplayedCount = 0;
  let silentReclassificationCount = 0;

  const fingerprintCounts = new Map<string, number>();
  const elapsed: number[] = [];
  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;

  for (const s of samples) {
    fingerprintCounts.set(s.mutationFingerprint, (fingerprintCounts.get(s.mutationFingerprint) ?? 0) + 1);
    elapsed.push(s.elapsedMs);
    if (s.observedAtMs < earliest) earliest = s.observedAtMs;
    if (s.observedAtMs > latest) latest = s.observedAtMs;

    if (s.outcome === 'denied') observedDeniedCount += 1;
    else if (s.outcome === 'allowed') observedAllowedCount += 1;
    else observedReplayedCount += 1;

    if (isSilentReclassification(s)) silentReclassificationCount += 1;
  }

  const uniqueFingerprintCount = fingerprintCounts.size;
  const duplicateFingerprintCount = samples.length - uniqueFingerprintCount;
  const meanElapsedMs = mean(elapsed);
  const p95ElapsedMs = percentile(elapsed, 0.95);

  let mutationsPerSec: number | null = null;
  if (Number.isFinite(earliest) && Number.isFinite(latest) && latest > earliest) {
    const elapsedSec = (latest - earliest) / 1000;
    mutationsPerSec = samples.length / elapsedSec;
  }

  // Ambiguity preservation: percentage of denied events with R-CAT-5 +
  // denialReason intact. 100% by default if no denied events at all.
  const ambiguityPreservationPct =
    observedDeniedCount === 0
      ? 100
      : ((observedDeniedCount - silentReclassificationCount) / observedDeniedCount) * 100;

  // Composite friction units. mean elapsed + penalties for silent reclass +
  // fingerprint collisions. Lower = lighter operational footprint.
  const frictionUnits =
    meanElapsedMs +
    silentReclassificationCount * SILENT_RECLASSIFICATION_PENALTY +
    duplicateFingerprintCount * FINGERPRINT_COLLISION_PENALTY;

  return {
    schema: 'vitalcv.operational-friction-metrics.v1',
    sampleCount: samples.length,
    uniqueFingerprintCount,
    duplicateFingerprintCount,
    mutationsPerSec,
    meanElapsedMs,
    p95ElapsedMs,
    observedDeniedCount,
    observedAllowedCount,
    observedReplayedCount,
    silentReclassificationCount,
    frictionUnits,
    ambiguityPreservationPct,
  };
}

// ── Comparison ───────────────────────────────────────────────────────────────

export interface BuildOperationalFrictionComparisonInput {
  samples: ReadonlyArray<RuntimeMutationSample>;
  baseline: BenchmarkBaselineModel;
}

export function buildOperationalFrictionComparison(
  input: BuildOperationalFrictionComparisonInput,
): OperationalFrictionComparison {
  const baselineFriction = input.baseline.metrics.operationalFrictionUnits;
  const metrics = input.samples.length > 0
    ? reduceOperationalFrictionMetrics(input.samples)
    : null;

  // Fail-closed paths first.
  if (metrics === null) {
    return {
      schema: 'vitalcv.operational-friction-comparison.v1',
      baselineId: input.baseline.baselineId,
      baselineLabel: input.baseline.label,
      baselineDerivation: input.baseline.derivation,
      vitalcvFrictionUnits: null,
      baselineFrictionUnits: baselineFriction,
      delta: null,
      ratio: null,
      metrics: null,
      verdict: 'BENCHMARK_AMBIGUOUS',
      frictionVerdict: 'FRICTION_AMBIGUOUS',
      ambiguous: true,
      reason: 'No mutation samples in slice; operational friction cannot be computed.',
      comparisonDigest: emptyDigest(input.baseline.baselineId),
    };
  }
  if (metrics.duplicateFingerprintCount > 0) {
    return {
      schema: 'vitalcv.operational-friction-comparison.v1',
      baselineId: input.baseline.baselineId,
      baselineLabel: input.baseline.label,
      baselineDerivation: input.baseline.derivation,
      vitalcvFrictionUnits: metrics.frictionUnits,
      baselineFrictionUnits: baselineFriction,
      delta: null,
      ratio: null,
      metrics,
      verdict: 'BENCHMARK_BREACH',
      frictionVerdict: 'FRICTION_FINGERPRINT_COLLAPSE',
      ambiguous: false,
      reason: `Detected ${metrics.duplicateFingerprintCount} duplicate fingerprint(s) across ${metrics.sampleCount} sample(s); fail-closed.`,
      comparisonDigest: comparisonDigestOf(input.baseline.baselineId, metrics),
    };
  }
  if (metrics.silentReclassificationCount > 0) {
    return {
      schema: 'vitalcv.operational-friction-comparison.v1',
      baselineId: input.baseline.baselineId,
      baselineLabel: input.baseline.label,
      baselineDerivation: input.baseline.derivation,
      vitalcvFrictionUnits: metrics.frictionUnits,
      baselineFrictionUnits: baselineFriction,
      delta: null,
      ratio: null,
      metrics,
      verdict: 'BENCHMARK_BREACH',
      frictionVerdict: 'FRICTION_AMBIGUITY_LOST',
      ambiguous: false,
      reason: `${metrics.silentReclassificationCount} denied event(s) lost ambiguity (missing R-CAT-5 / denialReason); fail-closed.`,
      comparisonDigest: comparisonDigestOf(input.baseline.baselineId, metrics),
    };
  }

  // Concrete comparison.
  if (baselineFriction === null) {
    return {
      schema: 'vitalcv.operational-friction-comparison.v1',
      baselineId: input.baseline.baselineId,
      baselineLabel: input.baseline.label,
      baselineDerivation: input.baseline.derivation,
      vitalcvFrictionUnits: metrics.frictionUnits,
      baselineFrictionUnits: null,
      delta: null,
      ratio: null,
      metrics,
      verdict: 'BENCHMARK_AMBIGUOUS',
      frictionVerdict: 'FRICTION_AMBIGUOUS',
      ambiguous: true,
      reason: `Baseline ${input.baseline.baselineId} does not define friction units; comparison preserved as ambiguous.`,
      comparisonDigest: comparisonDigestOf(input.baseline.baselineId, metrics),
    };
  }

  const delta = metrics.frictionUnits - baselineFriction;
  const ratio = metrics.frictionUnits === 0 ? null : baselineFriction / metrics.frictionUnits;
  const magnitude = Math.max(metrics.frictionUnits, baselineFriction, 1e-9);
  const isParity = Math.abs(delta) / magnitude <= 0.05;

  let frictionVerdict: FrictionVerdict;
  let benchmarkVerdict: BenchmarkVerdict;
  let reason: string;
  if (isParity) {
    frictionVerdict = 'FRICTION_PARITY';
    benchmarkVerdict = 'BENCHMARK_PARITY';
    reason = `VitalCV friction ${metrics.frictionUnits.toFixed(2)} within ±5% of baseline ${baselineFriction}.`;
  } else if (delta < 0) {
    frictionVerdict = 'FRICTION_OBSERVED_LOWER';
    benchmarkVerdict = 'BENCHMARK_OBSERVED';
    reason = `VitalCV friction ${metrics.frictionUnits.toFixed(2)} below baseline ${baselineFriction} (lighter is better; ratio ${ratio?.toFixed(2) ?? 'n/a'}×).`;
  } else {
    frictionVerdict = 'FRICTION_OBSERVED_HIGHER';
    benchmarkVerdict = 'BENCHMARK_REGRESSED';
    reason = `VitalCV friction ${metrics.frictionUnits.toFixed(2)} exceeds baseline ${baselineFriction} (heavier; ratio ${ratio?.toFixed(2) ?? 'n/a'}×).`;
  }

  return {
    schema: 'vitalcv.operational-friction-comparison.v1',
    baselineId: input.baseline.baselineId,
    baselineLabel: input.baseline.label,
    baselineDerivation: input.baseline.derivation,
    vitalcvFrictionUnits: metrics.frictionUnits,
    baselineFrictionUnits: baselineFriction,
    delta,
    ratio,
    metrics,
    verdict: benchmarkVerdict,
    frictionVerdict,
    ambiguous: false,
    reason,
    comparisonDigest: comparisonDigestOf(input.baseline.baselineId, metrics),
  };
}

// ── Digest helpers ───────────────────────────────────────────────────────────

function emptyDigest(baselineId: string): string {
  return sha256ForPayload({
    schema: 'vitalcv.operational-friction-comparison-digest.v1',
    baselineId,
    metrics: null,
  });
}

function comparisonDigestOf(
  baselineId: string,
  metrics: OperationalFrictionMetrics,
): string {
  return sha256ForPayload({
    schema: 'vitalcv.operational-friction-comparison-digest.v1',
    baselineId,
    metrics: {
      sampleCount: metrics.sampleCount,
      uniqueFingerprintCount: metrics.uniqueFingerprintCount,
      duplicateFingerprintCount: metrics.duplicateFingerprintCount,
      mutationsPerSec: metrics.mutationsPerSec,
      meanElapsedMs: metrics.meanElapsedMs,
      observedDeniedCount: metrics.observedDeniedCount,
      observedAllowedCount: metrics.observedAllowedCount,
      observedReplayedCount: metrics.observedReplayedCount,
      silentReclassificationCount: metrics.silentReclassificationCount,
      frictionUnits: metrics.frictionUnits,
      ambiguityPreservationPct: metrics.ambiguityPreservationPct,
    },
  });
}

// ── Sentinels ────────────────────────────────────────────────────────────────

export const KNOWN_FRICTION_VERDICTS = Object.freeze([
  'FRICTION_OBSERVED_LOWER',
  'FRICTION_PARITY',
  'FRICTION_OBSERVED_HIGHER',
  'FRICTION_AMBIGUITY_LOST',
  'FRICTION_FINGERPRINT_COLLAPSE',
  'FRICTION_AMBIGUOUS',
] as const);

export const FRICTION_PENALTIES = Object.freeze({
  SILENT_RECLASSIFICATION_PENALTY,
  FINGERPRINT_COLLISION_PENALTY,
});
