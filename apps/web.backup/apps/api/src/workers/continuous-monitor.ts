import cron from 'node-cron';
import type { Prisma, StateLicenseVerification } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { getCompactEvidenceSummaries } from '../../../../services/psv/evidenceBundle';
import { getServiceLogger } from '../../../../services/logging/serviceLogger';
import type {
  ContinuousCheckSource,
  ReadinessRescoreResult,
} from '../services/readiness/rescore';
import { recomputeReadinessFromContinuousChecks } from '../services/readiness/rescore';

const prisma = new PrismaClient();
const log = getServiceLogger('api/workers/continuous-monitor');

const DEFAULT_CRON = process.env.CONTINUOUS_MONITOR_CRON?.trim() || '0 */6 * * *';
const MAX_BATCH = Number(process.env.CONTINUOUS_MONITOR_BATCH || 25);
const STALE_HOURS = Number(process.env.CONTINUOUS_MONITOR_STALE_HOURS || 6);

type CheckStatus = 'pass' | 'warn' | 'fail';

const CLINICIAN_FIELDS = {
  id: true,
  userId: true,
  npi: true,
  state: true,
  specialty: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      did: true,
    },
  },
} satisfies Prisma.ClinicianProfileSelect;

type ClinicianTarget = Prisma.ClinicianProfileGetPayload<{
  select: typeof CLINICIAN_FIELDS;
}>;

let cronTask: cron.ScheduledTask | null = null;

export function startContinuousMonitorWorker(): cron.ScheduledTask {
  if (cronTask) {
    return cronTask;
  }

  log.info('Starting continuous credentialing worker', { schedule: DEFAULT_CRON });
  cronTask = cron.schedule(DEFAULT_CRON, async () => {
    try {
      const processed = await runContinuousMonitorBatch();
      log.info('Continuous credentialing batch completed', { processed });
    } catch (error) {
      log.error('Continuous credentialing batch failed', { error });
    }
  });

  return cronTask;
}

export interface MonitorBatchOptions {
  limit?: number;
  dryRun?: boolean;
}

export async function runContinuousMonitorBatch(
  options: MonitorBatchOptions = {},
): Promise<number> {
  const limit = options.limit ?? MAX_BATCH;
  const candidates = await selectClinicians(limit * 2);

  let processed = 0;
  for (const clinician of candidates) {
    if (processed >= limit) break;
    const recent = await hasFreshCheck(clinician.id);
    if (recent) continue;

    try {
      await runContinuousChecksForClinician(clinician.id, {
        dryRun: options.dryRun,
        preloadedClinician: clinician,
      });
      processed += 1;
    } catch (error) {
      log.error('Continuous check failed for clinician', {
        clinicianId: clinician.id,
        error,
      });
    }
  }

  return processed;
}

export interface RunContinuousOptions {
  dryRun?: boolean;
  preloadedClinician?: ClinicianTarget;
}

export interface ContinuousRunResult {
  clinicianId: string;
  checks: ContinuousCheckSource[];
  readiness?: ReadinessRescoreResult | null;
}

export async function runContinuousChecksForClinician(
  clinicianId: string,
  options: RunContinuousOptions = {},
): Promise<ContinuousRunResult> {
  const clinician =
    options.preloadedClinician ??
    (await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      select: CLINICIAN_FIELDS,
    }));

  if (!clinician) {
    throw new Error(`Clinician ${clinicianId} not found`);
  }

  const payloads = await Promise.all([
    collectLicenseCheck(clinician),
    collectSanctionsCheck(clinician),
    collectBoardCheck(clinician),
    collectNpdbCheck(clinician),
    collectCompactCheck(clinician),
  ]);

  const checks = payloads.filter((entry): entry is ContinuousCheckSource => Boolean(entry));

  let readiness: ReadinessRescoreResult | null = null;

  if (!options.dryRun && checks.length > 0) {
    await prisma.$transaction(
      checks.map((payload) =>
        prisma.continuousCheck.create({
          data: {
            clinicianId,
            type: payload.type,
            result: payload,
            runAt: new Date(),
          },
        }),
      ),
    );

    readiness = await recomputeReadinessFromContinuousChecks(clinicianId, {
      sources: checks,
    });
  }

  return {
    clinicianId,
    checks,
    readiness,
  };
}

async function selectClinicians(limit: number): Promise<ClinicianTarget[]> {
  return prisma.clinicianProfile.findMany({
    select: CLINICIAN_FIELDS,
    orderBy: { updatedAt: 'asc' },
    take: limit,
  });
}

async function hasFreshCheck(clinicianId: string): Promise<boolean> {
  const latest = await prisma.continuousCheck.findFirst({
    where: { clinicianId },
    orderBy: { runAt: 'desc' },
  });

  if (!latest) return false;
  const ageHours = (Date.now() - latest.runAt.getTime()) / (1000 * 60 * 60);
  return ageHours < STALE_HOURS;
}

async function collectLicenseCheck(
  clinician: ClinicianTarget,
): Promise<ContinuousCheckSource | null> {
  const licenses = await prisma.stateLicenseVerification.findMany({
    where: { clinicianId: clinician.id },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  });

  const now = new Date();
  if (licenses.length === 0) {
    return {
      type: 'license',
      status: 'fail',
      reason: 'no_license_records',
      freshnessHours: null,
      totals: { total: 0, expired: 0, expiringSoon: 0 },
      checkedAt: now.toISOString(),
    };
  }

  const latest = licenses[0];
  const lastVerified =
    latest.lastCheckedAt ?? latest.updatedAt ?? latest.createdAt ?? now;
  const freshnessHours = differenceInHours(now, lastVerified);

  const expired = countLicenses(licenses, (license) => isExpired(license, now));
  const expiringSoonList = licenses
    .filter((license) => willExpireSoon(license, now, 60))
    .map((license) => ({
      state: license.state,
      licenseNumber: license.licenseNumber,
      expiresAt: license.expiryDate ? license.expiryDate.toISOString() : undefined,
    }));

  const status: CheckStatus =
    expired > 0 ? 'fail' : expiringSoonList.length > 0 ? 'warn' : 'pass';

  return {
    type: 'license',
    status,
    freshnessHours,
    totals: {
      total: licenses.length,
      expired,
      expiringSoon: expiringSoonList.length,
    },
    expiringSoon: expiringSoonList.slice(0, 3),
    sample: {
      state: latest.state,
      licenseNumber: latest.licenseNumber,
    },
    checkedAt: now.toISOString(),
  };
}

