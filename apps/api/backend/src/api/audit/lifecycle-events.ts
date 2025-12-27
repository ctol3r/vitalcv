import crypto from 'crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { PulseEmitter, PulseEvent } from '../lifecycle/engine';

function computeHash(event: PulseEvent, recordedAtIso: string): string {
  const serialized = JSON.stringify({
    type: event.type,
    credentialId: event.credentialId,
    authorityId: event.authorityId ?? null,
    status: event.status,
    occurredAt: event.occurredAt,
    recordedAt: recordedAtIso,
    details: event.details ?? null,
  });
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

export async function recordLifecyclePulseEvent(
  event: PulseEvent,
): Promise<{ hash: string; recordedAt: string }> {
  const recordedAt = new Date().toISOString();
  const hash = computeHash(event, recordedAt);

  await prisma.auditEvent.create({
    data: {
      type: event.type,
      hash,
      credentialId: event.credentialId,
      metadata: {
        status: event.status,
        authorityId: event.authorityId,
        occurredAt: event.occurredAt,
        details: event.details ?? undefined,
      },
      createdAt: new Date(recordedAt),
    },
  });

  log('info', 'lifecycle_pulse_event_recorded', {
    credentialId: event.credentialId,
    authorityId: event.authorityId,
    type: event.type,
    status: event.status,
    hash,
  });

  return { hash, recordedAt };
}

export class AuditPulseEmitter implements PulseEmitter {
  async emit(event: PulseEvent): Promise<void> {
    await recordLifecyclePulseEvent(event);
  }
}
