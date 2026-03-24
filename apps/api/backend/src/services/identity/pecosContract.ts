import type { EnrollmentValue } from './evidenceModel';
import { getSource } from './sourceCatalog';

export type PecosEnrollmentStatus = EnrollmentValue['claimState'];

export const PECOS_SOURCE_ID = 'PECOS_PUBLIC' as const;
export const PECOS_SOURCE_LABEL = 'CMS PECOS' as const;
export const PECOS_SOURCE_NAME = 'PECOS' as const;
export const PECOS_SOURCE_UNAVAILABLE = 'PECOS_UNAVAILABLE' as const;
export const PECOS_SOURCE_LATENCY = 'QUARTERLY' as const;
export const PECOS_DATA_FRESHNESS = 'QUARTERLY' as const;
export const PECOS_SOURCE_DISCLAIMER =
  'Medicare enrollment status is point-in-time quarterly PECOS data and may lag current enrollment changes.';

export type PecosFetchedRecord = {
  claimState: PecosEnrollmentStatus;
  enrolled: boolean | null;
  enrollmentType: string | null;
  eligibleToOrderRefer: boolean | null;
  source: typeof PECOS_SOURCE_NAME | typeof PECOS_SOURCE_UNAVAILABLE;
  npi: string;
  observedAt: string;
  dataVersion: string | null;
  sourceLatency: typeof PECOS_SOURCE_LATENCY;
  dataFreshness: typeof PECOS_DATA_FRESHNESS;
  revalidationDue: string | null;
};

export type PecosArtifactSnapshot = Readonly<{
  checked: boolean;
  status: PecosEnrollmentStatus;
  observedAt: string | null;
  dataVersion: string | null;
  revalidationDue: string | null;
}>;

type PecosArtifactLike = {
  status?: string | null;
  rawPayload?: unknown;
  verifiedAt?: string | Date | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function isoDateValue(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }

  const normalized = stringValue(value);
  if (!normalized) {
    return null;
  }

  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = stringValue(value)?.toUpperCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'TRUE' || normalized === 'YES' || normalized === 'Y') {
    return true;
  }
  if (normalized === 'FALSE' || normalized === 'NO' || normalized === 'N') {
    return false;
  }

  return null;
}

function isUnavailableSource(source: unknown): boolean {
  return stringValue(source)?.toUpperCase() === PECOS_SOURCE_UNAVAILABLE;
}

function pecosRefreshSlaHours(): number {
  return getSource(PECOS_SOURCE_ID)?.refreshSlaHours ?? 2160;
}

function pecosRevalidationDueThresholdDays(): number {
  const raw = Number.parseInt(
    process.env.PECOS_REVALIDATION_DUE_THRESHOLD_DAYS ?? '',
    10,
  );

  return Number.isFinite(raw) && raw >= 0 ? raw : 30;
}

export function normalizePecosQuarterVersion(
  value: string | null | undefined,
): string | null {
  const normalized = stringValue(value);
  if (!normalized) {
    return null;
  }

  const compactMatch =
    normalized.match(/\b([12]\d{3})[-_ ]?Q([1-4])\b/i)
    ?? normalized.match(/\bQ([1-4])[-_ ]?([12]\d{3})\b/i)
    ?? normalized.match(/\bQ([1-4])\s+([12]\d{3})\b/i)
    ?? normalized.match(/\b([12]\d{3})\s+Q([1-4])\b/i);

  if (compactMatch) {
    const first = compactMatch[1] ?? '';
    const second = compactMatch[2] ?? '';
    const year = first.length === 4 ? first : second;
    const quarter = first.toUpperCase().startsWith('Q') ? first.slice(1) : second;
    if (year && quarter) {
      return `${year}-Q${quarter}`;
    }
  }

  const parsed = Date.parse(normalized);
  if (!Number.isNaN(parsed)) {
    const date = new Date(parsed);
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    return `${date.getUTCFullYear()}-Q${quarter}`;
  }

  return normalized;
}

export function formatPecosQuarterLabel(
  value: string | null | undefined,
): string | null {
  const normalized = normalizePecosQuarterVersion(value);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^([12]\d{3})-Q([1-4])$/i);
  if (!match) {
    return normalized;
  }

  return `Q${match[2]} ${match[1]}`;
}

