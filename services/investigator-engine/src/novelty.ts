import type {
  InvestigatorSeverity,
  NormalizedInvestigatorSignal,
  NoveltyScoreBreakdown,
  NoveltyScoreResult,
  PriorityScoreBreakdown,
  PriorityScoreResult,
} from './types';

function clamp01(value: number | null | undefined, fallback = 0): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface NoveltyScoreInput {
  firstOccurrence: boolean;
  magnitude?: number | null;
  peerOccurrenceRate?: number | null;
  recencyDays?: number | null;
  corroborationCount?: number | null;
}

export function computeNoveltyScore(input: NoveltyScoreInput): NoveltyScoreResult {
  const breakdown: NoveltyScoreBreakdown = {
    firstOccurrence: input.firstOccurrence ? 1 : 0.38,
    magnitude: clamp01(input.magnitude, input.firstOccurrence ? 0.62 : 0.4),
    rarityAmongPeers: clamp01(
      typeof input.peerOccurrenceRate === 'number'
        ? 1 - Math.min(Math.max(input.peerOccurrenceRate, 0), 1)
        : 0.55,
      0.55,
    ),
    recency: clamp01(
      typeof input.recencyDays === 'number'
        ? input.recencyDays <= 1
          ? 1
          : input.recencyDays <= 7
            ? 0.88
            : input.recencyDays <= 30
              ? 0.68
              : 0.48
        : 0.72,
      0.72,
    ),
    corroboration: clamp01(
      typeof input.corroborationCount === 'number'
        ? Math.min(input.corroborationCount, 3) / 3
        : 0,
      0,
    ),
  };

  const normalizedScore = (
    (breakdown.firstOccurrence * 0.28)
    + (breakdown.magnitude * 0.24)
    + (breakdown.rarityAmongPeers * 0.18)
    + (breakdown.recency * 0.14)
    + (breakdown.corroboration * 0.16)
  );

  return {
    score: round2(normalizedScore * 100),
    normalizedScore: round2(normalizedScore),
    breakdown,
  };
}

function severityValue(severity: InvestigatorSeverity): number {
  switch (severity) {
    case 'critical':
      return 1;
    case 'high':
      return 0.8;
    case 'medium':
      return 0.55;
    case 'low':
    default:
      return 0.3;
  }
}

export interface PriorityScoreInput {
  severity: InvestigatorSeverity;
  providerCentrality?: number | null;
  noveltyScore: number;
  sourceConfidence?: number | null;
  corroborationCount?: number | null;
}

export function computePriorityScore(input: PriorityScoreInput): PriorityScoreResult {
  const breakdown: PriorityScoreBreakdown = {
    severity: severityValue(input.severity),
    providerCentrality: clamp01(input.providerCentrality, 0.35),
    novelty: clamp01(input.noveltyScore / 100, 0.5),
    sourceConfidence: clamp01(input.sourceConfidence, 0.72),
    corroboration: clamp01(
      typeof input.corroborationCount === 'number'
        ? Math.min(input.corroborationCount, 4) / 4
        : 0,
      0,
    ),
  };

  const normalizedScore = (
    (breakdown.severity * 0.28)
    + (breakdown.providerCentrality * 0.18)
    + (breakdown.novelty * 0.26)
    + (breakdown.sourceConfidence * 0.18)
    + (breakdown.corroboration * 0.10)
  );

  return {
    score: round2(normalizedScore * 100),
    normalizedScore: round2(normalizedScore),
    breakdown,
  };
}

export function severityWithNovelty(
  baseSeverity: InvestigatorSeverity,
  noveltyScore: number,
): InvestigatorSeverity {
  const scale: InvestigatorSeverity[] = ['low', 'medium', 'high', 'critical'];
  const currentIndex = scale.indexOf(baseSeverity);
  if (noveltyScore >= 85 && currentIndex < scale.length - 1) {
    return scale[currentIndex + 1];
  }

  if (noveltyScore <= 24 && currentIndex > 0) {
    return scale[currentIndex - 1];
  }

  return baseSeverity;
}

export function noveltyFromSignal(
  signal: Pick<
    NormalizedInvestigatorSignal,
    'magnitude' | 'peerOccurrenceRate' | 'recencyDays' | 'corroborationSourceIds'
  >,
  options: { firstOccurrence: boolean },
): NoveltyScoreResult {
  return computeNoveltyScore({
    firstOccurrence: options.firstOccurrence,
    magnitude: signal.magnitude ?? null,
    peerOccurrenceRate: signal.peerOccurrenceRate ?? null,
    recencyDays: signal.recencyDays ?? null,
    corroborationCount: signal.corroborationSourceIds?.length ?? 0,
  });
}
