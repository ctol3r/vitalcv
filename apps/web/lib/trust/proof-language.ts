import type { PassportData } from '@/lib/trust/passport-contract';
import { resolveAuthorityEvidenceStatus } from '@/lib/trust/passport-truth';
import {
  findPassportSourceCoverageChecks,
  findPriorityCanonicalSourceCoverage,
  sourceCoverageStateLabel,
  type PassportSourceCoverageCheck,
  type PassportSourceCoverageState,
} from '@/lib/trust/source-coverage';

export type PassportFreshnessEntry = {
  layer: string;
  checkedAt: string | null;
  source: string;
  stale: boolean;
  unchecked: boolean;
  sourceState: PassportSourceCoverageState | null;
  stateLabel: string | null;
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

  if (credentials.some((credential) => credential.stale)) {
    return 'Mixed freshness';
  }

  const statuses = credentials.map(resolveAuthorityEvidenceStatus);
  if (statuses.some((status) => status === 'review_required' || status === 'blocked')) {
    return 'Needs review';
  }
  if (statuses.some((status) => status === 'access_required')) {
    return 'Access required';
  }
  if (statuses.some((status) => status === 'unavailable' || status === 'pending')) {
    return 'Missing data';
  }

  return 'Within freshness window';
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

const COVERAGE_LAYER_PRIORITIES: readonly PassportSourceCoverageState[] = [
  'checked',
  'stale',
  'reviewRequired',
  'accessRequired',
  'unavailable',
  'gated',
  'notDecisionGrade',
  'previewOnly',
  'pending',
];

const NPPES_ALIASES = ['NPPES', 'NPPES_API', 'NPI Registry'];
const OIG_ALIASES = ['OIG', 'LEIE', 'OIG_LEIE'];
const LICENSURE_ALIASES = [
  'STATE_BOARD',
  'STATE_BOARD_CA_API',
  'STATE_BOARD_MANUAL',
  'FSMB',
  'FSMB_MED_API',
  'FSMB_PDC',
  'NURSYS',
  'NURSYS_ENOTIFY',
];
const PECOS_ALIASES = ['PECOS', 'PECOS_PUBLIC'];

function isPastFreshnessWindowHours(
  checkedAt: string | null | undefined,
  freshnessWindowHours: number | null | undefined,
): boolean {
  if (!checkedAt || !freshnessWindowHours) {
    return false;
  }

  const timestamp = Date.parse(checkedAt);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp > freshnessWindowHours * 60 * 60 * 1000;
}

function resolveCoverageFreshnessState(
  check: PassportSourceCoverageCheck,
): PassportSourceCoverageState {
  if (
    check.state === 'checked'
    && isPastFreshnessWindowHours(check.checkedAt, check.freshnessWindowHours)
  ) {
    return 'stale';
  }

  return check.state;
}

function buildCoverageFreshnessEntry(
  passport: PassportData,
  config: {
    layer: string;
    source: string;
    aliases: string[];
    fallback: () => Omit<PassportFreshnessEntry, 'layer' | 'source' | 'sourceState' | 'stateLabel'>;
  },
): PassportFreshnessEntry {
  const matchingChecks = findPassportSourceCoverageChecks(
    passport.sourceCoverage,
    config.aliases,
  );
  const prioritizedCheck = findPriorityCanonicalSourceCoverage(
    matchingChecks,
    COVERAGE_LAYER_PRIORITIES,
  );

  if (!prioritizedCheck) {
    return {
      layer: config.layer,
      source: config.source,
      sourceState: null,
      stateLabel: null,
      ...config.fallback(),
    };
  }

  const sourceState = resolveCoverageFreshnessState(prioritizedCheck);
  const fallback = config.fallback();

  return {
    layer: config.layer,
    checkedAt: prioritizedCheck.checkedAt ?? fallback.checkedAt,
    source: config.source,
    stale: sourceState === 'stale',
    unchecked: sourceState !== 'checked' && sourceState !== 'stale',
    sourceState,
    stateLabel:
      sourceState === 'checked' || sourceState === 'stale'
        ? null
        : sourceCoverageStateLabel(sourceState),
  };
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
    buildCoverageFreshnessEntry(passport, {
      layer: 'Identity (NPPES)',
      source: 'CMS NPPES',
      aliases: NPPES_ALIASES,
      fallback: () => ({
        checkedAt: passport.lastCheckedAt ?? null,
        stale: isStale(passport.lastCheckedAt, 30),
        unchecked: !passport.lastCheckedAt,
      }),
    }),
    buildCoverageFreshnessEntry(passport, {
      layer: 'Safety (OIG)',
      source: 'OIG LEIE',
      aliases: OIG_ALIASES,
      fallback: () => ({
        checkedAt: passport.standing.exclusionCheckedAt ?? null,
        stale: isStale(passport.standing.exclusionCheckedAt, 90),
        unchecked: passport.standing.exclusionStatus === 'UNCHECKED',
      }),
    }),
    buildCoverageFreshnessEntry(passport, {
      layer: 'Authority (Licenses)',
      source: 'State Boards / FSMB',
      aliases: LICENSURE_ALIASES,
      fallback: () => ({
        checkedAt: licensureCheckedAt,
        stale: licensureCredentials.length > 0
          && licensureCredentials.some((credential) => credential.stale),
        unchecked: licensureCredentials.length === 0,
      }),
    }),
    buildCoverageFreshnessEntry(passport, {
      layer: 'Eligibility (PECOS)',
      source: passport.standing.enrollmentSourceLabel ?? 'CMS PECOS',
      aliases: PECOS_ALIASES,
      fallback: () => ({
        checkedAt: passport.standing.enrollmentObservedAt ?? null,
        // PECOS data expires — treat as stale if past revalidation due date on the PECOS credential,
        // or >180 days since the enrollment was observed. Previously hardcoded false (always fresh).
        stale: (() => {
          const pecosCred = passport.authority.credentials.find((credential) => (
            credential.domain === 'MEDICARE_ENROLLMENT'
          ));
          const revalDue = pecosCred?.nextReverifyAt ?? pecosCred?.revalidationDue ?? null;
          if (revalDue) return new Date(revalDue) < new Date();
          return isStale(passport.standing.enrollmentObservedAt, 180);
        })(),
        unchecked: pecosEnrollmentStatus === 'UNCHECKED',
      }),
    }),
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
