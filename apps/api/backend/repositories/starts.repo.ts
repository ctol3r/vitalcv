import crypto from 'crypto';
import {
  StartAttestation,
  type StartAttestationInput,
} from '../../../../packages/domain/events/StartAttestation';
import prisma from '../src/graphql/prisma_client';

type CanonicalEventType = 'START_EMITTED';

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

function buildStartPayload(event: StartAttestation): Record<string, unknown> {
  return {
    startId: event.startId,
    acceptanceId: event.acceptanceId,
    subjectId: event.subjectId,
    employerId: event.employerId,
    attestedAt: event.attestedAt,
  };
}

function buildMetadata(eventType: CanonicalEventType, payload: Record<string, unknown>) {
  return {
    eventTimestamp: payload.attestedAt ?? null,
    subjectId: payload.subjectId ?? null,
    eventHash: canonicalEventHash(eventType, payload),
    acceptanceId: payload.acceptanceId ?? null,
    startId: payload.startId ?? null,
    payload,
  };
}

function toStartInput(payload: Record<string, unknown>): StartAttestationInput {
  return {
    startId: String(payload.startId ?? ''),
    acceptanceId: String(payload.acceptanceId ?? ''),
    subjectId: String(payload.subjectId ?? ''),
    employerId: String(payload.employerId ?? ''),
    attestedAt: String(payload.attestedAt ?? ''),
  };
}

function parseStartRecord(record: { metadata: unknown } | null): StartAttestation | null {
  if (!record || !record.metadata || typeof record.metadata !== 'object') return null;
  const metadata = record.metadata as Record<string, unknown>;
  const payload = metadata.payload;
  if (!payload || typeof payload !== 'object') return null;

  try {
    return new StartAttestation(toStartInput(payload as Record<string, unknown>));
  } catch {
    return null;
  }
}

export async function insertStart(event: StartAttestation): Promise<void> {
  const existing = await prisma.auditEvent.findFirst({
    where: { type: 'START_EMITTED', credentialId: event.startId },
  });
  if (existing) {
    throw new Error(`StartAttestation already exists for ${event.startId}`);
  }

  const payload = buildStartPayload(event);
  const metadata = buildMetadata('START_EMITTED', payload);

  await prisma.auditEvent.create({
    data: {
      type: 'START_EMITTED',
      hash: String(metadata.eventHash),
      credentialId: event.startId,
      metadata,
      createdAt: new Date(),
    },
  });
}

export async function getStartById(startId: string): Promise<StartAttestation | null> {
  const record = await prisma.auditEvent.findFirst({
    where: { type: 'START_EMITTED', credentialId: startId },
    orderBy: { createdAt: 'desc' },
  });

  return parseStartRecord(record);
}

export async function listStartsBySubject(subjectId: string): Promise<StartAttestation[]> {
  const records = await prisma.auditEvent.findMany({ where: { type: 'START_EMITTED' } });
  const starts: StartAttestation[] = [];

  for (const record of records) {
    const start = parseStartRecord(record);
    if (start && start.subjectId === subjectId) {
      starts.push(start);
    }
  }

  return starts;
}

export async function listStartsByAcceptanceId(acceptanceId: string): Promise<StartAttestation[]> {
  const records = await prisma.auditEvent.findMany({ where: { type: 'START_EMITTED' } });
  const starts: StartAttestation[] = [];

  for (const record of records) {
    const start = parseStartRecord(record);
    if (start && start.acceptanceId === acceptanceId) {
      starts.push(start);
    }
  }

  return starts;
}
