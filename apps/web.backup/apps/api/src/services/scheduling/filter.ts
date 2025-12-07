import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface ShiftRequirement {
  shiftId: string;
  orgId?: string;
  role?: string | null;
  licenseStates: string[];
  privilegeCodes: string[];
  compactTypes: string[];
  readinessThreshold?: number;
  start?: string;
  end?: string;
  urgency?: string | null;
}

export interface ClinicianEligibility {
  clinicianId: string;
  clinicianName?: string | null;
  orgId?: string | null;
  specialty?: string | null;
  readinessScore: number;
  eligible: boolean;
  licenseStates: {
    covered: string[];
    missing: string[];
    expiresSoon: boolean;
    lastVerifiedAt?: string;
  };
  privilegeSummary: {
    satisfied: string[];
    missing: string[];
  };
  compactSummary: {
    eligible: string[];
    missing: string[];
  };
  missing: {
    licenses: string[];
    privileges: string[];
    compacts: string[];
  };
  privilegeReasons: string[];
}

export interface ShiftFilterResponse {
  requirement: ShiftRequirement;
  clinicians: ClinicianEligibility[];
  totalConsidered: number;
  readinessThreshold: number;
  missingSummary: {
    licenses: Array<{ item: string; count: number }>;
    privileges: Array<{ item: string; count: number }>;
    compacts: Array<{ item: string; count: number }>;
  };
}

interface FilterOptions {
  shiftId?: string;
  requirement?: ShiftRequirement;
  limit?: number;
  prisma?: PrismaClient;
}

type PrivilegeGrantRecord = Prisma.PrivilegeGrantedGetPayload<{
  include: {
    privilegeRequest: {
      include: {
        privilegeSet: true;
        privilegeSetV2: {
          include: { privileges: true };
        };
      };
    };
  };
}>;

const DEFAULT_READINESS_THRESHOLD = 0.78;
const EXPIRES_SOON_DAYS = 45;

