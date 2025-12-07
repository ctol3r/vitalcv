import {
  CredentialTimelineEventType,
  Prisma,
  PrismaClient,
  TimelineEventSeverity,
} from '@prisma/client';
import {
  enqueueCredentialAgentTask,
  getFailedAgentTasks,
  getOpenAgentTasks,
} from './models/CredentialAgentTask.js';
import { generateCredentialAgentPlan } from './planner/agentPlanner.js';
import { createJobQueueEntry } from '../queue/models/JobQueue.js';

const prisma = new PrismaClient();

export enum AgentState {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING',
  EXECUTING = 'EXECUTING',
  VERIFYING = 'VERIFYING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

export interface AgentStateMachineOptions {
  prismaClient?: PrismaClient;
  deterministicPlanner?: boolean;
}

export interface AgentStateMachineResult {
  clinicianId: string;
  state: AgentState;
  plannedTasks: string[];
  enqueuedJobIds: string[];
  failedTaskIds: string[];
}

export async function runCredentialAgentStateMachine(
  clinicianId: string,
  options: AgentStateMachineOptions = {}
): Promise<AgentStateMachineResult> {
  const client = options.prismaClient ?? prisma;
  const openTasks = await getOpenAgentTasks(clinicianId, { prismaClient: client });
  const failedTasks = await getFailedAgentTasks(clinicianId, { prismaClient: client });

  if (failedTasks.length > 0) {
    await logStateTransition(client, clinicianId, AgentState.FAILED, {
      failedTaskIds: failedTasks.map((task) => task.id),
    });
    return {
      clinicianId,
      state: AgentState.FAILED,
      plannedTasks: [],
      enqueuedJobIds: [],
      failedTaskIds: failedTasks.map((task) => task.id),
    };
  }

  if (openTasks.length > 0) {
    await logStateTransition(client, clinicianId, AgentState.EXECUTING, {
      taskIds: openTasks.map((task) => task.id),
    });
    return {
      clinicianId,
      state: AgentState.EXECUTING,
      plannedTasks: [],
      enqueuedJobIds: [],
      failedTaskIds: [],
    };
  }

  const plan = await generateCredentialAgentPlan(clinicianId, {
    prismaClient: client,
    deterministic: options.deterministicPlanner ?? false,
    existingTaskTypes: [],
  });

  if (plan.orderedTasks.length === 0) {
    await logStateTransition(client, clinicianId, AgentState.VERIFYING);
    await logStateTransition(client, clinicianId, AgentState.DONE);
    return {
      clinicianId,
      state: AgentState.DONE,
      plannedTasks: [],
      enqueuedJobIds: [],
      failedTaskIds: [],
    };
  }

  await logStateTransition(client, clinicianId, AgentState.PLANNING, {
    tasks: plan.orderedTasks.map((task) => task.taskType),
  });

  const enqueuedJobIds: string[] = [];
  const plannedTaskTypes: string[] = [];

  for (const planned of plan.orderedTasks) {
    const { task, created } = await enqueueCredentialAgentTask(
      {
        clinicianId,
        taskType: planned.taskType,
        payload: planned.payload,
      },
      { prismaClient: client }
    );

    plannedTaskTypes.push(planned.taskType);

    if (created) {
      const job = await createJobQueueEntry('CREDENTIAL_AGENT_TASK', { taskId: task.id });
      enqueuedJobIds.push(job.id);
    }
  }

  await logStateTransition(client, clinicianId, AgentState.EXECUTING, {
    taskTypes: plannedTaskTypes,
  });

  return {
    clinicianId,
    state: AgentState.EXECUTING,
    plannedTasks: plannedTaskTypes,
    enqueuedJobIds,
    failedTaskIds: [],
  };
}

async function logStateTransition(
  client: PrismaClient,
  clinicianId: string,
  state: AgentState,
  metadata?: Record<string, unknown>
) {
  await client.credentialTimelineEvent.create({
    data: {
      clinicianId,
      eventType: CredentialTimelineEventType.REVALIDATION_CREATED,
      severity: stateToSeverity(state),
      metadata: {
        agentState: state,
        ...(metadata ?? {}),
      } as Prisma.InputJsonValue,
      auditHash: `agent-state-${state}-${Date.now()}`,
    },
  });
}

function stateToSeverity(state: AgentState): TimelineEventSeverity {
  switch (state) {
    case AgentState.FAILED:
      return TimelineEventSeverity.WARNING;
    case AgentState.EXECUTING:
    case AgentState.PLANNING:
      return TimelineEventSeverity.NOTICE;
    default:
      return TimelineEventSeverity.INFO;
  }
}

