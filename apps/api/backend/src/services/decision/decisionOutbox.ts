import type { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import type { DecisionTriggerEvent } from '../../../repositories/decisionCapsules.repo';

export interface DecisionOutboxEventInput {
  capsuleId: string;
  subjectDid: string;
  subjectNpi: string;
  trustStateHash: string;
  decisionType: string;
  decisionAction?: string | null;
  triggerEvent: DecisionTriggerEvent;
  sourceReferenceId: string;
  artifactHash: string;
  decisionTimestamp: string;
  methodologyVersion: string;
  credentialIds: string[];
  issuerIds: string[];
  verifierOrg?: string | null;
}

export async function enqueueDecisionCapsuleCreatedEvent(
  input: DecisionOutboxEventInput,
): Promise<string> {
  const dedupeKey = [
    'DECISION_CAPSULE_CREATED',
    input.capsuleId,
    input.artifactHash,
  ].join(':');

  const payload = {
    capsuleId: input.capsuleId,
    subjectDid: input.subjectDid,
    subjectNpi: input.subjectNpi,
    trustStateHash: input.trustStateHash,
    verifierOrg: input.verifierOrg ?? null,
    decisionType: input.decisionType,
    decisionAction: input.decisionAction ?? null,
    triggerEvent: input.triggerEvent,
    sourceReferenceId: input.sourceReferenceId,
    credentialIds: [...input.credentialIds],
    issuerIds: [...input.issuerIds],
    artifactHash: input.artifactHash,
    decisionTimestamp: input.decisionTimestamp,
    methodologyVersion: input.methodologyVersion,
  };

  const outbox = await prisma.outboxEvent.upsert({
    where: { dedupeKey },
    create: {
      eventType: 'DECISION_CAPSULE_CREATED',
      aggregateType: 'DECISION_CAPSULE',
      aggregateId: input.capsuleId,
      payload: payload as Prisma.InputJsonValue,
      dedupeKey,
      status: 'PENDING',
      attemptCount: 0,
      availableAt: new Date(input.decisionTimestamp),
    },
    update: {
      payload: payload as Prisma.InputJsonValue,
      status: 'PENDING',
      availableAt: new Date(input.decisionTimestamp),
      lastError: null,
    },
    select: { id: true },
  });

  return outbox.id;
}
