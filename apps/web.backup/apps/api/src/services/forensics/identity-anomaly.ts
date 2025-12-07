import { PrismaClient, Prisma, DriftType, DriftSeverity } from '@prisma/client';

import {
  buildSignalId,
  clampScore,
  ForensicsSignal,
  ForensicsSeverity,
  scoreFromSeverity,
  severityFromScore,
} from './types';

const prisma = new PrismaClient();
const DEFAULT_LOOKBACK_DAYS = 180;
const LICENSE_WINDOW_DAYS = 90;

export interface IdentityAnomalyOptions {
  prisma?: PrismaClient;
  now?: Date;
  lookbackDays?: number;
  clinician?: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>;
}

export async function detectIdentityAnomalies(
  clinicianId: string,
  options: IdentityAnomalyOptions = {},
): Promise<ForensicsSignal[]> {
  if (!clinicianId) {
    throw new Error('clinicianId is required to detect identity anomalies');
  }

  const client = options.prisma ?? prisma;
  const now = options.now ?? new Date();
  const lookbackStart = daysAgo(options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS, now);

  const clinician =
    options.clinician ??
    (await client.clinicianProfile.findUnique({
      where: { id: clinicianId },
      include: { user: true },
    }));

  if (!clinician) {
    throw new Error(`Clinician ${clinicianId} not found for identity anomalies`);
  }

  const [nameDriftEvents, addressDriftEvents, boardCredentials, licenseRecords] = await Promise.all([
    client.driftEvent.findMany({
      where: {
        clinicianId,
        driftType: { in: [DriftType.NPPES_DRIFT, DriftType.NAME_MISMATCH] },
        detectedAt: { gte: lookbackStart },
      },
      orderBy: { detectedAt: 'desc' },
      take: 12,
    }),
    client.driftEvent.findMany({
      where: {
        clinicianId,
        driftType: DriftType.ADDRESS_DRIFT,
        detectedAt: { gte: lookbackStart },
      },
      orderBy: { detectedAt: 'desc' },
      take: 12,
    }),
    clinician.userId
      ? client.credential.findMany({
          where: {
            userId: clinician.userId,
            type: { contains: 'board', mode: 'insensitive' },
          },
          orderBy: { issuedAt: 'desc' },
          take: 6,
        })
      : Promise.resolve([]),
    client.stateLicenseVerification.findMany({
      where: {
        clinicianId,
        issueDate: { not: null, gte: daysAgo(LICENSE_WINDOW_DAYS, now) },
      },
      orderBy: { issueDate: 'desc' },
      take: 20,
    }),
  ]);

  const signals: ForensicsSignal[] = [];

  if (nameDriftEvents.length) {
    signals.push(buildNameDriftSignal(clinicianId, nameDriftEvents));
  }

  const addressSignal = buildAddressMismatchSignal(clinician, boardCredentials, addressDriftEvents);
  if (addressSignal) {
    signals.push(addressSignal);
  }

  const velocitySignal = buildLicenseVelocitySignal(clinicianId, licenseRecords, now);
  if (velocitySignal) {
    signals.push(velocitySignal);
  }

  return signals;
}

function buildNameDriftSignal(
  clinicianId: string,
  events: Prisma.DriftEventGetPayload<{}>[],
): ForensicsSignal {
  const weighted = events.map((event) => weightDrift(event.severity));
  const averageScore = clampScore(
    weighted.reduce((sum, value) => sum + value, 0) / Math.max(1, weighted.length),
  );
  const severity = severityFromScore(averageScore);

  return {
    id: buildSignalId('identity', 'name_drift_vs_npi_history'),
    clinicianId,
    category: 'identity',
    type: 'name_drift_vs_npi_history',
    severity,
    score: averageScore,
    description: `Detected ${events.length} name/NPI drift events in the last ${DEFAULT_LOOKBACK_DAYS} days.`,
    observedAt: events[0]?.detectedAt.toISOString() ?? new Date().toISOString(),
    metadata: {
      sample: events.slice(0, 3).map((event) => ({
        severity: event.severity,
        detectedAt: event.detectedAt.toISOString(),
        summary: coerceMetadataField(event.metadata, 'summary'),
      })),
      recentEvents: events.length,
    },
  };
}

