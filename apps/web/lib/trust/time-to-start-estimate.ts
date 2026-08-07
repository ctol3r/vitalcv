import type { PassportData } from '@/lib/trust/passport-contract';

/**
 * Pilot time-to-start PROJECTION.
 *
 * Every number this module returns is arithmetic on an assumption. The 90-day
 * baseline is an industry-shaped guess, not an observation — VitalCV has never
 * measured what this clinician's start would have taken without it — and the
 * coefficients below are hand-tuned, not fitted to outcomes. `timeSavedDays` is
 * therefore `assumedBaseline - projectedStart`: a difference between a guess and
 * a model, not an observed saving.
 *
 * That is legitimate as a conversation anchor and is exactly how
 * `docs/PILOT_ROI_NARRATIVE.md` frames it ("Hypothesis until measured by real
 * pilot cases. Do not present as proven."). It is NOT legitimate to render it in
 * the vocabulary of measurement, which is why the labels below say projected and
 * assumed, and why the disclosure names it a projection.
 *
 * The measured counterpart is `lib/trust/qualified-start-measurement.ts`, which
 * derives a real span from recorded milestones and deliberately refuses to emit
 * any `timeSaved` value at all, because a saving needs a counterfactual we do not
 * observe. When that module has enough measured spans to publish, it — not this
 * one — is what may speak in the language of fact.
 */

export const DEFAULT_PILOT_START_BASELINE_DAYS = 90;
export const PILOT_TIME_TO_START_DISCLOSURE =
  'Projection from an assumed baseline — not a measured result. VitalCV has not measured this start.';

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
    // "assumed" is carried in the value itself, not only in the surrounding
    // label, so the number cannot be lifted into a screenshot, a deck or a
    // different component and read as an observation.
    baselineLabel: `~${normalizedBaselineDays} days (assumed)`,
    timeSavedLabel: `${formatDayRange(timeSavedDays, true)} (projected)`,
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
