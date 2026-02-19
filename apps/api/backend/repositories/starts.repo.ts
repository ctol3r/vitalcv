import crypto from 'crypto';
import {
  StartAttestation,
  type StartAttestationInput,
} from '../../../../packages/domain/events/StartAttestation';
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

function eventHash(event: StartAttestation): string {
  return crypto
    .createHash('sha256')
    .update(
      stableStringify({
        eventType: 'START_EMITTED',
        payload: {
          startId: event.startId,
          acceptanceId: event.acceptanceId,
          subjectId: event.subjectId,
          employerId: event.employerId,
          attestedAt: event.attestedAt,
        },
      }),
    )
    .digest('hex');
}

function rowToStart(row: {
  startId: string;
  acceptanceId: string;
  subjectId: string;
  employerId: string;
  attestedAt: Date;
}): StartAttestation {
  return new StartAttestation({
    startId: row.startId,
    acceptanceId: row.acceptanceId,
    subjectId: row.subjectId,
    employerId: row.employerId,
    attestedAt: row.attestedAt.toISOString(),
  });
}

export async function insertStart(event: StartAttestation): Promise<void> {
  const existing = await prisma.start.findUnique({
    where: { startId: event.startId },
  });
  if (existing) {
    throw new Error(`StartAttestation already exists for ${event.startId}`);
  }

  await prisma.start.create({
    data: {
      startId: event.startId,
      acceptanceId: event.acceptanceId,
      subjectId: event.subjectId,
      employerId: event.employerId,
      attestedAt: new Date(event.attestedAt),
      eventHash: eventHash(event),
    },
  });
}

export async function getStartById(startId: string): Promise<StartAttestation | null> {
  const row = await prisma.start.findUnique({
    where: { startId },
  });
  if (!row) return null;
  return rowToStart(row);
}

export async function listStartsBySubject(subjectId: string): Promise<StartAttestation[]> {
  const rows = await prisma.start.findMany({
    where: { subjectId },
    orderBy: { attestedAt: 'desc' },
  });
  return rows.map(rowToStart);
}

export async function listStartsByAcceptanceId(acceptanceId: string): Promise<StartAttestation[]> {
  const rows = await prisma.start.findMany({
    where: { acceptanceId },
    orderBy: { attestedAt: 'desc' },
  });
  return rows.map(rowToStart);
}
