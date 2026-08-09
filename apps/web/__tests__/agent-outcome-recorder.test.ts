/**
 * L3 — the outcome recorder's truth posture.
 *
 * The load-bearing assertions are the refusals, not the writes:
 *   - no run → no event (an outcome cannot join a plan that never existed);
 *   - no subject key → no event;
 *   - a thrown read or failed write degrades to recorded:false, never throws
 *     into the hiring route;
 * plus the two resolution paths (subjectRef for clinician sessions, npi for
 * employer actors) stamping `resolvedBy` so analysis can weight the join.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const findFirstMock = vi.fn();
const createMock = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    agentRun: { findFirst: (...args: unknown[]) => findFirstMock(...args) },
    agentEvent: { create: (...args: unknown[]) => createMock(...args) },
  },
}));

const { classifyWorkflowKind, recordHiringOutcome } = await import(
  '@/lib/agent/outcomes/record-outcome'
);

const RUN = { id: 'run-1', planId: 'plan-1', subjectRef: 'user_abc' };

beforeEach(() => {
  findFirstMock.mockReset();
  createMock.mockReset();
  createMock.mockResolvedValue({});
});

describe('recordHiringOutcome — refusals', () => {
  it('records nothing when the subject has no agent run', async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await recordHiringOutcome({
      kind: 'application',
      ref: 'app-1',
      subjectRef: 'user_never_planned',
    });

    expect(result).toEqual({ recorded: false, reason: 'no_agent_run' });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('records nothing without a subject key or with an empty ref', async () => {
    expect(await recordHiringOutcome({ kind: 'start', ref: 'x' })).toEqual({
      recorded: false,
      reason: 'no_subject_key',
    });
    expect(
      await recordHiringOutcome({ kind: 'start', ref: '', subjectRef: 'user_abc' }),
    ).toEqual({ recorded: false, reason: 'no_subject_key' });
    expect(findFirstMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('degrades to recorded:false when the run read throws — never into the route', async () => {
    findFirstMock.mockRejectedValue(new Error('db down'));

    await expect(
      recordHiringOutcome({ kind: 'application', ref: 'app-1', subjectRef: 'user_abc' }),
    ).resolves.toEqual({ recorded: false, reason: 'error' });
  });

  it('reports write_failed when the event write fails', async () => {
    findFirstMock.mockResolvedValue(RUN);
    createMock.mockRejectedValue(new Error('insert failed'));

    const result = await recordHiringOutcome({
      kind: 'application',
      ref: 'app-1',
      subjectRef: 'user_abc',
    });

    expect(result).toEqual({ recorded: false, reason: 'write_failed' });
  });
});

describe('recordHiringOutcome — resolution and the written row', () => {
  it('resolves by subjectRef and writes the joined event', async () => {
    findFirstMock.mockResolvedValue(RUN);

    const result = await recordHiringOutcome({
      kind: 'application',
      ref: 'app-1',
      subjectRef: 'user_abc',
      metadata: { opportunityId: 'opp-9' },
    });

    expect(result).toEqual({ recorded: true });
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { subjectRef: 'user_abc' } }),
    );
    const row = createMock.mock.calls[0][0].data;
    expect(row.eventType).toBe('agent_outcome_observed');
    expect(row.planId).toBe('plan-1');
    expect(row.runId).toBe('run-1');
    expect(row.subjectRef).toBe('user_abc');
    expect(row.relatedKind).toBe('application');
    expect(row.relatedRef).toBe('app-1');
    expect(row.metadata).toEqual({ opportunityId: 'opp-9', resolvedBy: 'subject_ref' });
  });

  it('falls back to npi resolution for employer-actor routes', async () => {
    findFirstMock.mockResolvedValue(RUN);

    const result = await recordHiringOutcome({
      kind: 'start',
      ref: 'artifact-7',
      npi: '1234567893',
    });

    expect(result).toEqual({ recorded: true });
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { npi: '1234567893' } }),
    );
    const row = createMock.mock.calls[0][0].data;
    // The event is attributed to the RUN's subject, never to the caller.
    expect(row.subjectRef).toBe('user_abc');
    expect(row.relatedKind).toBe('start');
    expect(row.metadata).toEqual({ resolvedBy: 'npi' });
  });

  it('prefers subjectRef when both keys are present', async () => {
    findFirstMock.mockResolvedValue(RUN);

    await recordHiringOutcome({
      kind: 'offer',
      ref: 'app-2',
      subjectRef: 'user_abc',
      npi: '1234567893',
    });

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { subjectRef: 'user_abc' } }),
    );
  });
});

describe('classifyWorkflowKind', () => {
  it('maps interview and offer actions, and falls back to application', () => {
    expect(classifyWorkflowKind('schedule_interview')).toBe('interview');
    expect(classifyWorkflowKind('INTERVIEW_COMPLETED')).toBe('interview');
    expect(classifyWorkflowKind('extend_offer')).toBe('offer');
    expect(classifyWorkflowKind('advance_stage')).toBe('application');
    expect(classifyWorkflowKind('')).toBe('application');
  });
});
