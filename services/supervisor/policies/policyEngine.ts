/**
 * SupervisorPolicyEngine
 *
 * Defines policies for task execution:
 * - Don't run FUSION_UPDATE if SAFETY_SWEEP is active
 * - Priority: DRIFT > SAFETY > COMPLIANCE > PSV
 * - Tests for policy resolution
 */

import {
  SupervisorTaskType,
  SupervisorTaskStatus,
  PrismaClient,
} from '@prisma/client';
import { findRunningTasks } from '../models/SupervisorTask.js';

const prisma = new PrismaClient();

export interface PolicyViolation {
  taskType: SupervisorTaskType;
  reason: string;
  blockingTasks: SupervisorTaskType[];
}

export interface PolicyContext {
  runningTasks: SupervisorTaskType[];
  pendingTasks: SupervisorTaskType[];
}

/**
 * Policy: Don't run FUSION_UPDATE if SAFETY_SWEEP is active
 */
const SAFETY_SWEEP_BLOCKS_FUSION = {
  blockedTask: SupervisorTaskType.RUN_FUSION,
  blockingTasks: [SupervisorTaskType.RUN_SAFETY_SWEEP],
};

/**
 * Priority order: Higher priority = higher number
 * DRIFT > SAFETY > COMPLIANCE > PSV
 */
const TASK_PRIORITY: Record<SupervisorTaskType, number> = {
  [SupervisorTaskType.RUN_DRIFT_SWEEP]: 100,
  [SupervisorTaskType.RUN_SAFETY_SWEEP]: 80,
  [SupervisorTaskType.RUN_COMPLIANCE]: 60,
  [SupervisorTaskType.RUN_PSV]: 40,
  [SupervisorTaskType.RUN_FUSION]: 30,
  [SupervisorTaskType.RUN_MOBILITY]: 20,
  [SupervisorTaskType.RUN_EHR_SYNC]: 15,
  [SupervisorTaskType.RUN_NCI_PUBLISH]: 10,
  [SupervisorTaskType.RUN_PRIVILEGE_ISSUE]: 5,
};

/**
 * Get priority for a task type
 */
export function getTaskPriority(taskType: SupervisorTaskType): number {
  return TASK_PRIORITY[taskType] ?? 0;
}

/**
 * Check if a task can be executed given current running/pending tasks
 */
export async function canExecuteTask(
  taskType: SupervisorTaskType,
  context?: PolicyContext
): Promise<{ allowed: boolean; violation?: PolicyViolation }> {
  const ctx = context ?? (await buildPolicyContext());

  // Check SAFETY_SWEEP blocks FUSION
  if (
    taskType === SAFETY_SWEEP_BLOCKS_FUSION.blockedTask &&
    ctx.runningTasks.some((t) =>
      SAFETY_SWEEP_BLOCKS_FUSION.blockingTasks.includes(t)
    )
  ) {
    return {
      allowed: false,
      violation: {
        taskType,
        reason: 'SAFETY_SWEEP is running and blocks FUSION_UPDATE',
        blockingTasks: ctx.runningTasks.filter((t) =>
          SAFETY_SWEEP_BLOCKS_FUSION.blockingTasks.includes(t)
        ),
      },
    };
  }

  return { allowed: true };
}

/**
 * Build policy context from database
 */
export async function buildPolicyContext(): Promise<PolicyContext> {
  const running = await findRunningTasks();

  // Get all pending tasks
  const pending = await prisma.supervisorTask.findMany({
    where: {
      status: SupervisorTaskStatus.PENDING,
    },
  });

  return {
    runningTasks: running.map((t) => t.taskType),
    pendingTasks: pending.map((t) => t.taskType),
  };
}

/**
 * Resolve task conflicts by applying policies
 * Returns tasks that should be allowed to proceed
 */
export async function resolvePolicies(
  proposedTasks: SupervisorTaskType[]
): Promise<SupervisorTaskType[]> {
  const ctx = await buildPolicyContext();
  const allowed: SupervisorTaskType[] = [];

  // Sort by priority (highest first)
  const sorted = [...proposedTasks].sort(
    (a, b) => getTaskPriority(b) - getTaskPriority(a)
  );

  for (const taskType of sorted) {
    const check = await canExecuteTask(taskType, ctx);
    if (check.allowed) {
      allowed.push(taskType);
      // Add to context as if running (for subsequent checks)
      ctx.runningTasks.push(taskType);
    }
  }

  return allowed;
}

/**
 * Get priority-ordered list of task types
 */
export function getTasksByPriority(): SupervisorTaskType[] {
  return Object.entries(TASK_PRIORITY)
    .sort(([, a], [, b]) => b - a)
    .map(([taskType]) => taskType as SupervisorTaskType);
}

