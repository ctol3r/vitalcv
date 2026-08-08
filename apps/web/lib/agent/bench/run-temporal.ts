/**
 * START-Bench temporal evaluator.
 *
 * Runs a scenario pair through the real policy and the real diff, then checks
 * the hand-labeled expectations. Universal invariants on every pair:
 *
 *  - both plans generate without throwing;
 *  - re-diffing the same pair is byte-identical (the diff is pure);
 *  - the decision fingerprint agrees with the delta result — no deltas iff
 *    the fingerprint is unchanged. That equivalence is what proves the
 *    fingerprint is over decision content and not over the clock.
 */
import { stableStringify } from '../ids';
import { diffProjections, type PlanDeltaKind } from '../delta/diff';
import { buildDecisionProjection, decisionFingerprint } from '../delta/projection';
import type { GenerateStartPlanOptions } from '../policy/start-policy-v1';
import { generateStartPlanV2 } from '../policy/start-policy-v2';
import type { StartAgentContext, StartPlan } from '../types';
import { TEMPORAL_SCENARIOS, type TemporalScenario } from './temporal-scenarios';

export type StartPolicy = (
  context: StartAgentContext,
  options?: GenerateStartPlanOptions,
) => StartPlan;

export interface TemporalResult {
  id: string;
  title: string;
  passed: boolean;
  failures: string[];
  kinds: PlanDeltaKind[];
  materialCount: number;
}

export interface TemporalReport {
  total: number;
  passed: number;
  passRate: number;
  results: TemporalResult[];
}

export function runTemporalScenario(
  scenario: TemporalScenario,
  policy: StartPolicy = generateStartPlanV2,
): TemporalResult {
  const failures: string[] = [];

  const priorPlan = policy(scenario.prior, { now: scenario.prior.collectedAt });
  const nextPlan = policy(scenario.next, { now: scenario.next.collectedAt });

  const priorProjection = buildDecisionProjection(priorPlan, scenario.prior);
  const nextProjection = buildDecisionProjection(nextPlan, scenario.next);

  const outcome = diffProjections(priorProjection, nextProjection);

  // Purity: the diff must not depend on anything outside its inputs.
  const again = diffProjections(priorProjection, nextProjection);
  if (stableStringify(again) !== stableStringify(outcome)) {
    failures.push('diff is not pure: re-running over identical projections diverged');
  }

  const kinds = [...new Set(outcome.deltas.map((d) => d.kind))].sort() as PlanDeltaKind[];

  if (scenario.expect.notComparable) {
    if (outcome.comparable) {
      failures.push(`expected the pair to be incomparable (${scenario.expect.notComparable})`);
    } else if (outcome.reason !== scenario.expect.notComparable) {
      failures.push(`expected reason ${scenario.expect.notComparable}, got ${outcome.reason}`);
    }
  } else if (!outcome.comparable) {
    failures.push(`expected a comparable pair, got ${outcome.reason}`);
  } else {
    // Fingerprint/delta equivalence — the assertion that pins §7's finding.
    const samePrint =
      decisionFingerprint(priorProjection) === decisionFingerprint(nextProjection);
    const decisionDeltas = outcome.deltas.filter(
      (d) => d.kind !== 'observation_refreshed_no_change',
    );
    if (samePrint && decisionDeltas.length > 0) {
      failures.push(
        `decision fingerprint unchanged but ${decisionDeltas.length} decision delta(s) produced`,
      );
    }
    if (!samePrint && decisionDeltas.length === 0) {
      failures.push('decision fingerprint changed but no decision delta was produced');
    }

    for (const required of scenario.expect.requiredKinds) {
      if (!kinds.includes(required)) failures.push(`missing delta kind: ${required}`);
    }
    if (scenario.expect.exactKinds !== false) {
      for (const kind of kinds) {
        if (!scenario.expect.requiredKinds.includes(kind)) {
          failures.push(`unexpected delta kind: ${kind}`);
        }
      }
    }
    if (outcome.materialCount !== scenario.expect.materialCount) {
      failures.push(
        `expected ${scenario.expect.materialCount} material delta(s), got ${outcome.materialCount}`,
      );
    }
  }

  return {
    id: scenario.id,
    title: scenario.title,
    passed: failures.length === 0,
    failures,
    kinds,
    materialCount: outcome.materialCount,
  };
}

export function runTemporalBench(
  policy: StartPolicy = generateStartPlanV2,
  scenarios: TemporalScenario[] = TEMPORAL_SCENARIOS,
): TemporalReport {
  const results = scenarios.map((s) => runTemporalScenario(s, policy));
  const passed = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed,
    passRate: results.length === 0 ? 0 : passed / results.length,
    results,
  };
}
