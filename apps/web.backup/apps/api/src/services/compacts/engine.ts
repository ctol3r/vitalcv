import { PrismaClient, type Prisma } from '@prisma/client';
import {
  evaluatePracticeEligibility,
  listAuthorizedStatesForCompact,
  type ClinicianCompactProfile,
  type ClinicianLicense,
  type CompactType,
  type PracticeEligibilityResult,
} from '../../../../services/compacts/eligibilityEngine';

type CompactSubset = Extract<CompactType, 'IMLC' | 'NLC' | 'PSYPACT' | 'PT'>;
const SUPPORTED_COMPACTS: CompactSubset[] = ['IMLC', 'NLC', 'PSYPACT', 'PT'];

export interface CompactEligibilityComputation {
  compact: CompactSubset;
  eligible: boolean;
  rationale: CompactEligibilityRationale;
}

export interface CompactEligibilityRationale {
  evaluatedStates: Array<{
    state: string;
    eligible: boolean;
    result: PracticeEligibilityResult;
  }>;
  authorizedStates: string[];
  metadata: {
    homeState?: string;
    licenseCount: number;
  };
  evaluatedAt: string;
}

export interface CompactEngineOptions {
  targetStates?: string[];
}

export async function computeCompactEligibility(
  prisma: PrismaClient,
  clinicianId: string,
  options: CompactEngineOptions = {},
): Promise<CompactEligibilityComputation[]> {
  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: { user: true },
  });

  if (!clinician) {
    throw new Error(`Clinician ${clinicianId} not found`);
  }

  const [licenses, readiness] = await Promise.all([
    prisma.stateLicenseVerification.findMany({
      where: { clinicianId },
      orderBy: { verifiedAt: 'desc' },
    }),
    prisma.clinicianReadinessScore.findUnique({
      where: { clinicianId },
    }),
  ]);

  const profile = buildCompactProfile(clinician, licenses);
  const statesOfInterest =
    options.targetStates?.map(normalizeState).filter(Boolean) ??
    deriveTargetStates(profile, licenses);

  const evaluatedAt = new Date().toISOString();

  return SUPPORTED_COMPACTS.map((compact) => {
    const evaluations = statesOfInterest.map((state) => ({
      state,
      result: evaluatePracticeEligibility(compact, profile, state),
    }));

    const eligible = evaluations.some((entry) => entry.result.eligible);
    const authorizedStates = listAuthorizedStatesForCompact(compact, profile);

    return {
      compact,
      eligible,
      rationale: {
        evaluatedStates: evaluations.map((entry) => ({
          state: entry.state,
          eligible: entry.result.eligible,
          result: entry.result,
        })),
        authorizedStates,
        metadata: {
          homeState: normalizeState(profile.homeState ?? undefined),
          licenseCount: profile.licenses?.length ?? 0,
        },
        evaluatedAt,
      },
    };
  });
}

export async function persistCompactEligibility(
  prisma: PrismaClient,
  clinicianId: string,
  computations: CompactEligibilityComputation[],
) {
  await Promise.all(
    computations.map((record) =>
      prisma.compactEligibility.upsert({
        where: { clinicianId_compact: { clinicianId, compact: record.compact } },
        create: {
          clinicianId,
          compact: record.compact,
          eligible: record.eligible,
          rationale: record.rationale,
        },
        update: {
          eligible: record.eligible,
          rationale: record.rationale,
        },
      }),
    ),
  );
}

function buildCompactProfile(
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>,
  licenses: Prisma.StateLicenseVerificationGetPayload<{}>[],
): ClinicianCompactProfile {
  const licenseRecords: ClinicianLicense[] = licenses.map((license) => {
    const metadata = (license.metadata as Record<string, unknown> | null) ?? null;
    const licenseType =
      (license as any).licenseType ?? license.specialty ?? metadata?.licenseType ?? 'license';
    return {
      state: license.state ?? '',
      type: licenseType,
      status: (license.status ?? 'inactive').toLowerCase() as ClinicianLicense['status'],
      issueDate: license.issueDate ?? undefined,
      expirationDate: license.expiryDate ?? undefined,
      isPrimary: metadata ? Boolean(metadata.primary) : false,
      isMultiState: metadata ? Boolean(metadata.multiState) : undefined,
    };
  });

  const hasDiscipline = licenses.some((license) => license.disciplinaryFlag === true);

  return {
    did: clinician.user?.did ?? clinician.id,
    profession: clinician.specialty ?? undefined,
    homeState: clinician.state ?? undefined,
    licenses: licenseRecords,
    metadata: {
      hasDisciplinaryActions: hasDiscipline,
      residencyDaysInCurrentState: 365,
    },
    compacts: {},
  };
}

function deriveTargetStates(
  profile: ClinicianCompactProfile,
  licenses: Prisma.StateLicenseVerificationGetPayload<{}>[],
): string[] {
  const states = new Set<string>();
  if (profile.homeState) {
    states.add(normalizeState(profile.homeState));
  }
  licenses
    .map((license) => license.state)
    .filter(Boolean)
    .forEach((state) => states.add(normalizeState(state!)));
  const normalized = Array.from(states).filter(Boolean);
  if (normalized.length === 0) {
    normalized.push('CA');
  }
  return normalized;
}

function normalizeState(value?: string | null): string {
  return (value ?? '').trim().toUpperCase();
}


