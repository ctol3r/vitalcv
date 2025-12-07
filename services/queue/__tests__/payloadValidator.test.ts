import { describe, expect, it } from '@jest/globals';
import type { JobQueueRecord } from '../models/JobQueue.js';
import {
  JobPayloadValidationError,
  parseJobPayload,
  validateJobPayload,
} from '../validation/payloadValidator.js';

function buildJob(overrides: Partial<JobQueueRecord>): JobQueueRecord {
  return {
    id: 'job-1',
    type: 'PSV_RUN',
    payload: {
      clinicianId: 'clin-1',
      npi: '1234567890',
      state: 'CA',
      licenseNumber: 'LIC-123',
    },
    status: 'PENDING',
    attempts: 1,
    maxAttempts: 5,
    lastError: null,
    startedAt: null,
    completedAt: null,
    lastRunAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as JobQueueRecord;
}

describe('Job payload validator', () => {
  it('accepts valid PSV payloads', () => {
    const job = buildJob({});
    const result = validateJobPayload(job);
    expect(result.success).toBe(true);
  });

  it('rejects invalid payloads and surfaces issues', () => {
    const job = buildJob({ payload: {} });
    const result = validateJobPayload(job);

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(JobPayloadValidationError);
    expect(result.error?.issues).toHaveLength(4);
  });

  it('parses payloads into typed output', () => {
    const job = buildJob({});
    const payload = parseJobPayload(job, 'PSV_RUN');
    expect(payload.clinicianId).toBe('clin-1');
    expect(payload.licenseNumber).toBe('LIC-123');
  });
});

