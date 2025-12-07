import crypto from 'crypto';
import { Prisma, PrismaClient, CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();
const log = getServiceLogger('timeline/logCredentialTimelineEvent');

export interface LogCredentialTimelineEventInput {
  clinicianId: string;
  eventType: CredentialTimelineEventType;
  severity?: TimelineEventSeverity;
  metadata?: Record<string, unknown>;
}

function toJson(metadata?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!metadata) {
    return undefined;
  }
  return metadata as Prisma.InputJsonValue;
}

export async function logCredentialTimelineEvent(
  input: LogCredentialTimelineEventInput
): Promise<void> {
  if (!input.clinicianId) {
    log.warn('[logCredentialTimelineEvent] missing clinician id', { eventType: input.eventType });
    return;
  }

  try {
    await prisma.credentialTimelineEvent.create({
      data: {
        clinicianId: input.clinicianId,
        eventType: input.eventType,
        severity: input.severity ?? TimelineEventSeverity.INFO,
        metadata: toJson(input.metadata),
        auditHash: crypto.randomUUID(),
      },
    });
  } catch (error) {
    log.error('[logCredentialTimelineEvent] failed to persist event', {
      eventType: input.eventType,
      clinicianId: input.clinicianId,
      error,
    });
  }
}
