import { describe, it, expect } from '@jest/globals';
import { calculateRevalidationTasks } from '../calc.js';
import {
  RevalidationTaskStatus,
  RevalidationTaskType,
} from '../models/RevalidationTask.js';

describe('calculateRevalidationTasks', () => {
  const clinicianId = 'clinician-test';
  const referenceDate = new Date('2025-01-01T00:00:00Z');

  it('creates overdue credentialing task for expired license', () => {
    const tasks = calculateRevalidationTasks({
      clinicianId,
      referenceDate,
      licenses: [
        {
          state: 'CA',
          licenseNumber: 'A12345',
          expiresAt: new Date('2024-12-01T00:00:00Z'),
          status: 'EXPIRED',
        },
      ],
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe(RevalidationTaskType.CREDENTIALING);
    expect(tasks[0].status).toBe(RevalidationTaskStatus.OVERDUE);
    expect(tasks[0].metadata?.category).toBe('STATE_LICENSE');
  });

  it('flags DEA registration expiring within 60 days', () => {
    const tasks = calculateRevalidationTasks({
      clinicianId,
      referenceDate,
      dea: [
        {
          registrationNumber: 'DEA-999',
          expiresAt: new Date('2025-02-15T00:00:00Z'),
          status: 'ACTIVE',
        },
      ],
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe(RevalidationTaskType.CREDENTIALING);
    expect(tasks[0].status).toBe(RevalidationTaskStatus.OPEN);
    expect(tasks[0].notes).toContain('DEA');
  });

  it('includes PECOS task due within 3 months', () => {
    const tasks = calculateRevalidationTasks({
      clinicianId,
      referenceDate,
      pecos: [
        {
          enrollmentId: 'pecos-1',
          payerName: 'Medicare',
          revalidationDueDate: new Date('2025-03-31T00:00:00Z'),
        },
      ],
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe(RevalidationTaskType.PECOS);
    expect(tasks[0].status).toBe(RevalidationTaskStatus.OPEN);
    expect(tasks[0].metadata?.payerName).toBe('Medicare');
  });
});
