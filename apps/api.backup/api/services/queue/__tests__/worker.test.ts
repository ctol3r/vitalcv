import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const markJobCompletedMock = jest.fn();
const markJobFailureMock = jest.fn();
const getJobHandlerMock = jest.fn();
const validateJobPayloadMock = jest.fn();
const parseJobPayloadMock = jest.fn();
const persistDLQJobMock = jest.fn();
const logCredentialTimelineEventMock = jest.fn();
const createJobLoggerMock = jest.fn(() => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../models/JobQueue.js', () => ({
  markJobCompleted: markJobCompletedMock,
  markJobFailure: markJobFailureMock,
}));

jest.mock('../handlers/index.js', () => ({
  getJobHandler: getJobHandlerMock,
}));

jest.mock('@packages/queue-core', () => ({
  createJobLogger: createJobLoggerMock,
  withJobSpan: jest.fn(async (_job, callback) => callback()),
}));

jest.mock('../validation/payloadValidator.js', () => ({
  validateJobPayload: validateJobPayloadMock,
  parseJobPayload: parseJobPayloadMock,
}));

jest.mock('../models/DLQJobQueue.js', () => ({
  persistDLQJob: persistDLQJobMock,
}));

jest.mock('../timeline/logCredentialTimelineEvent.js', () => ({
  logCredentialTimelineEvent: logCredentialTimelineEventMock,
}));

import { QueueWorker } from '../worker.js';

function buildJob(overrides: Partial<any> = {}): any {
  return {
    id: 'job-1',
    type: 'PSV_RUN',
    payload: { clinicianId: 'clin-1', npi: '123', state: 'CA', licenseNumber: 'LIC-1' },
    attempts: 1,
    maxAttempts: 3,
    ...overrides,
  };
}

describe('QueueWorker processJob', () => {
  beforeEach(() => {
    markJobCompletedMock.mockReset();
    markJobFailureMock.mockReset();
    getJobHandlerMock.mockReset();
    validateJobPayloadMock.mockReset();
    parseJobPayloadMock.mockReset();
    persistDLQJobMock.mockReset();
    logCredentialTimelineEventMock.mockReset();
    createJobLoggerMock.mockClear();
  });

  it('sinks terminal handler failures to the DLQ and timeline', async () => {
    const job = buildJob();
    const handlerError = new Error('boom');
    validateJobPayloadMock.mockReturnValue({ success: true });
    getJobHandlerMock.mockReturnValue(jest.fn().mockRejectedValue(handlerError));
    markJobFailureMock.mockResolvedValue({ final: true, job });
    parseJobPayloadMock.mockReturnValue({
      clinicianId: 'clin-1',
      npi: '123',
      state: 'CA',
      licenseNumber: 'LIC-1',
    });

    const worker = new QueueWorker();
    await (worker as any).processJob(job);

    expect(markJobFailureMock).toHaveBeenCalledWith(job, handlerError);
    expect(persistDLQJobMock).toHaveBeenCalledTimes(1);
    expect(logCredentialTimelineEventMock).toHaveBeenCalledTimes(1);
  });

  it('fail-fast invalid payloads and never invoke handlers', async () => {
    const job = buildJob();
    const validationError = new Error('invalid');
    validateJobPayloadMock.mockReturnValue({ success: false, error: validationError });
    markJobFailureMock.mockResolvedValue({ final: true, job });

    const worker = new QueueWorker();
    await (worker as any).processJob(job);

    expect(getJobHandlerMock).not.toHaveBeenCalled();
    expect(markJobFailureMock).toHaveBeenCalledWith(job, validationError, { forceFinal: true });
    expect(persistDLQJobMock).toHaveBeenCalledTimes(1);
  });
});

