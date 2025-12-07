import {
  CredentialTimelineEventType,
  DriftEventSeverity,
  DriftEventStatus,
  PrismaClient,
  PrivilegeSafetyStateValue,
  TimelineEventSeverity,
} from '@prisma/client';
import { createJobLogger } from '@packages/queue-core';
import type { JobQueueRecord } from '../../queue/models/JobQueue.js';
import {
  parseJobPayload,
  type JobPayloadMap,
} from '../../queue/validation/payloadValidator.js';
import {
  SafetySignalCollector,
  type DriftSourceEvent,
  type SafetySignalResult,
} from '../collectors/signalCollector.js';
import { RestrictionEngine, type RestrictionDecision } from '../restrictionEngine.js';
import { createNotification } from '../../notifications/notificationService.js';
import { enqueueEmail } from '../../notifications/emailEnqueue.js';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { GlobalConcurrencyGate } from '../../queue/handlers/concurrency.js';

const handlerLogger = getServiceLogger('safety/sweepHandler');
const safetySweepConcurrency = new GlobalConcurrencyGate('SAFETY_SWEEP', 1);

type SafetySweepPayload = JobPayloadMap['SAFETY_SWEEP'];

export interface SafetySweepHandlerDeps {
  prisma?: PrismaClient;
  collector?: SafetySignalCollector;
  restrictionEngine?: RestrictionEngine;
  timelineLogger?: typeof logCredentialTimelineEvent;
}

export function createSafetySweepHandler(deps: SafetySweepHandlerDeps = {}) {
  const prisma = deps.prisma ?? new PrismaClient();
  const collector =
    deps.collector ?? new SafetySignalCollector({ prisma });
  const restrictionEngine =
    deps.restrictionEngine ?? new RestrictionEngine(prisma);
  const timelineLogger = deps.timelineLogger ?? logCredentialTimelineEvent;

  return async function runSafetySweepHandler(
    job: JobQueueRecord,
  ): Promise<void> {
    await safetySweepConcurrency.run(async () => {
      const payload = parseJobPayload(job, 'SAFETY_SWEEP');
      const jobLogger = createJobLogger(job, { baseLogger: handlerLogger });

      const driftEvents = await prisma.driftEvent.findMany({
        where: {
          status: { in: [DriftEventStatus.OPEN, DriftEventStatus.ACKNOWLEDGED] },
          clinicianId: payload.clinicianId
            ? payload.clinicianId
            : { not: null },
        },
        orderBy: { triggeredAt: 'asc' },
        take: payload.clinicianId ? 100 : 500,
      });

      if (driftEvents.length === 0) {
        jobLogger.info('No drift events available for safety sweep', {
          clinicianId: payload.clinicianId,
        });
        return;
      }

      const signalResults: SafetySignalResult[] = [];

      for (const driftEvent of driftEvents) {
        const driftPayload = mapDriftEventToSignal(driftEvent);
        if (!driftPayload) {
          continue;
        }
        const result = await collector.ingestDriftEvent(driftPayload);
        if (result) {
          signalResults.push(result);
        }
      }

      if (signalResults.length === 0) {
        jobLogger.info('Safety sweep completed without new signals', {
          clinicianId: payload.clinicianId,
        });
        return;
      }

      const decisions = await applyRestrictions(
        restrictionEngine,
        signalResults,
      );

      if (decisions.length === 0) {
        jobLogger.info('Safety sweep produced no new restrictions', {
          signals: signalResults.length,
        });
        return;
      }

      const clinicianContacts = await loadClinicianContacts(
        prisma,
        decisions.map((decision) => decision.clinicianId),
      );

      for (const decision of decisions) {
        await timelineLogger({
          clinicianId: decision.clinicianId,
          eventType: CredentialTimelineEventType.PRIVILEGE_SAFETY_RESTRICTION,
          severity: resolveTimelineSeverity(decision.state),
          metadata: {
            privilegeCode: decision.privilegeCode,
            state: decision.state,
            signalId: decision.signalId,
          },
        });

        await notifyClinician(decision, clinicianContacts.get(decision.clinicianId));
      }

      jobLogger.info('Safety sweep completed', {
        signals: signalResults.length,
        restrictions: decisions.length,
      });
    });
  };
}

export const runSafetySweepHandler = createSafetySweepHandler();

async function applyRestrictions(
  engine: RestrictionEngine,
  results: SafetySignalResult[],
) {
  const decisions = [];
  for (const result of results) {
    const applied = await engine.apply(result);
    decisions.push(...applied);
  }
  return decisions;
}

function mapDriftEventToSignal(
  driftEvent: Awaited<ReturnType<PrismaClient['driftEvent']['findMany']>>[number],
): DriftSourceEvent | null {
  if (!driftEvent.clinicianId) {
    return null;
  }
  return {
    id: driftEvent.id,
    clinicianId: driftEvent.clinicianId,
    orgId: driftEvent.orgId ?? undefined,
    type: driftEvent.type,
    detector: driftEvent.detectorId,
    severity: mapSeverity(driftEvent.severity),
    summary: driftEvent.summary,
    metadata: (driftEvent.metadata ?? undefined) as Record<string, unknown> | undefined,
    source: 'drift-monitor',
    detectedAt: driftEvent.triggeredAt,
  };
}

function mapSeverity(severity: DriftEventSeverity): DriftSourceEvent['severity'] {
  switch (severity) {
    case DriftEventSeverity.CRITICAL:
      return 'critical';
    case DriftEventSeverity.WARNING:
      return 'warning';
    default:
      return 'info';
  }
}

async function loadClinicianContacts(
  prisma: PrismaClient,
  clinicianIds: string[],
) {
  const uniqueIds = Array.from(new Set(clinicianIds));
  if (uniqueIds.length === 0) {
    return new Map<string, { userId?: string; email?: string; name?: string | null }>();
  }

  const rows = await prisma.clinicianProfile.findMany({
    where: { id: { in: uniqueIds } },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  return new Map(
    rows.map((row) => [
      row.id,
      {
        userId: row.user?.id,
        email: row.user?.email ?? undefined,
        name: row.user?.name ?? null,
      },
    ]),
  );
}

async function notifyClinician(
  decision: RestrictionDecision,
  contact?: { userId?: string; email?: string; name?: string | null },
) {
  if (contact?.userId) {
    await createNotification(contact.userId, 'SAFETY_RESTRICTION_APPLIED', {
      privilegeCode: decision.privilegeCode,
      state: decision.state,
      signalId: decision.signalId,
    });
  }

  if (contact?.email) {
    await enqueueEmail(contact.email, 'safety_restriction_alert', {
      subject: `New safety restriction (${decision.state})`,
      clinicianName: contact.name ?? 'Clinician',
      privilegeCode: decision.privilegeCode,
      severity: decision.severity,
    });
  }
}

function resolveTimelineSeverity(
  state: PrivilegeSafetyStateValue,
): TimelineEventSeverity {
  switch (state) {
    case PrivilegeSafetyStateValue.SUSPENDED:
      return TimelineEventSeverity.CRITICAL;
    case PrivilegeSafetyStateValue.HOLD:
      return TimelineEventSeverity.WARNING;
    default:
      return TimelineEventSeverity.INFO;
  }
}

