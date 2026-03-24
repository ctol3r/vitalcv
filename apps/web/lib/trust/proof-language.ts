import type { PassportData } from '@/app/passport/[id]/page';

export type PassportFreshnessEntry = {
  layer: string;
  checkedAt: string | null;
  source: string;
  stale: boolean;
  unchecked: boolean;
};

export type PassportFreshnessState = 'current' | 'partial' | 'stale';

export function formatProofDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
}

export function formatQuarter(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const quarter = Math.floor(parsed.getMonth() / 3) + 1;
  return `Q${quarter} ${parsed.getFullYear()}`;
}

export function joinNoteParts(parts: Array<string | null | undefined>): string | undefined {
  const values = parts.filter((part): part is string => Boolean(part && part.trim()));
  return values.length > 0 ? values.join(' · ') : undefined;
}

export function formatAsOfDate(value?: string | null): string | null {
  const date = formatProofDate(value);
  return date ? `as of ${date}` : null;
}

export function formatAsOfQuarter(
  observedAt?: string | null,
  dataVersion?: string | null,
): string | null {
  const quarter = dataVersion ?? formatQuarter(observedAt);
  return quarter ? `as of ${quarter}` : null;
}

export function formatCompactProofDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function renderAttachedRecordFreshness(checkedAt?: string | null): string {
  return checkedAt ? 'Current attached record' : 'No attached record';
}

export function renderAttachedCheckFreshness(checkedAt?: string | null): string {
  return checkedAt ? 'Current attached check' : 'No attached check';
}

export function renderCredentialGroupFreshness(
  credentials: PassportData['authority']['credentials'],
): string {
  if (credentials.length === 0) {
    return 'No attached record';
  }

  return credentials.some((credential) => credential.stale)
    ? 'Mixed freshness'
    : 'Within freshness window';
}

function latestObservedAt(
  credentials: PassportData['authority']['credentials'],
): string | null {
  const values = credentials
    .map((credential) => credential.observedAt ?? credential.verifiedAt ?? null)
    .filter((value): value is string => Boolean(value));

  if (values.length === 0) {
    return null;
  }

  return values.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

export function buildPassportFreshnessEntries(
  passport: PassportData,
): PassportFreshnessEntry[] {
  const licensureCredentials = passport.authority.credentials.filter(
    (credential) => credential.domain === 'LICENSURE',
  );
  const licensureCheckedAt = latestObservedAt(licensureCredentials);
  const pecosEnrollmentStatus = passport.standing.pecosEnrollmentStatus ?? (
    passport.standing.pecosStatus === 'enrolled'
      ? 'ENROLLED'
      : passport.standing.pecosStatus === 'not_enrolled'
        ? 'NOT_FOUND'
        : 'UNCHECKED'
  );

  return [
    {
      layer: 'Identity (NPPES)',
      checkedAt: passport.lastCheckedAt ?? null,
      source: 'CMS NPPES',
      stale: isStale(passport.lastCheckedAt, 30),
      unchecked: !passport.lastCheckedAt,
    },
    {
      layer: 'Safety (OIG)',
      checkedAt: passport.standing.exclusionCheckedAt ?? null,
      source: 'OIG LEIE',
      stale: isStale(passport.standing.exclusionCheckedAt, 90),
      unchecked: passport.standing.exclusionStatus === 'UNCHECKED',
    },
    {
      layer: 'Authority (Licenses)',
      checkedAt: licensureCheckedAt,
      source: 'State Boards / FSMB',
      stale: licensureCredentials.length > 0 && licensureCredentials.some((credential) => credential.stale),
      unchecked: licensureCredentials.length === 0,
    },
    {
      layer: 'Eligibility (PECOS)',
      checkedAt: passport.standing.enrollmentObservedAt ?? null,
      source: passport.standing.enrollmentSourceLabel ?? 'CMS PECOS',
      stale: false,
      unchecked: pecosEnrollmentStatus === 'UNCHECKED',
    },
  ];
}

export function summarizePassportFreshnessEntries(
  entries: PassportFreshnessEntry[],
): {
  state: PassportFreshnessState;
  label: string;
} {
  if (entries.some((entry) => entry.stale)) {
    return { state: 'stale', label: 'Stale sources present' };
  }

  if (entries.some((entry) => entry.unchecked)) {
    return { state: 'partial', label: 'Partial source coverage' };
  }

  return { state: 'current', label: 'Current attached checks' };
}

function isStale(value?: string | null, maxAgeDays = 90): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return false;

  return Date.now() - timestamp > maxAgeDays * 24 * 60 * 60 * 1000;
}
