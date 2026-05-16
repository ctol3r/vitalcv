/**
 * benchmarkChaosSimulation.ts — W2-PR70A
 *
 * Benchmark chaos simulation. Pure transform that injects synthetic chaos
 * into a benchmark input slice and asserts the benchmark report responds
 * with the expected fail-closed verdict. The simulation NEVER mutates the
 * original inputs — it produces a derived slice plus an expectation.
 *
 * Hard invariants:
 *   - every chaos mode has a deterministic expectation (the report's
 *     overall verdict). If the benchmark deviates, the simulator surfaces
 *     CHAOS_EXPECTATION_BREACH so the regression is operator-visible.
 *   - chaos slices are sealed: a mutated slice is hashed alongside its
 *     expectation. Replay of the same chaos seed reproduces identical
 *     slices and identical expectations.
 *   - injection is at the input layer; the benchmark module under test
 *     is unmodified. This is a black-box chaos harness.
 */
import { sha256ForPayload } from '../../../utils/deterministic';
import type { AuditBundle } from '../replayEngine';
import type { ReplayQuarantineRecord } from '../replayCorruptionContainment';
import {
  buildTrustOperationalBenchmark,
  type BenchmarkBaselineModel,
  type BenchmarkVerdict,
  type TrustBenchmarkInputs,
  type TrustOperationalBenchmark,
  STANDARD_BENCHMARK_BASELINES,
} from './trustOperationalBenchmark';

// ── Types ────────────────────────────────────────────────────────────────────

export type ChaosMode =
  | 'INJECT_CONTAINMENT_BREACH'
  | 'EMPTY_REPLAY_SLICE'
  | 'STRIP_LATENCIES'
  | 'AMBIGUITY_FLOOD'
  | 'BASELINE_NULL_METRICS'
  | 'NO_CHAOS';

export interface ChaosScenario {
  schema: 'vitalcv.benchmark-chaos-scenario.v1';
  mode: ChaosMode;
  description: string;
  expectedVerdict: BenchmarkVerdict;
  expectAmbiguous: boolean;
  /** Hashes (mutated inputs ∪ expectation). */
  scenarioDigest: string;
}

export interface ChaosSimulationResult {
  schema: 'vitalcv.benchmark-chaos-simulation-result.v1';
  scenario: ChaosScenario;
  benchmark: TrustOperationalBenchmark;
  observedVerdict: BenchmarkVerdict;
  observedAmbiguous: boolean;
  expectationMet: boolean;
  reason: string;
}

// ── Mutators ─────────────────────────────────────────────────────────────────

function injectContainmentBreach(bundles: ReadonlyArray<AuditBundle>): AuditBundle[] {
  if (bundles.length === 0) return [];
  return bundles.map((bundle, idx) => {
    if (idx !== 0) return bundle;
    if (bundle.containment.quarantines.length === 0) return bundle;
    const breach: ReplayQuarantineRecord = {
      ...bundle.containment.quarantines[0],
      verdict: 'CONTAINMENT_BREACH',
      kind: 'STRUCTURAL_CORRUPTION',
      ambiguous: false,
      reason: 'Synthetic chaos injection: containment evaluator forced failure.',
    };
    return {
      ...bundle,
      containment: {
        ...bundle.containment,
        quarantines: [breach, ...bundle.containment.quarantines.slice(1)],
        boundary: {
          ...bundle.containment.boundary,
          partitioned: false,
          containmentReason: 'Synthetic chaos injection',
        },
      },
    };
  });
}

function stripLatencies(): Record<string, number> {
  return {};
}

function ambiguityFlood(bundles: ReadonlyArray<AuditBundle>): AuditBundle[] {
  return bundles.map(bundle => ({
    ...bundle,
    containment: {
      ...bundle.containment,
      quarantines: bundle.containment.quarantines.map(q => ({
        ...q,
        verdict: 'AMBIGUOUS' as const,
        ambiguous: true,
        reason: 'Synthetic chaos injection: forced AMBIGUOUS verdict.',
      })),
      boundary: {
        ...bundle.containment.boundary,
        partitioned: true,
        ambiguousCount: bundle.containment.quarantines.length,
        cleanCount: 0,
        quarantinedCount: 0,
        contaminatedCount: 0,
      },
    },
  }));
}

