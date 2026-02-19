import crypto from 'crypto';
import {
  EmployerAcceptance,
  type EmployerAcceptanceInput,
} from '../../../../packages/domain/events/EmployerAcceptance';
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

function eventHash(event: EmployerAcceptance): string {
  return crypto
    .createHash('sha256')
    .update(
      stableStringify({
        eventType: 'ACCEPTANCE_EMITTED',
        payload: {
          acceptanceId: event.acceptanceId,
          recognitionId: event.recognitionId,
          subjectId: event.subjectId,
          employerId: event.employerId,
          acceptedAt: event.acceptedAt,
        },
      }),
    )
    .digest('hex');
}

function rowToAcceptance(row: {
  acceptanceId: string;
  recognitionId: string;
  subjectId: string;
  employerId: string;
  facilityId: string;
  acceptedAt: Date;
  psvReportId: string;
}): EmployerAcceptance {
  return new EmployerAcceptance({
    acceptanceId: row.acceptanceId,
    recognitionId: row.recognitionId,
    subjectId: row.subjectId,
    employerId: row.employerId,
    facilityId: row.facilityId,
    acceptedAt: row.acceptedAt.toISOString(),
    psvReportId: row.psvReportId,
  });
}

export async function insertAcceptance(event: EmployerAcceptance): Promise<void> {
  const existing = await prisma.acceptance.findUnique({
    where: { acceptanceId: event.acceptanceId },
  });
  if (existing) {
    throw new Error(`EmployerAcceptance already exists for ${event.acceptanceId}`);
  }

  await prisma.acceptance.create({
    data: {
      acceptanceId: event.acceptanceId,
      recognitionId: event.recognitionId,
      subjectId: event.subjectId,
      employerId: event.employerId,
      facilityId: event.facilityId,
      acceptedAt: new Date(event.acceptedAt),
      psvReportId: event.psvReportId,
      eventHash: eventHash(event),
    },
  });
}

export async function getAcceptanceById(acceptanceId: string): Promise<EmployerAcceptance | null> {
  const row = await prisma.acceptance.findUnique({
    where: { acceptanceId },
  });
  if (!row) return null;
  return rowToAcceptance(row);
}

export async function listAcceptancesBySubject(subjectId: string): Promise<EmployerAcceptance[]> {
  const rows = await prisma.acceptance.findMany({
    where: { subjectId },
    orderBy: { acceptedAt: 'desc' },
  });
  return rows.map(rowToAcceptance);
}
