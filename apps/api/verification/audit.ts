import crypto from 'crypto';
import prisma, { Prisma } from '../backend/src/graphql/prisma_client';
import { withPrismaToolSpan } from '../backend/src/tools/tracing';

export type VerificationAuditEventType =
  | 'VERIFICATION_REQUESTED'
  | 'VERIFICATION_COMPLETED'
  | 'VERIFICATION_FAILED';

type VerificationAuditInput = Readonly<{
  type: VerificationAuditEventType;
  clinician_id: string;
  reference_id: string;
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

function auditHash(value: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

export async function emitVerificationAuditEvent(input: VerificationAuditInput): Promise<string> {
  if (typeof input.clinician_id !== 'string' || input.clinician_id.trim().length === 0) {
    throw new Error('clinician_id is required');
  }

  if (typeof input.reference_id !== 'string' || input.reference_id.trim().length === 0) {
    throw new Error('reference_id is required');
  }

  const clinician_id = input.clinician_id.trim();
  const reference_id = input.reference_id.trim();
  const occurred_at = input.occurred_at ?? new Date().toISOString();
  const metadata = Object.freeze({
    ...input.metadata,
    clinician_id,
    reference_id,
    occurred_at,
  });

  const created = await withPrismaToolSpan(
    {
      operation: 'auditEvent.create',
      input: {
        type: input.type,
        clinician_id,
        reference_id,
      },
    },
    () =>
      prisma.auditEvent.create({
        data: {
          type: input.type,
          hash: auditHash({
            type: input.type,
            clinician_id,
            reference_id,
            metadata,
            occurred_at,
          }),
          clinicianId: clinician_id,
          referenceId: reference_id,
          metadata: metadata as unknown as Prisma.InputJsonValue,
          createdAt: new Date(occurred_at),
        },
      }),
  );

  return `audit:${created.id}`;
}
