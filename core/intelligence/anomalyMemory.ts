export type AnomalySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type AnomalyOutcome = 'OPEN' | 'CONFIRMED' | 'REJECTED' | 'RESOLVED';

export interface AnomalyObservation {
  anomalyKey: string;
  anomalyType: string;
  subjectType: string;
  subjectId: string;
  sourceIds: string[];
  severity: AnomalySeverity;
  confidence: number;
  fingerprint: string;
  outcome: AnomalyOutcome;
  detectedAt?: Date | string;
  metadata?: Record<string, unknown>;
}

export interface AnomalyMemorySnapshot {
  anomalyKey: string;
  anomalyType: string;
  subjectType: string;
  subjectId: string;
  sourceIds: string[];
  severity: AnomalySeverity;
  status: AnomalyOutcome;
  confidence: number;
  occurrenceCount: number;
  confirmationCount: number;
  rejectionCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  lastFingerprint: string;
  metadata: Record<string, unknown>;
}

function normalizeDate(value: Date | string | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, Math.round(value * 10_000) / 10_000));
}

function mergeMetadata(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return {
    ...existing,
    ...(incoming ?? {}),
  };
}

function mergeSourceIds(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming].filter((value) => value.trim().length > 0))].sort();
}

function nextStatus(previous: AnomalyOutcome | undefined, incoming: AnomalyOutcome): AnomalyOutcome {
  if (incoming === 'RESOLVED') {
    return 'RESOLVED';
  }

  if (incoming === 'CONFIRMED') {
    return 'CONFIRMED';
  }

  if (incoming === 'REJECTED') {
    return 'REJECTED';
  }

  return previous ?? 'OPEN';
}

export function mergeAnomalyMemory(
  existing: AnomalyMemorySnapshot | null,
  observation: AnomalyObservation,
): AnomalyMemorySnapshot {
  const detectedAt = normalizeDate(observation.detectedAt);
  const sameFingerprint = existing?.lastFingerprint === observation.fingerprint;
  const occurrenceCount = existing
    ? existing.occurrenceCount + (sameFingerprint ? 0 : 1)
    : 1;
  const confirmationCount = (existing?.confirmationCount ?? 0) + (observation.outcome === 'CONFIRMED' ? 1 : 0);
  const rejectionCount = (existing?.rejectionCount ?? 0) + (observation.outcome === 'REJECTED' ? 1 : 0);
  const previousConfidence = existing?.confidence ?? clampConfidence(observation.confidence);
  const nextConfidence = sameFingerprint
    ? Math.max(previousConfidence, clampConfidence(observation.confidence))
    : Math.round(((previousConfidence + clampConfidence(observation.confidence)) / 2) * 10_000) / 10_000;

  return {
    anomalyKey: observation.anomalyKey,
    anomalyType: observation.anomalyType.trim().toUpperCase(),
    subjectType: observation.subjectType.trim().toUpperCase(),
    subjectId: observation.subjectId.trim(),
    sourceIds: mergeSourceIds(existing?.sourceIds ?? [], observation.sourceIds),
    severity: observation.severity,
    status: nextStatus(existing?.status, observation.outcome),
    confidence: nextConfidence,
    occurrenceCount,
    confirmationCount,
    rejectionCount,
    firstDetectedAt: existing?.firstDetectedAt ?? detectedAt,
    lastDetectedAt: detectedAt,
    resolvedAt: observation.outcome === 'RESOLVED' ? detectedAt : existing?.resolvedAt ?? null,
    lastFingerprint: observation.fingerprint,
    metadata: mergeMetadata(existing?.metadata ?? {}, observation.metadata),
  };
}
