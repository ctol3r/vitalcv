import type { Prisma, PrivilegeSafetySignal } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type EmergencyPrivilegeReason = 'disaster' | 'surge' | 'shortage';

export interface EmergencyLicenseCheck {
  ok: boolean;
  status: string;
  state?: string | null;
  expiresAt?: string | null;
  rationale: string;
}

export interface EmergencySanctionCheck {
  ok: boolean;
  activeSignals: number;
  sanctionsProbability: number;
  rationale: string;
}

export interface EmergencyPrivilegeEligibility {
  eligible: boolean;
  license: EmergencyLicenseCheck;
  sanctions: EmergencySanctionCheck;
  relaxedRequirements: string[];
  rationale: string[];
}

export interface EvaluateEmergencyOptions {
  prisma?: PrismaClient;
}

const SANCTION_SIGNALS: PrivilegeSafetySignal['signalType'][] = [
  'NPDB_FLAG',
  'LICENSE_RISK',
  'DEA_EXPIRED',
];

const RELAXED_REQUIREMENTS = ['boardCertification', 'minimumExperience'];

export async function evaluateEmergencyPrivilegeEligibility(
  clinicianId: string,
  options: EvaluateEmergencyOptions = {},
): Promise<EmergencyPrivilegeEligibility> {
  if (!clinicianId) {
    throw new Error('clinicianId is required for emergency privilege evaluation');
  }

  const client = options.prisma ?? prisma;

  const [license, sanctionsDimension, activeSignals] = await Promise.all([
    client.stateLicenseVerification.findFirst({
      where: { clinicianId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    }),
    client.readinessDimension.findUnique({
      where: {
        clinicianId_dimension: {
          clinicianId,
          dimension: 'SANCTIONS',
        },
      },
    }),
    client.privilegeSafetySignal.count({
      where: {
        clinicianId,
        signalType: { in: SANCTION_SIGNALS },
        resolvedAt: null,
      },
    }),
  ]);

  const now = new Date();
  const normalizedStatus = normalizeStatus(license?.status);
  const expiresAtIso = license?.expiryDate?.toISOString() ?? null;
  const licenseActive =
    Boolean(license) &&
    normalizedStatus === 'ACTIVE' &&
    (!license?.expiryDate || license.expiryDate.getTime() > now.getTime());

  const licenseRationale = license
    ? licenseActive
      ? `Active ${license.state ?? 'state'} license valid through ${
          expiresAtIso ?? 'N/A'
        }.`
      : `Latest license (${license.state ?? 'unknown state'}) is ${normalizedStatus.toLowerCase()} or expired.`
    : 'No state license records found.';

  const sanctionsProbability = extractSanctionsProbability(sanctionsDimension?.metadata);
  const sanctionsOk = activeSignals === 0 && sanctionsProbability < 0.35;
  const sanctionsRationale = sanctionsOk
    ? 'No open sanctions or high-risk signals detected.'
    : `Sanctions review required (${activeSignals} active signals, probability ${(
        sanctionsProbability * 100
      ).toFixed(1)}%).`;

  const rationale: string[] = [licenseRationale, sanctionsRationale];

  return {
    eligible: licenseActive && sanctionsOk,
    license: {
      ok: licenseActive,
      status: normalizedStatus,
      state: license?.state ?? null,
      expiresAt: expiresAtIso,
      rationale: licenseRationale,
    },
    sanctions: {
      ok: sanctionsOk,
      activeSignals,
      sanctionsProbability,
      rationale: sanctionsRationale,
    },
    relaxedRequirements: [...RELAXED_REQUIREMENTS],
    rationale,
  };
}

function normalizeStatus(status?: string | null): string {
  return (status ?? 'UNKNOWN').toUpperCase();
}

function extractSanctionsProbability(metadata: Prisma.JsonValue | null | undefined): number {
  if (!metadata || typeof metadata !== 'object') return 0.08;
  const record = metadata as { sanctionsProbability?: number };
  const probability = typeof record.sanctionsProbability === 'number' ? record.sanctionsProbability : 0.08;
  if (Number.isNaN(probability)) return 0.08;
  return Math.min(Math.max(probability, 0), 1);
}











