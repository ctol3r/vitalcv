import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { replayJob } from '../../../cli/commands/queueReplay.js';

const handlerMap: Record<string, jest.Mock> = {};
const getJobByIdMock = jest.fn();
const traceQueueJobMock = jest.fn(async (_job, handler) => handler());

jest.mock('../../../services/queue/models/JobQueue.js', () => ({
  getJobById: (id: string) => getJobByIdMock(id),
}));

jest.mock('../../../services/queue/handlers/index.js', () => ({
  getJobHandler: (type: string) => handlerMap[type],
}));

jest.mock('../../../services/queue/tracing/jobTracer.js', () => ({
  traceQueueJob: (...args: Parameters<typeof traceQueueJobMock>) => traceQueueJobMock(...args),
}));

jest.mock('@chai-vc/logging-core', () => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn().mockReturnThis(),
  };
  return {
    createLogger: jest.fn(() => logger),
    serializeError: jest.fn((error) =>
      error instanceof Error ? { message: error.message } : { message: String(error) }
    ),
  };
});

describe('queue replay cli', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(handlerMap)) {
      delete handlerMap[key];
    }
    delete process.env.SANDBOX_MODE;
  });

  function buildJob(overrides: Record<string, unknown> = {}) {
    const now = new Date();
    return {
      id: 'job-1',
      type: 'EHR_SYNC',
      status: 'FAILED',
      payload: { syncId: 'sync-123' },
      attempts: 1,
      maxAttempts: 5,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      lastError: null,
      ...overrides,
    };
  }

  it('replays EHR_SYNC job with sandbox enforcement', async () => {
    const job = buildJob({ id: 'ehr-1', type: 'EHR_SYNC', status: 'FAILED' });
    handlerMap.EHR_SYNC = jest.fn().mockResolvedValue(undefined);
    getJobByIdMock.mockResolvedValue(job);

    await replayJob({ jobId: job.id });

    expect(handlerMap.EHR_SYNC).toHaveBeenCalledWith(job);
    expect(traceQueueJobMock).toHaveBeenCalled();
    expect(process.env.SANDBOX_MODE).toBe('true');
  });

  it('rejects jobs that are not failed or completed', async () => {
    const pendingJob = buildJob({ status: 'PENDING', id: 'job-pending' });
    handlerMap[pendingJob.type] = jest.fn();
    getJobByIdMock.mockResolvedValue(pendingJob);

    await expect(replayJob({ jobId: pendingJob.id })).rejects.toThrow(/only failed or completed/i);
    expect(handlerMap[pendingJob.type]).not.toHaveBeenCalled();
  });

  it('replays DRIFT_SWEEP job with sandbox disabled', async () => {
    const job = buildJob({ id: 'drift-1', type: 'DRIFT_SWEEP', status: 'FAILED_FINAL' });
    handlerMap.DRIFT_SWEEP = jest.fn().mockResolvedValue(undefined);
    getJobByIdMock.mockResolvedValue(job);
    process.env.SANDBOX_MODE = 'false';

    await replayJob({ jobId: job.id, sandbox: false });

    expect(handlerMap.DRIFT_SWEEP).toHaveBeenCalledWith(job);
    expect(process.env.SANDBOX_MODE).toBe('false');
  });
});

