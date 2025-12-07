import { PrismaClient, type ClinicianProfile, type StateLicenseVerification } from '@prisma/client';

import {
  evaluatePracticeEligibility,
  listAuthorizedStatesForCompact,
  type ClinicianCompactProfile,
  type ClinicianLicense,
  type PracticeEligibilityResult,
} from '../compacts/eligibilityEngine.js';
import { buildClinicianProfileFromStatus } from '../compacts/profileAdapter.js';

const prisma = new PrismaClient();
const ENGINE_VERSION = '2.0';

export type CompactV2Type = 'IMLC' | 'NLC' | 'PSYPACT' | 'PTC' | 'AOTA';
export type CompactV2Status = 'eligible' | 'review' | 'blocked';
type CompactSource = 'clinicalLicenses' | 'compactsStatus';

interface EvaluatedStateSummary {
  state: string;
  eligible: boolean;
  blockers: string[];
  detail: string;
}

export interface CompactEligibilityV2Result {
  compact: CompactV2Type;
  status: CompactV2Status;
  authorizedStates: string[];
  evaluatedStates: EvaluatedStateSummary[];
  blockers: string[];
  notes: string;
  metadata: {
    coverage: number;
    lastEvaluatedAt: string;
    source: CompactSource;
  };
}

export interface CompactEligibilityEngineV2Result {
  engineVersion: string;
  compacts: CompactEligibilityV2Result[];
  profile: ClinicianCompactProfile;
}

export interface CompactEligibilityEngineV2Options {
  prisma?: PrismaClient;
  targetStates?: string[];
}

export async function runCompactEligibilityEngineV2(
  clinicianId: string,
  options: CompactEligibilityEngineV2Options = {},
): Promise<CompactEligibilityEngineV2Result> {
  const client = options.prisma ?? prisma;
  const context = await loadClinicianContext(client, clinicianId);
  const targetStates = normalizeTargetStates(options.targetStates ?? deriveTargetStates(context.profile));
  const evaluatedAt = new Date().toISOString();

  const compacts: CompactEligibilityV2Result[] = [
    evaluateStandardCompact('IMLC', 'IMLC', context.profile, targetStates, context.sourceTag, evaluatedAt),
    evaluateStandardCompact('NLC', 'NLC', context.profile, targetStates, context.sourceTag, evaluatedAt),
    evaluateStandardCompact('PSYPACT', 'PSYPACT', context.profile, targetStates, context.sourceTag, evaluatedAt),
    evaluateStandardCompact('PTC', 'PT', context.profile, targetStates, context.sourceTag, evaluatedAt),
    evaluateAotaCompact(context.profile, targetStates, context.sourceTag, evaluatedAt),
  ];

  return {
    engineVersion: ENGINE_VERSION,
    compacts,
    profile: context.profile,
  };
}

async function loadClinicianContext(client: PrismaClient, clinicianId: string) {
  const clinician = await client.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: { user: true },
  });

  if (!clinician) {
    throw new Error(`Clinician ${clinicianId} not found`);
  }

  const [licenses, compactsStatus] = await Promise.all([
    client.stateLicenseVerification.findMany({
      where: { clinicianId },
      orderBy: { verifiedAt: 'desc' },
    }),
    clinician.user?.did
      ? client.compactsStatus.findUnique({
          where: { clinicianDid: clinician.user.did },
        })
      : Promise.resolve(null),
  ]);

  let profile = buildProfileFromLicenses(clinician, licenses);

  if (compactsStatus) {
    profile = mergeProfiles(
      profile,
      buildClinicianProfileFromStatus(compactsStatus as any, {
        homeState: profile.homeState ?? clinician.state ?? undefined,
        licenses: profile.licenses,
      }),
    );
  }

  return {
    clinician,
    licenses,
    profile,
    sourceTag: compactsStatus ? 'compactsStatus' : 'clinicalLicenses',
  };
}

