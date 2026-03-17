export type ConfidenceBand = 'HIGH' | 'MEDIUM' | 'LOW';
export type EvidenceQualityRating = 'STRONG' | 'ADEQUATE' | 'WEAK' | 'MISSING';
export type SourceQualityMarker = 'AUTHORITATIVE' | 'DERIVED' | 'MIXED' | 'UNKNOWN';
export type FreshnessMarker = 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN';

export interface TrustSignalLike {
  source?: string | null;
  observedAt?: string | null;
  confidence?: number | null;
  qualityRating?: EvidenceQualityRating | null;
  corroborationCount?: number | null;
  degraded?: boolean;
  sourceQuality?: SourceQualityMarker | null;
}

export interface TrustSignalSummary {
  confidenceBand: ConfidenceBand;
  evidenceQuality: EvidenceQualityRating;
  corroborationCount: number;
  uniqueSourceCount: number;
  freshness: FreshnessMarker;
  sourceQuality: SourceQualityMarker;
  lastObservedAt: string | null;
  degradedSourceCount: number;
}

const FRESHNESS_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
const FRESHNESS_STALE_MS = 30 * 24 * 60 * 60 * 1000;

function clampConfidence(value: number | null | undefined, fallback = 0): number {
  const candidate = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, candidate));
}

function parseObservedAt(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function distinctMarkers(values: Array<SourceQualityMarker | null | undefined>): SourceQualityMarker[] {
  return [...new Set(values.filter((value): value is SourceQualityMarker => Boolean(value) && value !== 'UNKNOWN'))];
}

export function classifyConfidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.8) {
    return 'HIGH';
  }

  if (confidence >= 0.55) {
    return 'MEDIUM';
  }

  return 'LOW';
}

export function classifySourceQuality(source: string | null | undefined): SourceQualityMarker {
  const normalized = (source ?? '').trim().toLowerCase();

  if (!normalized) {
    return 'UNKNOWN';
  }

  if (/(nppes|state board|medical board|board|abms|abim|dea|oig|sam|cms|nursys|caqh|registry|licen[sc]e|issuer)/.test(normalized)) {
    return 'AUTHORITATIVE';
  }

  if (/(graph|runtime|derived|heuristic|prediction|copilot|alert|storyline|network|feed)/.test(normalized)) {
    return 'DERIVED';
  }

  return 'MIXED';
}

export function classifyFreshness(
  observedAt: string | null | undefined,
  now = Date.now(),
): FreshnessMarker {
  const timestamp = parseObservedAt(observedAt);

  if (timestamp === null) {
    return 'UNKNOWN';
  }

  const ageMs = Math.max(0, now - timestamp);
  if (ageMs <= FRESHNESS_FRESH_MS) {
    return 'FRESH';
  }

  if (ageMs <= FRESHNESS_STALE_MS) {
    return 'AGING';
  }

  return 'STALE';
}

export function formatFreshnessLabel(
  freshness: FreshnessMarker,
  observedAt: string | null | undefined,
): string {
  if (!observedAt || freshness === 'UNKNOWN') {
    return 'Freshness unknown';
  }

  switch (freshness) {
    case 'FRESH':
      return 'Fresh evidence';
    case 'AGING':
      return 'Aging evidence';
    case 'STALE':
      return 'Stale evidence';
    default:
      return 'Freshness unknown';
  }
}

export function deriveEvidenceQuality(input: {
  confidence: number;
  corroborationCount?: number | null;
  degraded?: boolean;
  sourceQuality?: SourceQualityMarker | null;
}): EvidenceQualityRating {
  const corroborationCount = Math.max(0, input.corroborationCount ?? 0);
  const sourceQuality = input.sourceQuality ?? 'UNKNOWN';

  if (input.confidence <= 0) {
    return 'MISSING';
  }

  if (
    input.confidence >= 0.85
    && corroborationCount >= 1
    && !input.degraded
    && sourceQuality !== 'DERIVED'
  ) {
    return 'STRONG';
  }

  if (input.confidence >= 0.65) {
    return 'ADEQUATE';
  }

  return 'WEAK';
}

export function summarizeTrustSignals(
  items: TrustSignalLike[],
  fallbackConfidence = 0,
): TrustSignalSummary {
  if (items.length === 0) {
    const confidence = clampConfidence(fallbackConfidence);
    return {
      confidenceBand: classifyConfidenceBand(confidence),
      evidenceQuality: confidence > 0 ? deriveEvidenceQuality({ confidence }) : 'MISSING',
      corroborationCount: 0,
      uniqueSourceCount: 0,
      freshness: 'UNKNOWN',
      sourceQuality: 'UNKNOWN',
      lastObservedAt: null,
      degradedSourceCount: 0,
    };
  }

  const confidences = items.map((item) => clampConfidence(item.confidence, fallbackConfidence));
  const avgConfidence = confidences.reduce((sum, value) => sum + value, 0) / Math.max(confidences.length, 1);
  const sourceSet = new Set(
    items
      .map((item) => item.source?.trim())
      .filter((value): value is string => Boolean(value)),
  );
  const lastObservedAt = items
    .map((item) => item.observedAt ?? null)
    .sort((left, right) => (parseObservedAt(right) ?? 0) - (parseObservedAt(left) ?? 0))[0] ?? null;
  const degradedSourceCount = items.filter((item) => item.degraded).length;
  const explicitCorroborationCount = items.reduce(
    (current, item) => Math.max(current, Math.max(0, item.corroborationCount ?? 0)),
    0,
  );
  const uniqueSourceCount = sourceSet.size;
  const corroborationCount = Math.max(explicitCorroborationCount, Math.max(0, uniqueSourceCount - 1));
  const sourceQualityMarkers = distinctMarkers(
    items.map((item) => item.sourceQuality ?? classifySourceQuality(item.source)),
  );
  const sourceQuality = sourceQualityMarkers.length === 0
    ? 'UNKNOWN'
    : sourceQualityMarkers.length === 1
      ? sourceQualityMarkers[0]!
      : 'MIXED';
  const freshness = classifyFreshness(lastObservedAt);

  return {
    confidenceBand: classifyConfidenceBand(avgConfidence),
    evidenceQuality: deriveEvidenceQuality({
      confidence: avgConfidence,
      corroborationCount,
      degraded: degradedSourceCount > 0,
      sourceQuality,
    }),
    corroborationCount,
    uniqueSourceCount,
    freshness,
    sourceQuality,
    lastObservedAt,
    degradedSourceCount,
  };
}
