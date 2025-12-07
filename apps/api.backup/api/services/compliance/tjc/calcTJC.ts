import { PrismaClient as DefaultPrismaClient, type Prisma, type PrismaClient, type TJCComplianceRecord as PrismaTJCComplianceRecord } from '@prisma/client';
import { differenceInCalendarDays, subDays } from 'date-fns';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import {
  buildIssueCodes,
  summarizeStandardsFromRules,
  type TJCComplianceStatus,
  type TJCSignalSnapshot,
  TJCSignalSnapshotSchema,
  type TJCStandard,
  type TJCStandardResult,
  type TJCRuleEvaluation,
} from '../models/TJCComplianceRecord.js';
import { evaluateTjcRules } from './ruleRegistry.js';

const prisma = new DefaultPrismaClient();
const log = getServiceLogger('compliance/tjc/calc');

const DEFAULT_LOOKBACK_DAYS = 90;
const PRIVILEGE_EXPIRING_SOON_DAYS = 30;

interface PrismaLike extends Pick<
  PrismaClient,
  | 'clinicianProfile'
  | 'privilegeGranted'
  | 'fPPECase'
  | 'oPPECase'
  | 'fppeOppe'
  | 'stateLicenseVerification'
  | 'pSVResult'
  | 'npdbOigMonitor'
  | 'payerEnrollment'
  | 'payerEnrollmentV2'
  | 'tJCComplianceRecord'
> {}

export interface TJCEvaluationTarget {
  clinicianId: string;
  clinicianDid?: string;
  orgId?: string | null;
  jobRunId?: string;
}

export interface TJCComputationOptions {
  evaluationDate?: Date;
  lookbackDays?: number;
  prisma?: PrismaLike;
}

export interface TJCComputationResult {
  record: PrismaTJCComplianceRecord;
  previousRecord: PrismaTJCComplianceRecord | null;
  standardResults: Record<TJCStandard, TJCStandardResult>;
  ruleResults: TJCRuleEvaluation[];
  signalSnapshot: TJCSignalSnapshot;
}

export async function evaluateAndPersistTJCCompliance(
  target: TJCEvaluationTarget,
  options: TJCComputationOptions = {}
): Promise<TJCComputationResult> {
  const client = options.prisma ?? prisma;
  const evaluationDate = options.evaluationDate ?? new Date();
  const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;

  const clinicianProfile = await client.clinicianProfile.findUnique({
    where: { id: target.clinicianId },
    include: { user: { select: { did: true } } },
  });

  if (!clinicianProfile) {
    throw new Error(`Clinician profile ${target.clinicianId} not found`);
  }

  const clinicianDid = target.clinicianDid ?? clinicianProfile.user?.did ?? undefined;
  const orgId = target.orgId ?? null;

  const snapshot = await buildSignalSnapshot(client, {
    clinicianId: clinicianProfile.id,
    clinicianDid,
    orgId,
    lookbackDays,
  });
  const signalSnapshot = sanitizeSnapshot(snapshot);

  const ruleResults = evaluateTjcRules(signalSnapshot);
  const { standardResults, overallStatus, recommendations } = summarizeStandardsFromRules(ruleResults);
  const issueCodes = buildIssueCodes(ruleResults);

  const previousRecord = await client.tJCComplianceRecord.findFirst({
    where: { clinicianId: clinicianProfile.id, orgId },
    orderBy: { evaluationDate: 'desc' },
  });

  const driftContext = buildDriftContext(standardResults, previousRecord, overallStatus);

  const record = await client.tJCComplianceRecord.create({
    data: {
      clinicianId: clinicianProfile.id,
      orgId,
      evaluationDate,
      windowStart: subDays(evaluationDate, lookbackDays),
      windowEnd: evaluationDate,
      overallStatus,
      previousStatus: previousRecord?.overallStatus,
      standardResults: standardResults as Prisma.InputJsonValue,
      ruleEvaluations: ruleResults as Prisma.InputJsonValue,
      signalSnapshot: signalSnapshot as Prisma.InputJsonValue,
      issueCodes,
      recommendations: recommendations as Prisma.InputJsonValue,
      driftContext: driftContext as Prisma.InputJsonValue,
      jobRunId: target.jobRunId,
    },
  });

  return {
    record,
    previousRecord,
    standardResults,
    ruleResults,
    signalSnapshot,
  };
}

