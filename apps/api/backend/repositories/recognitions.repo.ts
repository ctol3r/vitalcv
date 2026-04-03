import crypto from 'crypto';
import {
  type RecognitionEventInput,
  type RecognitionRevocation,
  RecognitionEvent,
} from '@vitalcv/domain';
import prisma from '../src/graphql/prisma_client';

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
}

function eventHash(event: RecognitionEvent): string {
  return crypto
    .createHash('sha256')
    .update(
      stableStringify({
        eventType: 'RECOGNITION_EMITTED',
        payload: {
          recognitionId: event.recognitionId,
          subjectId: event.subjectId,
          employerId: event.employerId,
          recognizedAt: event.recognizedAt,
        },
      }),
    )
    .digest('hex');
}

function rowToRecognitionEvent(row: {
  recognitionId: string;
  subjectId: string;
  employerId: string;
  recognizedAt: Date;
  verifiedAt: Date;
  verificationRef: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revocationRef: string | null;
}): RecognitionEvent {
  const revocation: RecognitionRevocation | null =
    row.revokedAt && row.revocationRef
      ? { revokedAt: row.revokedAt.toISOString(), revocationRef: row.revocationRef }
      : null;

  return new RecognitionEvent({
    recognitionId: row.recognitionId,
    subjectId: row.subjectId,
    employerId: row.employerId,
    recognizedAt: row.recognizedAt.toISOString(),
    verification: {
      verifiedAt: row.verifiedAt.toISOString(),
      verificationRef: row.verificationRef,
    },
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    revocation,
  });
}

export async function insertRecognition(event: RecognitionEvent): Promise<void> {
  const existing = await prisma.recognition.findUnique({
    where: { recognitionId: event.recognitionId },
  });
  if (existing) {
    throw new Error(`RecognitionEvent already exists for ${event.recognitionId}`);
  }

  await prisma.recognition.create({
    data: {
      recognitionId: event.recognitionId,
      subjectId: event.subjectId,
      employerId: event.employerId,
      recognizedAt: new Date(event.recognizedAt),
      verifiedAt: new Date(event.verification.verifiedAt),
      verificationRef: event.verification.verificationRef,
      expiresAt: event.expiresAt ? new Date(event.expiresAt) : null,
      revokedAt: event.revocation ? new Date(event.revocation.revokedAt) : null,
      revocationRef: event.revocation?.revocationRef ?? null,
      eventHash: eventHash(event),
    },
  });
}

type RecognitionRevocationRecord = RecognitionRevocation & {
  recognitionId: string;
  subjectId: string;
};

export async function insertRecognitionRevocation(
  revocation: RecognitionRevocationRecord,
): Promise<void> {
  await prisma.recognition.update({
    where: { recognitionId: revocation.recognitionId },
    data: {
      revokedAt: new Date(revocation.revokedAt),
      revocationRef: revocation.revocationRef,
    },
  });
}

export async function getRecognitionById(recognitionId: string): Promise<RecognitionEvent | null> {
  const row = await prisma.recognition.findUnique({
    where: { recognitionId },
  });
  if (!row) return null;
  return rowToRecognitionEvent(row);
}

export async function listRecognitionsBySubject(subjectId: string): Promise<RecognitionEvent[]> {
  const rows = await prisma.recognition.findMany({
    where: { subjectId },
    orderBy: { recognizedAt: 'desc' },
  });
  return rows.map(rowToRecognitionEvent);
}
