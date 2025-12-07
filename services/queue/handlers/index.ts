import { PrismaClient } from '@prisma/client';
import { JobQueueRecord, JobQueueType } from '../models/JobQueue.js';
import { runPSV, PSVOrchestratorInput } from '../../psv/psvOrchestrator.js';
import { runDriftSweep } from '../../drift/orchestrator.js';
import { runEmailSenderJob } from '../../notifications/emailSenderStub.js';
import { runPilotSmoke } from '../../../apps/api/src/services/pilotSmoke.js';
import { getDemoMetrics } from '../../../apps/api/src/services/demoMetrics.js';
import { issuePrivilegeGrantedVC } from '../../../apps/issuer-api/src/services/privilegeVcIssuer.js';
import { runCredentialAgentTask } from '../../agent/executor/agentExecutor.js';
import { createLogger } from '@chai-vc/logging-core';
import { createJobLogger } from '@packages/queue-core';
import { safeDeliverSubscriptionEvent } from '../../fhir/subscriptions/deliverEvent.js';
import { runEhrSyncJob } from '../../ehr/workers/ehrSyncWorker.js';
import { parseJobPayload } from '../validation/payloadValidator.js';
import { withEhrSyncLock } from '../../ehr/workers/ehrSyncLock.js';
import { handleNciPublishProofsJob } from '../../nci/handlers/publishProofsHandler.js';
import { runFusionUpdateHandler } from '../../qualityFusion/handlers/fusionHandler.js';
import { runSafetySweepHandler } from '../../safety/handlers/safetySweepHandler.js';
import { runMobilityEvaluateHandler } from '../../mobility/handlers/evaluateMobilityHandler.js';

const prisma = new PrismaClient();
const handlerLogger = createLogger({ service: 'queue-worker' });

export type JobHandler = (job: JobQueueRecord) => Promise<void>;

