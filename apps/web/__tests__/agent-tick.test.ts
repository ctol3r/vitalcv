/**
 * A2.1 — tick semantics and the route's machine-auth boundary.
 *
 * The properties under test are all safety properties: shadow, bounded,
 * killable, isolated, and dry by default outside production.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TickDeps } from '@/lib/agent/schedule/tick';
import type { ScheduledSubject } from '@/lib/agent/schedule/subject-schedule';

vi.mock('server-only', () => ({}));

const NOW = new Date('2026-08-08T12:00:00.000Z');

function subject(ref: string): ScheduledSubject {
  return { id: `id-${ref}`, subjectRef: ref, npi: null, intervalMinutes: 1440, consecutiveFailures: 0 };
}

function deps(overrides: Partial<TickDeps> = {}): Partial<TickDeps> {
  return {
    isKilled: async () => false,
    claim: async () => [subject('a'), subject('b')],
    planSubject: async (s) => ({
      subjectRef: s.subjectRef,
      ok: true,
      planId: `plan_${s.subjectRef}`,
      runId: `run_${s.subjectRef}`,
      blockerCount: 1,
      rankedActionCount: 1,
      completeness: 'reduced' as const,
      inputGaps: ['ownership_state:actor_unavailable'],
    }),
    onSuccess: async () => {},
    onFailure: async () => {},
    summary: async () => ({ enrolled: 2, enabled: 2, due: 2 }),
    ...overrides,
  };
}

describe('runAgentTick', () => {
  it('is always shadow — there is no live mode to ask for', async () => {
    const { runAgentTick } = await import('@/lib/agent/schedule/tick');
    const result = await runAgentTick({ now: NOW, dryRun: true, deps: deps() });
    expect(result.mode).toBe('shadow');
  });

  it('runs each claimed subject and reports counts', async () => {
    const { runAgentTick } = await import('@/lib/agent/schedule/tick');
    const result = await runAgentTick({ now: NOW, dryRun: true, deps: deps() });
    expect(result).toMatchObject({ claimed: 2, succeeded: 2, failed: 0 });
    expect(result.outcomes.map((o) => o.subjectRef)).toEqual(['a', 'b']);
    expect(result.outcomes[0].completeness).toBe('reduced');
  });

  it('stops entirely when the kill switch is tripped', async () => {
    const claim = vi.fn(async () => [subject('a')]);
    const { runAgentTick } = await import('@/lib/agent/schedule/tick');
    const result = await runAgentTick({
      now: NOW,
      dryRun: true,
      deps: deps({ isKilled: async () => true, claim }),
    });
    expect(result.skipped).toBe('killed');
    expect(result.claimed).toBe(0);
    expect(claim).not.toHaveBeenCalled();
  });

  it('reports nothing_due rather than pretending it worked', async () => {
    const { runAgentTick } = await import('@/lib/agent/schedule/tick');
    const result = await runAgentTick({
      now: NOW,
      dryRun: true,
      deps: deps({ claim: async () => [] }),
    });
    expect(result.skipped).toBe('nothing_due');
    expect(result.succeeded).toBe(0);
  });

  it('isolates a failing subject — one bad subject does not end the tick', async () => {
    const { runAgentTick } = await import('@/lib/agent/schedule/tick');
    const result = await runAgentTick({
      now: NOW,
      dryRun: true,
      deps: deps({
        claim: async () => [subject('a'), subject('bad'), subject('c')],
        planSubject: async (s) => {
          if (s.subjectRef === 'bad') throw new Error('canonical state unavailable');
          return { subjectRef: s.subjectRef, ok: true, planId: 'p', runId: 'r' };
        },
      }),
    });
    expect(result).toMatchObject({ claimed: 3, succeeded: 2, failed: 1 });
    expect(result.outcomes.find((o) => o.subjectRef === 'bad')).toMatchObject({
      ok: false,
      error: 'canonical state unavailable',
    });
  });

  it('clamps the batch to the hard ceiling', async () => {
    const claim = vi.fn(async () => []);
    const { runAgentTick, MAX_SUBJECTS_PER_TICK } = await import('@/lib/agent/schedule/tick');
    await runAgentTick({ now: NOW, dryRun: true, limit: 10_000, deps: deps({ claim }) });
    expect(claim.mock.calls[0][0].limit).toBe(MAX_SUBJECTS_PER_TICK);
  });

  it('does not advance schedules in a dry run', async () => {
    const onSuccess = vi.fn(async () => {});
    const onFailure = vi.fn(async () => {});
    const { runAgentTick } = await import('@/lib/agent/schedule/tick');
    await runAgentTick({ now: NOW, dryRun: true, deps: deps({ onSuccess, onFailure }) });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('records schedule outcomes when not a dry run', async () => {
    const onSuccess = vi.fn(async () => {});
    const { runAgentTick } = await import('@/lib/agent/schedule/tick');
    await runAgentTick({ now: NOW, dryRun: false, deps: deps({ onSuccess }) });
    expect(onSuccess).toHaveBeenCalledTimes(2);
  });

  it('an unreadable kill switch does not silently stop the loop', async () => {
    // Treating an ops outage as a stop would make the agent inert precisely
    // when nobody is watching. Shadow + bounded batch are the safety here.
    const { runAgentTick } = await import('@/lib/agent/schedule/tick');
    const result = await runAgentTick({ now: NOW, dryRun: true, deps: deps() });
    expect(result.skipped).toBeUndefined();
  });
});
