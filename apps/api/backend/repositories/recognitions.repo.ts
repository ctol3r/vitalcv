import crypto from 'crypto';
import {
  type RecognitionEventInput,
  type RecognitionRevocation,
  RecognitionEvent,
} from '../../../../packages/domain/events/RecognitionEvent';
import prisma from '../src/graphql/prisma_client';

type CanonicalEventType = 'RECOGNITION_EMITTED' | 'RECOGNITION_REVOKED';

type RecognitionRevocationRecord = RecognitionRevocation & {
  recognitionId: string;
  subjectId: string;
};

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
}

function canonicalEventHash(
  eventType: CanonicalEventType,
  payload: Record<string, unknown>,
): string {
  return crypto.createHash('sha256').update(stableStringify({ eventType, payload })).digest('hex');
}

function buildRecognitionPayload(event: RecognitionEvent): Record<string, unknown> {
  return {
    recognitionId: event.recognitionId,
    subjectId: event.subjectId,
    employerId: event.employerId,
    recognizedAt: event.recognizedAt,
    verification: {
      verifiedAt: event.verification.verifiedAt,
      verificationRef: event.verification.verificationRef,
    },
    expiresAt: event.expiresAt,
    revocation: event.revocation
      ? {
          revokedAt: event.revocation.revokedAt,
          revocationRef: event.revocation.revocationRef,
        }
      : null,
  };
}

function buildRevocationPayload(revocation: RecognitionRevocationRecord): Record<string, unknown> {
  return {
    recognitionId: revocation.recognitionId,
    subjectId: revocation.subjectId,
    revokedAt: revocation.revokedAt,
    revocationRef: revocation.revocationRef,
  };
}

function buildMetadata(eventType: CanonicalEventType, payload: Record<string, unknown>) {
  return {
    eventTimestamp:
      eventType === 'RECOGNITION_REVOKED'
        ? payload.revokedAt ?? null
        : payload.recognizedAt ?? null,
    subjectId: payload.subjectId ?? null,
    eventHash: canonicalEventHash(eventType, payload),
    recognitionId: payload.recognitionId ?? null,
    payload,
  };
}

function toRecognitionInput(
  payload: Record<string, unknown>,
  revocation: RecognitionRevocation | null,
): RecognitionEventInput {
  const verification = (payload.verification ?? {}) as Record<string, unknown>;
  const expiresAtRaw = payload.expiresAt;
  const expiresAt =
    expiresAtRaw === null || expiresAtRaw === undefined ? null : String(expiresAtRaw);

  return {
    recognitionId: String(payload.recognitionId ?? ''),
    subjectId: String(payload.subjectId ?? ''),
    employerId: String(payload.employerId ?? ''),
    recognizedAt: String(payload.recognizedAt ?? ''),
    verification: {
      verifiedAt: String(verification.verifiedAt ?? ''),
      verificationRef: String(verification.verificationRef ?? ''),
    },
    expiresAt,
    revocation,
  };
}

function parseRecognitionRecord(record: { metadata: unknown } | null): RecognitionEvent | null {
  if (!record || !record.metadata || typeof record.metadata !== 'object') return null;
  const metadata = record.metadata as Record<string, unknown>;
  const payload = metadata.payload;
  if (!payload || typeof payload !== 'object') return null;

  try {
    return new RecognitionEvent(toRecognitionInput(payload as Record<string, unknown>, null));
  } catch {
    return null;
  }
}

function parseRevocationRecord(
  record: { metadata: unknown } | null,
): RecognitionRevocationRecord | null {
  if (!record || !record.metadata || typeof record.metadata !== 'object') return null;
  const metadata = record.metadata as Record<string, unknown>;
  const payload = metadata.payload;
  if (!payload || typeof payload !== 'object') return null;

  const data = payload as Record<string, unknown>;
  const recognitionId = String(data.recognitionId ?? '').trim();
  const subjectId = String(data.subjectId ?? '').trim();
  const revokedAt = String(data.revokedAt ?? '').trim();
  const revocationRef = String(data.revocationRef ?? '').trim();

  if (!recognitionId || !subjectId || !revokedAt || !revocationRef) return null;

  return {
    recognitionId,
    subjectId,
    revokedAt,
    revocationRef,
  };
}

export async function insertRecognition(event: RecognitionEvent): Promise<void> {
  const existing = await prisma.auditEvent.findFirst({
    where: { type: 'RECOGNITION_EMITTED', credentialId: event.recognitionId },
  });
  if (existing) {
    throw new Error(`RecognitionEvent already exists for ${event.recognitionId}`);
  }

  const payload = buildRecognitionPayload(event);
  const metadata = buildMetadata('RECOGNITION_EMITTED', payload);

  await prisma.auditEvent.create({
    data: {
      type: 'RECOGNITION_EMITTED',
      hash: String(metadata.eventHash),
      credentialId: event.recognitionId,
      metadata,
      createdAt: new Date(),
    },
  });
}

export async function insertRecognitionRevocation(
  revocation: RecognitionRevocationRecord,
): Promise<void> {
  const payload = buildRevocationPayload(revocation);
  const metadata = buildMetadata('RECOGNITION_REVOKED', payload);

  await prisma.auditEvent.create({
    data: {
      type: 'RECOGNITION_REVOKED',
      hash: String(metadata.eventHash),
      credentialId: revocation.recognitionId,
      metadata,
      createdAt: new Date(),
    },
  });
}

export async function getRecognitionById(recognitionId: string): Promise<RecognitionEvent | null> {
  const record = await prisma.auditEvent.findFirst({
    where: { type: 'RECOGNITION_EMITTED', credentialId: recognitionId },
    orderBy: { createdAt: 'desc' },
  });

  const recognition = parseRecognitionRecord(record);
  if (!recognition) return null;

  const revocationRecord = await prisma.auditEvent.findFirst({
    where: { type: 'RECOGNITION_REVOKED', credentialId: recognitionId },
    orderBy: { createdAt: 'desc' },
  });

  const revocation = parseRevocationRecord(revocationRecord);
  if (!revocation) return recognition;

  return new RecognitionEvent(
    toRecognitionInput(buildRecognitionPayload(recognition), {
      revokedAt: revocation.revokedAt,
      revocationRef: revocation.revocationRef,
    }),
  );
}

export async function listRecognitionsBySubject(subjectId: string): Promise<RecognitionEvent[]> {
  const [recognitionRecords, revocationRecords] = await Promise.all([
    prisma.auditEvent.findMany({ where: { type: 'RECOGNITION_EMITTED' } }),
    prisma.auditEvent.findMany({ where: { type: 'RECOGNITION_REVOKED' } }),
  ]);

  const revocations = new Map<string, RecognitionRevocationRecord>();
  for (const record of revocationRecords) {
    const revocation = parseRevocationRecord(record);
    if (revocation && revocation.subjectId === subjectId) {
      revocations.set(revocation.recognitionId, revocation);
    }
  }

  const recognitions: RecognitionEvent[] = [];
  for (const record of recognitionRecords) {
    const recognition = parseRecognitionRecord(record);
    if (!recognition || recognition.subjectId !== subjectId) continue;

    const revocation = revocations.get(recognition.recognitionId);
    if (revocation) {
      recognitions.push(
        new RecognitionEvent(
          toRecognitionInput(buildRecognitionPayload(recognition), {
            revokedAt: revocation.revokedAt,
            revocationRef: revocation.revocationRef,
          }),
        ),
      );
    } else {
      recognitions.push(recognition);
    }
  }

  return recognitions;
}
