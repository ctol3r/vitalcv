const prismaMock = {
  auditEvent: { create: jest.fn(), findMany: jest.fn() },
  activationRequirement: { findMany: jest.fn() },
};

jest.mock('../../../graphql/prisma_client', () => ({ __esModule: true, default: prismaMock }));

import { cancelStart, markStartReady, recordStart } from '../startEventService';

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
});

describe('markStartReady', () => {
  it('refuses when a required requirement is still open, naming the blockers', async () => {
    prismaMock.activationRequirement.findMany.mockResolvedValue(
      requirements({ necessity: 'required', status: 'met' }, { necessity: 'required', status: 'submitted' }),
    );
    const res = await markStartReady({ applicationId: 'app-1', organizationId: 'org-1', actorId: 'u1' });
    expect(res.ok).toBe(false);
    if (!res.ok && res.reason === 'not_start_ready') {
      expect(res.blocking).toHaveLength(1);
    }
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled(); // no event written on refusal
  });

  it('writes START_READY when every required requirement is resolved', async () => {
    prismaMock.activationRequirement.findMany.mockResolvedValue(
      requirements({ necessity: 'required', status: 'met' }, { necessity: 'preferred', status: 'blocked' }),
    );
    const res = await markStartReady({ applicationId: 'app-1', organizationId: 'org-1', actorId: 'u1' });
    expect(res).toEqual({ ok: true, state: 'start_ready' });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'START_READY', referenceId: 'app-1' }) }),
    );
  });

  it('refuses to re-mark when already start_ready', async () => {
    prismaMock.auditEvent.findMany.mockResolvedValue(startEvents('START_READY'));
    const res = await markStartReady({ applicationId: 'app-1', organizationId: 'org-1', actorId: 'u1' });
    expect(res).toEqual({ ok: false, reason: 'invalid_state', state: 'start_ready' });
  });
});

describe('recordStart', () => {
  it('records a start only from start_ready', async () => {
    prismaMock.auditEvent.findMany.mockResolvedValue(startEvents('START_READY'));
    const res = await recordStart({ applicationId: 'app-1', organizationId: 'org-1', actorId: 'u1', startedAt: '2026-06-01T00:00:00Z' });
    expect(res).toEqual({ ok: true, state: 'started' });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'START_RECORDED' }) }),
    );
  });

  it('never infers a start from an unready application', async () => {
    prismaMock.auditEvent.findMany.mockResolvedValue([]); // no start-ready event
    const res = await recordStart({ applicationId: 'app-1', organizationId: 'org-1', actorId: 'u1', startedAt: '2026-06-01T00:00:00Z' });
    expect(res).toEqual({ ok: false, reason: 'invalid_state', state: 'not_ready' });
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
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