export async function filterCliniciansForShift(
  options: FilterOptions,
): Promise<ShiftFilterResponse> {
  const client = options.prisma ?? prisma;
  const requirement =
    options.requirement ??
    (await loadShiftRequirement(client, options.shiftId ?? '')).requirement;
  const limit = Math.max(1, Math.min(options.limit ?? 20, 100));

  const readinessRecords = await client.clinicianReadinessScore.findMany({
    orderBy: { score: 'desc' },
    take: limit * 3,
  });

  if (readinessRecords.length === 0) {
    return {
      requirement,
      clinicians: [],
      totalConsidered: 0,
      readinessThreshold: requirement.readinessThreshold ?? DEFAULT_READINESS_THRESHOLD,
      missingSummary: { licenses: [], privileges: [], compacts: [] },
    };
  }

  const readinessMap = new Map(readinessRecords.map((record) => [record.clinicianId, record]));
  const candidateIds = readinessRecords.map((record) => record.clinicianId);

  const clinicianProfiles = await client.clinicianProfile.findMany({
    where: {
      id: { in: candidateIds },
      ...(requirement.orgId ? { orgId: requirement.orgId } : {}),
    },
    include: {
      user: {
        select: { name: true },
      },
    },
  });

  const profileMap = new Map(
    clinicianProfiles.map((profile) => [profile.id, profile]),
  );

  const filteredIds = candidateIds.filter((id) => profileMap.has(id)).slice(0, limit);

  if (filteredIds.length === 0) {
    return {
      requirement,
      clinicians: [],
      totalConsidered: readinessRecords.length,
      readinessThreshold: requirement.readinessThreshold ?? DEFAULT_READINESS_THRESHOLD,
      missingSummary: { licenses: [], privileges: [], compacts: [] },
    };
  }

  const [licenses, privilegeGrants, compactRecords] = await Promise.all([
    client.stateLicenseVerification.findMany({
      where: { clinicianId: { in: filteredIds } },
      orderBy: { updatedAt: 'desc' },
    }),
    client.privilegeGranted.findMany({
      where: { clinicianId: { in: filteredIds } },
      include: {
        privilegeRequest: {
          include: {
            privilegeSet: true,
            privilegeSetV2: {
              include: { privileges: true },
            },
          },
        },
      },
    }),
    client.compactEligibility.findMany({
      where: { clinicianId: { in: filteredIds }, eligible: true },
    }),
  ]);

  const licenseMap = groupBy(licenses, (license) => license.clinicianId);
  const privilegeMap = groupBy(privilegeGrants, (grant) => grant.clinicianId);
  const compactMap = groupBy(compactRecords, (record) => record.clinicianId);

  const licenseMissingCounter = new Map<string, number>();
  const privilegeMissingCounter = new Map<string, number>();
  const compactMissingCounter = new Map<string, number>();

  const readinessThreshold = requirement.readinessThreshold ?? DEFAULT_READINESS_THRESHOLD;

  const clinicians = filteredIds
    .map((clinicianId) => {
      const profile = profileMap.get(clinicianId);
      const readiness = readinessMap.get(clinicianId);
      const readinessScore = readiness?.score ?? 0;

      const clinicianLicenses = licenseMap.get(clinicianId) ?? [];
      const activeStates = collectActiveLicenseStates(clinicianLicenses);
      const missingStates = diff(requirement.licenseStates, activeStates);

      const privilegeCodes = collectPrivilegeCodes(privilegeMap.get(clinicianId) ?? []);
      const missingPrivileges = diff(requirement.privilegeCodes, privilegeCodes);
      const satisfiedPrivileges = requirement.privilegeCodes.filter((code) =>
        privilegeCodes.includes(code),
      );

      const compactTypes = (compactMap.get(clinicianId) ?? []).map((record) =>
        record.compact.toUpperCase(),
      );
      const missingCompacts = diff(requirement.compactTypes, compactTypes);

      incrementCounter(licenseMissingCounter, missingStates);
      incrementCounter(privilegeMissingCounter, missingPrivileges);
      incrementCounter(compactMissingCounter, missingCompacts);

      const eligible =
        readinessScore >= readinessThreshold &&
        missingStates.length === 0 &&
        missingPrivileges.length === 0 &&
        missingCompacts.length === 0;

      const privilegeReasons =
        missingPrivileges.length > 0
          ? missingPrivileges.map((code) => `Missing ${code}`)
          : requirement.privilegeCodes.length > 0
            ? [
                `Meets ${satisfiedPrivileges.length}/${requirement.privilegeCodes.length} privilege requirements`,
              ]
            : ['No privilege prerequisites'];

      return {
        clinicianId,
        clinicianName: profile?.user?.name ?? null,
        orgId: profile?.orgId ?? null,
        specialty: profile?.specialty ?? null,
        readinessScore,
        eligible,
        licenseStates: {
          covered: activeStates,
          missing: missingStates,
          expiresSoon: hasLicenseExpiringSoon(clinicianLicenses),
          lastVerifiedAt: latestVerification(clinicianLicenses),
        },
        privilegeSummary: {
          satisfied: satisfiedPrivileges,
          missing: missingPrivileges,
        },
        compactSummary: {
          eligible: compactTypes,
          missing: missingCompacts,
        },
        missing: {
          licenses: missingStates,
          privileges: missingPrivileges,
          compacts: missingCompacts,
        },
        privilegeReasons,
      } satisfies ClinicianEligibility;
    })
    .sort((a, b) => b.readinessScore - a.readinessScore);

  return {
    requirement,
    clinicians,
    totalConsidered: readinessRecords.length,
    readinessThreshold,
    missingSummary: {
      licenses: counterToArray(licenseMissingCounter),
      privileges: counterToArray(privilegeMissingCounter),
      compacts: counterToArray(compactMissingCounter),
    },
  };
}

async function loadShiftRequirement(client: PrismaClient, shiftId: string): Promise<{
  requirement: ShiftRequirement;
}> {
  if (!shiftId) {
    throw new Error('shiftId is required');
  }

  const demand = await client.workforceDemand.findUnique({
    where: { id: shiftId },
  });

  if (!demand) {
    throw new Error(`Shift ${shiftId} not found`);
  }

  const location = (demand.location as Record<string, unknown> | null) ?? null;
  const locationStates = normalizeStateList([
    typeof location?.state === 'string' ? location.state : undefined,
    ...(Array.isArray(location?.states) ? (location?.states as string[]) : []),
  ]);

  const requirement: ShiftRequirement = {
    shiftId,
    orgId: demand.orgId ?? undefined,
    role: demand.role ?? null,
    licenseStates: dedupeStrings([...locationStates]),
    privilegeCodes: dedupeStrings(demand.privilegeCodes ?? []),
    compactTypes: dedupeStrings((demand.requiredCompacts ?? []).map((item) => item.toUpperCase())),
    readinessThreshold: undefined,
    start: demand.shiftStart?.toISOString(),
    end: demand.shiftEnd?.toISOString(),
    urgency: demand.urgency ?? null,
  };

  if (requirement.licenseStates.length === 0 && location?.city) {
    requirement.licenseStates.push(String(location.city).toUpperCase());
  }

  return { requirement };
}

