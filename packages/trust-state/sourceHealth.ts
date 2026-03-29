import {
  buildCanonicalSourceCoverageFreshness,
  type CanonicalSourceCoverageFreshness,
  type CanonicalSourceCoverageReport,
  type CanonicalSourceCoverageState,
} from './sourceCoverage';

export const SOURCE_HEALTH_OPERATOR_STATUSES = [
  'HEALTHY',
  'DEGRADED',
  'STALE',
  'CRITICAL',
] as const;

export type SourceHealthOperatorStatus =
  (typeof SOURCE_HEALTH_OPERATOR_STATUSES)[number];

export type SourceHealthSpineStatus = SourceHealthOperatorStatus;

export type SourceHealthFreshness = Readonly<
  CanonicalSourceCoverageFreshness & {
    ageHours: number | null;
  }
>;

export type SourceHealthEntry = Readonly<{
  sourceId: string;
  name: string;
  isSpine: boolean;
  supported: boolean;
  decisionGrade: boolean;
  coverageState: CanonicalSourceCoverageState;
  coverageReason: string;
  operatorStatus: SourceHealthOperatorStatus;
  featureFlag: Readonly<{
    key: string;
    enabled: boolean;
  }>;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  freshnessSlaHours: number;
  freshness: SourceHealthFreshness;
}>;

export type SourceHealthReport = Readonly<{
  timestamp: string;
  sources: SourceHealthEntry[];
  sourceCoverage: CanonicalSourceCoverageReport;
  spineStatus: SourceHealthSpineStatus;
  alerts: string[];
}>;

function readAgeHours(
  timestamp: string | null,
  now: Date,
): number | null {
  if (!timestamp) {
    return null;
  }

  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Number(((now.getTime() - parsed) / 3_600_000).toFixed(2)));
}

export function isSourceHealthFresh(input: {
  lastSuccessAt: string | null;
  freshnessWindowHours: number;
  now?: Date;
}): boolean {
  if (!input.lastSuccessAt || input.freshnessWindowHours <= 0) {
    return false;
  }

  const observedAt = Date.parse(input.lastSuccessAt);
  if (!Number.isFinite(observedAt)) {
    return false;
  }

  const now = input.now ?? new Date();
  return now.getTime() - observedAt <= input.freshnessWindowHours * 3_600_000;
}

export function buildSourceHealthFreshness(input: {
  coverageState: CanonicalSourceCoverageState;
  lastSuccessAt: string | null;
  freshnessWindowHours: number;
  now?: Date;
}): SourceHealthFreshness {
  const now = input.now ?? new Date();
  const freshness = buildCanonicalSourceCoverageFreshness({
    state: input.coverageState,
    checkedAt: input.lastSuccessAt,
    observedAt: input.lastSuccessAt,
    freshnessWindowHours: input.freshnessWindowHours,
  });

  return Object.freeze({
    ...freshness,
    ageHours: readAgeHours(input.lastSuccessAt, now),
  });
}
