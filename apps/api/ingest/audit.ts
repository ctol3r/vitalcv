import crypto from 'crypto';
import prisma, { Prisma } from '../backend/src/graphql/prisma_client';

export type IntakeAuditEventType =
  | 'NPI_INGESTED'
  | 'NPI_VALIDATION_FAILED'
  | 'FILE_INGESTED'
  | 'INGEST_PARSE_SUMMARY'
  | 'INGEST_CONFLICT_DETECTED'
  | 'INGEST_ERROR';

type IngestAuditInput = Readonly<{
  type: IntakeAuditEventType;
  clinician_id: string;
  metadata: Readonly<Record<string, unknown>>;
  occurred_at?: string;
}>;

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function computeAuditHash(event: {
  type: IntakeAuditEventType;
  clinician_id: string;
  metadata: Readonly<Record<string, unknown>>;
  occurred_at: string;
}): string {
  return crypto
    .createHash('sha256')
    .update(stableStringify(event))
    .digest('hex');
}

export async function emitIngestAuditEvent(input: IngestAuditInput): Promise<string> {
  if (typeof input.clinician_id !== 'string' || input.clinician_id.trim().length === 0) {
    throw new Error('clinician_id is required');
  }

  const clinician_id = input.clinician_id.trim();
  const occurred_at = input.occurred_at ?? new Date().toISOString();
  const metadata = Object.freeze({
    ...input.metadata,
    clinician_id,
    occurred_at,
  });

  const created = await prisma.auditEvent.create({
    data: {
      type: input.type,
      hash: computeAuditHash({
        type: input.type,
        clinician_id,
        metadata,
        occurred_at,
      }),
      clinicianId: clinician_id,
      metadata: metadata as unknown as Prisma.InputJsonValue,
      createdAt: new Date(occurred_at),
    },
  });

  return `audit:${created.id}`;
}
