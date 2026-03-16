export type IntelligenceDirection = 'UP' | 'DOWN' | 'FLAT' | 'MIXED';

export type IntelligenceConfidenceLevel = 'low' | 'medium' | 'high';

export type IntelligencePriority = 'low' | 'medium' | 'high' | 'critical';

export interface IntelligenceEntityRef {
  entityType: string;
  entityId: string;
  entityLabel: string | null;
}

export interface IntelligenceConfidence {
  score: number;
  level: IntelligenceConfidenceLevel;
  label: string;
  insufficientSignal: boolean;
  reasoning: string[];
}

export interface IntelligenceExplanation {
  summary: string;
  details: string[];
  formatted: string;
  insufficientSignal: boolean;
}

export interface IntelligenceDriver {
  key: string;
  label: string;
  value: number | string | boolean | null;
  direction: IntelligenceDirection;
  importance: number;
  source: string | null;
  observedAt: string | null;
  explanation: string;
}

export interface IntelligenceSourceSignal {
  id: string;
  type: string;
  label: string;
  value: number | string | boolean | null;
  source: string | null;
  confidence: number | null;
  observedAt: string | null;
  explanation: string | null;
  metadata: Record<string, unknown>;
}

export interface ExplainableIntelligenceOutput {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  state: string;
  score: number;
  confidence: IntelligenceConfidence;
  explanation: IntelligenceExplanation;
  drivers: IntelligenceDriver[];
  sourceSignals: IntelligenceSourceSignal[];
  lastUpdated: string;
  linkedEvidenceRefs: string[];
  recommendedActionRefs: string[];
  linkedStorylineIds: string[];
  metadata: Record<string, unknown>;
}

export interface IntelligenceFeedItem {
  id: string;
  type: string;
  headline: string;
  summary: string;
  entityRefs: IntelligenceEntityRef[];
  confidence: IntelligenceConfidence;
  priority: IntelligencePriority | null;
  impact: IntelligencePriority | null;
  linkedEvidenceRefs: string[];
  recommendedActionRefs: string[];
  createdAt: string;
  updatedAt: string;
  signal: ExplainableIntelligenceOutput | null;
  metadata: Record<string, unknown>;
}

function round(value: number, precision = 4): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

export function clamp01(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, round(value, 4)));
}

export function normalizeScore(
  value: number,
  inputScale: 'ratio' | 'score_100' = 'score_100',
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = inputScale === 'ratio'
    ? value * 100
    : value;

  return Math.max(0, Math.min(100, round(normalized, 2)));
}

export function normalizeConfidence(
  value: number | null | undefined,
  options: {
    insufficientSignal?: boolean;
    reasoning?: Array<string | null | undefined>;
  } = {},
): IntelligenceConfidence {
  const score = clamp01(value ?? 0);
  const insufficientSignal = options.insufficientSignal === true;
  const reasoning = dedupeStrings(options.reasoning ?? []);
  const level: IntelligenceConfidenceLevel = score >= 0.75
    ? 'high'
    : score >= 0.45
      ? 'medium'
      : 'low';

  return {
    score,
    level,
    label: `${Math.round(score * 100)}% confidence`,
    insufficientSignal,
    reasoning,
  };
}

export function normalizeTimestamp(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

export function selectSignalTimestamp(
  ...values: Array<Date | string | null | undefined>
): string {
  for (const value of values) {
    const normalized = normalizeTimestamp(value);
    if (normalized) {
      return normalized;
    }
  }

  return new Date().toISOString();
}

export function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = value.trim();
    if (normalized.length === 0) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(normalized);
  }

  return results;
}

export function normalizeDriver(input: {
  key: string;
  label?: string | null;
  value: number | string | boolean | null;
  direction?: IntelligenceDirection | null;
  importance?: number | null;
  source?: string | null;
  observedAt?: Date | string | null;
  explanation?: string | null;
}): IntelligenceDriver {
  return {
    key: input.key,
    label: input.label?.trim() || input.key.replace(/_/g, ' '),
    value: input.value ?? null,
    direction: input.direction ?? 'FLAT',
    importance: clamp01(input.importance ?? inferDriverImportance(input.value)),
    source: input.source?.trim() || null,
    observedAt: normalizeTimestamp(input.observedAt),
    explanation: input.explanation?.trim() || `${input.key.replace(/_/g, ' ')} informs the current intelligence state.`,
  };
}

function inferDriverImportance(value: number | string | boolean | null): number {
  if (typeof value === 'number') {
    return clamp01(Math.abs(value) <= 1 ? Math.abs(value) : Math.min(Math.abs(value) / 100, 1));
  }
  if (typeof value === 'boolean') {
    return value ? 0.8 : 0.2;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return 0.5;
  }
  return 0.25;
}

export function rankDrivers(
  drivers: IntelligenceDriver[],
  limit = 6,
): IntelligenceDriver[] {
  return [...drivers]
    .sort((left, right) => {
      if (right.importance !== left.importance) {
        return right.importance - left.importance;
      }

      const rightTs = right.observedAt ? Date.parse(right.observedAt) : 0;
      const leftTs = left.observedAt ? Date.parse(left.observedAt) : 0;
      if (rightTs !== leftTs) {
        return rightTs - leftTs;
      }

      return left.key.localeCompare(right.key);
    })
    .slice(0, Math.max(limit, 0));
}

