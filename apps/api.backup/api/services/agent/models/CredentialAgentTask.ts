import {
  CredentialAgentTask,
  CredentialAgentTaskStatus,
  CredentialAgentTaskType,
  Prisma,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

export type CredentialAgentTaskRecord = CredentialAgentTask;

export const CREDENTIAL_AGENT_TASK_TYPES: CredentialAgentTaskType[] = [
  'NPDB_QUERY',
  'LICENSE_CHECK',
  'BOARD_CHECK',
  'DEA_CHECK',
  'PECOS_CHECK',
  'MEDICAID_CHECK',
  'PAYER_CHECK',
  'PRIVILEGE_VALIDATION',
  'OPPE_REFRESH',
  'FPPE_EVAL',
  'TIMELINE_REFRESH',
  'COMPLIANCE_CALC',
];

const ACTIVE_STATUSES = new Set<CredentialAgentTaskStatus>([
  CredentialAgentTaskStatus.PENDING,
  CredentialAgentTaskStatus.RUNNING,
]);

const TERMINAL_STATUSES = new Set<CredentialAgentTaskStatus>([
  CredentialAgentTaskStatus.COMPLETED,
  CredentialAgentTaskStatus.FAILED,
]);

const MAX_ERROR_LENGTH = 2000;

export interface CredentialAgentTaskInput {
  clinicianId: string;
  taskType: CredentialAgentTaskType;
  payload?: Prisma.JsonValue;
}

export interface EnqueueTaskOptions {
  prismaClient?: PrismaClient;
  allowDuplicate?: boolean;
}

export interface EnqueueTaskResult {
  task: CredentialAgentTaskRecord;
  created: boolean;
}

export async function enqueueCredentialAgentTask(
  input: CredentialAgentTaskInput,
  options: EnqueueTaskOptions = {}
): Promise<EnqueueTaskResult> {
  const client = options.prismaClient ?? prisma;
  const shouldDedup = options.allowDuplicate !== true;

  if (shouldDedup) {
    const existing = await client.credentialAgentTask.findFirst({
      where: {
        clinicianId: input.clinicianId,
        taskType: input.taskType,
        status: { in: Array.from(ACTIVE_STATUSES) },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (existing) {
      return { task: existing, created: false };
    }
  }

  const task = await client.credentialAgentTask.create({
    data: {
      clinicianId: input.clinicianId,
      taskType: input.taskType,
      payload: input.payload ?? Prisma.JsonNull,
    },
  });

  return { task, created: true };
}

export interface UpdateTaskOptions {
  prismaClient?: PrismaClient;
}

export async function markTaskRunning(
  taskId: string,
  options: UpdateTaskOptions = {}
): Promise<CredentialAgentTaskRecord> {
  const client = options.prismaClient ?? prisma;

  return client.credentialAgentTask.update({
    where: { id: taskId },
    data: {
      status: CredentialAgentTaskStatus.RUNNING,
      startedAt: new Date(),
      error: null,
      updatedAt: new Date(),
    },
  });
}

export async function markTaskCompleted(
  taskId: string,
  options: UpdateTaskOptions = {}
): Promise<CredentialAgentTaskRecord> {
  const client = options.prismaClient ?? prisma;

  return client.credentialAgentTask.update({
    where: { id: taskId },
    data: {
      status: CredentialAgentTaskStatus.COMPLETED,
      completedAt: new Date(),
      error: null,
      updatedAt: new Date(),
    },
  });
}

export async function markTaskFailed(
  taskId: string,
  error: unknown,
  options: UpdateTaskOptions = {}
): Promise<CredentialAgentTaskRecord> {
  const client = options.prismaClient ?? prisma;

  return client.credentialAgentTask.update({
    where: { id: taskId },
    data: {
      status: CredentialAgentTaskStatus.FAILED,
      completedAt: new Date(),
      error: serializeTaskError(error),
      updatedAt: new Date(),
    },
  });
}

export async function getAgentTaskById(
  taskId: string,
  options: UpdateTaskOptions = {}
): Promise<CredentialAgentTaskRecord | null> {
  const client = options.prismaClient ?? prisma;
  return client.credentialAgentTask.findUnique({ where: { id: taskId } });
}

export interface AgentTaskSummary {
  pending: CredentialAgentTaskRecord[];
  running: CredentialAgentTaskRecord[];
  failed: CredentialAgentTaskRecord[];
  completed: CredentialAgentTaskRecord[];
}

export async function getAgentTaskSummary(
  clinicianId: string,
  options: UpdateTaskOptions = {}
): Promise<AgentTaskSummary> {
  const client = options.prismaClient ?? prisma;
  const tasks = await client.credentialAgentTask.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'asc' },
  });

  return {
    pending: tasks.filter((task) => task.status === CredentialAgentTaskStatus.PENDING),
    running: tasks.filter((task) => task.status === CredentialAgentTaskStatus.RUNNING),
    failed: tasks.filter((task) => task.status === CredentialAgentTaskStatus.FAILED),
    completed: tasks.filter((task) => task.status === CredentialAgentTaskStatus.COMPLETED),
  };
}

export async function getOpenAgentTasks(
  clinicianId: string,
  options: UpdateTaskOptions = {}
): Promise<CredentialAgentTaskRecord[]> {
  const client = options.prismaClient ?? prisma;
  return client.credentialAgentTask.findMany({
    where: {
      clinicianId,
      status: { in: Array.from(ACTIVE_STATUSES) },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getFailedAgentTasks(
  clinicianId: string,
  options: UpdateTaskOptions = {}
): Promise<CredentialAgentTaskRecord[]> {
  const client = options.prismaClient ?? prisma;
  return client.credentialAgentTask.findMany({
    where: {
      clinicianId,
      status: CredentialAgentTaskStatus.FAILED,
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export function isTerminalTaskStatus(status: CredentialAgentTaskStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function serializeTaskError(error: unknown): string {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);
  return message.length > MAX_ERROR_LENGTH ? `${message.slice(0, MAX_ERROR_LENGTH)}…` : message;
}

