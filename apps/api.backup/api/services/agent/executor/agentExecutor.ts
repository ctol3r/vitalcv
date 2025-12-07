import {
  ClinicianProfile,
  CredentialAgentTaskType,
  CredentialTimelineEventType,
  Prisma,
  PrismaClient,
  TimelineEventSeverity,
  User,
} from '@prisma/client';
import { runPSV } from '../../psv/psvOrchestrator.js';
import { npdbService } from '../../privileging/npdbIntegration.js';
import { evaluateRenewalCriteriaV2 } from '../../privileging/renewalEngineV2.js';
import { checkEnrollmentRequirements } from '../../payer/requirementsEngine.js';
import { mergeCredentialRisk } from '../../credentialRisk/riskService.js';
import { CredentialRiskFactors } from '../../credentialRisk/enums.js';
import {
  CredentialAgentTaskRecord,
  getAgentTaskById,
  markTaskCompleted,
  markTaskFailed,
  markTaskRunning,
} from '../models/CredentialAgentTask.js';

const prisma = new PrismaClient();

type ClinicianWithUser = ClinicianProfile & { user: User | null };

interface TaskExecutionContext {
  prisma: PrismaClient;
  task: CredentialAgentTaskRecord;
  clinician: ClinicianWithUser;
  payload: Record<string, unknown>;
}

type TaskHandlerResult = Record<string, unknown> | void;
type TaskHandler = (ctx: TaskExecutionContext) => Promise<TaskHandlerResult>;

const TIMELINE_EVENT_BY_TASK: Partial<Record<CredentialAgentTaskType, CredentialTimelineEventType>> = {
  NPDB_QUERY: CredentialTimelineEventType.NPDB_QUERY,
  LICENSE_CHECK: CredentialTimelineEventType.LICENSE_VERIFIED,
  BOARD_CHECK: CredentialTimelineEventType.BOARD_VERIFIED,
  DEA_CHECK: CredentialTimelineEventType.DEA_VERIFIED,
  PECOS_CHECK: CredentialTimelineEventType.PECOS_VERIFIED,
  MEDICAID_CHECK: CredentialTimelineEventType.PECOS_VERIFIED,
  PAYER_CHECK: CredentialTimelineEventType.PRIVILEGE_GRANTED,
  PRIVILEGE_VALIDATION: CredentialTimelineEventType.PRIVILEGE_GRANTED,
  OPPE_REFRESH: CredentialTimelineEventType.OPPE_CYCLE,
  FPPE_EVAL: CredentialTimelineEventType.FPPE_COMPLETED,
  TIMELINE_REFRESH: CredentialTimelineEventType.REVALIDATION_CREATED,
  COMPLIANCE_CALC: CredentialTimelineEventType.DISCREPANCY_FOUND,
};

const TASK_HANDLERS: Record<CredentialAgentTaskType, TaskHandler> = {
  NPDB_QUERY: handleNpdbQuery,
  LICENSE_CHECK: handleLicenseCheck,
  BOARD_CHECK: handleBoardCheck,
  DEA_CHECK: handleDeaCheck,
  PECOS_CHECK: handlePecosCheck,
  MEDICAID_CHECK: (ctx) => handlePayerCheck(ctx, { planType: 'Medicaid' }),
  PAYER_CHECK: handlePayerCheck,
  PRIVILEGE_VALIDATION: handlePrivilegeValidation,
  OPPE_REFRESH: handleOppeRefresh,
  FPPE_EVAL: handleFppeEval,
  TIMELINE_REFRESH: handleTimelineRefresh,
  COMPLIANCE_CALC: handleComplianceCalc,
};

export interface TaskExecutionOptions {
  prismaClient?: PrismaClient;
}

export interface TaskExecutionSummary {
  taskId: string;
  taskType: CredentialAgentTaskType;
  metadata?: Record<string, unknown>;
}

export async function runCredentialAgentTask(
  taskId: string,
  options: TaskExecutionOptions = {}
): Promise<TaskExecutionSummary> {
  const client = options.prismaClient ?? prisma;
  const task = await getAgentTaskById(taskId, { prismaClient: client });
  if (!task) {
    throw new Error(`CredentialAgentTask ${taskId} not found`);
  }

  const clinician = await client.clinicianProfile.findUnique({
    where: { id: task.clinicianId },
    include: { user: true },
  });

  if (!clinician) {
    throw new Error(`Clinician ${task.clinicianId} not found`);
  }

  const handler = TASK_HANDLERS[task.taskType];
  if (!handler) {
    throw new Error(`No task handler registered for ${task.taskType}`);
  }

  await markTaskRunning(taskId, { prismaClient: client });

  try {
    const metadata = await handler({
      prisma: client,
      task,
      clinician,
      payload: readPayload(task.payload),
    });

    await markTaskCompleted(taskId, { prismaClient: client });
    await recordTimelineEvent(client, clinician, task.taskType, taskId, metadata);

    return {
      taskId,
      taskType: task.taskType,
      metadata: metadata ?? undefined,
    };
  } catch (error) {
    await markTaskFailed(taskId, error, { prismaClient: client });
    throw error;
  }
}