function buildProfileFromLicenses(
  clinician: ClinicianProfile,
  licenses: StateLicenseVerification[],
): ClinicianCompactProfile {
  const mappedLicenses: ClinicianLicense[] = licenses.map((license) => {
    const metadata = (license.metadata as Record<string, unknown> | null) ?? null;
    const raw = license as unknown as { licenseType?: string | null };
    const licenseType =
      raw.licenseType ??
      license.specialty ??
      (metadata?.licenseType as string | undefined) ??
      'license';
    return {
      state: normalizeState(license.state),
      type: String(licenseType),
      status: (license.status ?? 'inactive').toLowerCase() as ClinicianLicense['status'],
      issueDate: license.issueDate ?? undefined,
      expirationDate: license.expiryDate ?? undefined,
      isPrimary: metadata ? Boolean(metadata.primary) : false,
      isMultiState: metadata ? Boolean(metadata.multiState) : undefined,
    };
  });

  return {
    did: clinician.user?.did ?? clinician.id,
    homeState: normalizeState(clinician.state),
    profession: clinician.specialty ?? undefined,
    licenses: mappedLicenses,
    metadata: {
      hasDisciplinaryActions: licenses.some((license) => license.disciplinaryFlag === true),
      residencyDaysInCurrentState: 365,
    },
    compacts: {},
  };
}

function mergeProfiles(
  base: ClinicianCompactProfile,
  augment: ClinicianCompactProfile,
): ClinicianCompactProfile {
  const combinedLicenses = dedupeLicenses([...(base.licenses ?? []), ...(augment.licenses ?? [])]);

  return {
    ...base,
    homeState: augment.homeState ?? base.homeState,
    compacts: {
      ...(base.compacts ?? {}),
      ...(augment.compacts ?? {}),
    },
    licenses: combinedLicenses,
  };
}

function dedupeLicenses(licenses: ClinicianLicense[]): ClinicianLicense[] {
  const seen = new Map<string, ClinicianLicense>();
  for (const license of licenses) {
    const key = `${normalizeState(license.state)}:${(license.type ?? '').toLowerCase()}`;
    if (!seen.has(key)) {
      seen.set(key, license);
      continue;
    }
    const existing = seen.get(key)!;
    if (!existing.issueDate && license.issueDate) {
      existing.issueDate = license.issueDate;
    }
    if (!existing.expirationDate && license.expirationDate) {
      existing.expirationDate = license.expirationDate;
    }
    existing.isMultiState = existing.isMultiState ?? license.isMultiState;
  }
  return Array.from(seen.values());
}

function deriveTargetStates(profile: ClinicianCompactProfile): string[] {
  const states = new Set<string>();
  if (profile.homeState) {
    states.add(normalizeState(profile.homeState));
  }
  (profile.licenses ?? [])
    .map((license) => normalizeState(license.state))
    .filter(Boolean)
    .forEach((state) => states.add(state));
  return Array.from(states);
}

function normalizeTargetStates(states: string[]): string[] {
  const deduped = new Set<string>();
  states
    .map((state) => normalizeState(state))
    .filter(Boolean)
    .forEach((state) => deduped.add(state));
  if (deduped.size === 0) {
    deduped.add('CA');
  }
  return Array.from(deduped);
}

function evaluateStandardCompact(
  label: CompactV2Type,
  legacyCompact: 'IMLC' | 'NLC' | 'PSYPACT' | 'PT',
  profile: ClinicianCompactProfile,
  targetStates: string[],
  source: CompactSource,
  evaluatedAt: string,
): CompactEligibilityV2Result {
  const evaluatedStates = targetStates.map((state) => summarizeEvaluation(legacyCompact, profile, state));
  const authorizedStates = resolveAuthorizedStates(legacyCompact, profile, evaluatedStates);
  const blockers = dedupeStrings(
    evaluatedStates.flatMap((entry) => entry.blockers).filter((detail) => detail.length > 0),
  );

  let status: CompactV2Status = 'review';
  if (evaluatedStates.some((entry) => entry.eligible)) {
    status = 'eligible';
  } else if (blockers.length > 0 || authorizedStates.length === 0) {
    status = 'blocked';
  }

  const notes =
    status === 'eligible'
      ? `${label} coverage across ${authorizedStates.length} state${authorizedStates.length === 1 ? '' : 's'}`
      : blockers[0] ?? `No ${label} privileges detected`;

  return {
    compact: label,
    status,
    authorizedStates,
    evaluatedStates,
    blockers,
    notes,
    metadata: {
      coverage: authorizedStates.length,
      lastEvaluatedAt: evaluatedAt,
      source,
    },
  };
}

