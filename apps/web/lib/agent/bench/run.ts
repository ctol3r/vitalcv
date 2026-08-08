/**
 * START-Bench evaluator.
 *
 * Universal invariants asserted on EVERY scenario (a failure on any is a
 * scenario failure):
 *   - the policy produces a plan without throwing;
 *   - zero structural violations, zero truth-boundary violations;
 *   - the deterministic template narrative validates (no unknown actions, no
 *     forbidden claims) — the Part-12 forbidden-claim evaluator;
 *   - regeneration over the identical context is byte-identical (idempotence);
 * plus the per-scenario expectations: blocker set, acceptable top action with
 * owner and permission level, must-mention / must-not-rank actions, and any
 * extra forbidden text.
 *
 * `runStartBench` takes the policy as an argument so a future
 * `start-policy-v2` replays against the exact same suite side-by-side.
 */
import { stableStringify } from '../ids';
import { validateNarrative } from '../model/agent-model';
import { buildModelContext } from '../model/context-builder';
import { DeterministicTemplateModel } from '../model/template-model';
import type { GenerateStartPlanOptions } from '../policy/start-policy-v1';
import { generateStartPlanV2 } from '../policy/start-policy-v2';
import { auditTruthBoundaries, validateStartPlanStructure } from '../truth-boundary';
import type { StartAgentContext, StartPlan } from '../types';
import { START_BENCH_SCENARIOS, START_BENCH_VERSION } from './scenarios';
import type { StartBenchScenario } from './scenario-types';

export type StartPolicy = (
  context: StartAgentContext,
  options?: GenerateStartPlanOptions,
) => StartPlan;

export interface ScenarioResult {
  id: string;
  title: string;
  holdout: boolean;
  passed: boolean;
  failures: string[];
  plan: StartPlan | null;
}

export interface StartBenchReport {
  benchVersion: string;
  policyVersion: string | null;
  total: number;
  passed: number;
  passRate: number;
  results: ScenarioResult[];
}

const BENCH_NOW = '2026-08-07T00:00:00.000Z';

export async function runStartBenchScenario(
  scenario: StartBenchScenario,
  policy: StartPolicy = generateStartPlanV2,
): Promise<ScenarioResult> {
  const failures: string[] = [];
  let plan: StartPlan | null = null;

  try {
    plan = policy(scenario.context, { now: BENCH_NOW });
  } catch (error) {
    failures.push(`policy threw: ${(error as Error).message}`);
  }

  if (plan) {
    // Universal: structure + truth boundaries (belt over the policy's own gate).
    for (const v of validateStartPlanStructure(plan)) {
      failures.push(`structure: ${v.code}@${v.subjectPath}`);
    }
    for (const v of auditTruthBoundaries(plan, scenario.context)) {
      failures.push(`truth: ${v.code}@${v.subjectPath}`);
    }

    // Universal: idempotent regeneration.
    const again = policy(scenario.context, { now: BENCH_NOW });
    if (stableStringify(again) !== stableStringify(plan)) {
      failures.push('idempotence: regeneration over identical context diverged');
    }

    // Universal: template narrative must validate (forbidden-claim evaluator).
    const narrative = await new DeterministicTemplateModel().explain(
      buildModelContext(plan, scenario.context),
    );
    for (const v of validateNarrative(narrative, plan, scenario.context)) {
      failures.push(`narrative: ${v.code}@${v.subjectPath}`);
    }

    // Blocker expectations.
    const derived = new Set(plan.blockers.map((b) => b.type));
    for (const required of scenario.expect.requiredBlockerTypes) {
      if (!derived.has(required)) failures.push(`missing blocker type: ${required}`);
    }
    if (scenario.expect.exactBlockers !== false) {
      for (const type of derived) {
        if (!scenario.expect.requiredBlockerTypes.includes(type)) {
          failures.push(`unexpected blocker type: ${type}`);
        }
      }
    }

    // Top-action expectations.
    const topId = plan.rankedActionIds[0];
    const top = plan.actions.find((a) => a.id === topId);
    if (scenario.expect.acceptableTopActions.length === 0) {
      if (plan.rankedActionIds.length > 0) {
        failures.push(`expected an empty ranked list, got top ${top?.type ?? topId}`);
      }
    } else if (!top) {
      failures.push('expected a top-ranked action, ranked list is empty');
    } else {
      const acceptable = scenario.expect.acceptableTopActions.some(
        (candidate) =>
          candidate.type === top.type &&
          candidate.owner === top.owner &&
          candidate.permission === top.permission,
      );
      if (!acceptable) {
        failures.push(
          `top action ${top.type} (owner=${top.owner}, permission=${top.permission}) is not in the acceptable set`,
        );
      }
    }

    // Must-mention / must-not-rank.
    const presentTypes = new Set(plan.actions.map((a) => a.type));
    for (const type of scenario.expect.mustMentionActionTypes ?? []) {
      if (!presentTypes.has(type)) failures.push(`plan must mention action type ${type}`);
    }
    const rankedTypes = new Set(
      plan.rankedActionIds
        .map((id) => plan!.actions.find((a) => a.id === id)?.type)
        .filter(Boolean),
    );
    for (const type of scenario.expect.forbiddenBlockerTypes ?? []) {
      if (plan.blockers.some((b) => b.type === type)) {
        failures.push(`blocker type ${type} was derived but must not be`);
      }
    }

    for (const type of scenario.expect.forbiddenActionTypes ?? []) {
      if (plan.actions.some((a) => a.type === type)) {
        failures.push(`action type ${type} exists in the plan but must not be derived at all`);
      }
    }

    for (const type of scenario.expect.mustNotRankActionTypes ?? []) {
      if (rankedTypes.has(type)) failures.push(`action type ${type} must not appear in the ranked list`);
    }

    // Extra forbidden text over the full serialized plan + narrative.
    const serialized = `${stableStringify(plan)} ${stableStringify(narrative)}`.toLowerCase();
    for (const phrase of scenario.expect.forbiddenText ?? []) {
      if (serialized.includes(phrase)) failures.push(`forbidden text present: ${phrase}`);
    }
  }

  return {
    id: scenario.id,
    title: scenario.title,
    holdout: scenario.holdout ?? false,
    passed: failures.length === 0,
    failures,
    plan,
  };
}

export async function runStartBench(
  policy: StartPolicy = generateStartPlanV2,
  scenarios: StartBenchScenario[] = START_BENCH_SCENARIOS,
): Promise<StartBenchReport> {
  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    results.push(await runStartBenchScenario(scenario, policy));
  }
  const passed = results.filter((r) => r.passed).length;
  return {
    benchVersion: START_BENCH_VERSION,
    policyVersion: results.find((r) => r.plan)?.plan?.policyVersion ?? null,
    total: results.length,
    passed,
    passRate: results.length === 0 ? 0 : passed / results.length,
    results,
  };
}
