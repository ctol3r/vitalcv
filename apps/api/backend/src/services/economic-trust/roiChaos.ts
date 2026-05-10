/**
 * roiChaos.ts — Chaos simulations for ROI / economic-trust resilience.
 *
 * Wave: W2-PR60A.
 *
 * Tests the engine's fail-closed semantics by injecting failure modes into a
 * baseline ReplayEvidence dataset and recording how the engine's verdict
 * shifts. The harness is deterministic — given the same baseline and seed it
 * produces the same scenarios — so CI gates can compare scenario outcomes
 * exactly across runs.
 *
 * Scenarios:
 *
 *   - 'replay_corruption': mark a fraction of records `malformed: true`. The
 *     engine should reduce confidence and, past a threshold, return FAIL_CLOSED.
 *   - 'integrity_collapse': flip integrityVerdict to 'fail' for a fraction of
 *     records. Expected: trust-efficiency score drops, verdict degrades.
 *   - 'verifier_monoculture': collapse all verifierIds to a single value. Expected:
 *     no fail-closed (this is a real production state), but the verifierEfficiency
 *     report should expose the monoculture.
 *   - 'reuse_inflation': raise reused above artifacts on a fraction of records
 *     (a malicious or buggy upstream). Expected: those records are excluded and
 *     reported via inconsistentReplays; the verdict remains conservative.
 *   - 'window_starvation': replace records with a 1-record dataset. Expected:
 *     INCONCLUSIVE (sample-too-small), never PROVEN.
 *
 * The harness does not RE-RUN the engine itself (callers do that); it returns
 * mutated datasets the caller can feed into `computeEconomicTrustReport`.
 */

import type { ChaosScenarioResult, EconomicTrustReport, ReplayEvidence } from './types';

/** A chaos scenario: name plus a transform applied to a baseline dataset. */
export interface ChaosScenario {
  name: ChaosScenarioName;
  /** Failure rate in [0,1]; meaning depends on the scenario. */
  rate: number;
  /** Deterministic seed for the scenario's PRNG. */
  seed: number;
}

export type ChaosScenarioName =
  | 'replay_corruption'
  | 'integrity_collapse'
  | 'verifier_monoculture'
  | 'reuse_inflation'
  | 'window_starvation';

/** Apply a scenario to a baseline; returns a NEW dataset (does not mutate input). */
export function applyChaosScenario(
  baseline: readonly ReplayEvidence[],
  scenario: ChaosScenario,
): ReplayEvidence[] {
  if (scenario.rate < 0 || scenario.rate > 1) {
    throw new Error(`applyChaosScenario: rate must be in [0,1], got ${scenario.rate}`);
  }
  const rng = makeRng(scenario.seed >>> 0);
  switch (scenario.name) {
    case 'replay_corruption': {
      return baseline.map((r) => (rng() < scenario.rate ? { ...r, malformed: true } : { ...r }));
    }
    case 'integrity_collapse': {
      return baseline.map((r) =>
        rng() < scenario.rate ? { ...r, integrityVerdict: 'fail' as const } : { ...r },
      );
    }
    case 'verifier_monoculture': {
      // rate ignored — the entire dataset is folded into a single verifier.
      return baseline.map((r) => ({ ...r, verifierId: 'mono', verifierType: 'SYSTEM' as const }));
    }
    case 'reuse_inflation': {
      return baseline.map((r) =>
        rng() < scenario.rate
          ? { ...r, reusedArtifactCount: r.evidenceArtifactCount + 1 }
          : { ...r },
      );
    }
    case 'window_starvation': {
      // rate ignored; truncate to first record (or empty if baseline is empty).
      return baseline.length === 0 ? [] : [{ ...baseline[0] }];
    }
    default: {
      const exhaustive: never = scenario.name;
      throw new Error(`applyChaosScenario: unknown scenario ${exhaustive as string}`);
    }
  }
}

/**
 * Compose a ChaosScenarioResult by comparing baseline vs. perturbed reports.
 *
 * The harness asserts:
 *   - failedClosed: perturbed verdict is FAIL_CLOSED OR INCONCLUSIVE
 *   - trustEfficiencyDelta: perturbed.point − baseline.point (negative = degraded)
 *
 * Use this in scale tests to verify the engine never claims a stronger ROI
 * after corruption than before.
 */
export function summariseChaosScenario(
  scenarioName: ChaosScenarioName,
  injectedFailureRate: number,
  baselineReport: EconomicTrustReport,
  perturbedReport: EconomicTrustReport,
): ChaosScenarioResult {
  const failedClosed =
    perturbedReport.verdict === 'FAIL_CLOSED' || perturbedReport.verdict === 'INCONCLUSIVE';
  const trustEfficiencyDelta =
    perturbedReport.trustEfficiencyScore.point - baselineReport.trustEfficiencyScore.point;
  return {
    scenario: scenarioName,
    injectedFailureRate,
    observedVerdict: perturbedReport.verdict,
    trustEfficiencyDelta,
    failedClosed,
    notes: noteFor(scenarioName, perturbedReport),
  };
}

function noteFor(name: ChaosScenarioName, report: EconomicTrustReport): string {
  if (report.verdict === 'FAIL_CLOSED') {
    return `${name}: engine returned FAIL_CLOSED — ${report.failClosedReasons.join('; ')}`;
  }
  if (report.verdict === 'INCONCLUSIVE') {
    return `${name}: engine returned INCONCLUSIVE — ${report.reasons.map((r) => r.code).join('; ')}`;
  }
  return `${name}: engine returned ${report.verdict}; trust score point = ${report.trustEfficiencyScore.point.toFixed(2)}`;
}

function makeRng(seed: number): () => number {
  let state = seed || 0xdeadbeef;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
