/**
 * A2.4 gate — scheduled refresh planning, gating, and budgets.
 *
 * The properties: one cadence table, every skip named, health defers rather
 * than retries into a wall, the budget is shared and bounded, and nothing
 * executes.
 */
import { describe, expect, it } from 'vitest';
import { cadenceForLane, cadenceSatisfied } from '@/lib/agent/refresh/cadence';
import { createRefreshBudget, SCHEDULED_REFRESH_POLICY } from '@/lib/agent/refresh/budget';
import { planScheduledRefreshes } from '@/lib/agent/refresh/planner';
import { ctx, lane } from '@/lib/agent/bench/temporal-scenarios';

const NOW = '2026-08-08T00:00:00.000Z';
const LONG_AGO = '2026-01-01T00:00:00.000Z';

describe('cadence comes from SOURCE_REGISTRY and nowhere else', () => {
  it('maps agent lanes onto registry entries', () => {
    expect(cadenceForLane('nppes_identity')?.sourceId).toBe('NPPES');
    expect(cadenceForLane('oig_exclusions')?.sourceId).toBe('OIG_LEIE');
    expect(cadenceForLane('pecos_enrollment')?.sourceId).toBe('PECOS_ENROLLMENT');
  });

  it('carries the registry values rather than restating them', () => {
    const nppes = cadenceForLane('nppes_identity')!;
    expect(nppes.cadenceMs).toBe(24 * 60 * 60 * 1000);
    expect(nppes.freshnessTtlMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(nppes.requiredForDecisionGrade).toBe(true);
  });

  it('invents NO cadence for a lane the registry does not know', () => {
    // Asserting how often an authority we have never asked changes is the
    // same class of error as inventing an expiry date.
    expect(cadenceForLane('state_license:VA')).toBeNull();
    expect(cadenceForLane('board_cert')).toBeNull();
    // …and CA is the only state board actually in the registry.
    expect(cadenceForLane('state_license:CA')?.sourceId).toBe('CA_PA_BOARD');
  });

  it('holds off until the source could plausibly have changed', () => {
    const cadence = cadenceForLane('nppes_identity')!;
    expect(cadenceSatisfied({ cadence, observedAt: NOW, now: NOW })).toBe(false);
    expect(
      cadenceSatisfied({ cadence, observedAt: '2026-08-07T23:00:00.000Z', now: NOW }),
    ).toBe(false);
    expect(cadenceSatisfied({ cadence, observedAt: LONG_AGO, now: NOW })).toBe(true);
    // Never observed: nothing to wait for.
    expect(cadenceSatisfied({ cadence, now: NOW })).toBe(true);
  });
});

describe('gates, each with a named reason', () => {
  it('skips a current lane nothing requires', () => {
    const plan = planScheduledRefreshes({
      context: ctx(NOW, { observations: [lane('nppes_identity', 'current', LONG_AGO)] }),
      now: NOW,
    });
    expect(plan.planned).toHaveLength(0);
    expect(plan.skipped[0]).toMatchObject({ reason: 'not_relevant' });
  });

  it('plans a stale lane whose cadence has elapsed', () => {
    const plan = planScheduledRefreshes({
      context: ctx(NOW, { observations: [lane('nppes_identity', 'stale', LONG_AGO)] }),
      now: NOW,
    });
    expect(plan.planned).toHaveLength(1);
    expect(plan.planned[0]).toMatchObject({
      laneId: 'nppes_identity',
      sourceId: 'NPPES',
      because: 'evidence_aging',
    });
  });

  it('holds off when the cadence has not elapsed', () => {
    const plan = planScheduledRefreshes({
      context: ctx(NOW, { observations: [lane('nppes_identity', 'stale', NOW)] }),
      now: NOW,
    });
    expect(plan.planned).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('cadence_not_elapsed');
  });

  it('names the missing cadence rather than assuming one', () => {
    const plan = planScheduledRefreshes({
      context: ctx(NOW, { observations: [lane('state_license:VA', 'stale', LONG_AGO)] }),
      now: NOW,
    });
    expect(plan.planned).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('no_known_cadence');
  });

  it('defers on an unavailable source rather than retrying into a wall', () => {
    const plan = planScheduledRefreshes({
      context: ctx(NOW, { observations: [lane('oig_exclusions', 'stale', LONG_AGO)] }),
      now: NOW,
      laneHealth: { OIG_LEIE: 'UNAVAILABLE' },
    });
    expect(plan.planned).toHaveLength(0);
    expect(plan.skipped[0]).toMatchObject({ reason: 'source_unavailable' });
  });

  it('defers on a rate-limited source too', () => {
    const plan = planScheduledRefreshes({
      context: ctx(NOW, { observations: [lane('oig_exclusions', 'stale', LONG_AGO)] }),
      now: NOW,
      laneHealth: { OIG_LEIE: 'RATE_LIMITED' },
    });
    expect(plan.skipped[0].reason).toBe('source_unavailable');
  });

  it('proceeds when health is DEGRADED — degraded is not down', () => {
    const plan = planScheduledRefreshes({
      context: ctx(NOW, { observations: [lane('oig_exclusions', 'stale', LONG_AGO)] }),
      now: NOW,
      laneHealth: { OIG_LEIE: 'DEGRADED' },
    });
    expect(plan.planned).toHaveLength(1);
  });

  it('honours A1’s repeated-failure pause instead of adding a second policy', () => {
    const plan = planScheduledRefreshes({
      context: ctx(NOW, {
        observations: [lane('nppes_identity', 'stale', LONG_AGO)],
        actionHistory: [
          {
            actionId: 'nppes_identity',
            type: 'refresh_source_observation',
            outcome: 'failed',
            at: NOW,
            failureCount: 3,
          },
        ],
      }),
      now: NOW,
    });
    expect(plan.planned).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('paused_repeated_failure');
  });

  it('reads a lane an active role requires even when it looks fresh', () => {
    const plan = planScheduledRefreshes({
      context: ctx(NOW, {
        observations: [lane('oig_exclusions', 'current', LONG_AGO)],
        role: {
          roleRef: 'r1',
          employerRef: 'e1',
          applicationState: 'in_progress',
          requirements: [
            {
              id: 'req-1',
              kind: 'source_lane',
              laneId: 'oig_exclusions',
              controlledBy: 'vitalcv',
              satisfied: false,
              evidenceRefs: [],
            },
          ],
        },
      }),
      now: NOW,
    });
    expect(plan.planned[0]).toMatchObject({ because: 'required_for_active_role' });
  });
});

describe('budget', () => {
  it('is bounded well below the connector default', () => {
    // Background work competes with clinician-initiated reads for the same
    // upstream quota, and should lose that competition.
    expect(SCHEDULED_REFRESH_POLICY.limit).toBeLessThan(60);
  });

  it('defers once the window is spent, and says so', () => {
    const budget = createRefreshBudget({ limit: 2, windowMs: 60_000 });
    const context = ctx(NOW, {
      observations: [
        lane('nppes_identity', 'stale', LONG_AGO),
        lane('oig_exclusions', 'stale', LONG_AGO),
        lane('pecos_enrollment', 'stale', LONG_AGO),
      ],
    });
    // Each lane maps to a DIFFERENT source, so a per-source limit of 2 does
    // not bind. Drive one source past its own limit instead.
    const single = ctx(NOW, { observations: [lane('nppes_identity', 'stale', LONG_AGO)] });
    const first = planScheduledRefreshes({ context: single, now: NOW, budget });
    const second = planScheduledRefreshes({ context: single, now: NOW, budget });
    const third = planScheduledRefreshes({ context: single, now: NOW, budget });
    expect(first.planned).toHaveLength(1);
    expect(second.planned).toHaveLength(1);
    expect(third.planned).toHaveLength(0);
    expect(third.skipped[0].reason).toBe('budget_exhausted');
    expect(context.observations).toHaveLength(3); // fixture sanity
  });

  it('is shared across subjects — a big batch cannot hammer one source', () => {
    const budget = createRefreshBudget({ limit: 3, windowMs: 60_000 });
    const subject = ctx(NOW, { observations: [lane('nppes_identity', 'stale', LONG_AGO)] });
    const results = Array.from({ length: 5 }, () =>
      planScheduledRefreshes({ context: subject, now: NOW, budget }),
    );
    const totalPlanned = results.reduce((sum, r) => sum + r.planned.length, 0);
    expect(totalPlanned).toBe(3);
  });

  it('reports what a live tick would have spent', () => {
    const budget = createRefreshBudget();
    planScheduledRefreshes({
      context: ctx(NOW, { observations: [lane('nppes_identity', 'stale', LONG_AGO)] }),
      now: NOW,
      budget,
    });
    const spend = budget.spend();
    expect(spend.NPPES).toMatchObject({ used: 1 });
    expect(spend.NPPES.remaining).toBe(SCHEDULED_REFRESH_POLICY.limit - 1);
  });

  it('does not spend quota on a lane skipped for a free reason', () => {
    // Budget is checked LAST on purpose: a lane skipped for cadence or
    // health must not consume the window it never used.
    const budget = createRefreshBudget();
    planScheduledRefreshes({
      context: ctx(NOW, { observations: [lane('nppes_identity', 'stale', NOW)] }),
      now: NOW,
      budget,
    });
    expect(budget.spend()).toEqual({});
  });
});

describe('required lanes get first claim on a scarce budget', () => {
  it('plans the role-required lane before the merely-aging one', () => {
    const budget = createRefreshBudget({ limit: 1, windowMs: 60_000 });
    const plan = planScheduledRefreshes({
      context: ctx(NOW, {
        observations: [
          lane('nppes_identity', 'stale', LONG_AGO),
          lane('oig_exclusions', 'stale', LONG_AGO),
        ],
        role: {
          roleRef: 'r1',
          employerRef: 'e1',
          applicationState: 'in_progress',
          requirements: [
            {
              id: 'req-1',
              kind: 'source_lane',
              laneId: 'oig_exclusions',
              controlledBy: 'vitalcv',
              satisfied: false,
              evidenceRefs: [],
            },
          ],
        },
      }),
      now: NOW,
      budget,
    });
    // Both sources are separate, so both fit; the ORDER is what is pinned.
    expect(plan.planned[0].laneId).toBe('oig_exclusions');
  });
});

describe('nothing executes', () => {
  it('planning is pure — it returns intentions, not results', () => {
    const plan = planScheduledRefreshes({
      context: ctx(NOW, { observations: [lane('nppes_identity', 'stale', LONG_AGO)] }),
      now: NOW,
    });
    // A planned refresh carries no outcome, no timestamp, no receipt: A2.4
    // decides, A2.5 acts.
    expect(plan.planned[0]).not.toHaveProperty('executed');
    expect(plan.planned[0]).not.toHaveProperty('observedAt');
    expect(Object.keys(plan.planned[0]).sort()).toEqual([
      'because',
      'laneId',
      'requiredForDecisionGrade',
      'sourceId',
    ]);
  });
});