interface SnapshotInput {
  clinicianId: string;
  clinicianDid?: string;
  orgId?: string | null;
  lookbackDays: number;
}

async function buildSignalSnapshot(client: PrismaLike, input: SnapshotInput): Promise<TJCSignalSnapshot> {
  const now = new Date();
  const lookbackStart = subDays(now, input.lookbackDays);

  const privilegeWhere: Prisma.PrivilegeGrantedWhereInput = {
    clinicianDid: input.clinicianDid,
    status: { notIn: ['REVOKED'] },
    ...(input.orgId ? { orgId: input.orgId } : {}),
  };

  const clinicianWhere = {
    clinicianId: input.clinicianId,
    ...(input.orgId ? { orgId: input.orgId } : {}),
  };

  const [
    privileges,
    fppeCases,
    oppeCases,
    fppeOppe,
    licenses,
    latestPsv,
    monitors,
    payerEnrollments,
    payerEnrollmentsV2,
  ] = await Promise.all([
    client.privilegeGranted.findMany({
      where: privilegeWhere,
      select: {
        status: true,
        expiresAt: true,
        isTemporary: true,
      },
    }),
    client.fPPECase.findMany({
      where: { ...clinicianWhere, startAt: { gte: lookbackStart } },
    }),
    client.oPPECase.findMany({
      where: { ...clinicianWhere, periodStart: { gte: subDays(now, 365) } },
      orderBy: { periodEnd: 'desc' },
    }),
    client.fppeOppe.findFirst({
      where: { clinicianDid: input.clinicianDid, ...(input.orgId ? { orgId: input.orgId } : {}) },
      orderBy: { updatedAt: 'desc' },
    }),
    client.stateLicenseVerification.findMany({ where: { clinicianId: input.clinicianId } }),
    client.pSVResult.findFirst({ where: { clinicianId: input.clinicianId }, orderBy: { checkedAt: 'desc' } }),
    client.npdbOigMonitor.findMany({
      where: { clinicianDid: input.clinicianDid, checkDate: { gte: subDays(now, 365) } },
      orderBy: { checkDate: 'desc' },
      take: 10,
    }),
    client.payerEnrollment.findMany({
      where: { clinicianDid: input.clinicianDid, ...(input.orgId ? { orgId: input.orgId } : {}) },
      select: { status: true, revalidationDueAt: true },
    }),
    client.payerEnrollmentV2.findMany({
      where: { clinicianId: input.clinicianId },
      select: { status: true, lastStatusChange: true },
    }),
  ]);

  const privilegeSnapshot = summarizePrivileges(privileges, now);
  const fppeSnapshot = summarizeFppe(fppeCases, now);
  const oppeSnapshot = summarizeOppe(oppeCases, now);
  const licenseSnapshot = summarizeLicenses(licenses, now);
  const psvSnapshot = summarizePsv(latestPsv, now);
  const npdbSnapshot = summarizeMonitor(monitors.find((entry) => entry.monitorType?.toUpperCase() === 'NPDB'));
  const sanctionsSnapshot = summarizeMonitor(monitors.find((entry) => entry.monitorType?.toUpperCase() === 'OIG'));
  const enrollmentSnapshot = summarizeEnrollment(payerEnrollments, payerEnrollmentsV2, now);
  const competencySnapshot = summarizeCompetency(fppeOppe, fppeSnapshot, oppeSnapshot);

  return {
    generatedAt: now.toISOString(),
    clinicianId: input.clinicianId,
    orgId: input.orgId ?? null,
    clinicianDid: input.clinicianDid,
    fppe: fppeSnapshot,
    oppe: oppeSnapshot,
    privileges: privilegeSnapshot,
    licenses: licenseSnapshot,
    psv: psvSnapshot,
    npdb: npdbSnapshot,
    sanctions: sanctionsSnapshot,
    competency: competencySnapshot,
    enrollment: enrollmentSnapshot,
  };
}

