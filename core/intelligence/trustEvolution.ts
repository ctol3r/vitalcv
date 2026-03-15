export interface TrustEvolutionInput {
  subjectType: string;
  subjectId: string;
  previousScore: number | null;
  newScore: number;
  triggerEvent: string;
  confidence?: number | null;
  band?: string | null;
  methodologyVersion?: string | null;
  metadata?: Record<string, unknown>;
  recordedAt?: Date | string;
}

export interface TrustEvolutionRecord {
  subjectType: string;
  subjectId: string;
  previousScore: number | null;
  newScore: number;
  scoreDelta: number;
  triggerEvent: string;
  confidence: number | null;
  band: string | null;
  methodologyVersion: string | null;
  metadata: Record<string, unknown>;
  recordedAt: string;
}

function round(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 10_000) / 10_000;
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

export function buildTrustEvolution(input: TrustEvolutionInput): TrustEvolutionRecord {
  const previousScore = round(input.previousScore);
  const newScore = round(input.newScore) ?? 0;
  const baseline = previousScore ?? 0;

  return {
    subjectType: input.subjectType.trim().toUpperCase(),
    subjectId: input.subjectId.trim(),
    previousScore,
    newScore,
    scoreDelta: Math.round((newScore - baseline) * 10_000) / 10_000,
    triggerEvent: input.triggerEvent.trim().toUpperCase(),
    confidence: round(input.confidence ?? null),
    band: input.band?.trim() ?? null,
    methodologyVersion: input.methodologyVersion?.trim() ?? null,
    metadata: input.metadata ?? {},
    recordedAt: toIsoString(input.recordedAt),
  };
}

export function shouldPersistTrustEvolution(
  latest: Pick<TrustEvolutionRecord, 'newScore' | 'triggerEvent' | 'band'> | null,
  candidate: TrustEvolutionRecord,
): boolean {
  if (!latest) {
    return true;
  }

  return latest.newScore !== candidate.newScore
    || latest.triggerEvent !== candidate.triggerEvent
    || latest.band !== candidate.band;
}
