import { jest } from '@jest/globals';
import type { PrismaClient, CredentialAgentTask } from '@prisma/client';
import {
  enqueueCredentialAgentTask,
  getAgentTaskSummary,
  markTaskFailed,
} from '../CredentialAgentTask';

const mockPrisma = {
  credentialAgentTask: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  return {
    ...actual,
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

describe('CredentialAgentTask model helpers', () => {
  const baseTask: CredentialAgentTask = {
    id: 'task-1',
    clinicianId: 'clinician-1',
    taskType: 'LICENSE_CHECK',
    payload: { hello: 'world' } as any,
    status: 'PENDING',
    startedAt: null,
    completedAt: null,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockPrisma.credentialAgentTask).forEach((fn) => {
      (fn as jest.Mock).mockReset();
    });
  });

  it('enqueues new tasks while deduplicating active ones', async () => {
    (mockPrisma.credentialAgentTask.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(baseTask);
    (mockPrisma.credentialAgentTask.create as jest.Mock).mockResolvedValue(baseTask);

    const first = await enqueueCredentialAgentTask({
      clinicianId: 'clinician-1',
      taskType: 'LICENSE_CHECK',
      payload: { some: 'data' },
    });

    const second = await enqueueCredentialAgentTask({
      clinicianId: 'clinician-1',
      taskType: 'LICENSE_CHECK',
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(mockPrisma.credentialAgentTask.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.credentialAgentTask.findFirst).toHaveBeenCalledTimes(2);
  });

  it('truncates oversized error payloads when marking tasks failed', async () => {
    const updated = { ...baseTask, status: 'FAILED', error: 'oops' } as CredentialAgentTask;
    (mockPrisma.credentialAgentTask.update as jest.Mock).mockResolvedValue(updated);

    await markTaskFailed('task-1', 'x'.repeat(5000));

    expect(mockPrisma.credentialAgentTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          error: expect.stringMatching(/…$/),
        }),
      })
    );
  });

  it('summarizes tasks by status', async () => {
    const tasks: CredentialAgentTask[] = [
      { ...baseTask, id: 't1', status: 'PENDING' },
      { ...baseTask, id: 't2', status: 'RUNNING' },
      { ...baseTask, id: 't3', status: 'FAILED' },
      { ...baseTask, id: 't4', status: 'COMPLETED' },
    ];
    (mockPrisma.credentialAgentTask.findMany as jest.Mock).mockResolvedValue(tasks);

    const summary = await getAgentTaskSummary('clinician-1');

    expect(summary.pending).toHaveLength(1);
    expect(summary.running).toHaveLength(1);
    expect(summary.failed).toHaveLength(1);
    expect(summary.completed).toHaveLength(1);
  });
});