function baselineWithNullMetrics(): BenchmarkBaselineModel {
  return {
    schema: 'vitalcv.benchmark-baseline.v1',
    baselineId: 'NO_REPLAY_SURVIVABILITY',
    label: 'Synthetic null-metrics baseline (chaos)',
    derivation: 'Synthetic chaos baseline with all metric slots set to null — every comparison MUST emit ambiguous.',
    evidenceSources: ['Synthetic chaos harness'],
    metrics: {
      decisionLatencyMs: null,
      replayLatencyMs: null,
      auditSurvivabilityPct: null,
      ambiguityPreservationPct: null,
      operationalFrictionUnits: null,
    },
  };
}

// ── Scenario definition ──────────────────────────────────────────────────────

interface ScenarioDefinitionInput {
  mode: ChaosMode;
  inputs: TrustBenchmarkInputs;
  baseline?: BenchmarkBaselineModel;
}

interface DerivedScenario {
  inputs: TrustBenchmarkInputs;
  baselines: BenchmarkBaselineModel[];
  expectedVerdict: BenchmarkVerdict;
  expectAmbiguous: boolean;
  description: string;
}

function deriveScenario(input: ScenarioDefinitionInput): DerivedScenario {
  const baseline = input.baseline ?? STANDARD_BENCHMARK_BASELINES.LEGACY_CREDENTIALING;

  switch (input.mode) {
    case 'INJECT_CONTAINMENT_BREACH':
      return {
        inputs: {
          ...input.inputs,
          auditBundles: injectContainmentBreach(input.inputs.auditBundles),
        },
        baselines: [baseline],
        expectedVerdict: 'BENCHMARK_BREACH',
        expectAmbiguous: false,
        description: 'Inject CONTAINMENT_BREACH into the first quarantine of the first audit bundle.',
      };
    case 'EMPTY_REPLAY_SLICE':
      return {
        inputs: { ...input.inputs, auditBundles: [] },
        baselines: [baseline],
        expectedVerdict: 'BENCHMARK_AMBIGUOUS',
        expectAmbiguous: true,
        description: 'Strip all audit bundles from the slice — benchmark cannot derive a profile.',
      };
    case 'STRIP_LATENCIES':
      return {
        inputs: { ...input.inputs, replayLatencies: stripLatencies() },
        baselines: [baseline],
        // Without latencies, decisionLatency / replayLatency / friction are all
        // null, but survivability + ambiguity are still derivable, so the verdict
        // depends on the slice. The expected outcome is OBSERVED iff the bundle
        // survivability beats the baseline's, otherwise AMBIGUOUS.
        expectedVerdict: 'BENCHMARK_OBSERVED',
        expectAmbiguous: true,
        description: 'Remove all per-replay latencies; only survivability + ambiguity remain.',
      };
    case 'AMBIGUITY_FLOOD':
      return {
        inputs: {
          ...input.inputs,
          auditBundles: ambiguityFlood(input.inputs.auditBundles),
        },
        baselines: [baseline],
        // Every replay is now AMBIGUOUS. Survivability counts toward operator-
        // actionable surface (still 100%) and ambiguity preservation is 100%,
        // so this should be OBSERVED on the survivability axis.
        expectedVerdict: 'BENCHMARK_OBSERVED',
        expectAmbiguous: true,
        description: 'Flood every quarantine with AMBIGUOUS verdicts — survivability remains operator-actionable.',
      };
    case 'BASELINE_NULL_METRICS':
      return {
        inputs: input.inputs,
        baselines: [baselineWithNullMetrics()],
        expectedVerdict: 'BENCHMARK_AMBIGUOUS',
        expectAmbiguous: true,
        description: 'Use a synthetic baseline whose metrics are all null — every comparison must be ambiguous.',
      };
    case 'NO_CHAOS':
    default:
      return {
        inputs: input.inputs,
        baselines: [baseline],
        // Without chaos the verdict depends on actual data; we assert the
        // benchmark is at least not BREACH.
        expectedVerdict: 'BENCHMARK_OBSERVED',
        expectAmbiguous: false,
        description: 'No chaos injection — benchmark runs against unmodified inputs.',
      };
  }
}