function summarizePrivileges(
  privileges: Array<{ status: string; expiresAt: Date; isTemporary: boolean }>,
  now: Date
) {
  if (!privileges.length) {
    return undefined;
  }
  const expired = privileges.filter((priv) => priv.expiresAt && priv.expiresAt < now).length;
  const expiringSoon = privileges.filter((priv) => isWithinDays(priv.expiresAt, now, PRIVILEGE_EXPIRING_SOON_DAYS)).length;
  return {
    active: privileges.filter((priv) => priv.status === 'ACTIVE').length,
    expiringSoon,
    expired,
    suspended: privileges.filter((priv) => priv.status === 'SUSPENDED').length,
    temporary: privileges.filter((priv) => priv.isTemporary).length,
  };
}

function summarizeFppe(cases: Prisma.FPPECase[], now: Date) {
  if (!cases.length) {
    return undefined;
  }
  return {
    completedCount: cases.filter((fppe) => fppe.status === 'COMPLETED').length,
    openCount: cases.filter((fppe) => fppe.status !== 'COMPLETED').length,
    overdueCount: cases.filter((fppe) => fppe.status !== 'COMPLETED' && fppe.dueAt && fppe.dueAt < now).length,
    lastCompletedAt: maxIso(
      cases
        .filter((fppe) => fppe.completedAt)
        .map((fppe) => fppe.completedAt ?? undefined)
    ),
  };
}

function summarizeOppe(cases: Prisma.OPPECase[], now: Date) {
  if (!cases.length) {
    return undefined;
  }
  const sorted = [...cases].sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime());
  const latest = sorted[0];
  return {
    overdueCases: cases.filter((oppe) => oppe.status !== 'COMPLETED' && oppe.periodEnd && oppe.periodEnd < now).length,
    failedCases: cases.filter((oppe) => oppe.status === 'FAILED').length,
    activeCases: cases.filter((oppe) => oppe.status === 'OPEN' || oppe.status === 'REVIEWING').length,
    lastReviewAt: (latest.reviewedAt ?? latest.periodEnd)?.toISOString(),
    metrics: normalizeMetrics(latest.metrics),
  };
}

function summarizeLicenses(licenses: Prisma.StateLicenseVerification[], now: Date) {
  if (!licenses.length) {
    return undefined;
  }
  return {
    total: licenses.length,
    active: licenses.filter((license) => license.status === 'ACTIVE').length,
    expired: licenses.filter((license) => license.expiryDate && license.expiryDate < now).length,
    expiringSoon: licenses.filter((license) => license.expiryDate && isWithinDays(license.expiryDate, now, 45)).length,
    restricted: licenses.filter((license) => license.status !== 'ACTIVE').length,
    disciplinaryFlags: licenses.filter((license) => license.disciplinaryFlag).length,
  };
}

function summarizePsv(result: Prisma.PSVResult | null, now: Date) {
  if (!result) {
    return undefined;
  }
  const freshUntil = result.freshUntil?.toISOString();
  const daysRemaining =
    result.freshUntil && !Number.isNaN(result.freshUntil.getTime())
      ? differenceInCalendarDays(result.freshUntil, now)
      : undefined;
  return {
    checkedAt: result.checkedAt?.toISOString(),
    freshUntil,
    isFresh: result.isFresh,
    daysRemaining,
    overallStatus: result.overallStatus,
  };
}