function groupBy<TEntry, TKey extends string | number>(
  entries: TEntry[],
  selector: (entry: TEntry) => TKey,
): Map<TKey, TEntry[]> {
  const map = new Map<TKey, TEntry[]>();
  for (const entry of entries) {
    const key = selector(entry);
    const bucket = map.get(key) ?? [];
    bucket.push(entry);
    map.set(key, bucket);
  }
  return map;
}

function collectActiveLicenseStates(
  licenses: Prisma.StateLicenseVerificationGetPayload<{}>[],
): string[] {
  return licenses
    .filter((license) => isLicenseActive(license))
    .map((license) => normalizeStateCode(license.state))
    .filter(Boolean);
}

function isLicenseActive(license: Prisma.StateLicenseVerificationGetPayload<{}>): boolean {
  const status = (license.status ?? '').toUpperCase();
  if (status && !['ACTIVE', 'CURRENT', 'CLEAR'].includes(status)) {
    return false;
  }
  if (license.expiryDate) {
    return license.expiryDate.getTime() > Date.now();
  }
  return true;
}

function hasLicenseExpiringSoon(
  licenses: Prisma.StateLicenseVerificationGetPayload<{}>[],
): boolean {
  return licenses.some((license) => {
    if (!license.expiryDate) return false;
    const diffDays = (license.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays <= EXPIRES_SOON_DAYS;
  });
}

function latestVerification(
  licenses: Prisma.StateLicenseVerificationGetPayload<{}>[],
): string | undefined {
  const timestamps = licenses
    .map((license) => license.verifiedAt ?? license.updatedAt ?? license.createdAt)
    .filter(Boolean) as Date[];
  if (!timestamps.length) {
    return undefined;
  }
  const latest = timestamps.reduce((acc, value) => {
    if (!acc || value.getTime() > acc.getTime()) {
      return value;
    }
    return acc;
  });
  return latest?.toISOString();
}

function collectPrivilegeCodes(grants: PrivilegeGrantRecord[]): string[] {
  const codes = new Set<string>();
  for (const grant of grants) {
    const setCodes =
      derivePrivilegeCodesFromSetV2(grant.privilegeRequest?.privilegeSetV2) ??
      derivePrivilegeCodesFromSet(grant.privilegeRequest?.privilegeSet);
    setCodes.forEach((code) => codes.add(code));
  }
  return Array.from(codes);
}

function derivePrivilegeCodesFromSet(
  setRecord: { procedures?: Array<{ code?: string | null }> } | null | undefined,
): string[] {
  if (!setRecord?.procedures) return [];
  return setRecord.procedures
    .map((procedure) => normalizePrivilegeCode(procedure?.code))
    .filter(Boolean);
}

function derivePrivilegeCodesFromSetV2(
  privilegeSet?:
    | {
        privileges: Array<{ privilegeCode: string }>;
      }
    | null,
): string[] | null {
  if (!privilegeSet) return null;
  return privilegeSet.privileges
    .map((record) => normalizePrivilegeCode(record.privilegeCode))
    .filter(Boolean);
}

function normalizePrivilegeCode(code?: string | null): string {
  if (!code) return '';
  return code
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
}

function diff(required: string[], owned: string[]): string[] {
  if (!required.length) return [];
  const ownedSet = new Set(owned.map((value) => value.toUpperCase()));
  return required.filter((value) => !ownedSet.has(value.toUpperCase()));
}

function normalizeStateCode(state?: string | null): string {
  if (!state) return '';
  return state.toUpperCase();
}

function normalizeStateList(values: Array<string | undefined>): string[] {
  return values
    .map((value) => normalizeStateCode(value))
    .filter((value): value is string => Boolean(value));
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const normalized = value?.toUpperCase?.() ?? value;
    if (!normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function incrementCounter(counter: Map<string, number>, items: string[]): void {
  items.forEach((item) => {
    const normalized = item.toUpperCase();
    counter.set(normalized, (counter.get(normalized) ?? 0) + 1);
  });
}

function counterToArray(counter: Map<string, number>): Array<{ item: string; count: number }> {
  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([item, count]) => ({ item, count }));
}










