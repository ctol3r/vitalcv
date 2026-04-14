jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    acceptance: { findMany: jest.fn() },
    actionLog: { findMany: jest.fn() },
  },
}));

import prisma from '../../../graphql/prisma_client';
import { computeReuseSignal } from '../reuseSignal';

const prismaMock = prisma as unknown as {
  acceptance: { findMany: jest.Mock };
  actionLog: { findMany: jest.Mock };
};

describe('computeReuseSignal', () => {
  beforeEach(() => {
    prismaMock.acceptance.findMany.mockReset();
    prismaMock.actionLog.findMany.mockReset();
  });

  it('returns an empty signal when no acceptances or actions exist', async () => {
    prismaMock.acceptance.findMany.mockResolvedValue([]);
    prismaMock.actionLog.findMany.mockResolvedValue([]);

    const signal = await computeReuseSignal('1234567890');

    expect(signal).toEqual({
      accepted_count: 0,
      flagged_count: 0,
      request_data_count: 0,
      last_action: null,
      last_action_at: null,
    });
  });

  it('counts acceptances, flags, and data requests', async () => {
    prismaMock.acceptance.findMany.mockResolvedValue([
      { acceptedAt: new Date('2026-04-10T00:00:00.000Z') },
      { acceptedAt: new Date('2026-04-01T00:00:00.000Z') },
    ]);
    prismaMock.actionLog.findMany.mockResolvedValue([
      { action: 'flag', createdAt: new Date('2026-04-12T00:00:00.000Z') },
      { action: 'request_data', createdAt: new Date('2026-04-08T00:00:00.000Z') },
      { action: 'request_data', createdAt: new Date('2026-04-05T00:00:00.000Z') },
    ]);

    const signal = await computeReuseSignal('1234567890');

    expect(signal).toEqual({
      accepted_count: 2,
      flagged_count: 1,
      request_data_count: 2,
      last_action: 'flag',
      last_action_at: '2026-04-12T00:00:00.000Z',
    });
  });

  it('reports accept as last_action when an acceptance is newer than any action-log entry', async () => {
    prismaMock.acceptance.findMany.mockResolvedValue([
      { acceptedAt: new Date('2026-04-13T12:00:00.000Z') },
    ]);
    prismaMock.actionLog.findMany.mockResolvedValue([
      { action: 'flag', createdAt: new Date('2026-04-10T00:00:00.000Z') },
    ]);

    const signal = await computeReuseSignal('1234567890');

    expect(signal.last_action).toBe('accept');
    expect(signal.last_action_at).toBe('2026-04-13T12:00:00.000Z');
    expect(signal.accepted_count).toBe(1);
    expect(signal.flagged_count).toBe(1);
  });

  it('reports the logged action when it is newer than any acceptance', async () => {
    prismaMock.acceptance.findMany.mockResolvedValue([
      { acceptedAt: new Date('2026-04-01T00:00:00.000Z') },
    ]);
    prismaMock.actionLog.findMany.mockResolvedValue([
      { action: 'request_data', createdAt: new Date('2026-04-10T00:00:00.000Z') },
    ]);

    const signal = await computeReuseSignal('1234567890');

    expect(signal.last_action).toBe('request_data');
    expect(signal.last_action_at).toBe('2026-04-10T00:00:00.000Z');
  });
});
