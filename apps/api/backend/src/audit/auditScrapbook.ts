import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function sha256Hex(payload: string): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export async function logAuditEvent(
  eventType: string,
  payload: {
    subjectId: string;
    credentialId?: string;
    [key: string]: unknown;
  }
): Promise<{ hash: string; timestamp: string }> {
  const timestamp = new Date();
  const hash = sha256Hex(
    JSON.stringify({
      eventType,
      subjectId: payload.subjectId,
      credentialId: payload.credentialId ?? null,
      timestamp: timestamp.toISOString(),
      payload,
    })
  );

  await prisma.auditEvent.create({
    data: {
      type: eventType,
      hash,
      credentialId: payload.credentialId,
      metadata: {
        subjectId: payload.subjectId,
        ...payload,
      },
      createdAt: timestamp,
    },
  });

  return { hash, timestamp: timestamp.toISOString() };
}

export async function logVerificationEvent(
  credentialId: string,
  outcome: {
    valid: boolean;
    verifierId: string;
    vc: unknown;
    issuer?: string;
    subject?: string;
  }
): Promise<{ hash: string; timestamp: string }> {
  const timestamp = new Date();
  const vcHash = sha256Hex(JSON.stringify(outcome.vc));

  await prisma.auditEvent.create({
    data: {
      type: 'VERIFY_CREDENTIAL',
      hash: vcHash,
      credentialId,
      metadata: {
        verifierId: outcome.verifierId,
        valid: outcome.valid,
        issuer: outcome.issuer,
        subject: outcome.subject,
      },
      createdAt: timestamp,
    },
  });

  return { hash: vcHash, timestamp: timestamp.toISOString() };
}
