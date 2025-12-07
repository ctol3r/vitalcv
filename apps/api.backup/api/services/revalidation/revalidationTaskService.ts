import { Prisma, PrismaClient } from '@prisma/client';
import {
  CreateRevalidationTaskInput,
  CreateRevalidationTaskSchema,
  NOTIFICATION_COOLDOWN_HOURS,
  NOTIFICATION_WINDOW_DAYS,
  RevalidationTask,
  RevalidationTaskFilters,
  RevalidationTaskMetadata,
  RevalidationTaskStatus,
  RevalidationTaskType,
  UpdateRevalidationTaskInput,
  UpdateRevalidationTaskSchema,
} from './models/RevalidationTask.js';

const prisma = new PrismaClient();

function toJson(metadata?: RevalidationTaskMetadata): Prisma.InputJsonValue | undefined {
  if (!metadata) return undefined;
  return metadata as Prisma.InputJsonValue;
}

function buildWhere(filters?: RevalidationTaskFilters): Prisma.RevalidationTaskWhereInput {
  if (!filters) {
    return { status: { not: RevalidationTaskStatus.COMPLETED } };
  }

  const statusFilter =
    filters.status === undefined
      ? undefined
      : Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;

  const typeFilter =
    filters.type === undefined
      ? undefined
      : Array.isArray(filters.type)
        ? { in: filters.type }
        : filters.type;

  const where: Prisma.RevalidationTaskWhereInput = {
    clinicianId: filters.clinicianId,
    type:
      typeof typeFilter === 'string'
        ? typeFilter
        : typeFilter
          ? (typeFilter as Prisma.EnumRevalidationTaskTypeFilter)
          : undefined,
    dueDate: {
      ...(filters.dueAfter ? { gte: filters.dueAfter } : {}),
      ...(filters.dueBefore ? { lte: filters.dueBefore } : {}),
    },
  };

  if (statusFilter !== undefined) {
    where.status =
      typeof statusFilter === 'string'
        ? statusFilter
        : (statusFilter as Prisma.EnumRevalidationTaskStatusFilter);
  } else if (!filters.includeCompleted) {
    where.status = { not: RevalidationTaskStatus.COMPLETED };
  }

  return where;
}

export async function createRevalidationTask(
  input: CreateRevalidationTaskInput
): Promise<RevalidationTask> {
  const parsed = CreateRevalidationTaskSchema.parse(input);

  return prisma.revalidationTask.create({
    data: {
      clinicianId: parsed.clinicianId,
      type: parsed.type,
      dueDate: parsed.dueDate,
      status: parsed.status ?? RevalidationTaskStatus.OPEN,
      source: parsed.source ?? undefined,
      notes: parsed.notes,
      metadata: toJson(parsed.metadata),
    },
  });
}

export async function listRevalidationTasks(
  filters?: RevalidationTaskFilters
): Promise<RevalidationTask[]> {
  return prisma.revalidationTask.findMany({
    where: buildWhere(filters),
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function listClinicianTasks(
  clinicianId: string,
  includeCompleted = false
): Promise<RevalidationTask[]> {
  return listRevalidationTasks({
    clinicianId,
    includeCompleted,
  });
}

export async function updateRevalidationTask(
  id: string,
  updates: UpdateRevalidationTaskInput
): Promise<RevalidationTask> {
  const parsed = UpdateRevalidationTaskSchema.parse(updates);

  return prisma.revalidationTask.update({
    where: { id },
    data: {
      ...parsed,
      metadata: parsed.metadata ? toJson(parsed.metadata) : undefined,
    },
  });
}

export async function markRevalidationTaskCompleted(
  id: string,
  options?: { notes?: string; completedAt?: Date }
): Promise<RevalidationTask> {
  return prisma.revalidationTask.update({
    where: { id },
    data: {
      status: RevalidationTaskStatus.COMPLETED,
      completedAt: options?.completedAt ?? new Date(),
      notes: options?.notes,
    },
  });
}

export async function deleteRevalidationTask(id: string): Promise<void> {
  await prisma.revalidationTask.delete({
    where: { id },
  });
}

export async function recordTaskNotification(id: string): Promise<RevalidationTask> {
  return prisma.revalidationTask.update({
    where: { id },
    data: {
      lastNotifiedAt: new Date(),
      notificationCount: {
        increment: 1,
      },
    },
  });
}

export function shouldNotify(task: RevalidationTask, now = new Date()): boolean {
  const windowMs = NOTIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const cooldownMs = NOTIFICATION_COOLDOWN_HOURS * 60 * 60 * 1000;

  if (
    task.status === RevalidationTaskStatus.COMPLETED ||
    task.status === RevalidationTaskStatus.IN_PROGRESS
  ) {
    return false;
  }

  const dueMs = task.dueDate.getTime();
  const nowMs = now.getTime();
  const withinWindow = dueMs <= nowMs + windowMs;

  if (!withinWindow) return false;

  if (!task.lastNotifiedAt) return true;

  return nowMs - task.lastNotifiedAt.getTime() >= cooldownMs;
}

export interface RevalidationTaskUpsertPayload extends CreateRevalidationTaskInput {
  referenceId?: string;
}

export async function upsertRevalidationTask(
  payload: RevalidationTaskUpsertPayload
): Promise<RevalidationTask> {
  const existing = await prisma.revalidationTask.findFirst({
    where: {
      clinicianId: payload.clinicianId,
      type: payload.type,
      metadata: payload.metadata?.referenceId
        ? {
            path: ['referenceId'],
            equals: payload.metadata.referenceId,
          }
        : undefined,
    },
  });

  if (!existing) {
    return createRevalidationTask(payload);
  }

  return prisma.revalidationTask.update({
    where: { id: existing.id },
    data: {
      dueDate: payload.dueDate,
      status: payload.status,
      source: payload.source,
      notes: payload.notes,
      metadata: toJson({
        ...existing.metadata,
        ...payload.metadata,
      }),
    },
  });
}