export function normalizePecosEnrollmentStatus(input: {
  claimState?: unknown;
  enrolled?: boolean | null;
  source?: unknown;
}): PecosEnrollmentStatus {
  const explicit = stringValue(input.claimState)?.toUpperCase();
  if (explicit === 'ENROLLED') return 'ENROLLED';
  if (explicit === 'NOT_FOUND' || explicit === 'ENROLLMENT_NOT_FOUND') return 'NOT_FOUND';
  if (explicit === 'UNKNOWN') return 'UNKNOWN';
  if (explicit === 'UNCHECKED') return 'UNCHECKED';
  if (input.enrolled === true) return 'ENROLLED';
  if (input.enrolled === false) {
    return isUnavailableSource(input.source) ? 'UNKNOWN' : 'NOT_FOUND';
  }
  return 'UNKNOWN';
}

export function computePecosRevalidationDue(input: {
  status: PecosEnrollmentStatus;
  observedAt?: string | Date | null;
}): string | null {
  if (input.status === 'UNCHECKED') {
    return null;
  }

  const observedAt = isoDateValue(input.observedAt);
  if (!observedAt) {
    return null;
  }

  const base = Date.parse(observedAt);
  if (!Number.isFinite(base)) {
    return null;
  }

  return new Date(base + pecosRefreshSlaHours() * 60 * 60 * 1000).toISOString();
}

export function isPecosFresh(input: {
  status: PecosEnrollmentStatus;
  revalidationDue?: string | null;
  observedAt?: string | Date | null;
}, now: Date = new Date()): boolean {
  const due =
    isoDateValue(input.revalidationDue)
    ?? computePecosRevalidationDue({
      status: input.status,
      observedAt: input.observedAt,
    });

  if (!due) {
    return false;
  }

  return Date.parse(due) > now.getTime();
}

export function pecosRevalidationDaysRemaining(
  revalidationDue: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const due = isoDateValue(revalidationDue);
  if (!due) {
    return null;
  }

  const dueMs = Date.parse(due);
  if (!Number.isFinite(dueMs)) {
    return null;
  }

  const deltaMs = dueMs - now.getTime();
  return Math.ceil(deltaMs / (24 * 60 * 60 * 1000));
}

export function isPecosRevalidationDueSoon(input: {
  status: PecosEnrollmentStatus;
  revalidationDue?: string | null;
  observedAt?: string | Date | null;
  thresholdDays?: number | null;
}, now: Date = new Date()): boolean {
  if (!isPecosFresh({
    status: input.status,
    revalidationDue: input.revalidationDue,
    observedAt: input.observedAt,
  }, now)) {
    return false;
  }

  const daysRemaining = pecosRevalidationDaysRemaining(
    input.revalidationDue
      ?? computePecosRevalidationDue({
        status: input.status,
        observedAt: input.observedAt,
      }),
    now,
  );
  if (daysRemaining === null) {
    return false;
  }

  const thresholdDays = input.thresholdDays ?? pecosRevalidationDueThresholdDays();
  return daysRemaining <= thresholdDays;
}