function summarizeMonitor(record?: Prisma.NpdbOigMonitor | null) {
  if (!record) {
    return undefined;
  }
  const adverseCount = Array.isArray(record.adverseActions) ? record.adverseActions.length : 0;
  return {
    lastCheckedAt: record.checkDate?.toISOString(),
    status: record.status,
    adverseActionCount: adverseCount,
  };
}

function summarizeEnrollment(
  legacy: Array<{ status: string; revalidationDueAt: Date | null }>,
  v2: Array<{ status: string; lastStatusChange: Date | null }>,
  now: Date
) {
  if (!legacy.length && !v2.length) {
    return undefined;
  }
  const combined = [
    ...legacy.map((entry) => ({ status: entry.status, due: entry.revalidationDueAt ?? undefined })),
    ...v2.map((entry) => ({ status: entry.status, due: entry.lastStatusChange ?? undefined })),
  ];

  return {
    total: combined.length,
    active: combined.filter((entry) => ['APPROVED', 'ENROLLED'].includes(entry.status)).length,
    revalidationDue: combined.filter((entry) => entry.due && entry.due < now).length,
  };
}

function summarizeCompetency(
  fppeOppe: Prisma.FppeOppe | null,
  fppe?: { overdueCount?: number },
  oppe?: { overdueCases?: number; failedCases?: number }
) {
  if (!fppeOppe && !fppe && !oppe) {
    return undefined;
  }
  return {
    oppeStatus: fppeOppe?.oppeStatus,
    fppeStatus: fppeOppe?.fppeStatus,
    outstandingActions: (fppe?.overdueCount ?? 0) + (oppe?.overdueCases ?? 0),
  };
}

function sanitizeSnapshot(snapshot: TJCSignalSnapshot): TJCSignalSnapshot {
  const parsed = TJCSignalSnapshotSchema.parse(snapshot);
  return JSON.parse(JSON.stringify(parsed));
}

function buildDriftContext(
  current: Record<TJCStandard, TJCStandardResult>,
  previous: PrismaTJCComplianceRecord | null,
  overallStatus: TJCComplianceStatus
) {
  const priorStandards = parseStandardResult(previous?.standardResults);
  const changedStandards = Object.entries(current)
    .filter(([standard, result]) => priorStandards[standard]?.status !== result.status)
    .map(([standard, result]) => ({
      standard,
      previousStatus: priorStandards[standard]?.status ?? 'PENDING',
      currentStatus: result.status,
    }));

  return {
    previousStatus: previous?.overallStatus ?? null,
    currentStatus: overallStatus,
    changedStandards,
  };
}

function parseStandardResult(value: Prisma.JsonValue | null | undefined): Record<string, { status: TJCComplianceStatus }> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const record = value as Record<string, { status?: string }>;
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, entry]) => entry?.status)
      .map(([standard, entry]) => [standard, { status: entry!.status as TJCComplianceStatus }])
  );
}

function normalizeMetrics(metrics: unknown) {
  if (!metrics || typeof metrics !== 'object') {
    return undefined;
  }
  const source = metrics as Record<string, unknown>;
  const asNumber = (value: unknown) => {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string' && value.trim().length) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  };
  return {
    caseCount: asNumber(source.caseCount),
    complications: asNumber(source.complications),
    issuesFlagged: asNumber(source.issuesFlagged),
    licenseIssues: asNumber(source.licenseIssues),
    boardAlerts: asNumber(source.boardAlerts),
    deaFindings: asNumber(source.deaFindings),
  };
}

function isWithinDays(date: Date, now: Date, days: number) {
  const diff = differenceInCalendarDays(date, now);
  return diff >= 0 && diff <= days;
}

function maxIso(values: Array<Date | null | undefined>) {
  const valid = values.filter((value): value is Date => Boolean(value) && !Number.isNaN(value.getTime()));
  if (!valid.length) {
    return undefined;
  }
  return valid.reduce((latest, current) => (current.getTime() > latest.getTime() ? current : latest)).toISOString();
}
