/**
 * A2.2 gate — the temporal bench plus the properties the diff must hold.
 */
import { describe, expect, it } from 'vitest';
import { runTemporalBench, runTemporalScenario } from '@/lib/agent/bench/run-temporal';
import { TEMPORAL_SCENARIOS, ctx, lane } from '@/lib/agent/bench/temporal-scenarios';
import { diffProjections } from '@/lib/agent/delta/diff';
import { buildDecisionProjection, decisionFingerprint } from '@/lib/agent/delta/projection';
import { contextFingerprint } from '@/lib/agent/ids';
import { generateStartPlan } from '@/lib/agent/policy/start-policy-v1';
import { generateStartPlanV2 } from '@/lib/agent/policy/start-policy-v2';

const T1 = '2026-08-08T00:00:00.000Z';
const T2 = '2026-08-09T00:00:00.000Z';

function project(context: Parameters<typeof buildDecisionProjection>[1]) {
  const plan = generateStartPlanV2(context, { now: context.collectedAt });
  return buildDecisionProjection(plan, context);
}

describe('temporal bench', () => {
  it('defines the pair scenarios with unique ids', () => {
    expect(TEMPORAL_SCENARIOS.length).toBeGreaterThanOrEqual(10);
    const ids = TEMPORAL_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('passes every scenario under the deployed policy', () => {
    const report = runTemporalBench();
    const failing = report.results.filter((r) => !r.passed);
    const detail = failing.map((r) => `${r.id}:\n  - ${r.failures.join('\n  - ')}`).join('\n');
    expect(failing, `temporal failures:\n${detail}`).toHaveLength(0);
    expect(report.passRate).toBe(1);
  });

  it('passes identically under the frozen v1 policy — the diff is not policy-specific', () => {
    const report = runTemporalBench(generateStartPlan);
    const failing = report.results.filter((r) => !r.passed);
    const detail = failing.map((r) => `${r.id}: ${r.failures.join('; ')}`).join('\n');
    expect(failing, `v1 temporal failures:\n${detail}`).toHaveLength(0);
  });
});

describe('the fingerprint trap', () => {
  it('contextFingerprint and planId DO change when only the clock moves', () => {
    // Pinning the finding itself. If this ever stops being true the
    // justification for a separate decision fingerprint disappears, and
    // whoever changes it should have to look at this test.
    const before = ctx(T1);
    const after = ctx(T2, { observations: [lane('nppes_identity', 'current', T1)] });
    expect(contextFingerprint(before)).not.toBe(contextFingerprint(after));
    expect(generateStartPlanV2(before, { now: T1 }).planId).not.toBe(
      generateStartPlanV2(after, { now: T2 }).planId,
    );
  });

  it('the decision fingerprint does NOT change when only the clock moves', () => {
    const before = project(ctx(T1));
    const after = project(ctx(T2, { observations: [lane('nppes_identity', 'current', T1)] }));
    expect(decisionFingerprint(before)).toBe(decisionFingerprint(after));
    expect(diffProjections(before, after)).toMatchObject({ comparable: true, materialCount: 0 });
  });

  it('the decision fingerprint ignores a re-read that found nothing new', () => {
    // observedAt moved; status did not. The fingerprint must be stable, and
    // the re-read is reported as a non-material delta rather than silence.
    const before = project(ctx(T1));
    const after = project(ctx(T2, { observations: [lane('nppes_identity', 'current', T2)] }));
    expect(decisionFingerprint(before)).toBe(decisionFingerprint(after));
    const outcome = diffProjections(before, after);
    expect(outcome.deltas.map((d) => d.kind)).toEqual(['observation_refreshed_no_change']);
    expect(outcome.materialCount).toBe(0);
  });

  it('the decision fingerprint DOES change when a lane status moves', () => {
    const before = project(ctx(T1, { observations: [lane('state_license:VA', 'current', T1)] }));
    const after = project(ctx(T2, { observations: [lane('state_license:VA', 'stale', T1)] }));
    expect(decisionFingerprint(before)).not.toBe(decisionFingerprint(after));
  });
});

describe('comparability', () => {
  it('a first run is not "no changes detected"', () => {
    // The trap the licensure doctrine names: a tick that checked nothing and
    // a tick that found nothing must not look the same.
    const outcome = diffProjections(null, project(ctx(T1)));
    expect(outcome).toMatchObject({ comparable: false, reason: 'no_prior_run' });
    expect(outcome.deltas).toHaveLength(0);
  });

  it('refuses across completeness rather than fabricating deltas', () => {
    const full = project(ctx(T1));
    const reduced = project(
      ctx(T2, {
        actor: 'system_scheduler',
        completeness: 'reduced',
        ownership: { status: 'unknown', evidenceRefs: [] },
      }),
    );
    expect(diffProjections(full, reduced)).toMatchObject({
      comparable: false,
      reason: 'completeness_mismatch',
    });
  });

  it('refuses across projection versions', () => {
    const a = project(ctx(T1));
    const b = { ...project(ctx(T2)), version: 2 as unknown as 1 };
    expect(diffProjections(a, b)).toMatchObject({
      comparable: false,
      reason: 'projection_version_mismatch',
    });
  });
});

describe('materiality', () => {
  it('a top-action change is not material when type and owner are unchanged', () => {
    // Two stale lanes: which one ranks first is churn, not news. Telling
    // someone "your next step changed" when it is the same kind of step from
    // the same party is how you teach them to ignore you.
    const before = project(
      ctx(T1, {
        observations: [lane('state_license:VA', 'stale', T1), lane('state_license:MD', 'current', T1)],
      }),
    );
    const after = project(
      ctx(T2, {
        observations: [lane('state_license:VA', 'current', T2), lane('state_license:MD', 'stale', T1)],
      }),
    );
    const outcome = diffProjections(before, after);
    const top = outcome.deltas.find((d) => d.kind === 'top_action_changed');
    expect(top).toBeDefined();
    expect(top!.material).toBe(false);
  });

  it('every delta carries a ref and an honest detail sentence', () => {
    for (const scenario of TEMPORAL_SCENARIOS) {
      const result = runTemporalScenario(scenario);
      expect(result.passed, `${scenario.id}: ${result.failures.join('; ')}`).toBe(true);
    }
    const before = project(ctx(T1, { observations: [lane('state_license:VA', 'current', T1)] }));
    const after = project(ctx(T2, { observations: [lane('state_license:VA', 'stale', T1)] }));
    for (const delta of diffProjections(before, after).deltas) {
      expect(delta.ref.length).toBeGreaterThan(0);
      expect(delta.detail.length).toBeGreaterThan(0);
      expect(delta.detail).not.toMatch(/undefined|\[object/);
    }
  });
});
