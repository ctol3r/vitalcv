/**
 * SupervisorTask model and types
 *
 * Represents tasks that the supervisor system can schedule and execute.
 */

import { SupervisorTaskType, SupervisorTaskStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SupervisorTaskInput {
  taskType: SupervisorTaskType;
  priority?: number;
  triggeredBy?: string;
  metadata?: Record<string, unknown>;
}

export interface SupervisorTaskUpdate {
  status?: SupervisorTaskStatus;
  error?: string;
  result?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Create a new supervisor task
 */
export async function createSupervisorTask(
  input: SupervisorTaskInput
): Promise<string> {
  const task = await prisma.supervisorTask.create({
    data: {
      taskType: input.taskType,
      status: SupervisorTaskStatus.PENDING,
      priority: input.priority ?? 0,
      triggeredBy: input.triggeredBy ?? null,
      metadata: input.metadata ?? null,
    },
  });
  return task.id;
}

/**
 * Update a supervisor task
 */
export async function updateSupervisorTask(
  id: string,
  update: SupervisorTaskUpdate
): Promise<void> {
  await prisma.supervisorTask.update({
    where: { id },
    data: {
      status: update.status,
      error: update.error,
      result: update.result ?? null,
      startedAt: update.startedAt,
      completedAt: update.completedAt,
    },
  });
}

/**
 * Find pending tasks ordered by priority
 */
export async function findPendingTasks(limit?: number) {
  return prisma.supervisorTask.findMany({
    where: {
      status: SupervisorTaskStatus.PENDING,
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
    take: limit,
  });
}

/**
 * Find running tasks
 */
export async function findRunningTasks() {
  return prisma.supervisorTask.findMany({
    where: {
      status: SupervisorTaskStatus.RUNNING,
    },
  });
}

/**
 * Find tasks by type and status
 */
export async function findTasksByTypeAndStatus(
  taskType: SupervisorTaskType,
  status: SupervisorTaskStatus
) {
  return prisma.supervisorTask.findMany({
    where: {
      taskType,
      status,
    },
  });
}

export { SupervisorTaskType, SupervisorTaskStatus };