const handlers: Record<JobQueueType, JobHandler> = {
  PSV_RUN: async (job) => {
    const jobLogger = createJobLogger(job, { baseLogger: handlerLogger });
    const payload = parseJobPayload(job, 'PSV_RUN') as PSVOrchestratorInput;
    const result = await runPSV(payload);
    jobLogger.info('PSV run completed', {
      clinicianId: payload.clinicianId,
      result: result.overallStatus,
    });
  },
  SEND_EMAIL: async (job) => {
    const jobLogger = createJobLogger(job, { baseLogger: handlerLogger });
    const payload = parseJobPayload(job, 'SEND_EMAIL');
    const batchSize = payload.batchSize ?? 10;
    await runEmailSenderJob(batchSize);
    jobLogger.info('Email batch processed', {
      batchSize,
    });
  },
  RUN_PILOT_SMOKE: async (job) => {
    const jobLogger = createJobLogger(job, { baseLogger: handlerLogger });
    const result = await runPilotSmoke();
    jobLogger.info('Pilot smoke finished', {
      ok: result.ok,
      totalDuration: result.totalDuration,
    });
  },
  SYNC_METRICS: async (job) => {
    const jobLogger = createJobLogger(job, { baseLogger: handlerLogger });
    const payload = parseJobPayload(job, 'SYNC_METRICS');
    const metrics = await getDemoMetrics();
    jobLogger.info('Demo metrics snapshot', {
      label: payload.label ?? 'demo-dashboard',
      metrics,
    });
  },
  PRIVILEGE_ISSUE: async (job) => {
    const jobLogger = createJobLogger(job, { baseLogger: handlerLogger });
    const payload = parseJobPayload(job, 'PRIVILEGE_ISSUE');

    const privilegeGrant = await prisma.privilegeGranted.findUnique({
      where: { id: payload.privilegeGrantedId },
      select: {
        id: true,
        vcHash: true,
        vcCredentialId: true,
      },
    });

    if (!privilegeGrant) {
      throw new Error(`PrivilegeGranted record ${payload.privilegeGrantedId} not found`);
    }

    if (privilegeGrant.vcCredentialId) {
      jobLogger.info('Privilege VC already issued, skipping duplicate job', {
        privilegeGrantedId: payload.privilegeGrantedId,
        vcCredentialId: privilegeGrant.vcCredentialId,
      });
      return;
    }

    const vcResult = await issuePrivilegeGrantedVC({
      privilegeRequestId: payload.privilegeRequestId,
      clinicianDid: payload.clinicianDid,
      orgId: payload.orgId,
      privilegeSetId: payload.privilegeSetId,
      reviewerDid: payload.reviewerDid,
    });

    await prisma.privilegeGranted.update({
      where: { id: payload.privilegeGrantedId },
      data: {
        vcHash: vcResult.vcHash,
        vcCredentialId: vcResult.vcId,
      },
    });

    jobLogger.info('Issued privilege VC', {
      privilegeRequestId: payload.privilegeRequestId,
      vcId: vcResult.vcId,
    });
  },
  CREDENTIAL_AGENT_TASK: async (job) => {
    const jobLogger = createJobLogger(job, { baseLogger: handlerLogger });
    const payload = parseJobPayload(job, 'CREDENTIAL_AGENT_TASK');
    await runCredentialAgentTask(payload.taskId);
    jobLogger.info('Executed credential agent task', {
      taskId: payload.taskId,
    });
  },
  EHR_SYNC: async (job) => {
    const jobLogger = createJobLogger(job, { baseLogger: handlerLogger });
    const payload = parseJobPayload(job, 'EHR_SYNC');
    const syncId = payload.syncId;
    await withEhrSyncLock(syncId, async () => {
      jobLogger.info('Dispatching EHR sync job', { syncId });
      await runEhrSyncJob(job);
    });
    jobLogger.info('EHR sync job finished', { syncId });
  },

  FHIR_SUBSCRIPTION_DELIVER: async (job) => {
    const jobLogger = createJobLogger(job, { baseLogger: handlerLogger });
    const payload = parseJobPayload(job, 'FHIR_SUBSCRIPTION_DELIVER');
    await safeDeliverSubscriptionEvent(payload);
    jobLogger.info('Delivered FHIR subscription event', {
      subscriptionId: payload.subscriptionId,
      resourceId: payload.resourceId,
    });
  },
  DRIFT_SWEEP: async (job) => {
    const jobLogger = createJobLogger(job, { baseLogger: handlerLogger });
    const result = await runDriftSweep();
    jobLogger.info('Drift sweep completed', result);
  },
  NCI_PUBLISH_PROOFS: handleNciPublishProofsJob,
  FUSION_UPDATE: runFusionUpdateHandler,
  SAFETY_SWEEP: runSafetySweepHandler,
  MOBILITY_EVALUATE_ORG: runMobilityEvaluateHandler,
  SUPERVISOR_RUN: async (job) => {
    const jobLogger = createJobLogger(job, { baseLogger: handlerLogger });
    const payload = parseJobPayload(job, 'SUPERVISOR_RUN');

    // Import supervisor components
    const { withSupervisorLock, SupervisorLockError } = await import('../../supervisor/locks/supervisorLock.js');
    const { SupervisorDispatcher } = await import('../../supervisor/dispatcher/dispatcher.js');

    try {
      await withSupervisorLock(payload.orgId, async () => {
        jobLogger.info('Starting supervisor run', {
          orgId: payload.orgId,
          clinicianId: payload.clinicianId,
        });

        const dispatcher = new SupervisorDispatcher();

        // TODO: Generate supervisor tasks based on org state
        // For now, this is a placeholder that demonstrates the structure
        const tasks: Array<{ jobType: JobQueueType; payload: any }> = [];

        if (tasks.length > 0) {
          const jobIds = await dispatcher.dispatchTasks(
            tasks.map((task) => ({
              jobType: task.jobType,
              payload: task.payload,
            }))
          );

          jobLogger.info('Supervisor run completed', {
            orgId: payload.orgId,
            tasksDispatched: jobIds.length,
            jobIds,
          });
        } else {
          jobLogger.info('Supervisor run completed with no tasks', {
            orgId: payload.orgId,
          });
        }
      });
    } catch (error) {
      if (error instanceof SupervisorLockError) {
        jobLogger.warn('Supervisor run skipped - already in progress', {
          orgId: payload.orgId,
        });
        // Don't throw - this is expected behavior
        return;
      }
      throw error;
    }
  },
};

export function getJobHandler(type: string): JobHandler | undefined {
  return handlers[type as JobQueueType];
}
