import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { runNightlyRevalidationJob } from '../revalidation/nightly.js';
import { RevalidationTaskStatus, RevalidationTaskType } from '../../services/revalidation/models/RevalidationTask.js';

const mockCliniciansFindMany = jest.fn();
const mockPecosFindMany = jest.fn();
const mockPecosLifecycleFindMany = jest.fn();
const mockLicenseFindMany = jest.fn();
const mockCredentialFindMany = jest.fn();

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      clinicianProfile: { findMany: mockCliniciansFindMany },
      pECOSProvider: { findMany: mockPecosFindMany },
      pECOSEnrollment: { findMany: mockPecosLifecycleFindMany },
      stateLicenseVerification: { findMany: mockLicenseFindMany },
      credential: { findMany: mockCredentialFindMany },
    })),
  };
});

const mockCalculateRevalidationTasks = jest.fn();
jest.mock('../../services/revalidation/calc.js', () => ({
  calculateRevalidationTasks: (...args: unknown[]) => mockCalculateRevalidationTasks(...args),
}));

const mockUpsertRevalidationTask = jest.fn();
const mockRecordTaskNotification = jest.fn();
const mockShouldNotify = jest.fn();
jest.mock('../../services/revalidation/revalidationTaskService.js', () => ({
  upsertRevalidationTask: (...args: unknown[]) => mockUpsertRevalidationTask(...args),
  recordTaskNotification: (...args: unknown[]) => mockRecordTaskNotification(...args),
  shouldNotify: (...args: unknown[]) => mockShouldNotify(...args),
}));

const mockCreateNotification = jest.fn();
jest.mock('../../services/notifications/notificationService.js', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

describe('runNightlyRevalidationJob', () => {
  const referenceDate = new Date('2025-01-01T00:00:00Z');

  function setupClinicianData() {
    mockCliniciansFindMany.mockResolvedValue([
      { id: 'clin-1', userId: 'user-1', npi: '1234567890', specialty: 'Cardiology' },
    ]);
    mockPecosFindMany.mockResolvedValue([
      {
        id: 'pecos-1',
        clinicianId: 'clin-1',
        enrollmentType: 'CMS855I',
        revalidationDate: new Date('2025-02-01T00:00:00Z'),
        status: 'APPROVED',
        metadata: { payerName: 'Medicare', cycle: 'STANDARD' },
      },
    ]);
    mockPecosLifecycleFindMany.mockResolvedValue([
      {
        id: 'lifecycle-1',
        clinicianId: 'clin-1',
        enrollmentType: 'CMS855I',
        revalidationDueAt: new Date('2025-02-01T00:00:00Z'),
        currentStatus: 'ENROLLED',
      },
    ]);
    mockLicenseFindMany.mockResolvedValue([
      {
        id: 'license-1',
        clinicianId: 'clin-1',
        state: 'CA',
        licenseNumber: 'A12345',
        expiryDate: new Date('2025-03-01T00:00:00Z'),
        status: 'ACTIVE',
        sourceMetadata: { evidenceUrl: 'https://example.com/license' },
      },
    ]);
    mockCredentialFindMany.mockResolvedValue([
      {
        id: 'cred-1',
        userId: 'user-1',
        type: 'DEARegistration',
        name: 'DEA-999',
        status: 'active',
        expiresAt: new Date('2025-01-20T00:00:00Z'),
      },
      {
        id: 'cred-2',
        userId: 'user-1',
        type: 'BoardCertification',
        name: 'Cardiology',
        issuer: 'ABIM',
        status: 'active',
        expiresAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes tasks and upserts them for clinicians', async () => {
    setupClinicianData();

    const mockTask = {
      clinicianId: 'clin-1',
      type: RevalidationTaskType.PECOS,
      status: RevalidationTaskStatus.OPEN,
      dueDate: new Date('2025-02-01T00:00:00Z'),
      source: 'SYSTEM',
      notes: 'Due soon',
      metadata: { referenceId: 'pecos-1' },
    } as any;

    mockCalculateRevalidationTasks.mockReturnValue([mockTask]);
    mockUpsertRevalidationTask.mockResolvedValue({
      ...mockTask,
      id: 'task-1',
      notificationCount: 0,
    });
    mockShouldNotify.mockReturnValue(false);

    const result = await runNightlyRevalidationJob(referenceDate);

    expect(result.cliniciansProcessed).toBe(1);
    expect(result.tasksUpserted).toBe(1);
    expect(mockCalculateRevalidationTasks).toHaveBeenCalledWith(
      expect.objectContaining({ clinicianId: 'clin-1' })
    );
    expect(mockUpsertRevalidationTask).toHaveBeenCalledWith(mockTask);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('sends notifications for tasks due within 30 days when allowed', async () => {
    setupClinicianData();

    const dueSoon = {
      clinicianId: 'clin-1',
      type: RevalidationTaskType.CREDENTIALING,
      status: RevalidationTaskStatus.OPEN,
      dueDate: new Date('2025-01-05T00:00:00Z'),
      source: 'SYSTEM',
      notes: 'DEA expiring',
      metadata: { referenceId: 'DEA-999' },
    } as any;

    mockCalculateRevalidationTasks.mockReturnValue([dueSoon]);
    mockUpsertRevalidationTask.mockResolvedValue({ ...dueSoon, id: 'task-2', notificationCount: 0 });
    mockShouldNotify.mockReturnValue(true);

    const result = await runNightlyRevalidationJob(referenceDate);

    expect(result.notificationsSent).toBe(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      'user-1',
      'revalidation.task.due',
      expect.objectContaining({ taskId: 'task-2' })
    );
    expect(mockRecordTaskNotification).toHaveBeenCalledWith('task-2');
  });

  it('records errors when task computation fails', async () => {
    setupClinicianData();
    mockCalculateRevalidationTasks.mockImplementation(() => {
      throw new Error('calc failed');
    });

    const result = await runNightlyRevalidationJob(referenceDate);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('calc failed');
  });
});
