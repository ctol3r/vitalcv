/**
 * A2.1 — subject scheduling and claiming against a REAL Postgres.
 *
 * The property that matters: a subject is claimed at most once per due
 * window, no matter how many ticks run concurrently or how often one is
 * retried. Gated on DATABASE_URL; wired into the web-quality DB step.
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
let n = 0;
function subjectRef(): string {
  n += 1;
  const ref = `sched-${RUN}-${n}`;
  SUBJECTS.add(ref);
  return ref;
}

const T0 = new Date('2026-08-08T12:00:00.000Z');

describe.skipIf(SKIP)('agent subject schedule (real Postgres)', () => {
  let prisma: import('../lib/generated/prisma').PrismaClient;
  let store: typeof import('@/lib/agent/schedule/subject-schedule');

  beforeAll(async () => {
    prisma = (await import('@/lib/db')).prisma as never;
    store = await import('@/lib/agent/schedule/subject-schedule');
  });

  afterAll(async () => {
    if (SKIP) return;
    await prisma.agentSubjectSchedule.deleteMany({ where: { subjectRef: { in: [...SUBJECTS] } } });
    await prisma.$disconnect();
  });

  it('enrollment is explicit and idempotent', async () => {
    const ref = subjectRef();
    expect(await store.enrollSubject({ subjectRef: ref, npi: '1234567893' })).toEqual({
      enrolled: true,
    });
    expect(await store.enrollSubject({ subjectRef: ref })).toEqual({ enrolled: true });
    expect(await prisma.agentSubjectSchedule.count({ where: { subjectRef: ref } })).toBe(1);
  });

  it('clamps the interval rather than accepting an abusive one', async () => {
    const ref = subjectRef();
    await store.enrollSubject({ subjectRef: ref, intervalMinutes: 1 });
    const row = await prisma.agentSubjectSchedule.findUnique({ where: { subjectRef: ref } });
    expect(row?.intervalMinutes).toBe(60);
  });

  it('claims a due subject and moves its due time forward BEFORE any work', async () => {
    const ref = subjectRef();
    await store.enrollSubject({ subjectRef: ref, firstDueAt: new Date(T0.getTime() - 1000) });

    const claimed = await store.claimDueSubjects({ limit: 10, now: T0 });
    expect(claimed.map((c) => c.subjectRef)).toContain(ref);

    const row = await prisma.agentSubjectSchedule.findUnique({ where: { subjectRef: ref } });
    expect(row!.nextDueAt.getTime()).toBeGreaterThan(T0.getTime());
    expect(row!.lastClaimedAt?.toISOString()).toBe(T0.toISOString());
  });

  it('a second tick in the same window claims nothing — the retry case', async () => {
    const ref = subjectRef();
    await store.enrollSubject({ subjectRef: ref, firstDueAt: new Date(T0.getTime() - 1000) });

    const first = await store.claimDueSubjects({ limit: 10, now: T0 });
    expect(first.map((c) => c.subjectRef)).toContain(ref);

    const second = await store.claimDueSubjects({ limit: 10, now: T0 });
    expect(second.map((c) => c.subjectRef)).not.toContain(ref);
  });

  it('concurrent ticks claim a subject exactly once', async () => {
    const ref = subjectRef();
    await store.enrollSubject({ subjectRef: ref, firstDueAt: new Date(T0.getTime() - 1000) });

    const results = await Promise.all(
      Array.from({ length: 6 }, () => store.claimDueSubjects({ limit: 10, now: T0 })),
    );
    const total = results.flat().filter((c) => c.subjectRef === ref).length;
    expect(total).toBe(1);
  });

  it('never claims a disabled subject', async () => {
    const ref = subjectRef();
    await store.enrollSubject({ subjectRef: ref, firstDueAt: new Date(T0.getTime() - 1000) });
    expect(await store.setSubjectEnabled(ref, false)).toEqual({ updated: true });

    const claimed = await store.claimDueSubjects({ limit: 10, now: T0 });
    expect(claimed.map((c) => c.subjectRef)).not.toContain(ref);
  });

  it('never claims a subject that is not yet due', async () => {
    const ref = subjectRef();
    await store.enrollSubject({ subjectRef: ref, firstDueAt: new Date(T0.getTime() + 3_600_000) });
    const claimed = await store.claimDueSubjects({ limit: 10, now: T0 });
    expect(claimed.map((c) => c.subjectRef)).not.toContain(ref);
  });

  it('respects the batch limit', async () => {
    const refs = [subjectRef(), subjectRef(), subjectRef()];
    for (const ref of refs) {
      await store.enrollSubject({ subjectRef: ref, firstDueAt: new Date(T0.getTime() - 1000) });
    }
    const claimed = await store.claimDueSubjects({ limit: 2, now: T0 });
    expect(claimed.filter((c) => refs.includes(c.subjectRef)).length).toBeLessThanOrEqual(2);
  });

  it('backs off a repeatedly failing subject instead of retrying every cycle', async () => {
    const ref = subjectRef();
    await store.enrollSubject({
      subjectRef: ref,
      intervalMinutes: 60,
      firstDueAt: new Date(T0.getTime() - 1000),
    });
    const row = await prisma.agentSubjectSchedule.findUnique({ where: { subjectRef: ref } });
    await store.recordSubjectFailure({ id: row!.id, error: 'boom', now: T0 });
    await store.recordSubjectFailure({ id: row!.id, error: 'boom', now: T0 });

    // Make it due again, then claim: the backoff multiplier should push the
    // next due time out further than one plain interval.
    await prisma.agentSubjectSchedule.update({
      where: { id: row!.id },
      data: { nextDueAt: new Date(T0.getTime() - 1000) },
    });
    await store.claimDueSubjects({ limit: 10, now: T0 });
    const after = await prisma.agentSubjectSchedule.findUnique({ where: { id: row!.id } });
    expect(after!.consecutiveFailures).toBe(2);
    expect(after!.nextDueAt.getTime()).toBe(T0.getTime() + 60 * 4 * 60_000);
  });

  it('a success clears the failure streak', async () => {
    const ref = subjectRef();
    await store.enrollSubject({ subjectRef: ref });
    const row = await prisma.agentSubjectSchedule.findUnique({ where: { subjectRef: ref } });
    await store.recordSubjectFailure({ id: row!.id, error: 'boom', now: T0 });
    await store.recordSubjectSuccess({ id: row!.id, runId: null, now: T0 });
    const after = await prisma.agentSubjectSchedule.findUnique({ where: { id: row!.id } });
    expect(after!.consecutiveFailures).toBe(0);
    expect(after!.lastError).toBeNull();
  });
});
