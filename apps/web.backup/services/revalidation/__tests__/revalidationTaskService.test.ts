import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  createRevalidationTask,
  deleteRevalidationTask,
  listRevalidationTasks,
  markRevalidationTaskCompleted,
  recordTaskNotification,
  shouldNotify,
  updateRevalidationTask,
  upsertRevalidationTask,
} from '../revalidationTaskService.js';
import {
  RevalidationTaskSource,
  RevalidationTaskStatus,
  RevalidationTaskType,
} from '../models/RevalidationTask.js';

const mockPrisma = {
  revalidationTask: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
  },
} as any;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

describe('revalidationTaskService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a task with validated payload', async () => {
    mockPrisma.revalidationTask.create.mockResolvedValue({
      id: 'task-1',
      clinicianId: 'clinician-1',
      type: RevalidationTaskType.PECOS,
      dueDate: new Date('2025-03-01T00:00:00Z'),
      status: RevalidationTaskStatus.OPEN,
      source: RevalidationTaskSource.SYSTEM,
      notes: 'Due in 90 days',
      metadata: { referenceId: 'pecos-123' },
    });

    const result = await createRevalidationTask({
      clinicianId: 'clinician-1',
      type: RevalidationTaskType.PECOS,
      dueDate: new Date('2025-03-01T00:00:00Z'),
      notes: 'Due in 90 days',
      metadata: {
        referenceId: 'pecos-123',
      },
    });

    expect(mockPrisma.revalidationTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicianId: 'clinician-1',
        type: RevalidationTaskType.PECOS,
      }),
    });
    expect(result.id).toBe('task-1');
  });

  it('lists tasks with default non-completed filter', async () => {
    mockPrisma.revalidationTask.findMany.mockResolvedValue([]);

    await listRevalidationTasks();

    expect(mockPrisma.revalidationTask.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: { not: RevalidationTaskStatus.COMPLETED },
      }),
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('updates a task and preserves metadata merge', async () => {
    mockPrisma.revalidationTask.update.mockResolvedValue({
      id: 'task-1',
      clinicianId: 'clinician-1',
      type: RevalidationTaskType.CREDENTIALING,
      dueDate: new Date('2025-04-01T00:00:00Z'),
      status: RevalidationTaskStatus.IN_PROGRESS,
      source: RevalidationTaskSource.USER,
      notes: 'Working with board office',
    });

    const result = await updateRevalidationTask('task-1', {
      status: RevalidationTaskStatus.IN_PROGRESS,
      notes: 'Working with board office',
      metadata: {
        category: 'BOARD',
        referenceId: 'board-xyz',
      },
    });

    expect(mockPrisma.revalidationTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({
        status: RevalidationTaskStatus.IN_PROGRESS,
      }),
    });
    expect(result.status).toBe(RevalidationTaskStatus.IN_PROGRESS);
  });

  it('marks a task completed with timestamp', async () => {
    const completed = new Date('2025-02-01T00:00:00Z');
    mockPrisma.revalidationTask.update.mockResolvedValue({
      id: 'task-2',
      clinicianId: 'clinician-1',
      type: RevalidationTaskType.MEDICAID,
      dueDate: new Date('2025-01-01T00:00:00Z'),
      status: RevalidationTaskStatus.COMPLETED,
      source: RevalidationTaskSource.SYSTEM,
      completedAt: completed,
      notes: 'Submitted proof',
    });

    const result = await markRevalidationTaskCompleted('task-2', {
      notes: 'Submitted proof',
      completedAt: completed,
    });

    expect(result.status).toBe(RevalidationTaskStatus.COMPLETED);
    expect(mockPrisma.revalidationTask.update).toHaveBeenCalledWith({
      where: { id: 'task-2' },
      data: expect.objectContaining({
        status: RevalidationTaskStatus.COMPLETED,
        completedAt: completed,
      }),
    });
  });

  it('deletes a task by id', async () => {
    mockPrisma.revalidationTask.delete.mockResolvedValue(undefined);

    await deleteRevalidationTask('task-99');

    expect(mockPrisma.revalidationTask.delete).toHaveBeenCalledWith({
      where: { id: 'task-99' },
    });
  });

  it('records notification events and respects cooldown helper', async () => {
    const now = new Date('2025-01-01T00:00:00Z');
    const soonDue: any = {
      id: 'task-3',
      clinicianId: 'c1',
      type: RevalidationTaskType.PAYER,
      dueDate: new Date('2025-01-15T00:00:00Z'),
      status: RevalidationTaskStatus.OPEN,
      source: RevalidationTaskSource.SYSTEM,
      notificationCount: 0,
    };

    expect(shouldNotify(soonDue, now)).toBe(true);

    soonDue.lastNotifiedAt = new Date('2024-12-31T00:00:00Z');
    expect(shouldNotify(soonDue, now)).toBe(true);

    soonDue.lastNotifiedAt = new Date('2025-01-01T00:00:00Z');
    expect(shouldNotify(soonDue, now)).toBe(false);

    mockPrisma.revalidationTask.update.mockResolvedValue({
      ...soonDue,
      lastNotifiedAt: now,
      notificationCount: 1,
    });

    const updated = await recordTaskNotification('task-3');
    expect(updated.notificationCount).toBe(1);
  });

  it('upserts tasks by referenceId', async () => {
    mockPrisma.revalidationTask.findFirst.mockResolvedValueOnce(null);
    mockPrisma.revalidationTask.create.mockResolvedValue({ id: 'new-task' });

    await upsertRevalidationTask({
      clinicianId: 'clinician-2',
      type: RevalidationTaskType.PECOS,
      dueDate: new Date('2025-06-01T00:00:00Z'),
      metadata: { referenceId: 'pecos-456' },
    });

    expect(mockPrisma.revalidationTask.create).toHaveBeenCalled();

    mockPrisma.revalidationTask.findFirst.mockResolvedValueOnce({
      id: 'existing-task',
      metadata: { referenceId: 'pecos-456' },
    });
    mockPrisma.revalidationTask.update.mockResolvedValue({ id: 'existing-task' });

    await upsertRevalidationTask({
      clinicianId: 'clinician-2',
      type: RevalidationTaskType.PECOS,
      dueDate: new Date('2025-07-01T00:00:00Z'),
      metadata: { referenceId: 'pecos-456' },
    });

    expect(mockPrisma.revalidationTask.update).toHaveBeenCalledWith({
      where: { id: 'existing-task' },
      data: expect.objectContaining({ dueDate: expect.any(Date) }),
    });
  });
});
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  createRevalidationTask,
  listRevalidationTasks,
  markRevalidationTaskCompleted,
  recordTaskNotification,
  shouldNotify,
  updateRevalidationTask,
  upsertRevalidationTask,
} from '../revalidationTaskService.js';
import {
  RevalidationTaskSource,
  RevalidationTaskStatus,
  RevalidationTaskType,
} from '../models/RevalidationTask.js';

