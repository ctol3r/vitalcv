import { PrismaClient, type Prisma } from '@prisma/client';
import { getServiceLogger } from '../../../../services/logging/serviceLogger';
import { anchorAtsScreenVerdict } from '../audit/anchor';
import { publishRecruiterEvent } from '../recruiter/stream';
import type { ScreeningComponent, ScreeningComponentStatus } from './types';

const prisma = new PrismaClient();
const log = getServiceLogger('api/services/ats/screen');

export interface AutoScreeningOptions {
  clinicianId: string;
  orgId?: string | null;
  minYearsExperience?: number;
  requireBoardCertified?: boolean;
  requireCompact?: boolean;
}

export interface AutoScreeningResult {
  clinicianId: string;
  orgId?: string | null;
  verdict: ScreeningComponentStatus;
  components: ScreeningComponent[];
  yearsExperience: number | null;
  compactEligibleStates: string[];
  runAt: string;
}

export class AutoScreeningEngine {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async run(options: AutoScreeningOptions): Promise<AutoScreeningResult> {
    const [clinician, licenses, boardCredentials, compactRecords] = await Promise.all([
      this.prismaClient.clinicianProfile.findUnique({
        where: { id: options.clinicianId },
        select: { id: true, orgId: true },
      }),
      this.prismaClient.stateLicenseVerification.findMany({
        where: { clinicianId: options.clinicianId },
        orderBy: { verifiedAt: 'desc' },
        take: 25,
      }),
      this.prismaClient.credential.findMany({
        where: {
          clinicianId: options.clinicianId,
          OR: [
            { type: { contains: 'board', mode: 'insensitive' } },
            { name: { contains: 'board', mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 15,
      }),
      this.prismaClient.compactEligibility.findMany({
        where: { clinicianId: options.clinicianId },
      }),
    ]);

    const licenseComponent = evaluateLicenseStatus(licenses);
    const boardComponent = evaluateBoardStatus(boardCredentials, options.requireBoardCertified ?? false);
    const { component: experienceComponent, yearsExperience } = evaluateExperience(
      licenses,
      options.minYearsExperience,
    );
    const { component: compactComponent, states: compactStates } = evaluateCompactEligibility(
      compactRecords,
      options.requireCompact ?? false,
    );

    const components = [licenseComponent, boardComponent, experienceComponent, compactComponent];
    const verdict = deriveVerdict(components);
    const orgId = options.orgId ?? clinician?.orgId ?? null;
    const runAt = new Date().toISOString();

    await anchorAtsScreenVerdict({
      clinicianId: options.clinicianId,
      orgId,
      verdict,
      components,
      runAt,
    });

    publishRecruiterEvent('screening.action', {
      clinicianId: options.clinicianId,
      orgId,
      payload: {
        verdict,
        components,
      },
    });

    log.info('Auto-screening completed', {
      clinicianId: options.clinicianId,
      orgId,
      verdict,
    });

    return {
      clinicianId: options.clinicianId,
      orgId,
      verdict,
      components,
      yearsExperience,
      compactEligibleStates: compactStates,
      runAt,
    };
  }
}

export async function runAutoScreening(options: AutoScreeningOptions): Promise<AutoScreeningResult> {
  const engine = new AutoScreeningEngine(prisma);
  return engine.run(options);
}

function evaluateLicenseStatus(
  licenses: Prisma.StateLicenseVerificationGetPayload<{}>[],
): ScreeningComponent {
  if (licenses.length === 0) {
    return {
      key: 'license',
      status: 'fail',
      detail: 'No state licenses found in the last 24 months.',
      metadata: { total: 0 },
    };
  }

  const now = Date.now();
  const active = licenses.filter((license) => {
    const status = (license.status ?? '').toUpperCase();
    const activeStatus = ['ACTIVE', 'CLEAR', 'CURRENT', 'ISSUED'];
    const notExpired = !license.expiryDate || license.expiryDate.getTime() > now;
    return activeStatus.includes(status) && notExpired;
  });
  const verifiedRecently = active.filter((license) => {
    const verifiedAt = license.verifiedAt ?? license.updatedAt ?? null;
    if (!verifiedAt) {
      return false;
    }
    const ageDays = (now - verifiedAt.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays <= 180;
  });
  const states = active
    .map((license) => license.state)
    .filter((state): state is string => Boolean(state));

  let status: ScreeningComponentStatus = 'pass';
  if (active.length === 0) {
    status = 'fail';
  } else if (verifiedRecently.length === 0) {
    status = 'review';
  }

  return {
    key: 'license',
    status,
    detail:
      status === 'pass'
        ? `${active.length} active licenses (${verifiedRecently.length} verified in ≤180d)`
        : 'Active license verification required',
    metadata: {
      active: active.length,
      total: licenses.length,
      states,
      verifiedRecently: verifiedRecently.length,
    },
  };
}

function evaluateBoardStatus(
  credentials: Prisma.CredentialGetPayload<{}>[],
  requireBoard: boolean,
): ScreeningComponent {
  if (credentials.length === 0) {
    return {
      key: 'board',
      status: requireBoard ? 'fail' : 'review',
      detail: 'No board certification data available.',
      metadata: { total: 0 },
    };
  }

  const now = Date.now();
  const active = credentials.filter((credential) => {
    if (!credential.expiresAt) {
      return true;
    }
    return credential.expiresAt.getTime() > now;
  });

  let status: ScreeningComponentStatus = 'pass';
  if (active.length === 0) {
    status = requireBoard ? 'fail' : 'review';
  }

  return {
    key: 'board',
    status,
    detail:
      status === 'pass'
        ? `Active certifications: ${active.length}`
        : 'Board certification refresh required',
    metadata: {
      active: active.length,
      total: credentials.length,
      specialities: credentials.map((credential) => credential.name ?? credential.type),
    },
  };
}

function evaluateExperience(
  licenses: Prisma.StateLicenseVerificationGetPayload<{}>[],
  minimum?: number,
): { component: ScreeningComponent; yearsExperience: number | null } {
  const timestamps = licenses
    .map((license) => license.issueDate?.getTime() ?? license.verifiedAt?.getTime())
    .filter((value): value is number => typeof value === 'number');
  if (!timestamps.length) {
    return {
      yearsExperience: null,
      component: {
        key: 'experience',
        status: 'review',
        detail: 'Insufficient data to calculate tenure.',
      },
    };
  }

  const earliest = Math.min(...timestamps);
  const years = yearsBetween(earliest);
  let status: ScreeningComponentStatus = 'pass';
  if (minimum && years < minimum) {
    status = 'review';
  } else if (!minimum && years < 1) {
    status = 'review';
  }

  return {
    yearsExperience: Number(years.toFixed(1)),
    component: {
      key: 'experience',
      status,
      detail: `${years.toFixed(1)} years since first issuance`,
      metadata: {
        minimum,
      },
    },
  };
}

function evaluateCompactEligibility(
  records: Prisma.CompactEligibilityGetPayload<{}>[],
  requireCompact: boolean,
): { component: ScreeningComponent; states: string[] } {
  if (records.length === 0) {
    return {
      states: [],
      component: {
        key: 'compact',
        status: requireCompact ? 'fail' : 'review',
        detail: 'No compact participation recorded.',
      },
    };
  }

  const eligibleStates = records
    .filter((record) => record.eligible)
    .map((record) => record.compact)
    .filter((value): value is string => Boolean(value));

  let status: ScreeningComponentStatus = 'pass';
  if (eligibleStates.length === 0) {
    status = requireCompact ? 'fail' : 'review';
  }

  return {
    states: eligibleStates,
    component: {
      key: 'compact',
      status,
      detail:
        eligibleStates.length > 0
          ? `Eligible via ${eligibleStates.length} compact jurisdictions`
          : 'No compact eligibility detected.',
      metadata: { eligibleStates, total: records.length },
    },
  };
}

function deriveVerdict(components: ScreeningComponent[]): ScreeningComponentStatus {
  if (components.some((component) => component.status === 'fail')) {
    return 'fail';
  }
  if (components.some((component) => component.status === 'review')) {
    return 'review';
  }
  return 'pass';
}

function yearsBetween(epochMs: number): number {
  const diffMs = Date.now() - epochMs;
  return diffMs / (1000 * 60 * 60 * 24 * 365);
}