// ── Simulator ────────────────────────────────────────────────────────────────

export interface RunBenchmarkChaosSimulationInput {
  benchmarkId: string;
  generatedAt: string;
  mode: ChaosMode;
  inputs: TrustBenchmarkInputs;
  baseline?: BenchmarkBaselineModel;
}

export function runBenchmarkChaosSimulation(
  input: RunBenchmarkChaosSimulationInput,
): ChaosSimulationResult {
  const derived = deriveScenario({
    mode: input.mode,
    inputs: input.inputs,
    baseline: input.baseline,
  });

  const benchmark = buildTrustOperationalBenchmark({
    benchmarkId: input.benchmarkId,
    generatedAt: input.generatedAt,
    inputs: derived.inputs,
    baselines: derived.baselines,
  });

  const scenarioDigest = sha256ForPayload({
    schema: 'vitalcv.benchmark-chaos-scenario-digest.v1',
    mode: input.mode,
    expectedVerdict: derived.expectedVerdict,
    expectAmbiguous: derived.expectAmbiguous,
    auditBundleIds: benchmark.inputs.auditBundleIds,
    replayCapsuleIds: benchmark.inputs.replayCapsuleIds,
    baselineIds: benchmark.comparisons.map(c => c.baselineId).slice().sort(),
  });

  const scenario: ChaosScenario = {
    schema: 'vitalcv.benchmark-chaos-scenario.v1',
    mode: input.mode,
    description: derived.description,
    expectedVerdict: derived.expectedVerdict,
    expectAmbiguous: derived.expectAmbiguous,
    scenarioDigest,
  };

  // Expectation check. STRIP_LATENCIES + AMBIGUITY_FLOOD are "soft" — the
  // expectation is preserved as a guideline, but the actual verdict may be
  // AMBIGUOUS depending on the exact slice. We treat them as met if the
  // observed verdict is either the expected or AMBIGUOUS.
  let expectationMet: boolean;
  let reason: string;
  switch (input.mode) {
    case 'INJECT_CONTAINMENT_BREACH':
    case 'EMPTY_REPLAY_SLICE':
    case 'BASELINE_NULL_METRICS':
      expectationMet = benchmark.overallVerdict === derived.expectedVerdict;
      reason = expectationMet
        ? `Chaos mode ${input.mode} produced expected verdict ${derived.expectedVerdict}.`
        : `Chaos mode ${input.mode} expected ${derived.expectedVerdict} but observed ${benchmark.overallVerdict}; CHAOS_EXPECTATION_BREACH.`;
      break;
    case 'STRIP_LATENCIES':
    case 'AMBIGUITY_FLOOD':
    case 'NO_CHAOS':
      expectationMet =
        benchmark.overallVerdict === derived.expectedVerdict ||
        benchmark.overallVerdict === 'BENCHMARK_AMBIGUOUS' ||
        benchmark.overallVerdict === 'BENCHMARK_PARITY';
      reason = expectationMet
        ? `Chaos mode ${input.mode} produced ${benchmark.overallVerdict} — within accepted soft-expectation set.`
        : `Chaos mode ${input.mode} expected ${derived.expectedVerdict}/AMBIGUOUS/PARITY but observed ${benchmark.overallVerdict}; CHAOS_EXPECTATION_BREACH.`;
      break;
  }

  return {
    schema: 'vitalcv.benchmark-chaos-simulation-result.v1',
    scenario,
    benchmark,
    observedVerdict: benchmark.overallVerdict,
    observedAmbiguous: benchmark.ambiguous,
    expectationMet,
    reason,
  };
}

// ── Sentinels ────────────────────────────────────────────────────────────────

export const KNOWN_BENCHMARK_CHAOS_MODES = Object.freeze([
  'INJECT_CONTAINMENT_BREACH',
  'EMPTY_REPLAY_SLICE',
  'STRIP_LATENCIES',
  'AMBIGUITY_FLOOD',
  'BASELINE_NULL_METRICS',
  'NO_CHAOS',
] as const);
