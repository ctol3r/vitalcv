/**
 * START-Bench policy replay — the governed-learning gate in practice.
 *
 * A candidate policy may only be promoted if it improves on the incumbent
 * with NO truth/safety regression. This suite runs both versions against the
 * suite each was written for and pins the isolated behavior delta.
 */
import { describe, expect, it } from 'vitest';
import { runStartBench } from '@/lib/agent/bench/run';
import { scenariosForPolicy, START_BENCH_SCENARIOS } from '@/lib/agent/bench/scenarios';
import { generateStartPlan, START_POLICY_VERSION } from '@/lib/agent/policy/start-policy-v1';
import { generateStartPlanV2, START_POLICY_VERSION_V2 } from '@/lib/agent/policy/start-policy-v2';

const NOW = '2026-08-07T00:00:00.000Z';

describe('start-policy-v1 (frozen incumbent)', () => {
  it('still passes every scenario that existed for it', async () => {
    const scenarios = scenariosForPolicy(START_POLICY_VERSION);
    const report = await runStartBench(generateStartPlan, scenarios);
    const failing = report.results.filter((r) => !r.passed);
    const detail = failing.map((r) => `${r.id}: ${r.failures.join('; ')}`).join('\n');
    expect(failing, `v1 regressions:\n${detail}`).toHaveLength(0);
    expect(report.policyVersion).toBe(START_POLICY_VERSION);
  });
});

describe('start-policy-v2 (candidate)', () => {
  it('passes the full suite including the new consented-execution scenarios', async () => {
    const report = await runStartBench(generateStartPlanV2, START_BENCH_SCENARIOS);
    const failing = report.results.filter((r) => !r.passed);
    const detail = failing.map((r) => `${r.id}: ${r.failures.join('; ')}`).join('\n');
    expect(failing, `v2 failures:\n${detail}`).toHaveLength(0);
    expect(report.passRate).toBe(1);
    expect(report.policyVersion).toBe(START_POLICY_VERSION_V2);
  });

  it('is a strict improvement: v1 cannot pass the scenarios v2 was written for', async () => {
    const newScenarios = START_BENCH_SCENARIOS.filter((s) => s.sincePolicy === START_POLICY_VERSION_V2);
    expect(newScenarios.length).toBeGreaterThan(0);
    const v1OnNew = await runStartBench(generateStartPlan, newScenarios);
    expect(v1OnNew.passed).toBe(0);
    const v2OnNew = await runStartBench(generateStartPlanV2, newScenarios);
    expect(v2OnNew.passed).toBe(newScenarios.length);
  });

  it('changes nothing else: shared scenarios produce identical plans under both versions', async () => {
    const shared = scenariosForPolicy(START_POLICY_VERSION);
    for (const scenario of shared) {
      const v1 = generateStartPlan(scenario.context, { now: NOW });
      const v2 = generateStartPlanV2(scenario.context, { now: NOW });
      // planId legitimately differs (it hashes the policy version); the
      // decision content must not.
      expect(
        { ...v2, planId: null, policyVersion: null },
        `policy delta leaked into ${scenario.id}`,
      ).toEqual({ ...v1, planId: null, policyVersion: null });
    }
  });
});
