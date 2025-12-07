import { EhrSynchronizationStatus, PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface EhrSyncRow {
  id: string;
  privilegeCode: string;
  privilegeSetId?: string | null;
  privilegeSetName?: string | null;
  privilegeGrantedId?: string | null;
  status: EhrSynchronizationStatus;
  lastSyncedAt?: string | null;
  lastAttemptAt?: string | null;
  mismatchDetails?: {
    missing?: string[];
    unexpected?: string[];
  } | null;
  failureReason?: string | null;
}

export interface EhrSyncStatusPayload {
  clinicianId: string;
  clinicianDid?: string | null;
  orgId?: string | null;
  rows: EhrSyncRow[];
  lastJobRunAt?: string | null;
  hasErrors: boolean;
}

export async function fetchEhrSyncStatus(clinicianId: string): Promise<EhrSyncStatusPayload> {
  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: {
      user: {
        include: {
          orgMemberships: true,
        },
      },
    },
  });

  const syncRows = await prisma.ehrSynchronization.findMany({
    where: { clinicianId },
    include: {
      privilegeSet: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const rows: EhrSyncRow[] = syncRows.map((record) => ({
    id: record.id,
    privilegeCode: record.privilegeCode,
    privilegeSetId: record.privilegeSetId,
    privilegeSetName: record.privilegeSet?.name ?? null,
    privilegeGrantedId: record.privilegeGrantedId,
    status: record.status,
    lastSyncedAt: record.lastSyncedAt?.toISOString() ?? null,
    lastAttemptAt: record.lastAttemptAt?.toISOString() ?? null,
    mismatchDetails: normalizeMismatch(record.mismatchDetails),
    failureReason: record.error ?? null,
  }));

  const lastJobRunAt = rows.length
    ? rows
        .map((row) => row.lastAttemptAt ?? row.lastSyncedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .pop()
    : null;

  const hasErrors = rows.some(
    (row) => row.status === 'FAILED' || row.status === 'DRIFT' || Boolean(row.failureReason)
  );

  return {
    clinicianId,
    clinicianDid: clinician?.user?.did ?? null,
    orgId: clinician?.user?.orgMemberships?.[0]?.orgId ?? null,
    rows,
    lastJobRunAt,
    hasErrors,
  };
}

function normalizeMismatch(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const parsed = value as Record<string, unknown>;
  const missing = Array.isArray(parsed.missing) ? (parsed.missing as string[]) : undefined;
  const unexpected = Array.isArray(parsed.unexpected) ? (parsed.unexpected as string[]) : undefined;
  if (!missing && !unexpected) {
    return null;
  }
  return { missing, unexpected };
}