function evaluateAotaCompact(
  profile: ClinicianCompactProfile,
  targetStates: string[],
  source: CompactSource,
  evaluatedAt: string,
): CompactEligibilityV2Result {
  const otLicenses = (profile.licenses ?? []).filter((license) =>
    typeof license.type === 'string' && license.type.toLowerCase().includes('ot'),
  );
  const authorizedStates = dedupeStates(
    otLicenses.map((license) => normalizeState(license.state)).filter(Boolean),
  );
  const evaluatedStates: EvaluatedStateSummary[] = targetStates.map((state) => {
    if (authorizedStates.includes(state)) {
      return {
        state,
        eligible: true,
        blockers: [],
        detail: `Occupational therapy license recognized in ${state}`,
      };
    }
    return {
      state,
      eligible: false,
      blockers: ['OT credential not yet provisioned for this jurisdiction'],
      detail: 'Submit OT credential evidence to enable AOTA compact routing',
    };
  });

  const blockers =
    authorizedStates.length === 0
      ? ['Occupational therapy credential not found in the clinician wallet']
      : [];

  let status: CompactV2Status = 'review';
  if (authorizedStates.length >= 3) {
    status = 'eligible';
  } else if (authorizedStates.length === 0) {
    status = 'blocked';
  }

  const notes =
    status === 'eligible'
      ? `AOTA readiness confirmed for ${authorizedStates.length} state${authorizedStates.length === 1 ? '' : 's'}`
      : 'Upload OT license or request verification to unlock AOTA compact portability';

  return {
    compact: 'AOTA',
    status,
    authorizedStates,
    evaluatedStates,
    blockers,
    notes,
    metadata: {
      coverage: authorizedStates.length,
      lastEvaluatedAt: evaluatedAt,
      source,
    },
  };
}

function summarizeEvaluation(
  compact: 'IMLC' | 'NLC' | 'PSYPACT' | 'PT',
  profile: ClinicianCompactProfile,
  state: string,
): EvaluatedStateSummary {
  try {
    const result = evaluatePracticeEligibility(compact, profile, state);
    const blockers = result.conditions
      ?.filter((condition) => !condition.passed)
      .map((condition) => condition.detail || condition.code) ?? [];
    return {
      state,
      eligible: result.eligible,
      blockers,
      detail: result.reason,
    };
  } catch (error) {
    return {
      state,
      eligible: false,
      blockers: ['Eligibility engine error'],
      detail: error instanceof Error ? error.message : 'Eligibility evaluation failed',
    };
  }
}

function resolveAuthorizedStates(
  compact: 'IMLC' | 'NLC' | 'PSYPACT' | 'PT',
  profile: ClinicianCompactProfile,
  evaluatedStates: EvaluatedStateSummary[],
): string[] {
  const fromProfile = listAuthorizedStatesForCompact(compact, profile).map((state) => normalizeState(state));
  const fallback = fallbackAuthorizedStates(compact, profile);
  const eligibleStates = evaluatedStates.filter((entry) => entry.eligible).map((entry) => entry.state);
  return dedupeStates([...fromProfile, ...fallback, ...eligibleStates]);
}

function fallbackAuthorizedStates(
  compact: 'IMLC' | 'NLC' | 'PSYPACT' | 'PT',
  profile: ClinicianCompactProfile,
): string[] {
  switch (compact) {
    case 'IMLC':
      return dedupeStates([
        profile.homeState ? normalizeState(profile.homeState) : '',
        ...(profile.licenses ?? [])
          .filter((license) => license.type?.toLowerCase().includes('md') || license.type?.toLowerCase().includes('do'))
          .map((license) => normalizeState(license.state)),
      ]);
    case 'NLC':
      return dedupeStates(
        (profile.licenses ?? [])
          .filter(
            (license) =>
              (license.type ?? '').toLowerCase().includes('rn') && license.isMultiState === true,
          )
          .map((license) => normalizeState(license.state)),
      );
    case 'PSYPACT':
      return dedupeStates(
        (profile.licenses ?? [])
          .filter((license) => (license.type ?? '').toLowerCase().includes('psych'))
          .map((license) => normalizeState(license.state)),
      );
    case 'PT':
      return dedupeStates(
        (profile.licenses ?? [])
          .filter((license) => (license.type ?? '').toLowerCase().includes('pt'))
          .map((license) => normalizeState(license.state)),
      );
    default:
      return [];
  }
}

function dedupeStates(states: Array<string | undefined>): string[] {
  const set = new Set<string>();
  states
    .map((state) => normalizeState(state))
    .filter(Boolean)
    .forEach((state) => set.add(state));
  return Array.from(set);
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeState(value?: string | null): string {
  return (value ?? '').trim().toUpperCase();
}

