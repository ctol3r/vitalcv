import { createHash } from 'node:crypto';

export type LearningLoopType =
  | 'SOURCE_INGESTION'
  | 'DIVERGENCE_DETECTION'
  | 'AI_SUGGESTION'
  | 'ALERT_OUTCOME'
  | 'TRUST_EVOLUTION'
  | 'QUERY_LEARNING'
  | 'USER_CORRECTION';

export type LearningEventType =
  | 'USER_CORRECTION'
  | 'REJECTED_AI_LINK'
  | 'ANOMALY_CONFIRMED'
  | 'ANOMALY_REJECTED'
  | 'ALERT_TRUE_POSITIVE'
  | 'ALERT_FALSE_POSITIVE'
  | 'ALERT_ESCALATED'
  | 'VERIFICATION_FRESHNESS_DECAY'
  | 'SOURCE_INGESTION_SUCCEEDED'
  | 'SOURCE_INGESTION_FAILED'
  | 'SOURCE_INGESTION_PARTIAL'
  | 'SOURCE_VERIFICATION_CONFIRMED'
  | 'SUGGESTION_ACCEPTED'
  | 'SUGGESTION_REJECTED'
  | 'SUGGESTION_IGNORED'
  | 'QUERY_EXECUTED'
  | 'QUERY_SUGGESTION_ACCEPTED'
  | 'TRUST_SCORE_CHANGED';

export interface LearningEventInput {
  eventType: LearningEventType;
  loopType: LearningLoopType;
  subjectType: string;
  subjectId: string;
  sourceId?: string | null;
  relatedId?: string | null;
  status?: string | null;
  confidence?: number | null;
  scoreDelta?: number | null;
  signalStrength?: number | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date | string;
  dedupeKey?: string | null;
}

export interface LearningEventRecord {
  eventType: LearningEventType;
  loopType: LearningLoopType;
  subjectType: string;
  subjectId: string;
  sourceId: string | null;
  relatedId: string | null;
  status: string;
  confidence: number | null;
  scoreDelta: number | null;
  signalStrength: number | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  dedupeKey: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return Object.fromEntries(entries.map(([key, entry]) => [key, canonicalize(entry)]));
  }

  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function toIsoString(value: Date | string | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeNullableString(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clampNullable(value: number | null | undefined, min: number, max: number): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return Math.min(max, Math.max(min, Math.round(value * 10_000) / 10_000));
}

export function createLearningEventDedupeKey(input: LearningEventInput): string {
  const basis = stableStringify({
    eventType: input.eventType,
    loopType: input.loopType,
    subjectType: input.subjectType.trim().toUpperCase(),
    subjectId: input.subjectId.trim(),
    sourceId: normalizeNullableString(input.sourceId) ?? null,
    relatedId: normalizeNullableString(input.relatedId) ?? null,
    status: normalizeNullableString(input.status) ?? 'RECORDED',
    confidence: clampNullable(input.confidence, 0, 1),
    scoreDelta: clampNullable(input.scoreDelta, -100, 100),
    signalStrength: clampNullable(input.signalStrength, 0, 1),
    metadata: input.metadata ?? {},
    occurredAt: toIsoString(input.occurredAt),
  });

  return sha256Hex(basis);
}

export function buildLearningEvent(input: LearningEventInput): LearningEventRecord {
  const metadata = canonicalize(input.metadata ?? {}) as Record<string, unknown>;

  return {
    eventType: input.eventType,
    loopType: input.loopType,
    subjectType: input.subjectType.trim().toUpperCase(),
    subjectId: input.subjectId.trim(),
    sourceId: normalizeNullableString(input.sourceId),
    relatedId: normalizeNullableString(input.relatedId),
    status: normalizeNullableString(input.status) ?? 'RECORDED',
    confidence: clampNullable(input.confidence, 0, 1),
    scoreDelta: clampNullable(input.scoreDelta, -100, 100),
    signalStrength: clampNullable(input.signalStrength, 0, 1),
    metadata,
    occurredAt: toIsoString(input.occurredAt),
    dedupeKey: normalizeNullableString(input.dedupeKey) ?? createLearningEventDedupeKey(input),
  };
}
