import cron from 'node-cron';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { Prisma, PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../../../services/logging/serviceLogger';

const prisma = new PrismaClient();
const log = getServiceLogger('api/workers/expiration');

const DEFAULT_CRON = process.env.EXPIRATION_SWEEP_CRON?.trim() || '45 5 * * *';
const DEFAULT_LOOKAHEAD_DAYS = Number(
  process.env.EXPIRATION_LOOKAHEAD_DAYS ?? '60',
);
const DEFAULT_NOTIFY_WITHIN_DAYS = Number(
  process.env.EXPIRATION_NOTIFY_DAYS ?? '30',
);
const MAX_NOTIFICATIONS = Number(
  process.env.EXPIRATION_NOTIFY_CAP ?? '250',
);

let cronTask: cron.ScheduledTask | null = null;

type LicenseRecord = Prisma.StateLicenseVerificationGetPayload<{
  select: {
    id: true;
    clinicianId: true;
    state: true;
    licenseNumber: true;
    expiryDate: true;
    status: true;
    source: true;
  };
}>;

type PrivilegeRecord = Prisma.PrivilegeGrantedGetPayload<{
  select: {
    id: true;
    clinicianId: true;
    orgId: true;
    privilegeSetId: true;
    expiresAt: true;
    status: true;
  };
}>;

interface ExpiringCredential {
  id: string;
  type: 'license' | 'privilege';
  label: string;
  expiresAt: string;
  daysUntilExpiry: number;
  status?: string | null;
  metadata?: Record<string, unknown>;
}

interface ClinicianExpirationSummary {
  clinicianId: string;
  licenses: ExpiringCredential[];
  privileges: ExpiringCredential[];
}

interface ExpiringSoonFlag {
  flaggedAt: string;
  lookaheadDays: number;
  total: number;
  licenseCount: number;
  privilegeCount: number;
  credentials: {
    licenses: ExpiringCredential[];
    privileges: ExpiringCredential[];
  };
}

interface NotificationEntry {
  clinicianId: string;
  orgId?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
  credentials: ExpiringCredential[];
}

export interface ExpirationWorkerOptions {
  lookaheadDays?: number;
  notifyWithinDays?: number;
  dryRun?: boolean;
}

export interface ExpirationWorkerResult {
  processedClinicians: number;
  flaggedClinicians: number;
  complianceChecksCreated: number;
  notificationsQueued: number;
  generatedAt: string;
  windowDays: number;
}

export function startExpirationWorker(): cron.ScheduledTask {
  if (cronTask) {
    return cronTask;
  }

  log.info('Starting expiration monitoring worker', { schedule: DEFAULT_CRON });
  cronTask = cron.schedule(DEFAULT_CRON, async () => {
    try {
      const result = await runExpirationSweep();
      log.info('Expiration sweep completed', result);
    } catch (error) {
      log.error('Expiration sweep failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return cronTask;
}

export async function runExpirationSweep(
  options: ExpirationWorkerOptions = {},
): Promise<ExpirationWorkerResult> {
  const lookaheadDays = options.lookaheadDays ?? DEFAULT_LOOKAHEAD_DAYS;
  const notifyWithinDays = options.notifyWithinDays ?? DEFAULT_NOTIFY_WITHIN_DAYS;
  const now = new Date();
  const windowEnd = addDays(now, lookaheadDays);

  const [licenses, privileges] = await Promise.all([
    prisma.stateLicenseVerification.findMany({
      where: {
        expiryDate: {
          gte: now,
          lte: windowEnd,
        },
      },
      select: {
        id: true,
        clinicianId: true,
        state: true,
        licenseNumber: true,
        expiryDate: true,
        status: true,
        source: true,
      },
    }),
    prisma.privilegeGranted.findMany({
      where: {
        expiresAt: {
          gte: now,
          lte: windowEnd,
        },
        status: { notIn: ['REVOKED'] },
      },
      select: {
        id: true,
        clinicianId: true,
        orgId: true,
        privilegeSetId: true,
        expiresAt: true,
        status: true,
      },
    }),
  ]);

  const summaries = buildClinicianSummaries(licenses, privileges, now);
  const clinicianIds = Array.from(summaries.keys());

  if (clinicianIds.length === 0) {
    return {
      processedClinicians: 0,
      flaggedClinicians: 0,
      complianceChecksCreated: 0,
      notificationsQueued: 0,
      generatedAt: now.toISOString(),
      windowDays: lookaheadDays,
    };
  }

  const [profiles, readinessRecords] = await Promise.all([
    prisma.clinicianProfile.findMany({
      where: { id: { in: clinicianIds } },
      select: {
        id: true,
        orgId: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
    prisma.clinicianReadinessScore.findMany({
      where: { clinicianId: { in: clinicianIds } },
      select: { clinicianId: true, score: true, factors: true },
    }),
  ]);

  const readinessMap = new Map(
    readinessRecords.map((record) => [record.clinicianId, record]),
  );
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  let complianceChecksCreated = 0;
  let flaggedClinicians = 0;
  const notifications: NotificationEntry[] = [];

  for (const summary of summaries.values()) {
    const totalExpiring = summary.licenses.length + summary.privileges.length;
    if (totalExpiring === 0) {
      continue;
    }

    flaggedClinicians += 1;
    const expiringFlag = buildExpiringFlag(summary, lookaheadDays);
    const existingReadiness = readinessMap.get(summary.clinicianId);

    if (!options.dryRun) {
      await upsertReadinessFlag(summary.clinicianId, existingReadiness, expiringFlag);
      await prisma.complianceCheck.create({
        data: {
          clinicianId: summary.clinicianId,
          type: 'expiry',
          source: 'expiration_worker',
          result: {
            windowDays: lookaheadDays,
            flaggedAt: expiringFlag.flaggedAt,
            licenses: summary.licenses,
            privileges: summary.privileges,
            totals: {
              licenses: summary.licenses.length,
              privileges: summary.privileges.length,
            },
          } as Prisma.InputJsonValue,
        },
      });
    }

    complianceChecksCreated += 1;

    const urgentCredentials = [...summary.licenses, ...summary.privileges].filter(
      (credential) => credential.daysUntilExpiry <= notifyWithinDays,
    );

    if (urgentCredentials.length) {
      notifications.push(
        buildNotification(summary.clinicianId, profileMap.get(summary.clinicianId), urgentCredentials),
      );
    }
  }

  const notificationsQueued = await dispatchNotifications(
    notifications,
    options.dryRun ?? false,
  );

  return {
    processedClinicians: clinicianIds.length,
    flaggedClinicians,
    complianceChecksCreated,
    notificationsQueued,
    generatedAt: now.toISOString(),
    windowDays: lookaheadDays,
  };
}

function buildClinicianSummaries(
  licenses: LicenseRecord[],
  privileges: PrivilegeRecord[],
  now: Date,
): Map<string, ClinicianExpirationSummary> {
  const map = new Map<string, ClinicianExpirationSummary>();

  licenses.forEach((license) => {
    if (!license.expiryDate) {
      return;
    }
    const record = map.get(license.clinicianId) ?? {
      clinicianId: license.clinicianId,
      licenses: [],
      privileges: [],
    };
    record.licenses.push({
      id: license.id,
      type: 'license',
      label: `${license.state ?? 'STATE'} License ${license.licenseNumber ?? ''}`.trim(),
      expiresAt: license.expiryDate.toISOString(),
      daysUntilExpiry: differenceInCalendarDays(license.expiryDate, now),
      status: license.status,
      metadata: {
        state: license.state,
        licenseNumber: license.licenseNumber,
        source: license.source ?? 'state_board',
      },
    });
    map.set(license.clinicianId, record);
  });

  privileges.forEach((grant) => {
    if (!grant.expiresAt) {
      return;
    }
    const record = map.get(grant.clinicianId) ?? {
      clinicianId: grant.clinicianId,
      licenses: [],
      privileges: [],
    };
    record.privileges.push({
      id: grant.id,
      type: 'privilege',
      label: `Privilege ${grant.privilegeSetId ?? grant.id}`,
      expiresAt: grant.expiresAt.toISOString(),
      daysUntilExpiry: differenceInCalendarDays(grant.expiresAt, now),
      status: grant.status,
      metadata: {
        privilegeSetId: grant.privilegeSetId,
        orgId: grant.orgId,
      },
    });
    map.set(grant.clinicianId, record);
  });

  return map;
}

function buildExpiringFlag(
  summary: ClinicianExpirationSummary,
  lookaheadDays: number,
): ExpiringSoonFlag {
  const total = summary.licenses.length + summary.privileges.length;
  return {
    flaggedAt: new Date().toISOString(),
    lookaheadDays,
    total,
    licenseCount: summary.licenses.length,
    privilegeCount: summary.privileges.length,
    credentials: {
      licenses: summary.licenses,
      privileges: summary.privileges,
    },
  };
}

async function upsertReadinessFlag(
  clinicianId: string,
  existing:
    | {
        clinicianId: string;
        score: number;
        factors: Prisma.JsonValue | null;
      }
    | undefined,
  expiringFlag: ExpiringSoonFlag,
): Promise<void> {
  const mergedFactors = buildMergedFactors(existing?.factors, expiringFlag);

  await prisma.clinicianReadinessScore.upsert({
    where: { clinicianId },
    update: {
      factors: mergedFactors,
    },
    create: {
      clinicianId,
      score: existing?.score ?? 0.78,
      factors: mergedFactors,
    },
  });
}

function buildMergedFactors(
  factors: Prisma.JsonValue | null | undefined,
  expiringFlag: ExpiringSoonFlag,
): Prisma.InputJsonValue {
  const base =
    factors && typeof factors === 'object' && !Array.isArray(factors)
      ? { ...(factors as Record<string, unknown>) }
      : {};

  return {
    ...base,
    expiringSoon: expiringFlag,
  };
}

function buildNotification(
  clinicianId: string,
  profile:
    | {
        id: string;
        orgId: string | null;
        user: { email: string | null; name: string | null } | null;
      }
    | undefined,
  credentials: ExpiringCredential[],
): NotificationEntry {
  return {
    clinicianId,
    orgId: profile?.orgId ?? null,
    contactEmail: profile?.user?.email ?? null,
    contactName: profile?.user?.name ?? null,
    credentials,
  };
}

async function dispatchNotifications(
  entries: NotificationEntry[],
  dryRun: boolean,
): Promise<number> {
  if (entries.length === 0) {
    return 0;
  }

  const slice = entries.slice(0, MAX_NOTIFICATIONS);
  slice.forEach((entry) => {
    const payload = {
      clinicianId: entry.clinicianId,
      orgId: entry.orgId,
      contactEmail: entry.contactEmail,
      totalCredentials: entry.credentials.length,
      soonestExpiry: entry.credentials
        .map((item) => item.expiresAt)
        .sort()[0],
    };
    if (dryRun) {
      log.info('[expiration] dry-run notification', payload);
    } else {
      console.info('[expiration] notifying expiring credentials', payload);
    }
  });

  return slice.length;
}










