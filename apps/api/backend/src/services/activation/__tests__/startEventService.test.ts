const prismaMock = {
  auditEvent: { create: jest.fn(), findMany: jest.fn() },
  activationRequirement: { findMany: jest.fn() },
};

jest.mock('../../../graphql/prisma_client', () => ({ __esModule: true, default: prismaMock }));
jest.mock('../applicationStartCommandService', () => ({
  markApplicationStartReady: jest.fn(),
}));

import { cancelStart, markStartReady } from '../startEventService';
import { markApplicationStartReady } from '../applicationStartCommandService';
import { HttpError } from '../../../utils/httpError';

const markReadyMock = markApplicationStartReady as jest.MockedFunction<typeof markApplicationStartReady>;

/** Seed the derived start-state by returning these START_* audit rows. */
function startEvents(...types: Array<'START_READY' | 'START_RECORDED' | 'START_CANCELLED'>) {
  return types.map((type, i) => ({ type, createdAt: new Date(2026, 4, i + 1) }));
}
function requirements(...rows: Array<{ necessity: string; status: string }>) {
  return rows.map((r, i) => ({ id: `r${i}`, ...r, createdAt: new Date() }));
}

beforeEach(() => {
  prismaMock.auditEvent.create.mockReset().mockResolvedValue({ id: 'a' });
  prismaMock.auditEvent.findMany.mockReset().mockResolvedValue([]);
  prismaMock.activationRequirement.findMany.mockReset().mockResolvedValue([]);
  markReadyMock.mockReset().mockResolvedValue({
    state: 'start_ready', duplicate: false, auditEventId: 'a', activationId: 'activation-1',
  });
});

describe('markStartReady (adapter over the canonical application command)', () => {
  it('refuses when a required requirement is still open, naming the blockers', async () => {
    markReadyMock.mockRejectedValue(new HttpError(409, 'Required items remain unresolved.', 'START_REQUIREMENTS_OPEN'));
    prismaMock.activationRequirement.findMany.mockResolvedValue(
      requirements({ necessity: 'required', status: 'met' }, { necessity: 'required', status: 'submitted' }),
    );
    const res = await markStartReady({ applicationId: 'app-1', organizationId: 'org-1', actorId: 'u1' });
    expect(res.ok).toBe(false);
    if (!res.ok && res.reason === 'not_start_ready') {
      expect(res.blocking).toHaveLength(1);
    }
    expect(markReadyMock).toHaveBeenCalledTimes(1);
  });

  it('delegates the write to the canonical command with the caller-resolved scope', async () => {
    const res = await markStartReady({ applicationId: 'app-1', organizationId: 'org-1', actorId: 'u1' });
    expect(res).toEqual({ ok: true, state: 'start_ready' });
    expect(markReadyMock).toHaveBeenCalledWith({ applicationId: 'app-1', organizationId: 'org-1', actorId: 'u1' });
    // The adapter itself writes nothing — the command owns the transaction.
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
  });

  it('translates an invalid-state refusal into the route vocabulary', async () => {
    markReadyMock.mockRejectedValue(new HttpError(409, 'Already ready.', 'INVALID_START_STATE'));
    prismaMock.auditEvent.findMany.mockResolvedValue(startEvents('START_READY'));
    const res = await markStartReady({ applicationId: 'app-1', organizationId: 'org-1', actorId: 'u1' });
    expect(res).toEqual({ ok: false, reason: 'invalid_state', state: 'start_ready' });
  });

  it('propagates a missing hire-to-start case as its own 404, never a silent ok', async () => {
    markReadyMock.mockRejectedValue(new HttpError(404, 'Hire-to-start case not found.'));
    await expect(markStartReady({ applicationId: 'app-1', organizationId: 'org-1', actorId: 'u1' }))
      .rejects.toMatchObject({ status: 404 });
  });
});

describe('the actual-start writer is gone from this module', () => {
  it('exports no recordStart — actual-first-day flows only through the application command', async () => {
    const surface = await import('../startEventService');
    expect('recordStart' in surface).toBe(false);
  });
});

describe('cancelStart', () => {
  it('supersedes a started application with a reason, keeping history', async () => {
    prismaMock.auditEvent.findMany.mockResolvedValue(startEvents('START_READY', 'START_RECORDED'));
    const res = await cancelStart({ applicationId: 'app-1', organizationId: 'org-1', actorId: 'u1', reasonCode: 'clinician_withdrew' });
    expect(res).toEqual({ ok: true, state: 'cancelled' });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'START_CANCELLED' }) }),
    );
  });
});
