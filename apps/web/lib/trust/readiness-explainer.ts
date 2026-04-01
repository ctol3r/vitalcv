import type {
  PassportData,
  PassportReadinessBreakdown,
} from '@/lib/trust/passport-contract';
import type { TrustBadgeStatus } from '@/components/ui/trust-status-badge';

type ReadinessLabel = 'Source-backed' | 'Needs review' | 'Missing data';

export interface ReadinessExplanationDimension {
  id: 'identity' | 'exclusion' | 'licensure' | 'enrollment';
  label: string;
  percent: number;
}

export interface ReadinessExplanation {
  score: number;
  label: ReadinessLabel;
  badgeStatus: TrustBadgeStatus;
  dimensions: ReadinessExplanationDimension[];
  whatIsMissing: string[];
}

interface TrustStateReadinessLike {
  readiness_score: number;
  gap_summary?: string[];
  gaps?: string[];
  confidenceWeighting?: Partial<Record<'identity' | 'exclusion' | 'licensure' | 'enrollment', number>>;
}

function clampPercent(value: number | undefined | null, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function dedupeMissing(items: readonly string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function normalizeReadinessLabel(input: {
  status?: string | null;
  score: number;
  whatIsMissing: string[];
  dimensions: ReadinessExplanationDimension[];
}): ReadinessLabel {
  const normalizedStatus = (input.status ?? '').trim().toUpperCase();
  const allZero = input.dimensions.every((dimension) => dimension.percent === 0);

  if (allZero && input.whatIsMissing.length > 0) {
    return 'Missing data';
  }

  if (
    normalizedStatus === 'READY'
    || normalizedStatus === 'CLEAR_TO_START'
    || (input.score >= 60 && input.whatIsMissing.length === 0)
  ) {
    return 'Source-backed';
  }

  return 'Needs review';
}

export function buildReadinessExplanation(input: {
  score: number;
  status?: string | null;
  breakdown?: PassportReadinessBreakdown | null;
  whatIsMissing?: readonly string[];
  identityPct?: number | null;
  exclusionPct?: number | null;
  licensurePct?: number | null;
  enrollmentPct?: number | null;
}): ReadinessExplanation {
  const dimensions: ReadinessExplanationDimension[] = [
    {
      id: 'identity',
      label: 'Identity',
      percent: clampPercent(input.breakdown?.identityPct ?? input.identityPct),
    },
    {
      id: 'exclusion',
      label: 'Exclusion',
      percent: clampPercent(input.breakdown?.exclusionPct ?? input.exclusionPct),
    },
    {
      id: 'licensure',
      label: 'Licensure',
      percent: clampPercent(input.breakdown?.licensurePct ?? input.licensurePct),
    },
    {
      id: 'enrollment',
      label: 'Enrollment',
      percent: clampPercent(input.breakdown?.enrollmentPct ?? input.enrollmentPct),
    },
  ];
  const whatIsMissing = dedupeMissing([
    ...(input.breakdown?.whatIsMissing ?? []),
    ...(input.whatIsMissing ?? []),
  ]);
  const label = normalizeReadinessLabel({
    status: input.status,
    score: input.score,
    whatIsMissing,
    dimensions,
  });

  return {
    score: clampPercent(input.score),
    label,
    badgeStatus:
      label === 'Source-backed'
        ? 'checked'
        : label === 'Missing data'
          ? 'unavailable'
          : 'review required',
    dimensions,
    whatIsMissing,
  };
}

export function buildPassportReadinessExplanation(
  passport: PassportData,
): ReadinessExplanation {
  return buildReadinessExplanation({
    score: passport.readiness.score,
    status: passport.readiness.status,
    breakdown: passport.readiness.breakdown,
    whatIsMissing: [
      ...passport.readiness.blockers,
      ...passport.readiness.gaps,
    ],
  });
}

export function buildTrustStateReadinessExplanation(
  state: TrustStateReadinessLike,
): ReadinessExplanation {
  return buildReadinessExplanation({
    score: state.readiness_score,
    status: state.readiness_score >= 60 && (state.gap_summary?.length ?? 0) === 0 ? 'READY' : 'PARTIAL',
    identityPct: typeof state.confidenceWeighting?.identity === 'number'
      ? state.confidenceWeighting.identity * 100
      : 0,
    exclusionPct: typeof state.confidenceWeighting?.exclusion === 'number'
      ? state.confidenceWeighting.exclusion * 100
      : 0,
    licensurePct: typeof state.confidenceWeighting?.licensure === 'number'
      ? state.confidenceWeighting.licensure * 100
      : 0,
    enrollmentPct: typeof state.confidenceWeighting?.enrollment === 'number'
      ? state.confidenceWeighting.enrollment * 100
      : 0,
    whatIsMissing: [
      ...(state.gap_summary ?? []),
      ...(state.gaps ?? []),
    ],
  });
}
