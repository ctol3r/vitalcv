export interface TimeToStartSignalInput {
  blockers?: readonly string[] | null;
  gaps?: readonly string[] | null;
  licensureStatus?: string | null;
}

export interface TimeToStartPenaltyFlags {
  missingLicense: boolean;
  missingEnrollment: boolean;
  staleVerification: boolean;
}

export interface TimeToStartDayRange {
  min: number;
  max: number;
}

export interface TimeToStartEstimate {
  baselineDays: number;
  tooltip: string;
  penalties: TimeToStartPenaltyFlags;
  penaltyDays: number;
  readinessFactor: TimeToStartDayRange;
  adjusted: TimeToStartDayRange;
  withoutVitalCvLabel: string;
  withVitalCvLabel: string;
  timeSavedLabel: string;
}

const BASELINE_DAYS = 90;
const BASE_WITH_VITALCV_RANGE: TimeToStartDayRange = { min: 45, max: 60 };
const TOOLTIP_COPY = 'Based on credential readiness and common onboarding delays';

const PENALTY_DAYS = {
  missingLicense: 30,
  missingEnrollment: 20,
  staleVerification: 10,
} as const;

function normalizeSignals(values: readonly string[] | null | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function hasSignal(signals: readonly string[], patterns: readonly RegExp[]): boolean {
  return signals.some((signal) => patterns.some((pattern) => pattern.test(signal)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatApproxDays(range: TimeToStartDayRange): string {
  if (range.min === range.max) {
    return `~${range.min} days`;
  }

  return `~${range.min}-${range.max} days`;
}

export function resolveTimeToStartPenalties(
  input: TimeToStartSignalInput = {},
): TimeToStartPenaltyFlags {
  const signals = [
    ...normalizeSignals(input.blockers),
    ...normalizeSignals(input.gaps),
  ];

  const missingLicense = hasSignal(signals, [
    /\bproof missing:\s*licensure\b/,
    /\bmissing:\s*licensure\b/,
    /\bmissing licen/,
    /\blicense (?:missing|not found|not confirmed)\b/,
    /\bactive license not confirmed\b/,
  ]);

  const missingEnrollment = hasSignal(signals, [
    /\bpecos\b/,
    /\bmedicare enrollment\b/,
    /\benrollment not found\b/,
    /\bsubmit pecos enrollment\b/,
    /\bnot enrolled\b/,
  ]);

  const staleVerification = hasSignal(signals, [
    /\bstale\b/,
    /\brefresh required\b/,
    /\brevalidation due\b/,
  ]);

  return {
    missingLicense,
    missingEnrollment,
    staleVerification,
  };
}

export function buildTimeToStartEstimate(
  input: TimeToStartSignalInput = {},
): TimeToStartEstimate {
  const penalties = resolveTimeToStartPenalties(input);
  const penaltyDays =
    (penalties.missingLicense ? PENALTY_DAYS.missingLicense : 0)
    + (penalties.missingEnrollment ? PENALTY_DAYS.missingEnrollment : 0)
    + (penalties.staleVerification ? PENALTY_DAYS.staleVerification : 0);

  const adjusted: TimeToStartDayRange = {
    min: clamp(BASE_WITH_VITALCV_RANGE.min + penaltyDays, BASE_WITH_VITALCV_RANGE.min, BASELINE_DAYS),
    max: clamp(BASE_WITH_VITALCV_RANGE.max + penaltyDays, BASE_WITH_VITALCV_RANGE.max, BASELINE_DAYS),
  };

  const readinessFactor: TimeToStartDayRange = {
    min: Math.max(0, BASELINE_DAYS - adjusted.max),
    max: Math.max(0, BASELINE_DAYS - adjusted.min),
  };

  return {
    baselineDays: BASELINE_DAYS,
    tooltip: TOOLTIP_COPY,
    penalties,
    penaltyDays,
    readinessFactor,
    adjusted,
    // Same discipline as lib/trust/time-to-start-estimate.ts: the baseline is an
    // assumption and the difference is a projection, so the values say so. This
    // pair (module + components/hero/TimeToStartCard) currently has no consumer,
    // but dead code with measurement-flavoured labels is a loaded gun — if it is
    // ever wired up it must not assert an outcome nobody measured.
    withoutVitalCvLabel: `~${BASELINE_DAYS} days (assumed)`,
    withVitalCvLabel: `${formatApproxDays(adjusted)} (projected)`,
    timeSavedLabel: `${formatApproxDays(readinessFactor)} (projected)`,
  };
}
