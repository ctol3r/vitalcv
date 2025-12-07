import { randomUUID } from 'crypto';

export type HitlTaskStatus = 'queued' | 'in_review' | 'approved' | 'rejected' | 'expired';
export type HitlPriority = 'low' | 'medium' | 'high';

export interface HitlTask {
  id: string;
  decisionId: string;
  requestedBy: string;
  reason: string;
  status: HitlTaskStatus;
  priority: HitlPriority;
  instructions?: string;
  context?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  resolutionNotes?: string;
  resolvedBy?: string;
}

const IN_MEMORY_QUEUE: HitlTask[] = [];
const DEFAULT_TTL_MINUTES = Number(process.env.AI_OVERRIDE_TTL_MINUTES ?? 30);

export interface HitlEnqueueRequest {
  decisionId: string;
  requestedBy: string;
  reason: string;
  priority?: HitlPriority;
  instructions?: string;
  context?: Record<string, unknown>;
  ttlMinutes?: number;
}

export function enqueueHitlTask(request: HitlEnqueueRequest): HitlTask {
  purgeExpiredTasks();
  const now = new Date();
  const ttl = request.ttlMinutes ?? DEFAULT_TTL_MINUTES;
  const expiresAt = ttl > 0 ? new Date(now.getTime() + ttl * 60_000).toISOString() : undefined;
  const task: HitlTask = {
    id: randomUUID(),
    decisionId: request.decisionId,
    requestedBy: request.requestedBy,
    reason: request.reason,
    instructions: request.instructions,
    context: request.context ?? {},
    priority: request.priority ?? 'medium',
    status: 'queued',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt,
  };

  IN_MEMORY_QUEUE.unshift(task);
  return task;
}

export function updateHitlTaskStatus(
  taskId: string,
  status: Exclude<HitlTaskStatus, 'queued'>,
  actor: string,
  notes?: string,
): HitlTask | null {
  purgeExpiredTasks();
  const task = IN_MEMORY_QUEUE.find((entry) => entry.id === taskId);
  if (!task) {
    return null;
  }
  task.status = status;
  task.updatedAt = new Date().toISOString();
  task.resolutionNotes = notes;
  task.resolvedBy = actor;
  return task;
}

export function listHitlTasks(limit = 50): HitlTask[] {
  purgeExpiredTasks();
  return IN_MEMORY_QUEUE.slice(0, limit);
}

export function pendingHitlTasks(decisionId?: string): HitlTask[] {
  purgeExpiredTasks();
  return IN_MEMORY_QUEUE.filter((task) => {
    if (decisionId && task.decisionId !== decisionId) {
      return false;
    }
    return task.status === 'queued' || task.status === 'in_review';
  });
}

export function getHitlQueueSnapshot() {
  purgeExpiredTasks();
  const counts = IN_MEMORY_QUEUE.reduce(
    (acc, task) => {
      acc[task.status] = (acc[task.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<HitlTaskStatus, number>,
  );
  const total = IN_MEMORY_QUEUE.length;
  return {
    total,
    counts,
    oldestPending: IN_MEMORY_QUEUE.filter((task) => task.status === 'queued')
      .slice(-1)
      .pop(),
  };
}

function purgeExpiredTasks() {
  const now = Date.now();
  for (const task of IN_MEMORY_QUEUE) {
    if (task.expiresAt && new Date(task.expiresAt).getTime() < now && task.status === 'queued') {
      task.status = 'expired';
      task.updatedAt = new Date().toISOString();
    }
  }
}