export function normalizeSourceSignal(input: {
  id?: string | null;
  type: string;
  label: string;
  value: number | string | boolean | null;
  source?: string | null;
  confidence?: number | null;
  observedAt?: Date | string | null;
  explanation?: string | null;
  metadata?: Record<string, unknown>;
}): IntelligenceSourceSignal {
  const source = input.source?.trim() || null;
  const observedAt = normalizeTimestamp(input.observedAt);
  return {
    id: input.id?.trim() || stableIntelligenceId(
      input.type,
      source ?? 'derived',
      input.label,
      observedAt ?? 'undated',
    ),
    type: input.type,
    label: input.label.trim(),
    value: input.value ?? null,
    source,
    confidence: typeof input.confidence === 'number' ? clamp01(input.confidence) : null,
    observedAt,
    explanation: input.explanation?.trim() || null,
    metadata: input.metadata ?? {},
  };
}

export function normalizeExplanation(input: {
  summary: string;
  details?: Array<string | null | undefined>;
  insufficientSignal?: boolean;
}): IntelligenceExplanation {
  const details = dedupeStrings(input.details ?? []);
  const summary = input.summary.trim();
  const insufficientSignal = input.insufficientSignal === true;

  return {
    summary,
    details,
    formatted: [summary, ...details].join(' '),
    insufficientSignal,
  };
}

export function stableIntelligenceId(...parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (part ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    .filter((part) => part.length > 0)
    .join(':');
}

export function buildExplainableIntelligence(input: {
  id?: string | null;
  type: string;
  entity: IntelligenceEntityRef;
  state: string;
  score: number;
  scoreScale?: 'ratio' | 'score_100';
  confidence: number | null | undefined;
  explanation: {
    summary: string;
    details?: Array<string | null | undefined>;
    insufficientSignal?: boolean;
  };
  drivers?: IntelligenceDriver[];
  sourceSignals?: IntelligenceSourceSignal[];
  lastUpdated?: Date | string | null;
  linkedEvidenceRefs?: Array<string | null | undefined>;
  recommendedActionRefs?: Array<string | null | undefined>;
  linkedStorylineIds?: Array<string | null | undefined>;
  metadata?: Record<string, unknown>;
}): ExplainableIntelligenceOutput {
  const explanation = normalizeExplanation(input.explanation);
  const sourceSignals = input.sourceSignals ?? [];
  const confidence = normalizeConfidence(input.confidence, {
    insufficientSignal: explanation.insufficientSignal,
    reasoning: sourceSignals.map((signal) => signal.source),
  });

  return {
    id: input.id?.trim() || stableIntelligenceId(
      input.type,
      input.entity.entityType,
      input.entity.entityId,
      input.state,
    ),
    type: input.type,
    entityType: input.entity.entityType,
    entityId: input.entity.entityId,
    entityLabel: input.entity.entityLabel,
    state: input.state,
    score: normalizeScore(input.score, input.scoreScale ?? 'score_100'),
    confidence,
    explanation,
    drivers: rankDrivers(input.drivers ?? []),
    sourceSignals,
    lastUpdated: selectSignalTimestamp(input.lastUpdated),
    linkedEvidenceRefs: dedupeStrings(input.linkedEvidenceRefs ?? []),
    recommendedActionRefs: dedupeStrings(input.recommendedActionRefs ?? []),
    linkedStorylineIds: dedupeStrings(input.linkedStorylineIds ?? []),
    metadata: input.metadata ?? {},
  };
}

export function buildFeedItem(input: {
  id?: string | null;
  type: string;
  headline: string;
  summary: string;
  entityRefs: IntelligenceEntityRef[];
  confidence: number | null | undefined;
  priority?: IntelligencePriority | null;
  impact?: IntelligencePriority | null;
  linkedEvidenceRefs?: Array<string | null | undefined>;
  recommendedActionRefs?: Array<string | null | undefined>;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  signal?: ExplainableIntelligenceOutput | null;
  metadata?: Record<string, unknown>;
}): IntelligenceFeedItem {
  const createdAt = selectSignalTimestamp(input.createdAt, input.updatedAt);
  const updatedAt = selectSignalTimestamp(input.updatedAt, input.createdAt);
  return {
    id: input.id?.trim() || stableIntelligenceId(input.type, input.headline, createdAt),
    type: input.type,
    headline: input.headline.trim(),
    summary: input.summary.trim(),
    entityRefs: input.entityRefs,
    confidence: normalizeConfidence(input.confidence),
    priority: input.priority ?? null,
    impact: input.impact ?? null,
    linkedEvidenceRefs: dedupeStrings(input.linkedEvidenceRefs ?? []),
    recommendedActionRefs: dedupeStrings(input.recommendedActionRefs ?? []),
    createdAt,
    updatedAt,
    signal: input.signal ?? null,
    metadata: input.metadata ?? {},
  };
}

export function formatSourceSignalsForCopilot(
  sourceSignals: IntelligenceSourceSignal[],
  limit = 4,
): string[] {
  return sourceSignals
    .slice(0, Math.max(limit, 0))
    .map((signal) => {
      const value = typeof signal.value === 'number'
        ? round(signal.value, 2)
        : signal.value;
      const source = signal.source ? `${signal.source}: ` : '';
      return `${source}${signal.label} = ${String(value)}`;
    });
}
