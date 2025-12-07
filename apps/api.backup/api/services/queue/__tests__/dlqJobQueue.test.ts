import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const upsertMock = jest.fn();
const findUniqueMock = jest.fn();

jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  return {
    ...actual,
    PrismaClient: jest.fn().mockImplementation(() => ({
      dLQJobQueue: {
        upsert: upsertMock,
        findUnique: findUniqueMock,
      },
    })),
  };
});

import { persistDLQJob } from '../models/DLQJobQueue.js';

describe('DLQJobQueue model', () => {
  beforeEach(() => {
    upsertMock.mockReset();
    findUniqueMock.mockReset();
  });

  it('persists failed jobs with payload and error metadata', async () => {
    const job = {
      id: 'job-1',
      type: 'PSV_RUN',
      payload: { clinicianId: 'clin-1' },
      attempts: 3,
      maxAttempts: 3,
      traceContext: { traceparent: '00-abc' },
    } as any;

    const error = {
      name: 'Error',
      message: 'boom',
      type: 'Error',
    };

    await persistDLQJob({ job, error });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const args = upsertMock.mock.calls[0][0];
    expect(args.where).toEqual({ jobId: 'job-1' });
    expect(args.create).toMatchObject({
      jobId: 'job-1',
      type: 'PSV_RUN',
      attempts: 3,
      error,
      lastError: 'boom',
    });
  });
});

