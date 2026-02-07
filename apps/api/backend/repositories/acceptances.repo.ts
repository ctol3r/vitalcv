import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import {
  EmployerAcceptance,
  type EmployerAcceptanceInput,
} from '../../../../packages/domain/events/EmployerAcceptance';
import prisma from '../src/graphql/prisma_client';

type CanonicalEventType = 'ACCEPTANCE_EMITTED';
type CanonicalMetadata = Readonly<{
  eventTimestamp: unknown;
  subjectId: unknown;
  eventHash: string;
  recognitionId: unknown;
  acceptanceId: unknown;
  payload: Prisma.InputJsonValue;
}>;

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

function buildAcceptancePayload(event: EmployerAcceptance): Record<string, unknown> {
  return {
    acceptanceId: event.acceptanceId,
    recognitionId: event.recognitionId,
    subjectId: event.subjectId,
    employerId: event.employerId,
    facilityId: event.facilityId,
    acceptedAt: event.acceptedAt,
  };
}

function buildMetadata(eventType: CanonicalEventType, payload: Record<string, unknown>): CanonicalMetadata {
  return {
    eventTimestamp: payload.acceptedAt ?? null,
    subjectId: payload.subjectId ?? null,
    eventHash: canonicalEventHash(eventType, payload),
    recognitionId: payload.recognitionId ?? null,
    acceptanceId: payload.acceptanceId ?? null,
    payload: payload as Prisma.InputJsonValue,
  };
}

function toAcceptanceInput(payload: Record<string, unknown>): EmployerAcceptanceInput {
  return {
    acceptanceId: String(payload.acceptanceId ?? ''),
    recognitionId: String(payload.recognitionId ?? ''),
    subjectId: String(payload.subjectId ?? ''),
    employerId: String(payload.employerId ?? ''),
    facilityId: String(payload.facilityId ?? ''),
    acceptedAt: String(payload.acceptedAt ?? ''),
  };
}

function parseAcceptanceRecord(record: { metadata: unknown } | null): EmployerAcceptance | null {
  if (!record || !record.metadata || typeof record.metadata !== 'object') return null;
  const metadata = record.metadata as Record<string, unknown>;
  const payload = metadata.payload;
  if (!payload || typeof payload !== 'object') return null;

  try {
    return new EmployerAcceptance(toAcceptanceInput(payload as Record<string, unknown>));
  } catch {
    return null;
  }
}

export async function insertAcceptance(event: EmployerAcceptance): Promise<void> {
  const existing = await prisma.auditEvent.findFirst({
    where: { type: 'ACCEPTANCE_EMITTED', credentialId: event.acceptanceId },
  });
  if (existing) {
    throw new Error(`EmployerAcceptance already exists for ${event.acceptanceId}`);
  }

  const payload = buildAcceptancePayload(event);
  const metadata = buildMetadata('ACCEPTANCE_EMITTED', payload);

  await prisma.auditEvent.create({
    data: {
      type: 'ACCEPTANCE_EMITTED',
      hash: String(metadata.eventHash),
      credentialId: event.acceptanceId,
      metadata: metadata as Prisma.InputJsonValue,
      createdAt: new Date(),
    },
  });
}

export async function getAcceptanceById(acceptanceId: string): Promise<EmployerAcceptance | null> {
  const record = await prisma.auditEvent.findFirst({
    where: { type: 'ACCEPTANCE_EMITTED', credentialId: acceptanceId },
    orderBy: { createdAt: 'desc' },
  });

  return parseAcceptanceRecord(record);
}

export async function listAcceptancesBySubject(subjectId: string): Promise<EmployerAcceptance[]> {
  const records = await prisma.auditEvent.findMany({ where: { type: 'ACCEPTANCE_EMITTED' } });
  const acceptances: EmployerAcceptance[] = [];

  for (const record of records) {
    const acceptance = parseAcceptanceRecord(record);
    if (acceptance && acceptance.subjectId === subjectId) {
      acceptances.push(acceptance);
    }
  }

  return acceptances;
}
