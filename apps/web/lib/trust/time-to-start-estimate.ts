import type { PassportData } from '@/lib/trust/passport-contract';

export const DEFAULT_PILOT_START_BASELINE_DAYS = 90;
export const PILOT_TIME_TO_START_DISCLOSURE = 'Pilot estimate — based on current credential readiness';

const NON_CHECKED_SOURCE_BUCKETS: Array<keyof PassportData['sourceCoverage']['summary']> = [
  'stale',
  'pending',
  'gated',
  'unavailable',
  'accessRequired',
  'reviewRequired',
  'notDecisionGrade',
  'previewOnly',
];

const MIN_ESTIMATED_START_DAYS = 10;
const MAX_MISSING_SOURCE_PENALTY = 5;
const MAX_BLOCKED_STATE_PENALTY = 4;
const DAY_RANGE_SEPARATOR = '–';

export interface PilotTimeToStartEstimateInput {
  readinessScore: number;
  missingSources: number;
  blockedStates: number;
  baselineDays?: number;
}

export interface PilotTimeToStartRange {
  minimumDays: number;
  maximumDays: number;
}

export interface PilotTimeToStartEstimate {
  baselineDays: number;
  missingSources: number;
  blockedStates: number;
  estimatedDays: PilotTimeToStartRange;
  timeSavedDays: PilotTimeToStartRange;
  estimatedStartLabel: string;
  baselineLabel: string;
  timeSavedLabel: string;
  disclosureLabel: typeof PILOT_TIME_TO_START_DISCLOSURE;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(Math.round(value), 0);
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(Math.round(value), 1);
}

function floorToNearestFive(value: number): number {
  return Math.floor(value / 5) * 5;
}

function ceilToNearestFive(value: number): number {
  return Math.ceil(value / 5) * 5;
}

function formatDayRange(range: PilotTimeToStartRange, approximate = false): string {
  if (range.minimumDays === range.maximumDays) {
    return `${approximate ? '~' : ''}${range.minimumDays} days`;
  }

  const prefix = approximate ? '~' : '';
  return `${prefix}${range.minimumDays}${DAY_RANGE_SEPARATOR}${range.maximumDays} days`;
}

export function countMissingSources(
  sourceSummary: PassportData['sourceCoverage']['summary'],
): number {
  const sourceIds = new Set<string>();

  for (const bucket of NON_CHECKED_SOURCE_BUCKETS) {
    for (const sourceId of sourceSummary[bucket]) {
      const normalized = sourceId.trim();
      if (normalized) {
        sourceIds.add(normalized);
      }
    }
  }

  return sourceIds.size;
}

export function estimatePilotTimeToStart({
  readinessScore,
  missingSources,
  blockedStates,
  baselineDays = DEFAULT_PILOT_START_BASELINE_DAYS,
}: PilotTimeToStartEstimateInput): PilotTimeToStartEstimate {
  const normalizedBaselineDays = normalizePositiveInteger(
    baselineDays,
    DEFAULT_PILOT_START_BASELINE_DAYS,
  );
  const normalizedReadinessScore = clamp(readinessScore, 0, 100);
  const effectiveMissingSources = clamp(
    normalizeNonNegativeInteger(missingSources, 0),
    0,
    MAX_MISSING_SOURCE_PENALTY,
  );
  const effectiveBlockedStates = clamp(
    normalizeNonNegativeInteger(blockedStates, 0),
    0,
    MAX_BLOCKED_STATE_PENALTY,
  );

  // Keep the wedge conservative: strong readiness lowers the range, while
  // incomplete source lanes and blockers widen it back toward the baseline.
  const fastestStartDays = clamp(
    normalizedBaselineDays
      - normalizedReadinessScore * 0.8
      + effectiveMissingSources * 2.5
      + effectiveBlockedStates * 5,
    MIN_ESTIMATED_START_DAYS,
    normalizedBaselineDays,
  );
  const slowestStartDays = clamp(
    normalizedBaselineDays
      - normalizedReadinessScore * 0.7
      + effectiveMissingSources * 4
      + effectiveBlockedStates * 7,
    fastestStartDays,
    normalizedBaselineDays,
  );

  const minimumDays = clamp(
    floorToNearestFive(fastestStartDays),
    MIN_ESTIMATED_START_DAYS,
    normalizedBaselineDays,
  );
  const maximumDays = clamp(
    Math.max(minimumDays, ceilToNearestFive(slowestStartDays)),
    MIN_ESTIMATED_START_DAYS,
    normalizedBaselineDays,
  );
  const estimatedDays = {
    minimumDays,
    maximumDays,
  };
  const timeSavedDays = {
    minimumDays: Math.max(0, normalizedBaselineDays - maximumDays),
    maximumDays: Math.max(0, normalizedBaselineDays - minimumDays),
  };

  return {
    baselineDays: normalizedBaselineDays,
    missingSources: effectiveMissingSources,
    blockedStates: effectiveBlockedStates,
    estimatedDays,
    timeSavedDays,
    estimatedStartLabel: formatDayRange(estimatedDays),
    baselineLabel: `~${normalizedBaselineDays} days`,
    timeSavedLabel: formatDayRange(timeSavedDays, true),
    disclosureLabel: PILOT_TIME_TO_START_DISCLOSURE,
  };
}

export function buildPassportPilotTimeToStartEstimate(
  passport: Pick<PassportData, 'readiness' | 'sourceCoverage'>,
  baselineDays = DEFAULT_PILOT_START_BASELINE_DAYS,
): PilotTimeToStartEstimate {
  return estimatePilotTimeToStart({
    readinessScore: passport.readiness.score,
    missingSources: countMissingSources(passport.sourceCoverage.summary),
    blockedStates: Math.max(
      passport.readiness.blockers.length,
      passport.readiness.status === 'BLOCKED' ? 1 : 0,
    ),
    baselineDays,
  });
}
