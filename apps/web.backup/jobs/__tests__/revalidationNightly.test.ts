import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { runNightlyRevalidationJob } from '../revalidation/nightly.js';

const mockPrisma = {
  clinicianProfile: {
    findMany: jest.fn(),
  },
  payerEnrollment: {
    findMany: jest.fn(),
  },
  privilegeGranted: {
    findMany: jest.fn(),
  },
  revalidationTask: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
} as any;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  Prisma: {},
}));

const mockCreateNotification = jest.fn();
jest.mock('../../services/notifications/notificationService.js', () => ({
  createNotification: (...args: any[]) => mockCreateNotification(...args),
}));

describe('nightly revalidation job', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const dueSoon = new Date();
    dueSoon.setDate(dueSoon.getDate() + 10);

    mockPrisma.clinicianProfile.findMany.mockResolvedValue([
      { id: 'cp-1', userId: 'user-1', npi: '123', state: 'CA' },
    ]);
    mockPrisma.payerEnrollment.findMany.mockResolvedValue([
      {
        id: 'enroll-1',
        revalidationDueAt: dueSoon,
        pecosEnrollmentId: 'pecos-1',
        pecosStatus: 'APPROVED',
        payer: { name: 'Medicare' },
      },
    ]);
    mockPrisma.privilegeGranted.findMany.mockResolvedValue([]);
    mockPrisma.revalidationTask.findMany.mockResolvedValue([]);
    mockPrisma.revalidationTask.create.mockResolvedValue({
      id: 'task-1',
      clinicianId: 'user-1',
      type: 'PECOS',
      dueDate: dueSoon,
      status: 'OPEN',
      source: 'SYSTEM',
      notificationCount: 0,
    });
    mockPrisma.revalidationTask.update.mockResolvedValue({
      id: 'task-1',
      clinicianId: 'user-1',
      type: 'PECOS',
      dueDate: dueSoon,
      status: 'OPEN',
      source: 'SYSTEM',
      notificationCount: 1,
    });
    mockCreateNotification.mockResolvedValue(undefined);
  });

  it('creates tasks and sends notifications for due items', async () => {
    const result = await runNightlyRevalidationJob();

    expect(result.tasksCreated).toBe(1);
    expect(result.notificationsSent).toBeGreaterThanOrEqual(1);
    expect(mockPrisma.revalidationTask.create).toHaveBeenCalled();
    expect(mockCreateNotification).toHaveBeenCalledWith(
      'user-1',
      'REVALIDATION_TASK_DUE',
      expect.any(Object)
    );
  });
});

