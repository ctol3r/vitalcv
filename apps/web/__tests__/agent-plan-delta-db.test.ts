/**
 * A2.2 — delta persistence against a REAL Postgres.
 *
 * Proves the round trip the learning loop depends on: a run stores its
 * decision projection, the next run finds it, the diff is persisted with
 * materiality intact, and a material change supersedes the prior plan.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const SKIP = !process.env.DATABASE_URL;

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', async () => {
  const { PrismaClient } = await import('../lib/generated/prisma');
  return {
    prisma: new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL ?? '' } } }),
  };
});

const RUN = randomUUID().slice(0, 8);
const SUBJECTS = new Set<string>();
function subjectRef(): string {
  const ref = `delta-${RUN}-${SUBJECTS.size + 1}`;
  SUBJECTS.add(ref);
  return ref;
}

const T1 = '2026-08-08T00:00:00.000Z';
const T2 = '2026-08-09T00:00:00.000Z';

describe.skipIf(SKIP)('plan delta persistence (real Postgres)', () => {
  let prisma: import('../lib/generated/prisma').PrismaClient;
  let store: typeof import('@/lib/agent/delta/delta-store');
  let projectionMod: typeof import('@/lib/agent/delta/projection');
  let diffMod: typeof import('@/lib/agent/delta/diff');
  let fixtures: typeof import('@/lib/agent/bench/temporal-scenarios');
  let policy: typeof import('@/lib/agent/policy/start-policy-v2');
  let telemetry: typeof import('@/lib/agent/telemetry/agent-run-store');

  beforeAll(async () => {
    prisma = (await import('@/lib/db')).prisma as never;
    store = await import('@/lib/agent/delta/delta-store');
    projectionMod = await import('@/lib/agent/delta/projection');
    diffMod = await import('@/lib/agent/delta/diff');
    fixtures = await import('@/lib/agent/bench/temporal-scenarios');
    policy = await import('@/lib/agent/policy/start-policy-v2');
    telemetry = await import('@/lib/agent/telemetry/agent-run-store');
  });

  afterAll(async () => {
    if (SKIP) return;
    const refs = [...SUBJECTS];
    await prisma.agentPlanDelta.deleteMany({ where: { subjectRef: { in: refs } } });
    await prisma.agentEvent.deleteMany({ where: { subjectRef: { in: refs } } });
    await prisma.agentRunAction.deleteMany({ where: { run: { subjectRef: { in: refs } } } });
    await prisma.agentRun.deleteMany({ where: { subjectRef: { in: refs } } });
    await prisma.$disconnect();
  });

  /** Persist one scheduled run and attach its projection, as the tick does. */
  async function recordRun(
    subjectRef: string,
    context: import('@/lib/agent/types').StartAgentContext,
    priorRunId: string | null,
  ) {
    const plan = policy.generateStartPlanV2(context, { now: context.collectedAt });
    const projection = projectionMod.buildDecisionProjection(plan, context);
    const { runId } = await telemetry.persistAgentRun({
      plan,
      subjectRef,
      inputGaps: [],
      trigger: 'scheduled',
      mode: 'shadow',
    });
    expect(runId).not.toBeNull();
    await store.attachRunProjection({
      runId: runId!,
      projection,
      fingerprint: projectionMod.decisionFingerprint(projection),
      deltaFromRunId: priorRunId,
    });
    return { runId: runId!, plan, projection };
  }

  it('stores a projection and finds it on the next run', async () => {
    const ref = subjectRef();
    expect(await store.readPriorRun(ref)).toBeNull();

    const first = await recordRun(ref, fixtures.ctx(T1), null);
    const prior = await store.readPriorRun(ref);
    expect(prior?.runId).toBe(first.runId);
    expect(prior?.projection.version).toBe(1);

    const row = await prisma.agentRun.findUnique({ where: { id: first.runId } });
    expect(row?.decisionFingerprint).toMatch(/^[0-9a-f]{32}$/);
    expect(row?.trigger).toBe('scheduled');
    expect(row?.mode).toBe('shadow');
  });

  it('persists deltas with materiality and links the prior run', async () => {
    const ref = subjectRef();
    const before = fixtures.ctx(T1, {
      observations: [fixtures.lane('state_license:VA', 'current', T1)],
    });
    const after = fixtures.ctx(T2, {
      observations: [fixtures.lane('state_license:VA', 'stale', T1)],
    });

    const first = await recordRun(ref, before, null);
    const second = await recordRun(ref, after, first.runId);

    const outcome = diffMod.diffProjections(first.projection, second.projection);
    expect(outcome.comparable).toBe(true);

    const result = await store.persistPlanDeltas({
      runId: second.runId,
      priorRunId: first.runId,
      subjectRef: ref,
      planId: second.plan.planId,
      deltas: outcome.deltas,
    });
    expect(result.persisted).toBe(true);

    const rows = await prisma.agentPlanDelta.findMany({ where: { subjectRef: ref } });
    expect(rows.length).toBe(outcome.deltas.length);
    expect(rows.every((r) => r.priorRunId === first.runId)).toBe(true);
    expect(rows.some((r) => r.kind === 'blocker_opened' && r.material)).toBe(true);

    // deltaFromRunId lands with its writer — the column is not decorative.
    const secondRow = await prisma.agentRun.findUnique({ where: { id: second.runId } });
    expect(secondRow?.deltaFromRunId).toBe(first.runId);
  });

  it('records agent_plan_superseded only when something material changed', async () => {
    const ref = subjectRef();
    const first = await recordRun(ref, fixtures.ctx(T1), null);

    // Non-material only: a re-read that found nothing new.
    const refreshed = fixtures.ctx(T2, {
      observations: [fixtures.lane('nppes_identity', 'current', T2)],
    });
    const second = await recordRun(ref, refreshed, first.runId);
    const quiet = diffMod.diffProjections(first.projection, second.projection);
    expect(quiet.materialCount).toBe(0);
    await store.persistPlanDeltas({
      runId: second.runId,
      priorRunId: first.runId,
      subjectRef: ref,
      planId: second.plan.planId,
      deltas: quiet.deltas,
    });
    expect(
      await prisma.agentEvent.count({
        where: { subjectRef: ref, eventType: 'agent_plan_superseded' },
      }),
    ).toBe(0);

    // Now something material.
    const stale = fixtures.ctx(T2, {
      observations: [fixtures.lane('nppes_identity', 'stale', T2)],
    });
    const third = await recordRun(ref, stale, second.runId);
    const loud = diffMod.diffProjections(second.projection, third.projection);
    expect(loud.materialCount).toBeGreaterThan(0);
    await store.persistPlanDeltas({
      runId: third.runId,
      priorRunId: second.runId,
      subjectRef: ref,
      planId: third.plan.planId,
      deltas: loud.deltas,
    });
    const events = await prisma.agentEvent.findMany({
      where: { subjectRef: ref, eventType: 'agent_plan_superseded' },
    });
    expect(events).toHaveLength(1);
    expect((events[0].metadata as Record<string, unknown>).materialCount).toBe(loud.materialCount);
  });

  it('reports the delta rate an operator would watch during shadow', async () => {
    const summary = await store.deltaRateSummary({ since: new Date('2020-01-01T00:00:00.000Z') });
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.byKind.observation_refreshed_no_change ?? 0).toBeGreaterThan(0);
    // The whole point of shadow: most of what we notice is not worth saying.
    expect(summary.material).toBeLessThan(summary.total);
  });
});
