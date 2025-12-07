import { differenceInDays } from 'date-fns';
import { PrismaClient, type Prisma, PrivilegeSafetySeverity } from '@prisma/client';

const prisma = new PrismaClient();

export type PreflightSeverity = 'pass' | 'warn' | 'block';

export interface CompliancePreflightFinding {
  id: string;
  label: string;
  severity: PreflightSeverity;
  detail: string;
  metadata?: Record<string, unknown>;
}

export interface CompliancePreflightResult {
  clinicianId: string;
  packId?: string;
  overall: PreflightSeverity;
  findings: CompliancePreflightFinding[];
  generatedAt: string;
}

interface CompliancePreflightOptions {
  clinicianId: string;
  packId?: string;
  prisma?: PrismaClient;
}

export async function runCompliancePreflightScan(
  options: CompliancePreflightOptions,
): Promise<CompliancePreflightResult> {
  const client = options.prisma ?? prisma;
  const [licenseCheck, sanctionsCheck, readiness, activeSignals] = await Promise.all([
    findLatestComplianceCheck(client, options.clinicianId, ['license']),
    findLatestComplianceCheck(client, options.clinicianId, ['sanctions', 'npdb']),
    client.clinicianReadinessScore.findUnique({
      where: { clinicianId: options.clinicianId },
    }),
    client.privilegeSafetySignal.findMany({
      where: {
        clinicianId: options.clinicianId,
        resolvedAt: null,
      },
      select: {
        id: true,
        severity: true,
        detectedAt: true,
        summary: true,
      },
      take: 10,
    }),
  ]);

  const findings: CompliancePreflightFinding[] = [];

  findings.push(evaluateLicenseFreshness(licenseCheck));
  findings.push(evaluateSanctionsSnapshot(sanctionsCheck));
  findings.push(evaluateReadinessScore(readiness));
  findings.push(...evaluateSafetySignals(activeSignals));

  const filtered = findings.filter(Boolean) as CompliancePreflightFinding[];
  const overall: PreflightSeverity = filtered.some((finding) => finding.severity === 'block')
    ? 'block'
    : filtered.some((finding) => finding.severity === 'warn')
      ? 'warn'
      : 'pass';

  return {
    clinicianId: options.clinicianId,
    packId: options.packId,
    overall,
    findings: filtered,
    generatedAt: new Date().toISOString(),
  };
}

async function findLatestComplianceCheck(
  client: PrismaClient,
  clinicianId: string,
  types: string[],
) {
  const [record] = await client.complianceCheck.findMany({
    where: { clinicianId, type: { in: types } },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  return record ?? null;
}

function evaluateLicenseFreshness(
  record: Awaited<ReturnType<typeof findLatestComplianceCheck>>,
): CompliancePreflightFinding {
  if (!record) {
    return {
      id: 'license_missing',
      label: 'License PSV',
      severity: 'warn',
      detail: 'No recent license compliance check located.',
    };
  }

  const payload = toJsonObject(record.result);
  const mismatch = Boolean(payload?.mismatchDetected);
  const checkedAt =
    typeof payload?.checkedAt === 'string' ? new Date(payload.checkedAt) : record.createdAt;
  const ageDays = differenceInDays(new Date(), checkedAt);

  if (mismatch) {
    return {
      id: 'license_mismatch',
      label: 'License PSV',
      severity: 'block',
      detail: 'Board status drift detected during last PSV.',
      metadata: {
        boardStatus: payload?.boardStatus,
        recordStatus: payload?.recordStatus,
      },
    };
  }

  if (ageDays > 75) {
    return {
      id: 'license_stale',
      label: 'License PSV',
      severity: 'warn',
      detail: `PSV is ${ageDays} days old; refresh before submission.`,
      metadata: {
        checkedAt: checkedAt.toISOString(),
      },
    };
  }

  return {
    id: 'license_fresh',
    label: 'License PSV',
    severity: 'pass',
    detail: 'License verification is current.',
    metadata: {
      checkedAt: checkedAt.toISOString(),
    },
  };
}

function evaluateSanctionsSnapshot(
  record: Awaited<ReturnType<typeof findLatestComplianceCheck>>,
): CompliancePreflightFinding {
  if (!record) {
    return {
      id: 'sanctions_missing',
      label: 'Sanctions sweep',
      severity: 'warn',
      detail: 'No sanctions or NPDB sweep recorded in the past window.',
    };
  }

  const payload = toJsonObject(record.result);
  const matches = Array.isArray(payload?.matches) ? payload?.matches : [];

  if (matches.length > 0) {
    return {
      id: 'sanctions_hit',
      label: 'Sanctions sweep',
      severity: 'block',
      detail: `Detected ${matches.length} pending sanction${matches.length === 1 ? '' : 's'}.`,
      metadata: {
        matches,
      },
    };
  }

  return {
    id: 'sanctions_clear',
    label: 'Sanctions sweep',
    severity: 'pass',
    detail: 'Sanctions sweep clear.',
  };
}

function evaluateReadinessScore(
  readiness: Awaited<ReturnType<PrismaClient['clinicianReadinessScore']['findUnique']>>,
): CompliancePreflightFinding {
  if (!readiness) {
    return {
      id: 'readiness_missing',
      label: 'Readiness score',
      severity: 'warn',
      detail: 'No readiness score computed; rescore before submission.',
    };
  }

  if (readiness.score < 0.6) {
    return {
      id: 'readiness_low',
      label: 'Readiness score',
      severity: 'warn',
      detail: `Readiness ${Math.round(readiness.score * 100)}% — triage blockers first.`,
    };
  }

  return {
    id: 'readiness_ok',
    label: 'Readiness score',
    severity: 'pass',
    detail: `Readiness ${Math.round(readiness.score * 100)}%.`,
  };
}

function evaluateSafetySignals(
  signals: Array<{ id: string; severity: PrivilegeSafetySeverity; detectedAt: Date; summary: string }> | null,
): CompliancePreflightFinding[] {
  if (!signals || signals.length === 0) {
    return [];
  }

  return signals.map((signal) => ({
    id: `safety_signal_${signal.id}`,
    label: 'Privilege safety',
    severity: signal.severity === 'CRITICAL' || signal.severity === 'HIGH' ? 'block' : 'warn',
    detail: signal.summary ?? 'Active privilege safety signal.',
    metadata: {
      severity: signal.severity,
      detectedAt: signal.detectedAt.toISOString(),
    },
  }));
}

function toJsonObject(value: Prisma.JsonValue | null): Prisma.JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Prisma.JsonObject;
}