function buildAddressMismatchSignal(
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>,
  boardCredentials: Prisma.CredentialGetPayload<{}>[],
  driftEvents: Prisma.DriftEventGetPayload<{}>[],
): ForensicsSignal | null {
  const clinicianAddress = buildAddressFingerprint({
    line1: (clinician as any).addressLine1 ?? null,
    city: (clinician as any).city ?? null,
    state: (clinician as any).state ?? null,
    postalCode: (clinician as any).postalCode ?? null,
  });

  if (!clinicianAddress && driftEvents.length === 0 && boardCredentials.length === 0) {
    return null;
  }

  const boardAddresses = boardCredentials
    .map((credential) => extractAddressFingerprint(credential.metadata))
    .filter(Boolean) as string[];

  const mismatches = clinicianAddress
    ? boardAddresses.filter((address) => address !== clinicianAddress)
    : boardAddresses;

  const driftScore = driftEvents.length
    ? clampScore(
        driftEvents.reduce((sum, event) => sum + weightDrift(event.severity), 0) /
          Math.max(1, driftEvents.length),
      )
    : 0;

  const mismatchRatio = boardAddresses.length
    ? clampScore(mismatches.length / boardAddresses.length)
    : 0;

  const compositeScore = clampScore((mismatchRatio * 0.7 + driftScore * 0.3) || 0);
  if (!compositeScore) {
    return null;
  }

  return {
    id: buildSignalId('identity', 'address_vs_board_records'),
    clinicianId: clinician.id,
    category: 'identity',
    type: 'address_vs_board_records',
    severity: severityFromScore(compositeScore),
    score: compositeScore,
    description:
      mismatches.length > 0
        ? `${mismatches.length} board-record addresses disagree with clinician demographics.`
        : 'Board records lack verifiable practice addresses despite address drift events.',
    observedAt:
      driftEvents[0]?.detectedAt.toISOString() ??
      boardCredentials[0]?.issuedAt?.toISOString() ??
      new Date().toISOString(),
    metadata: {
      clinicianAddress,
      boardAddresses,
      mismatchedAddresses: mismatches.slice(0, 5),
      driftEvents: driftEvents.slice(0, 3).map((event) => ({
        severity: event.severity,
        detectedAt: event.detectedAt.toISOString(),
      })),
    },
  };
}

function buildLicenseVelocitySignal(
  clinicianId: string,
  licenses: Prisma.StateLicenseVerificationGetPayload<{}>[],
  now: Date,
): ForensicsSignal | null {
  if (!licenses.length) {
    return null;
  }

  const states = new Map<string, Date>();
  licenses.forEach((license) => {
    const state = typeof license.state === 'string' ? license.state.toUpperCase() : null;
    if (!state) {
      return;
    }
    const issuedAt =
      license.issueDate ??
      license.createdAt ??
      license.updatedAt ??
      license.verifiedAt ??
      now;
    const existing = states.get(state);
    if (!existing || issuedAt > existing) {
      states.set(state, issuedAt);
    }
  });

  if (!states.size) {
    return null;
  }

  const sorted = Array.from(states.values()).sort((a, b) => b.getTime() - a.getTime());
  const spanDays =
    sorted.length > 1
      ? Math.max(
          1,
          (sorted[0].getTime() - sorted[sorted.length - 1].getTime()) / (1000 * 60 * 60 * 24),
        )
      : 1;
  const statesPerMonth = (states.size / Math.max(1, spanDays / 30)).toFixed(2);
  const normalizedVelocity = clampScore(states.size / 4);

  if (normalizedVelocity < 0.25) {
    return null;
  }

  return {
    id: buildSignalId('identity', 'multi_state_license_velocity'),
    clinicianId,
    category: 'identity',
    type: 'multi_state_license_velocity',
    severity: severityFromScore(normalizedVelocity),
    score: normalizedVelocity,
    description: `Issued ${states.size} unique state licenses in ~${Math.round(spanDays)} days (${statesPerMonth} states/mo).`,
    observedAt: sorted[0]?.toISOString() ?? new Date().toISOString(),
    metadata: {
      states: Array.from(states.keys()),
      issuedAt: sorted.map((date) => date.toISOString()),
      windowDays: LICENSE_WINDOW_DAYS,
    },
  };
}

function daysAgo(days: number, now: Date): Date {
  const clone = new Date(now);
  clone.setDate(now.getDate() - days);
  return clone;
}

function weightDrift(severity: DriftSeverity): number {
  switch (severity) {
    case DriftSeverity.CRITICAL:
      return scoreFromSeverity('high');
    case DriftSeverity.HIGH:
      return 0.8;
    case DriftSeverity.MEDIUM:
      return 0.55;
    default:
      return scoreFromSeverity('low');
  }
}

function buildAddressFingerprint(input: {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
} | null): string | null {
  if (!input) {
    return null;
  }
  const parts = [input.line1, input.city, input.state, normalizePostalCode(input.postalCode)]
    .map((value) => (typeof value === 'string' ? value.trim().toUpperCase() : ''))
    .filter(Boolean);
  if (!parts.length) {
    return null;
  }
  return parts.join('|');
}

function extractAddressFingerprint(metadata: Prisma.JsonValue | null | undefined): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  const record = metadata as Record<string, unknown>;
  const address =
    (record.address as Record<string, unknown> | undefined) ??
    (record.practiceAddress as Record<string, unknown> | undefined) ??
    record;
  return buildAddressFingerprint({
    line1: coerceString(address?.['line1'] ?? address?.['address1']),
    city: coerceString(address?.['city']),
    state: coerceString(address?.['state']),
    postalCode: coerceString(address?.['postalCode'] ?? address?.['zip']),
  });
}

function coerceString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length) {
    return value;
  }
  return null;
}

function normalizePostalCode(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.replace(/\s+/g, '').slice(0, 5);
}

function coerceMetadataField(metadata: Prisma.JsonValue | null | undefined, field: string) {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  const record = metadata as Record<string, unknown>;
  const value = record[field];
  if (typeof value === 'string') {
    return value;
  }
  return null;
}










