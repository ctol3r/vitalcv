/**
 * START-Bench — every scenario must pass against the deployed policy
 * (start-policy-v2 as of A1). A failing scenario prints its failures so the
 * report is actionable. Version-to-version replay lives in
 * start-bench-policy-replay.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { runStartBench } from '@/lib/agent/bench/run';
import { START_BENCH_SCENARIOS } from '@/lib/agent/bench/scenarios';

describe('START-Bench', () => {
  it('defines at least the initial 25 scenarios with unique stable ids', () => {
    expect(START_BENCH_SCENARIOS.length).toBeGreaterThanOrEqual(25);
    const ids = START_BENCH_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Fixed holdout scenarios exist for the learning loop.
    expect(START_BENCH_SCENARIOS.some((s) => s.holdout)).toBe(true);
  });

  it('passes every scenario under the deployed policy', async () => {
    const report = await runStartBench();
    const failing = report.results.filter((r) => !r.passed);
    const detail = failing.map((r) => `${r.id}:\n  - ${r.failures.join('\n  - ')}`).join('\n');
    expect(failing, `START-Bench failures:\n${detail}`).toHaveLength(0);
    expect(report.passed).toBe(report.total);
    expect(report.passRate).toBe(1);
    expect(report.policyVersion).toBe('start-policy-v2');
  });
});