function readPayload(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

async function recordTimelineEvent(
  client: PrismaClient,
  clinician: ClinicianWithUser,
  taskType: CredentialAgentTaskType,
  taskId: string,
  metadata?: Record<string, unknown>
) {
  const eventType = TIMELINE_EVENT_BY_TASK[taskType];
  if (!eventType) {
    return;
  }

  const timelineMetadata: Prisma.InputJsonValue = {
    taskId,
    ...(metadata ?? {}),
  };

  await client.credentialTimelineEvent.create({
    data: {
      clinicianId: clinician.id,
      eventType,
      severity: determineTimelineSeverity(taskType),
      metadata: timelineMetadata,
      auditHash: `agent-${taskId}-${Date.now()}`,
    },
  });
}

function determineTimelineSeverity(taskType: CredentialAgentTaskType): TimelineEventSeverity {
  if (taskType === 'NPDB_QUERY' || taskType === 'COMPLIANCE_CALC') {
    return TimelineEventSeverity.NOTICE;
  }
  if (taskType === 'LICENSE_CHECK' || taskType === 'PRIVILEGE_VALIDATION') {
    return TimelineEventSeverity.WARNING;
  }
  return TimelineEventSeverity.INFO;
}

async function handleNpdbQuery(ctx: TaskExecutionContext) {
  const npi = (ctx.payload.npi as string) ?? ctx.clinician.npi;
  if (!npi) {
    throw new Error('Clinician NPI required for NPDB query');
  }

  const result = await npdbService.queryNPDB({
    npi,
    firstName: ctx.payload.firstName as string | undefined,
    lastName: ctx.payload.lastName as string | undefined,
    requestingOrganization:
      (ctx.payload.requestingOrganization as string) ?? 'credential-agent',
    requestingOfficer: (ctx.payload.requestingOfficer as string) ?? 'CredentialAgent',
    purpose: (ctx.payload.purpose as any) ?? 'renewal',
  });

  return {
    npdbStatus: result.status,
    adverseActions: result.adverseActions.length,
    cached: result.cached,
  };
}

async function handleLicenseCheck(ctx: TaskExecutionContext) {
  const npi = (ctx.payload.npi as string) ?? ctx.clinician.npi;
  const state = (ctx.payload.state as string) ?? ctx.clinician.state;
  const licenseNumber =
    (ctx.payload.licenseNumber as string) ??
    (await inferLicenseNumber(ctx.prisma, ctx.task.clinicianId));

  if (!npi || !state || !licenseNumber) {
    throw new Error('Missing license metadata for PSV run');
  }

  const result = await runPSV({
    clinicianId: ctx.task.clinicianId,
    npi,
    state,
    licenseNumber,
  });

  return {
    overallStatus: result.overallStatus,
    summary: result.summary,
  };
}

async function handleBoardCheck(ctx: TaskExecutionContext) {
  const credential = await ctx.prisma.credential.findFirst({
    where: {
      userId: ctx.clinician.userId,
      type: { contains: 'Board', mode: 'insensitive' },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!credential) {
    throw new Error('No board certification credentials available');
  }

  if (credential.expiresAt && credential.expiresAt < new Date()) {
    throw new Error('Board certification credential expired');
  }

  return { credentialId: credential.id };
}

async function handleDeaCheck(ctx: TaskExecutionContext) {
  const credential = await ctx.prisma.credential.findFirst({
    where: {
      userId: ctx.clinician.userId,
      type: 'DEARegistration',
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!credential) {
    throw new Error('No DEA registration credential found');
  }

  if (credential.expiresAt && credential.expiresAt < new Date()) {
    throw new Error('DEA registration expired');
  }

  return { credentialId: credential.id };
}

async function handlePecosCheck(ctx: TaskExecutionContext) {
  const provider = await ctx.prisma.pECOSProvider.findFirst({
    where: { clinicianId: ctx.task.clinicianId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!provider) {
    throw new Error('No PECOS provider record to refresh');
  }

  await ctx.prisma.pECOSProvider.update({
    where: { id: provider.id },
    data: { lastCheckedAt: new Date() },
  });

  return { providerId: provider.id, status: provider.status };
}

async function handlePayerCheck(
  ctx: TaskExecutionContext,
  options: { planType?: string } = {}
) {
  const clinicianDid = ctx.clinician.user?.did;
  if (!clinicianDid) {
    throw new Error('Clinician DID required for payer evaluation');
  }

  let enrollment = null;
  const payloadEnrollment = ctx.payload.enrollmentId;
  if (typeof payloadEnrollment === 'string') {
    enrollment = await ctx.prisma.payerEnrollment.findUnique({
      where: { id: payloadEnrollment },
      include: { payer: true },
    });
  }

  if (!enrollment) {
    enrollment = await ctx.prisma.payerEnrollment.findFirst({
      where: {
        clinicianDid,
        status: 'APPROVED',
        ...(options.planType
          ? {
              payer: {
                planTypes: { has: options.planType },
              },
            }
          : {}),
      },
      include: { payer: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  if (!enrollment) {
    throw new Error(
      options.planType
        ? `No approved ${options.planType} enrollment found`
        : 'No approved payer enrollments found'
    );
  }

  const requirements = await checkEnrollmentRequirements(
    {
      payerId: enrollment.payerId,
      clinicianDid,
      specialty: ctx.clinician.specialty,
      state: ctx.clinician.state,
    },
    enrollment.payer as any
  );

  return {
    enrollmentId: enrollment.id,
    overallStatus: requirements.overallStatus,
  };
}

async function handlePrivilegeValidation(ctx: TaskExecutionContext) {
  const clinicianDid = ctx.clinician.user?.did;
  if (!clinicianDid) {
    throw new Error('Clinician DID required for privilege validation');
  }

  const payloadIds = Array.isArray(ctx.payload.privilegeIds)
    ? (ctx.payload.privilegeIds as string[])
    : [];

  const privilegeIds =
    payloadIds.length > 0
      ? payloadIds
      : (
          await ctx.prisma.privilegeGranted.findMany({
            where: { clinicianDid, status: { in: ['ACTIVE', 'HOLD'] } },
            select: { id: true },
            take: 3,
          })
        ).map((p) => p.id);

  if (privilegeIds.length === 0) {
    throw new Error('No active privileges found to validate');
  }

  for (const id of privilegeIds) {
    await evaluateRenewalCriteriaV2(id);
  }

  return { privilegeIds };
}

async function handleOppeRefresh(ctx: TaskExecutionContext) {
  const clinicianDid = ctx.clinician.user?.did;
  if (!clinicianDid) {
    throw new Error('Clinician DID required for OPPE refresh');
  }

  const oppe = await ctx.prisma.fppeOppe.findFirst({
    where: { clinicianDid },
    orderBy: { updatedAt: 'desc' },
  });

  if (!oppe) {
    throw new Error('No OPPE record available');
  }

  const nextReview = new Date();
  nextReview.setMonth(nextReview.getMonth() + (oppe.oppeIntervalMonths ?? 12));

  await ctx.prisma.fppeOppe.update({
    where: { id: oppe.id },
    data: {
      oppeLastReviewDate: new Date(),
      oppeNextReviewDue: nextReview,
      updatedAt: new Date(),
    },
  });

  return { oppeId: oppe.id, nextReviewDue: nextReview };
}

async function handleFppeEval(ctx: TaskExecutionContext) {
  const clinicianDid = ctx.clinician.user?.did;
  if (!clinicianDid) {
    throw new Error('Clinician DID required for FPPE evaluation');
  }

  const fppe = await ctx.prisma.fppeOppe.findFirst({
    where: { clinicianDid },
    orderBy: { updatedAt: 'desc' },
  });

  if (!fppe) {
    throw new Error('No FPPE record available');
  }

  await ctx.prisma.fppeOppe.update({
    where: { id: fppe.id },
    data: {
      fppeStatus: 'COMPLETED',
      fppeEndDate: new Date(),
      updatedAt: new Date(),
    },
  });

  return { fppeId: fppe.id, status: 'COMPLETED' };
}

async function handleTimelineRefresh(ctx: TaskExecutionContext) {
  await ctx.prisma.credentialTimelineEvent.updateMany({
    where: { clinicianId: ctx.clinician.id },
    data: { updatedAt: new Date() },
  });

  return { refreshed: true };
}

async function handleComplianceCalc(ctx: TaskExecutionContext) {
  await mergeCredentialRisk(ctx.clinician.id, {
    remove: [CredentialRiskFactors.MISSING_EVIDENCE],
  });

  return { recalculated: true };
}

async function inferLicenseNumber(prismaClient: PrismaClient, clinicianId: string) {
  const record = await prismaClient.stateLicenseVerification.findFirst({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });
  return record?.licenseNumber;
}

