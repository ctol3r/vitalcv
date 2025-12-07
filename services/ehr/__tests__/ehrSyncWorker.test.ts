import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { processEhrSynchronization } from '../workers/ehrSyncWorker.js';
import { EhrSynchronizationStatus } from '../models/EHRSynchronization.js';

const findUniqueMock = jest.fn();
const updateMock = jest.fn();
const getEhrAdapterMock = jest.fn();
const assignPrivilegeMock = jest.fn();

jest.mock('../../logging/serviceLogger.js', () => ({
  getServiceLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    ehrSynchronization: {
      findUnique: findUniqueMock,
      update: updateMock,
    },
  })),
}));

jest.mock('../adapters/index.js', () => ({
  getEhrAdapter: (system: string) => getEhrAdapterMock(system),
}));

describe('ehrSyncWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    let attemptCounter = 0;
    updateMock.mockImplementation(async (args) => {
      if (args.select?.attemptCount) {
        attemptCounter += 1;
        return { attemptCount: attemptCounter };
      }
      return args;
    });

    findUniqueMock.mockResolvedValue({
      id: 'sync-1',
      clinicianId: 'clinician-1',
      privilegeCode: 'CARD-SURG',
      ehrSystem: 'epic',
      attemptCount: 0,
      metadata: {},
    });

    assignPrivilegeMock.mockResolvedValue({
      success: true,
      status: EhrSynchronizationStatus.SYNCED,
      rawResponse: { ok: true },
    });

    getEhrAdapterMock.mockReturnValue({
      assignPrivilege: assignPrivilegeMock,
    });
  });

  it('marks synchronization as synced when adapter succeeds', async () => {
    await expect(
      processEhrSynchronization('sync-1', {
        sleepFn: async () => Promise.resolve(),
      })
    ).resolves.not.toThrow();

    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: 'sync-1' } });
    expect(assignPrivilegeMock).toHaveBeenCalledTimes(1);
    const successUpdate = updateMock.mock.calls.find(
      ([args]: any) => args.data?.status === EhrSynchronizationStatus.SYNCED
    );
    expect(successUpdate).toBeTruthy();
  });

  it('retries adapter failures and throws after exhausting attempts', async () => {
    assignPrivilegeMock.mockResolvedValueOnce({
      success: false,
      status: EhrSynchronizationStatus.FAILED,
      rawResponse: { ok: false },
      error: 'network',
    });
    assignPrivilegeMock.mockResolvedValueOnce({
      success: false,
      status: EhrSynchronizationStatus.FAILED,
      rawResponse: { ok: false },
      error: 'network',
    });
    assignPrivilegeMock.mockResolvedValueOnce({
      success: false,
      status: EhrSynchronizationStatus.FAILED,
      rawResponse: { ok: false },
      error: 'network',
    });

    await expect(
      processEhrSynchronization('sync-1', {
        maxAdapterAttempts: 3,
        sleepFn: async () => Promise.resolve(),
      })
    ).rejects.toThrow(/failed after retries/i);

    expect(assignPrivilegeMock).toHaveBeenCalledTimes(3);
    const failedUpdate = updateMock.mock.calls.find(
      ([args]: any) => args.data?.status === EhrSynchronizationStatus.FAILED
    );
    expect(failedUpdate).toBeTruthy();
  });
});
