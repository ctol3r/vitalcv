import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { getCachedTrustState, type TrustBand } from '../trust/trustStateEngine';

export interface ClinicianAvailability {
  npi: string;
  specialty: string;
  locations: string[];
  availableFrom: string;
  availableUntil?: string;
  rateFloor?: number;
  urgency: 'immediate' | 'within_30_days' | 'within_90_days' | 'exploring';
  trustBand?: string;
  updatedAt: string;
}

type AvailabilityRow = {
  npi: string | null;
  specialty: string | null;
  state_of_practice: string | null;
  metadata: unknown;
};

const NPI_RE = /^\d{10}$/;
/**
 * Clerk-id namespace for platform-minted marketplace-availability placeholder
 * rows (`marketplace-availability:<npi>`). Exported so account-reconciliation
 * logic (workspaceService) can allowlist exactly these rows without hardcoding
 * — and drifting from — the prefix.
 */
export const AVAILABILITY_PLACEHOLDER_PREFIX = 'marketplace-availability';
const TRUST_BAND_ORDER: Record<'L0' | TrustBand, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeNpi(npi: string): string {
  const normalized = npi.trim();
  if (!NPI_RE.test(normalized)) {
    throw new Error('npi must be exactly 10 digits');
  }
  return normalized;
}

function normalizeState(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeLocations(locations: string[]): string[] {
  return [...new Set(locations.map(normalizeState).filter(Boolean))];
}

function normalizeUrgency(
  urgency: ClinicianAvailability['urgency'],
): ClinicianAvailability['urgency'] {
  if (
    urgency === 'immediate'
    || urgency === 'within_30_days'
    || urgency === 'within_90_days'
    || urgency === 'exploring'
  ) {
    return urgency;
  }

  throw new Error(`Unsupported urgency: ${urgency}`);
}

function normalizeTrustBand(value: unknown): ClinicianAvailability['trustBand'] {
  if (value === 'L1' || value === 'L2' || value === 'L3') {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim().toUpperCase();
  }

  return undefined;
}

function normalizeDate(value: string, field: 'availableFrom' | 'availableUntil'): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid ISO date`);
  }
  return parsed.toISOString();
}

function normalizeAvailability(
  npi: string,
  data: Omit<ClinicianAvailability, 'npi' | 'updatedAt'>,
): ClinicianAvailability {
  const normalizedNpi = normalizeNpi(npi);
  const specialty = data.specialty.trim();
  if (!specialty) {
    throw new Error('specialty is required');
  }

  const locations = normalizeLocations(data.locations);
  if (locations.length === 0) {
    throw new Error('locations must include at least one state');
  }

  const normalized: ClinicianAvailability = {
    npi: normalizedNpi,
    specialty,
    locations,
    availableFrom: normalizeDate(data.availableFrom, 'availableFrom'),
    urgency: normalizeUrgency(data.urgency),
    updatedAt: new Date().toISOString(),
  };

  if (data.availableUntil) {
    normalized.availableUntil = normalizeDate(data.availableUntil, 'availableUntil');
  }
  if (typeof data.rateFloor === 'number' && Number.isFinite(data.rateFloor)) {
    normalized.rateFloor = data.rateFloor;
  }
  if (data.trustBand) {
    normalized.trustBand = normalizeTrustBand(data.trustBand);
  }

  return normalized;
}

function availabilityFromMetadata(
  metadata: unknown,
  fallback: Pick<AvailabilityRow, 'npi' | 'specialty' | 'state_of_practice'>,
): ClinicianAvailability | null {
  const root = isRecord(metadata) ? metadata : null;
  const raw = root && isRecord(root.availability) ? root.availability : null;
  if (!raw) {
    return null;
  }

  const npi = typeof raw.npi === 'string' && raw.npi.trim().length > 0
    ? raw.npi.trim()
    : fallback.npi?.trim();
  const specialty = typeof raw.specialty === 'string' && raw.specialty.trim().length > 0
    ? raw.specialty.trim()
    : fallback.specialty?.trim();
  const locations = Array.isArray(raw.locations)
    ? normalizeLocations(raw.locations.filter((item): item is string => typeof item === 'string'))
    : fallback.state_of_practice
      ? [normalizeState(fallback.state_of_practice)]
      : [];
  const availableFrom = typeof raw.availableFrom === 'string' ? raw.availableFrom : null;
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : null;

  if (!npi || !specialty || !availableFrom || !updatedAt || locations.length === 0) {
    return null;
  }

  const availability: ClinicianAvailability = {
    npi,
    specialty,
    locations,
    availableFrom,
    urgency: normalizeUrgency(
      (typeof raw.urgency === 'string' ? raw.urgency : 'exploring') as ClinicianAvailability['urgency'],
    ),
    updatedAt,
  };

  if (typeof raw.availableUntil === 'string') {
    availability.availableUntil = raw.availableUntil;
  }
  if (typeof raw.rateFloor === 'number') {
    availability.rateFloor = raw.rateFloor;
  }
  availability.trustBand = normalizeTrustBand(raw.trustBand);

  return availability;
}

function meetsMinimumTrustBand(
  trustBand: string | undefined,
  minimum: 'L1' | 'L2' | 'L3' | undefined,
): boolean {
  if (!minimum) {
    return true;
  }

  if (!trustBand) {
    return false;
  }

  const normalizedTrustBand = trustBand === 'L1' || trustBand === 'L2' || trustBand === 'L3'
    ? trustBand
    : 'L0';
  return TRUST_BAND_ORDER[normalizedTrustBand] >= TRUST_BAND_ORDER[minimum];
}

function isAvailableByDate(
  availability: ClinicianAvailability,
  availableBy?: string,
): boolean {
  if (!availableBy) {
    return true;
  }

  const requestedDate = new Date(availableBy);
  if (Number.isNaN(requestedDate.getTime())) {
    return false;
  }

  const availableFrom = new Date(availability.availableFrom);
  if (availableFrom.getTime() > requestedDate.getTime()) {
    return false;
  }

  if (!availability.availableUntil) {
    return true;
  }

  return new Date(availability.availableUntil).getTime() >= requestedDate.getTime();
}

async function ensureProfileForAvailability(
  npi: string,
  specialty: string,
  stateOfPractice?: string,
): Promise<void> {
  const existing = await prisma.personProfile.findUnique({
    where: { npi },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  const clerkUserId = `${AVAILABILITY_PLACEHOLDER_PREFIX}:${npi}`;
  const email = `${AVAILABILITY_PLACEHOLDER_PREFIX}+${npi}@vitalcv.local`;
  const placeholderUser = await prisma.user.upsert({
    where: { clerkUserId },
    update: { email },
    create: {
      clerkUserId,
      email,
      role: 'CLINICIAN',
      status: 'INVITED',
    },
  });

  await prisma.personProfile.upsert({
    where: { userId: placeholderUser.id },
    update: {
      npi,
      specialty,
      ...(stateOfPractice ? { stateOfPractice } : {}),
      updatedAt: new Date(),
    },
    create: {
      userId: placeholderUser.id,
      npi,
      specialty,
      ...(stateOfPractice ? { stateOfPractice } : {}),
      completeness: 0,
    },
  });

  log('warn', 'matcha: availability_placeholder_profile_created', { npi });
}

async function fetchAvailabilityRows(query: { npi?: string } = {}): Promise<AvailabilityRow[]> {
  if (query.npi) {
    return prisma.$queryRawUnsafe<AvailabilityRow[]>(
      `
        SELECT "npi", "specialty", "state_of_practice", "metadata"
        FROM "person_profiles"
        WHERE "npi" = $1
      `,
      query.npi,
    );
  }

  return prisma.$queryRawUnsafe<AvailabilityRow[]>(
    `
      SELECT "npi", "specialty", "state_of_practice", "metadata"
      FROM "person_profiles"
      WHERE "metadata" -> 'availability' IS NOT NULL
    `,
  );
}

export async function setAvailability(
  npi: string,
  data: Omit<ClinicianAvailability, 'npi' | 'updatedAt'>,
): Promise<ClinicianAvailability> {
  const availability = normalizeAvailability(npi, data);
  await ensureProfileForAvailability(
    availability.npi,
    availability.specialty,
    availability.locations[0],
  );

  await prisma.personProfile.updateMany({
    where: { npi: availability.npi },
    data: {
      specialty: availability.specialty,
      stateOfPractice: availability.locations[0],
      updatedAt: new Date(),
    },
  });

  const patch = JSON.stringify({ availability: cloneJson(availability) });
  await prisma.$executeRawUnsafe(
    `
      UPDATE "person_profiles"
      SET "metadata" = COALESCE("metadata", '{}'::jsonb) || $1::jsonb,
          "updated_at" = NOW()
      WHERE "npi" = $2
    `,
    patch,
    availability.npi,
  );

  return availability;
}

export async function getAvailability(npi: string): Promise<ClinicianAvailability | null> {
  const normalizedNpi = normalizeNpi(npi);
  const rows = await fetchAvailabilityRows({ npi: normalizedNpi });
  const row = rows[0];
  if (!row) {
    return null;
  }

  return availabilityFromMetadata(row.metadata, row);
}

export async function searchAvailablePool(filter: {
  specialty?: string;
  state?: string;
  urgency?: string;
  trustBandMinimum?: 'L1' | 'L2' | 'L3';
  availableBy?: string;
}): Promise<ClinicianAvailability[]> {
  const rows = await fetchAvailabilityRows();
  const specialtyFilter = filter.specialty?.trim().toLowerCase();
  const stateFilter = filter.state ? normalizeState(filter.state) : undefined;
  const urgencyFilter = typeof filter.urgency === 'string' ? filter.urgency.trim() : undefined;

  const enriched = await Promise.all(rows.map(async (row) => {
    const availability = availabilityFromMetadata(row.metadata, row);
    if (!availability) {
      return null;
    }

    const trustState = await getCachedTrustState(availability.npi).catch(() => null);
    if (trustState) {
      availability.trustBand = trustState.readiness_level;
    }

    return availability;
  }));

  return enriched
    .filter((availability): availability is ClinicianAvailability => availability !== null)
    .filter((availability) => {
      if (specialtyFilter && availability.specialty.toLowerCase() !== specialtyFilter) {
        return false;
      }
      if (stateFilter && !availability.locations.includes(stateFilter)) {
        return false;
      }
      if (urgencyFilter && availability.urgency !== urgencyFilter) {
        return false;
      }
      if (!meetsMinimumTrustBand(availability.trustBand, filter.trustBandMinimum)) {
        return false;
      }
      return isAvailableByDate(availability, filter.availableBy);
    })
    .sort((left, right) => {
      const trustBandDelta = (TRUST_BAND_ORDER[right.trustBand as TrustBand] ?? 0)
        - (TRUST_BAND_ORDER[left.trustBand as TrustBand] ?? 0);
      if (trustBandDelta !== 0) {
        return trustBandDelta;
      }

      return left.availableFrom.localeCompare(right.availableFrom);
    });
}

export async function removeAvailability(npi: string): Promise<void> {
  const normalizedNpi = normalizeNpi(npi);
  await prisma.$executeRawUnsafe(
    `
      UPDATE "person_profiles"
      SET "metadata" = COALESCE("metadata", '{}'::jsonb) - 'availability',
          "updated_at" = NOW()
      WHERE "npi" = $1
    `,
    normalizedNpi,
  );
}
