import {
  CredentialTimelineEventType,
  Prisma,
  PrismaClient,
  TimelineEventSeverity,
} from '@prisma/client';
import { createJobLogger } from '@packages/queue-core';
import type { JobQueueRecord } from '../../queue/models/JobQueue.js';
import {
  parseJobPayload,
  type JobPayloadMap,
} from '../../queue/validation/payloadValidator.js';
import { fusionEngine, type FusionEngine } from '../fusionEngine.js';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { GlobalConcurrencyGate } from '../../queue/handlers/concurrency.js';

const handlerLogger = getServiceLogger('qualityFusion/fusionHandler');
const fusionUpdateConcurrency = new GlobalConcurrencyGate('FUSION_UPDATE', 2);

type FusionUpdatePayload = JobPayloadMap['FUSION_UPDATE'];

export interface FusionHandlerDeps {
  prisma?: PrismaClient;
  engine?: FusionEngine;
  timelineLogger?: typeof logCredentialTimelineEvent;
}

export function createFusionUpdateHandler(deps: FusionHandlerDeps = {}) {
  const prisma = deps.prisma ?? new PrismaClient();
  const engine = deps.engine ?? fusionEngine;
  const timelineLogger = deps.timelineLogger ?? logCredentialTimelineEvent;

  return async function runFusionUpdateHandler(job: JobQueueRecord): Promise<void> {
    await fusionUpdateConcurrency.run(async () => {
      const payload = parseJobPayload(job, 'FUSION_UPDATE');
      const jobLogger = createJobLogger(job, { baseLogger: handlerLogger });

      const result = await engine.run({ clinicianId: payload.clinicianId });

      const analyticsMetadata: Prisma.InputJsonValue = {
        fusionScore: result.fusionScore,
        evaluatedAt: result.evaluatedAt.toISOString(),
        breakdown: result.breakdown,
        driftOpen: result.driftOpen,
        safetyAlerts: result.safetyAlerts,
      };

      await prisma.analyticsEvent.create({
        data: {
          eventType: 'FUSION_SCORE_UPDATED',
          subjectId: payload.clinicianId,
          metadata: analyticsMetadata,
        },
      });

      await timelineLogger({
        clinicianId: payload.clinicianId,
        eventType: CredentialTimelineEventType.OPPE_CYCLE,
        severity:
          result.fusionScore < 0.5
            ? TimelineEventSeverity.WARNING
            : TimelineEventSeverity.INFO,
        metadata: {
          fusionScore: result.fusionScore,
          driftOpen: result.driftOpen,
          safetyAlerts: result.safetyAlerts,
        },
      });

      jobLogger.info('Fusion composite score recalculated', {
        fusionScore: result.fusionScore,
        driftOpen: result.driftOpen,
        safetyAlerts: result.safetyAlerts,
      });
    });
  };
}

export const runFusionUpdateHandler = createFusionUpdateHandler();

