import type { CredentialVitalSign, Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type VitalComponent = 'license' | 'board' | 'sanctions' | 'npdb' | 'dea';
export type VitalStatus = 'good' | 'warning' | 'critical';

export interface EvaluateVitalsOptions {
  prisma?: PrismaClient;
  now?: Date;
}

export interface VitalComputation {
  component: VitalComponent;
  status: VitalStatus;
  details: Prisma.JsonObject;
}

export async function evaluateCredentialVitals(
  clinicianId: string,
  options: EvaluateVitalsOptions = {},
): Promise<CredentialVitalSign[]> {
  if (!clinicianId) {
    throw new Error('clinicianId is required to evaluate credential vitals');
  }

  const client = options.prisma ?? prisma;
  const now = options.now ?? new Date();

  const [licenses, boardCheck, sanctionsCheck, npdbCheck, deaCredential] = await Promise.all([
    client.stateLicenseVerification.findMany({
      where: { clinicianId },
      orderBy: { expiryDate: 'asc' },
      take: 5,
      select: {
        state: true,
        licenseNumber: true,
        expiryDate: true,
      },
    }),
    client.continuousCheck.findFirst({
      where: { clinicianId, type: 'board' },
      orderBy: { runAt: 'desc' },
    }),
    client.continuousCheck.findFirst({
      where: { clinicianId, type: 'sanctions' },
      orderBy: { runAt: 'desc' },
    }),
    client.continuousCheck.findFirst({
      where: { clinicianId, type: 'npdb' },
      orderBy: { runAt: 'desc' },
    }),
    client.dEACredential.findFirst({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
      select: {
        deaNumber: true,
        expiration: true,
        mateHours: true,
      },
    }),
  ]);

  const vitals = [
    computeLicenseVital(licenses, now),
    computeBoardVital(boardCheck),
    computeSanctionsVital(sanctionsCheck),
    computeNpdbVital(npdbCheck),
    computeDeaVital(deaCredential, now),
  ].filter((entry): entry is VitalComputation => Boolean(entry));

  if (!vitals.length) {
    return [];
  }

  await client.$transaction(
    vitals.map((vital) =>
      client.credentialVitalSign.upsert({
        where: {
          clinicianId_component: {
            clinicianId,
            component: vital.component,
          },
        },
        update: {
          status: vital.status,
          details: vital.details,
          updatedAt: now,
        },
        create: {
          clinicianId,
          component: vital.component,
          status: vital.status,
          details: vital.details,
        },
      }),
    ),
  );

  return client.credentialVitalSign.findMany({
    where: { clinicianId },
    orderBy: { component: 'asc' },
  });
}

export function computeHealthScore(vitals: Array<Pick<CredentialVitalSign, 'status'>>): number {
  if (!vitals.length) return 0;
  const weights = vitals.map((vital) => weightForStatus(vital.status as VitalStatus));
  return Number((weights.reduce((sum, value) => sum + value, 0) / weights.length).toFixed(4));
}

function computeLicenseVital(
  licenses: Array<{ state: string | null; licenseNumber: string; expiryDate: Date | null }>,
  now: Date,
): VitalComputation {
  if (!licenses.length) {
    return {
      component: 'license',
      status: 'critical',
      details: {
        reason: 'no_license_records',
      },
    };
  }

  const soonest = licenses
    .filter((license) => license.expiryDate)
    .reduce<{ expiry: Date; state: string | null; licenseNumber: string } | null>(
      (carry, license) => {
        if (!license.expiryDate) return carry;
        if (!carry || license.expiryDate < carry.expiry) {
          return {
            expiry: license.expiryDate,
            state: license.state,
            licenseNumber: license.licenseNumber,
          };
        }
        return carry;
      },
      null,
    );

  if (!soonest) {
    return {
      component: 'license',
      status: 'warning',
      details: {
        reason: 'missing_expiration_metadata',
      },
    };
  }

  const daysRemaining = Math.round(
    (soonest.expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  let status: VitalStatus = 'good';
  if (daysRemaining < 0) {
    status = 'critical';
  } else if (daysRemaining < 30) {
    status = 'warning';
  }

  return {
    component: 'license',
    status,
    details: {
      expiringInDays: daysRemaining,
      state: soonest.state,
      licenseNumber: soonest.licenseNumber,
    },
  };
}

function computeBoardVital(check: { result: Prisma.JsonValue | null } | null): VitalComputation {
  if (!check || !check.result || typeof check.result !== 'object') {
    return {
      component: 'board',
      status: 'warning',
      details: {
        reason: 'missing_board_checks',
      },
    };
  }

  const result = check.result as Record<string, unknown>;
  const totals = result.totals as Record<string, unknown> | undefined;
  const expired =
    typeof totals?.expired === 'number'
      ? totals.expired
      : typeof result.expired === 'number'
        ? (result.expired as number)
        : 0;
  const statusFlag = typeof result.status === 'string' ? result.status : 'pass';

  const status: VitalStatus =
    statusFlag === 'fail' || expired > 0 ? 'warning' : statusFlag === 'warn' ? 'warning' : 'good';

  return {
    component: 'board',
    status,
    details: {
      expired,
      expiringSoon:
        typeof totals?.expiringSoon === 'number'
          ? totals.expiringSoon
          : (result.expiringSoon as unknown[] | undefined)?.length ?? 0,
      monitorReasons: result.reason,
    },
  };
}

function computeSanctionsVital(check: { result: Prisma.JsonValue | null } | null): VitalComputation {
  if (!check || !check.result || typeof check.result !== 'object') {
    return {
      component: 'sanctions',
      status: 'warning',
      details: {
        reason: 'missing_monitor_feed',
      },
    };
  }

  const result = check.result as Record<string, unknown>;
  const hasHit = Boolean(result.hasHit);
  const monitorStatus = typeof result.monitorStatus === 'string' ? result.monitorStatus : null;

  const status: VitalStatus =
    hasHit || monitorStatus === 'ADVERSE_ACTION' ? 'critical' : 'good';

  return {
    component: 'sanctions',
    status,
    details: {
      monitorStatus,
      lastCheckedAt: result.lastCheckedAt,
    },
  };
}

function computeNpdbVital(check: { result: Prisma.JsonValue | null } | null): VitalComputation {
  if (!check || !check.result || typeof check.result !== 'object') {
    return {
      component: 'npdb',
      status: 'warning',
      details: {
        reason: 'missing_npdb_feed',
      },
    };
  }

  const result = check.result as Record<string, unknown>;
  const actions = typeof result.adverseActionCount === 'number' ? result.adverseActionCount : 0;
  const monitorStatus = typeof result.monitorStatus === 'string' ? result.monitorStatus : null;

  const status: VitalStatus =
    monitorStatus === 'ADVERSE_ACTION' || actions >= 2
      ? 'critical'
      : actions > 0
        ? 'warning'
        : 'good';

  return {
    component: 'npdb',
    status,
    details: {
      adverseActionCount: actions,
      monitorStatus,
      lastCheckedAt: result.lastCheckedAt,
    },
  };
}

function computeDeaVital(
  record: { deaNumber: string; expiration: Date; mateHours: number } | null,
  now: Date,
): VitalComputation {
  if (!record) {
    return {
      component: 'dea',
      status: 'warning',
      details: {
        reason: 'missing_dea_record',
      },
    };
  }

  const daysRemaining = Math.round(
    (record.expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  let status: VitalStatus = 'good';
  if (daysRemaining < 0) {
    status = 'critical';
  } else if (daysRemaining < 60) {
    status = 'warning';
  }

  return {
    component: 'dea',
    status,
    details: {
      deaNumber: record.deaNumber,
      expiringInDays: daysRemaining,
      mateHours: record.mateHours,
    },
  };
}

function weightForStatus(status: VitalStatus): number {
  switch (status) {
    case 'critical':
      return 0.2;
    case 'warning':
      return 0.65;
    case 'good':
    default:
      return 1;
  }
}

