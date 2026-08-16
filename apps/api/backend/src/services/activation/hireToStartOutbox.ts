/**
 * Durable outbound intent for hire-to-start lifecycle events.
 *
 * Same contract as the decision outbox in employerWorkflowService: the intent
 * is persisted in the SAME transaction as the state transition it announces,
 * and a delivery worker may process it later. The dedupeKey makes replays
 * idempotent (upsert, never a second row).
 *
 * SCOPE NOTE (supersedes-#1384 reconstruction): PR #1381 built a fuller
 * integrations layer (`services/integrations/hireToStartOutbox`, external
 * references, inbox receipts, an outbound sync worker). That branch is
 * deferred. This module carries only the piece current main can honour — a
 * durable OutboxEvent row written atomically with the lifecycle change. When
 * the integrations wave lands, it supersedes this helper; the enqueue call
 * sites keep the same name and shape so that landing is a move, not a rewrite.
 */
import type { Prisma } from '@prisma/client';

export type HireToStartOutboundEventType =
  | 'HIRE_TO_START_REQUIREMENT_CHANGED'
  | 'HIRE_TO_START_START_READY'
  | 'HIRE_TO_START_START_CONFIRMED';

export async function enqueueHireToStartOutboundEvent(
  tx: Prisma.TransactionClient,
  input: {
    eventType: HireToStartOutboundEventType;
    applicationId: string;
    organizationId: string;
    occurredAt: Date;
    dedupeKey: string;
    data: Record<string, unknown>;
  },
): Promise<{ id: string }> {
  const payload = {
    organizationId: input.organizationId,
    occurredAt: input.occurredAt.toISOString(),
    ...input.data,
  };
  const row = await tx.outboxEvent.upsert({
    where: { dedupeKey: input.dedupeKey },
    create: {
      eventType: input.eventType,
      aggregateType: 'APPLICATION',
      aggregateId: input.applicationId,
      payload,
      dedupeKey: input.dedupeKey,
      status: 'PENDING',
      attemptCount: 0,
      availableAt: input.occurredAt,
    },
    update: {
      payload,
      status: 'PENDING',
      availableAt: input.occurredAt,
      lastError: null,
    },
  });
  return { id: row.id };
}
