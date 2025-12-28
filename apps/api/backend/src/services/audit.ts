import crypto from 'crypto';
import prisma from '../graphql/prisma_client';

export type AuditEventInput = {
  eventType: string;
  credentialId?: string;
  userId?: number;
  subjectId?: string;
  metadata?: Record<string, unknown>;
};

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function logAuditEvent(input: AuditEventInput): Promise<{
  hash: string;
  createdAt: string;
}> {
  const createdAt = new Date();

  const metadata = input.subjectId
    ? { ...(input.metadata ?? {}), subjectId: input.subjectId }
    : input.metadata;

  const payload = {
    type: input.eventType,
    credentialId: input.credentialId || null,
    userId: input.userId || null,
    subjectId: input.subjectId || null,
    createdAt: createdAt.toISOString(),
    metadata: metadata || null,
  };

  const hash = sha256Hex(JSON.stringify(payload));

  await prisma.auditEvent.create({
    data: {
      type: input.eventType,
      hash,
      credentialId: input.credentialId,
      userId: input.userId,
      metadata: metadata ?? undefined,
      createdAt,
    },
  });

  return { hash, createdAt: createdAt.toISOString() };
}
