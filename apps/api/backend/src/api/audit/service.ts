import crypto from 'crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

export type AuditEventType = 'ISSUE' | 'VERIFY' | 'REVOKE' | 'RECEIPT_VIEWED';

export interface AuditEventInput {
  type: AuditEventType;
  credentialId?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

export interface AuditEventRecord {
  hash: string;
  createdAt: string;
}

export async function logAuditEvent(input: AuditEventInput): Promise<AuditEventRecord> {
  const createdAt = new Date();
  const payload = {
    type: input.type,
    credentialId: input.credentialId ?? null,
    requestId: input.requestId ?? null,
    createdAt: createdAt.toISOString(),
    metadata: input.metadata ?? null,
  };

  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  await prisma.auditEvent.create({
    data: {
      type: input.type,
      hash,
      credentialId: input.credentialId,
      metadata: payload.metadata ?? undefined,
      createdAt,
    },
  });

  log('info', 'audit_event_recorded', {
    type: input.type,
    credentialId: input.credentialId,
    requestId: input.requestId,
    hash,
  });

  return { hash, createdAt: createdAt.toISOString() };
}