const mockPrisma = {
  revalidationTask: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
  },
} as any;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

describe('revalidationTaskService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a task with validated payload', async () => {
    mockPrisma.revalidationTask.create.mockResolvedValue({
      id: 'task-1',
      clinicianId: 'clinician-1',
      type: RevalidationTaskType.PECOS,
      dueDate: new Date('2025-03-01T00:00:00Z'),
      status: RevalidationTaskStatus.OPEN,
      source: RevalidationTaskSource.SYSTEM,
      notes: 'Due in 90 days',
      metadata: { referenceId: 'pecos-123' },
    });

    const result = await createRevalidationTask({
      clinicianId: 'clinician-1',
      type: RevalidationTaskType.PECOS,
      dueDate: new Date('2025-03-01T00:00:00Z'),
      notes: 'Due in 90 days',
      metadata: {
        referenceId: 'pecos-123',
      },
    });

    expect(mockPrisma.revalidationTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicianId: 'clinician-1',
        type: RevalidationTaskType.PECOS,
        dueDate: new Date('2025-03-01T00:00:00Z'),
        notes: 'Due in 90 days',
      }),
    });
    expect(result.id).toBe('task-1');
  });

  it('lists tasks with default non-completed filter', async () => {
    mockPrisma.revalidationTask.findMany.mockResolvedValue([]);

    await listRevalidationTasks();

    expect(mockPrisma.revalidationTask.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: { not: RevalidationTaskStatus.COMPLETED },
      }),
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('updates a task and preserves metadata merge', async () => {
    mockPrisma.revalidationTask.update.mockResolvedValue({
      id: 'task-1',
      clinicianId: 'clinician-1',
      type: RevalidationTaskType.CREDENTIALING,
      dueDate: new Date('2025-04-01T00:00:00Z'),
      status: RevalidationTaskStatus.IN_PROGRESS,
      source: RevalidationTaskSource.USER,
      notes: 'Working with board office',
    });

    const result = await updateRevalidationTask('task-1', {
      status: RevalidationTaskStatus.IN_PROGRESS,
      notes: 'Working with board office',
      metadata: {
        category: 'BOARD',
        referenceId: 'board-xyz',
      },
    });

    expect(mockPrisma.revalidationTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({
        status: RevalidationTaskStatus.IN_PROGRESS,
      }),
    });
    expect(result.status).toBe(RevalidationTaskStatus.IN_PROGRESS);
  });

  it('marks a task completed with timestamp', async () => {
    const completed = new Date('2025-02-01T00:00:00Z');
    mockPrisma.revalidationTask.update.mockResolvedValue({
      id: 'task-2',
      clinicianId: 'clinician-1',
      type: RevalidationTaskType.MEDICAID,
      dueDate: new Date('2025-01-01T00:00:00Z'),
      status: RevalidationTaskStatus.COMPLETED,
      source: RevalidationTaskSource.SYSTEM,
      completedAt: completed,
      notes: 'Submitted proof',
    });

    const result = await markRevalidationTaskCompleted('task-2', {
      notes: 'Submitted proof',
      completedAt: completed,
    });

    expect(result.status).toBe(RevalidationTaskStatus.COMPLETED);
    expect(mockPrisma.revalidationTask.update).toHaveBeenCalledWith({
      where: { id: 'task-2' },
      data: expect.objectContaining({
        status: RevalidationTaskStatus.COMPLETED,
        completedAt: completed,
      }),
    });
  });

  it('records notification events and respects cooldown helper', async () => {
    const now = new Date('2025-01-01T00:00:00Z');
    const soonDue: any = {
      id: 'task-3',
      clinicianId: 'c1',
      type: RevalidationTaskType.PAYER,
      dueDate: new Date('2025-01-15T00:00:00Z'),
      status: RevalidationTaskStatus.OPEN,
      source: RevalidationTaskSource.SYSTEM,
      notificationCount: 0,
    };

    expect(shouldNotify(soonDue, now)).toBe(true);

    soonDue.lastNotifiedAt = new Date('2024-12-31T00:00:00Z');
    expect(shouldNotify(soonDue, now)).toBe(true);

    soonDue.lastNotifiedAt = new Date('2025-01-01T00:00:00Z');
    expect(shouldNotify(soonDue, now)).toBe(false);

    mockPrisma.revalidationTask.update.mockResolvedValue({
      ...soonDue,
      lastNotifiedAt: now,
      notificationCount: 1,
    });

    const updated = await recordTaskNotification('task-3');
    expect(updated.notificationCount).toBe(1);
  });

  it('upserts tasks by referenceId', async () => {
    mockPrisma.revalidationTask.findFirst.mockResolvedValueOnce(null);
    mockPrisma.revalidationTask.create.mockResolvedValue({ id: 'new-task' });

    await upsertRevalidationTask({
      clinicianId: 'clinician-2',
      type: RevalidationTaskType.PECOS,
      dueDate: new Date('2025-06-01T00:00:00Z'),
      metadata: { referenceId: 'pecos-456' },
    });

    expect(mockPrisma.revalidationTask.create).toHaveBeenCalled();

    mockPrisma.revalidationTask.findFirst.mockResolvedValueOnce({
      id: 'existing-task',
      metadata: { referenceId: 'pecos-456' },
    });
    mockPrisma.revalidationTask.update.mockResolvedValue({ id: 'existing-task' });

    await upsertRevalidationTask({
      clinicianId: 'clinician-2',
      type: RevalidationTaskType.PECOS,
      dueDate: new Date('2025-07-01T00:00:00Z'),
      metadata: { referenceId: 'pecos-456' },
    });

    expect(mockPrisma.revalidationTask.update).toHaveBeenCalledWith({
      where: { id: 'existing-task' },
      data: expect.objectContaining({
        dueDate: expect.any(Date),
      }),
    });
  });
});