async function collectSanctionsCheck(
  clinician: ClinicianTarget,
): Promise<ContinuousCheckSource | null> {
  const clinicianDid = clinician.user?.did ?? undefined;
  if (!clinicianDid) {
    return {
      type: 'sanctions',
      status: 'warn',
      reason: 'missing_did',
    };
  }

  const record = await prisma.npdbOigMonitor.findFirst({
    where: { clinicianDid, monitorType: 'OIG' },
    orderBy: { checkDate: 'desc' },
  });

  if (!record) {
    return {
      type: 'sanctions',
      status: 'warn',
      reason: 'no_monitor_events',
    };
  }

  const adverseActionCount = Array.isArray(record.adverseActions)
    ? (record.adverseActions as unknown[]).length
    : 0;
  const hasHit = record.status === 'ADVERSE_ACTION' || adverseActionCount > 0;
  const status: CheckStatus = hasHit ? 'fail' : 'pass';

  return {
    type: 'sanctions',
    status,
    adverseActionCount,
    lastCheckedAt: record.checkDate?.toISOString(),
    monitorStatus: record.status,
    hasHit,
  };
}

async function collectNpdbCheck(
  clinician: ClinicianTarget,
): Promise<ContinuousCheckSource | null> {
  const clinicianDid = clinician.user?.did ?? undefined;
  if (!clinicianDid) {
    return {
      type: 'npdb',
      status: 'warn',
      reason: 'missing_did',
    };
  }

  const record = await prisma.npdbOigMonitor.findFirst({
    where: { clinicianDid, monitorType: 'NPDB' },
    orderBy: { checkDate: 'desc' },
  });

  if (!record) {
    return {
      type: 'npdb',
      status: 'warn',
      reason: 'no_monitor_events',
    };
  }

  const adverseActionCount = Array.isArray(record.adverseActions)
    ? (record.adverseActions as unknown[]).length
    : 0;
  const status: CheckStatus =
    record.status === 'ADVERSE_ACTION' || adverseActionCount > 0 ? 'warn' : 'pass';

  return {
    type: 'npdb',
    status,
    adverseActionCount,
    lastCheckedAt: record.checkDate?.toISOString(),
    monitorStatus: record.status,
  };
}

async function collectBoardCheck(
  clinician: ClinicianTarget,
): Promise<ContinuousCheckSource | null> {
  const credentials = await prisma.credential.findMany({
    where: { userId: clinician.userId, type: 'BoardCertification' },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  const now = new Date();

  if (credentials.length === 0) {
    return {
      type: 'board',
      status: 'warn',
      reason: 'no_board_certifications',
    };
  }

  const expired = credentials.filter(
    (credential) => credential.expiresAt && credential.expiresAt < now,
  ).length;
  const expiringSoon = credentials.filter(
    (credential) => credential.expiresAt && isWithinDays(credential.expiresAt, now, 90),
  ).map((credential) => ({
    credentialId: credential.id,
    expiresAt: credential.expiresAt?.toISOString(),
  }));

  const status: CheckStatus =
    expired > 0 ? 'warn' : expiringSoon.length > 0 ? 'warn' : 'pass';

  return {
    type: 'board',
    status,
    totals: {
      total: credentials.length,
      expired,
      expiringSoon: expiringSoon.length,
    },
    expiringSoon,
    checkedAt: now.toISOString(),
  };
}

async function collectCompactCheck(
  clinician: ClinicianTarget,
): Promise<ContinuousCheckSource | null> {
  const clinicianDid = clinician.user?.did;
  if (!clinicianDid) {
    return {
      type: 'compact',
      status: 'warn',
      reason: 'missing_did',
      eligibleStates: [],
    };
  }

  const summaries = await getCompactEvidenceSummaries(clinicianDid);
  const eligibleStates = summaries.flatMap((summary) => summary.authorizedStates ?? []);

  const status: CheckStatus = eligibleStates.length > 0 ? 'pass' : 'warn';

  return {
    type: 'compact',
    status,
    eligibleStates,
    representativeStates: summaries
      .map((summary) => summary.representativeState)
      .filter(Boolean),
    checkedAt: new Date().toISOString(),
  };
}

function countLicenses(
  licenses: StateLicenseVerification[],
  predicate: (license: StateLicenseVerification) => boolean,
): number {
  return licenses.reduce((count, license) => (predicate(license) ? count + 1 : count), 0);
}

function isExpired(license: StateLicenseVerification, now: Date): boolean {
  return Boolean(license.expiryDate && license.expiryDate < now);
}

function willExpireSoon(
  license: StateLicenseVerification,
  now: Date,
  days: number,
): boolean {
  if (!license.expiryDate) return false;
  return isWithinDays(license.expiryDate, now, days);
}

function isWithinDays(date: Date, now: Date, days: number): boolean {
  const ms = days * 24 * 60 * 60 * 1000;
  return date > now && date.getTime() - now.getTime() <= ms;
}

function differenceInHours(a: Date, b: Date): number {
  return Math.max(0, Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60)));
}

