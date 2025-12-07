import {
  CredentialTimelineEventType,
  TimelineEventSeverity,
} from '@prisma/client';
import { createJobLogger } from '@packages/queue-core';
import type { JobQueueRecord } from '../../queue/models/JobQueue.js';
import { createJobQueueEntry } from '../../queue/models/JobQueue.js';
import {
  parseJobPayload,
  type JobPayloadMap,
} from '../../queue/validation/payloadValidator.js';
import { mobilityEngine, type MobilityEngine } from '../mobilityEngine.js';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const handlerLogger = getServiceLogger('mobility/evaluateHandler');

type MobilityPayload = JobPayloadMap['MOBILITY_EVALUATE_ORG'];

export interface MobilityHandlerDeps {
  engine?: MobilityEngine;
  timelineLogger?: typeof logCredentialTimelineEvent;
}

export function createMobilityEvaluateHandler(deps: MobilityHandlerDeps = {}) {
  const engine = deps.engine ?? mobilityEngine;
  const timelineLogger = deps.timelineLogger ?? logCredentialTimelineEvent;

  return async function runMobilityEvaluateHandler(
    job: JobQueueRecord,
  ): Promise<void> {
    const payload = parseJobPayload(job, 'MOBILITY_EVALUATE_ORG');
    const jobLogger = createJobLogger(job, { baseLogger: handlerLogger });

    const evaluation = await engine.evaluateOnboardingRequest(
      payload.onboardingRequestId,
    );

    await timelineLogger({
      clinicianId: evaluation.clinicianId,
      eventType: CredentialTimelineEventType.PRIVILEGE_SYNCED,
      severity:
        evaluation.readinessStatus === 'blocked'
          ? TimelineEventSeverity.WARNING
          : TimelineEventSeverity.INFO,
      metadata: {
        readinessScore: evaluation.readinessScore,
        readinessStatus: evaluation.readinessStatus,
        missingPrivileges: evaluation.missingPrivileges,
        reasons: evaluation.reasons,
      },
    });

    await enqueueEhrSyncJob(evaluation).catch((error) => {
      handlerLogger.warn('Failed to enqueue EHR sync job from mobility handler', {
        requestId: evaluation.requestId,
        error,
      });
    });

    jobLogger.info('Mobility evaluation completed', {
      readinessScore: evaluation.readinessScore,
      readinessStatus: evaluation.readinessStatus,
      missingPrivileges: evaluation.missingPrivileges.length,
    });
  };
}

export const runMobilityEvaluateHandler = createMobilityEvaluateHandler();

async function enqueueEhrSyncJob(evaluation: {
  requestId: string;
  orgId: string;
  clinicianId: string;
}) {
  await createJobQueueEntry('EHR_SYNC', {
    syncId: `mobility:${evaluation.requestId}`,
  });
}