export function buildPecosFreshnessLabel(input: {
  status: PecosEnrollmentStatus;
  revalidationDue?: string | null;
  observedAt?: string | Date | null;
  thresholdDays?: number | null;
}, now: Date = new Date()): string {
  if (!isPecosFresh({
    status: input.status,
    revalidationDue: input.revalidationDue,
    observedAt: input.observedAt,
  }, now)) {
    return 'Stale — refresh required';
  }

  const daysRemaining = pecosRevalidationDaysRemaining(
    input.revalidationDue
      ?? computePecosRevalidationDue({
        status: input.status,
        observedAt: input.observedAt,
      }),
    now,
  );

  if (
    daysRemaining !== null
    && isPecosRevalidationDueSoon({
      status: input.status,
      revalidationDue: input.revalidationDue,
      observedAt: input.observedAt,
      thresholdDays: input.thresholdDays,
    }, now)
  ) {
    if (daysRemaining <= 0) {
      return 'Revalidation due now';
    }
    return `Revalidation due in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
  }

  return 'Quarterly';
}

export function resolvePecosCurrentStatus(input: {
  checked: boolean;
  status: PecosEnrollmentStatus;
  fresh: boolean;
}): PecosEnrollmentStatus {
  if (!input.checked) {
    return 'UNCHECKED';
  }
  if (!input.fresh) {
    return 'UNKNOWN';
  }
  return input.status;
}

export function isUnresolvedPecosStatus(
  status: PecosEnrollmentStatus,
): boolean {
  return status === 'UNKNOWN' || status === 'UNCHECKED';
}

export function buildPecosStatusLabel(
  status: PecosEnrollmentStatus,
  dataVersion: string | null | undefined,
): string {
  const quarterLabel = formatPecosQuarterLabel(dataVersion);
  const suffix = quarterLabel
    ? `as of ${quarterLabel}`
    : 'as of the latest quarterly CMS PECOS release';

  if (status === 'ENROLLED') {
    return `Medicare enrolled — ${suffix}`;
  }
  if (status === 'NOT_FOUND') {
    return `Medicare enrollment not found in quarterly PECOS snapshot — ${suffix}`;
  }
  if (status === 'UNCHECKED') {
    return `Medicare enrollment not yet checked — ${suffix}`;
  }
  return `Medicare enrollment unresolved — ${suffix}`;
}

export function buildPecosEnrollmentNote(
  status: PecosEnrollmentStatus,
  dataVersion?: string | null,
): string {
  const quarterLabel = formatPecosQuarterLabel(dataVersion);
  const versionSuffix = quarterLabel ? ` — ${quarterLabel}` : '';

  if (status === 'ENROLLED') {
    return `Medicare enrolled${versionSuffix}`;
  }
  if (status === 'NOT_FOUND') {
    return quarterLabel
      ? `Not found in the quarterly CMS PECOS release (${quarterLabel}) — may indicate non-enrollment or publication lag`
      : 'Not found in the quarterly CMS PECOS release — may indicate non-enrollment or publication lag';
  }
  if (status === 'UNCHECKED') {
    return 'Medicare enrollment has not been checked';
  }
  return 'Enrollment status could not be resolved from the current quarterly PECOS data';
}

export function pecosCoverageReason(input: {
  status: PecosEnrollmentStatus;
  checked: boolean;
  fresh: boolean;
  daysRemaining?: number | null;
}): string {
  if (!input.checked) {
    return 'PECOS enrollment source not yet checked';
  }
  if (!input.fresh) {
    return 'PECOS evidence is stale and must be refreshed';
  }
  if (input.daysRemaining !== null && input.daysRemaining !== undefined) {
    if (input.daysRemaining <= 0) {
      return 'PECOS revalidation is due now and should be refreshed';
    }
    if (input.daysRemaining <= pecosRevalidationDueThresholdDays()) {
      return `PECOS revalidation due in ${input.daysRemaining} day${input.daysRemaining === 1 ? '' : 's'}`;
    }
  }
  if (input.status === 'NOT_FOUND') {
    return 'PECOS quarterly release does not show Medicare enrollment for this NPI';
  }
  if (input.status === 'UNKNOWN') {
    return 'PECOS enrollment outcome could not be resolved from the quarterly release';
  }
  if (input.status === 'UNCHECKED') {
    return 'PECOS enrollment source has not been checked yet';
  }
  return 'PECOS quarterly enrollment checked';
}

export function pecosBlocker(
  status: PecosEnrollmentStatus,
): string | null {
  return status === 'NOT_FOUND' ? 'PECOS quarterly enrollment not found' : null;
}

export function pecosGap(input: {
  status: PecosEnrollmentStatus;
  checked: boolean;
  fresh: boolean;
  daysRemaining?: number | null;
}): string | null {
  if (!input.checked || input.status === 'UNCHECKED') {
    return 'PECOS enrollment not yet checked';
  }
  if (!input.fresh) {
    return 'PECOS enrollment verification stale';
  }
  if (input.daysRemaining !== null && input.daysRemaining !== undefined) {
    if (input.daysRemaining <= 0) {
      return 'PECOS revalidation due now';
    }
    if (input.daysRemaining <= pecosRevalidationDueThresholdDays()) {
      return `PECOS revalidation due in ${input.daysRemaining} day${input.daysRemaining === 1 ? '' : 's'}`;
    }
  }
  if (input.status === 'UNKNOWN') {
    return 'PECOS enrollment outcome unresolved';
  }
  return null;
}

export function pecosReadinessStatus(
  status: PecosEnrollmentStatus,
): string | null {
  if (status === 'NOT_FOUND') {
    return 'Blocked — PECOS quarterly enrollment not found';
  }
  if (status === 'UNKNOWN') {
    return 'Unresolved — PECOS enrollment outcome is unknown';
  }
  if (status === 'UNCHECKED') {
    return 'Unresolved — PECOS enrollment has not been checked';
  }
  return null;
}

export function buildPecosSingleProviderQueryUrl(npi: string): string {
  const normalizedNpi = npi.trim();
  return `https://data.cms.gov/data-api/v1/dataset/2457ea29-fc82-48b0-86ec-3b0755de7515/data?filter%5BNPI%5D=${encodeURIComponent(normalizedNpi)}&size=5`;
}

export function buildPecosFetchedRecord(input: {
  npi: string;
  row?: Record<string, unknown> | null;
  fetchedAt: string;
  lastModified?: string | null;
  unavailable?: boolean;
}): PecosFetchedRecord {
  const observedAt = isoDateValue(input.fetchedAt) ?? new Date().toISOString();
  const dataVersion = normalizePecosQuarterVersion(input.lastModified ?? null);
  const status = input.unavailable
    ? 'UNKNOWN'
    : input.row
      ? 'ENROLLED'
      : 'NOT_FOUND';

  return {
    claimState: status,
    enrolled:
      status === 'ENROLLED'
        ? true
        : status === 'NOT_FOUND'
          ? false
          : null,
    enrollmentType: stringValue(input.row?.ENRLMT_CLSFCTN_TYPE_DESC) ?? stringValue(input.row?.enrollmentType),
    eligibleToOrderRefer: booleanValue(input.row?.eligibleToOrderRefer),
    source: input.unavailable ? PECOS_SOURCE_UNAVAILABLE : PECOS_SOURCE_NAME,
    npi: input.npi,
    observedAt,
    dataVersion,
    sourceLatency: PECOS_SOURCE_LATENCY,
    dataFreshness: PECOS_DATA_FRESHNESS,
    revalidationDue: computePecosRevalidationDue({
      status,
      observedAt,
    }),
  };
}

export function extractPecosArtifactSnapshot(
  artifact: PecosArtifactLike | null | undefined,
): PecosArtifactSnapshot {
  if (!artifact) {
    return Object.freeze({
      checked: false,
      status: 'UNCHECKED' as const,
      observedAt: null,
      dataVersion: null,
      revalidationDue: null,
    });
  }

  const payload = asRecord(artifact.rawPayload);
  const claims = Array.isArray(payload._claims) ? payload._claims : [];
  let claimValue: Record<string, unknown> = {};

  for (const claim of claims) {
    const claimRecord = asRecord(claim);
    if (claimRecord.claimType === 'ENROLLMENT_STATUS') {
      claimValue = asRecord(claimRecord.value);
      break;
    }
  }

  const statusFromClaim = normalizePecosEnrollmentStatus({
    claimState: claimValue.claimState,
    enrolled:
      typeof claimValue.enrolled === 'boolean'
        ? claimValue.enrolled
        : null,
    source: claimValue.source ?? payload.source,
  });
  const normalizedArtifactStatus = stringValue(artifact.status)?.toUpperCase();
  const status =
    statusFromClaim === 'UNKNOWN' && normalizedArtifactStatus === 'NOT_FOUND'
      ? 'NOT_FOUND'
      : statusFromClaim;
  const observedAt =
    isoDateValue(claimValue.observedAt)
    ?? isoDateValue(payload.observedAt)
    ?? isoDateValue(payload._ingestedAt)
    ?? isoDateValue(artifact.verifiedAt);
  const dataVersion = normalizePecosQuarterVersion(
    stringValue(claimValue.dataVersion)
    ?? stringValue(payload.dataVersion),
  );
  const revalidationDue =
    isoDateValue(payload.revalidationDue)
    ?? computePecosRevalidationDue({
      status,
      observedAt,
    });

  return Object.freeze({
    checked: true,
    status,
    observedAt,
    dataVersion,
    revalidationDue,
  });
}
