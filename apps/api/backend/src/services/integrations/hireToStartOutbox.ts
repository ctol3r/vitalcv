import type { Prisma } from '@prisma/client';

export type HireToStartOutboundEventType =
  | 'HIRE_TO_START_APPLICATION_SUBMITTED'
  | 'HIRE_TO_START_PACKET_DELIVERED'
  | 'HIRE_TO_START_DECISION_RECORDED'
  | 'HIRE_TO_START_REQUIREMENT_CHANGED'
  | 'HIRE_TO_START_START_READY'
  | 'HIRE_TO_START_START_CONFIRMED';

export interface HireToStartOutboxWriter {
  outboxEvent: {
    upsert(args: {
      where: { dedupeKey: string };
      create: {
        eventType: HireToStartOutboundEventType;
        aggregateType: 'APPLICATION';
        aggregateId: string;
        payload: Prisma.InputJsonValue;
        dedupeKey: string;
        status: 'PENDING';
        attemptCount: number;
        availableAt: Date;
      };
      update: Record<string, never>;
    }): Promise<{ id: string }>;
  };
}

/**
 * Write one durable, idempotent outbound intent. Replays return the original
 * row and never reset a dispatched event to pending.
 */
export async function enqueueHireToStartOutboundEvent(
  tx: HireToStartOutboxWriter,
  input: {
    eventType: HireToStartOutboundEventType;
    applicationId: string;
    organizationId: string;
    occurredAt: Date;
    dedupeKey: string;
    data: Readonly<Record<string, unknown>>;
  },
): Promise<{ id: string }> {
  return tx.outboxEvent.upsert({
    where: { dedupeKey: input.dedupeKey },
    create: {
      eventType: input.eventType,
      aggregateType: 'APPLICATION',
      aggregateId: input.applicationId,
      payload: {
        schema: 'vitalcv.hire-to-start.event.v1',
        eventType: input.eventType,
        applicationId: input.applicationId,
        organizationId: input.organizationId,
        occurredAt: input.occurredAt.toISOString(),
        data: input.data,
      } as Prisma.InputJsonValue,
      dedupeKey: input.dedupeKey,
      status: 'PENDING',
      attemptCount: 0,
      availableAt: input.occurredAt,
    },
    update: {},
  });
}
