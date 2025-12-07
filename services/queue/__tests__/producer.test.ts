import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { enqueueJob } from '../producer.js';

const createJobQueueEntryMock = jest.fn();
const isJobTypeMock = jest.fn((type: string) =>
  ['PSV_RUN', 'SEND_EMAIL', 'RUN_PILOT_SMOKE', 'SYNC_METRICS', 'PRIVILEGE_ISSUE'].includes(type)
);
const deriveIdempotencyKeyMock = jest.fn();

jest.mock('../models/JobQueue.js', () => ({
  createJobQueueEntry: createJobQueueEntryMock,
  isJobType: isJobTypeMock,
}));

jest.mock('../idempotency.js', () => ({
  deriveIdempotencyKey: deriveIdempotencyKeyMock,
}));

describe('queue producer', () => {
  beforeEach(() => {
    createJobQueueEntryMock.mockReset();
    deriveIdempotencyKeyMock.mockReset();
    deriveIdempotencyKeyMock.mockReturnValue('derived-key');
  });

  it('enqueues supported job types and returns job id', async () => {
    createJobQueueEntryMock.mockResolvedValue({ id: 'job-123', maxAttempts: 5 });

    const payload = { clinicianId: 'abc' };
    const jobId = await enqueueJob('PSV_RUN', payload);

    expect(createJobQueueEntryMock).toHaveBeenCalledWith('PSV_RUN', payload, {
      idempotencyKey: 'derived-key',
    });
    expect(jobId).toBe('job-123');
  });

  it('prefers caller-provided idempotency keys', async () => {
    createJobQueueEntryMock.mockResolvedValue({ id: 'job-abc', maxAttempts: 3 });

    const jobId = await enqueueJob('PRIVILEGE_ISSUE', { foo: 'bar' } as any, {
      idempotencyKey: 'custom-key',
    });

    expect(deriveIdempotencyKeyMock).not.toHaveBeenCalled();
    expect(createJobQueueEntryMock).toHaveBeenCalledWith(
      'PRIVILEGE_ISSUE',
      { foo: 'bar' },
      { idempotencyKey: 'custom-key' }
    );
    expect(jobId).toBe('job-abc');
  });

  it('rejects unsupported job types', async () => {
    await expect(enqueueJob('UNKNOWN' as any, {})).rejects.toThrow('Unsupported job type');
    expect(createJobQueueEntryMock).not.toHaveBeenCalled();
  });
});
