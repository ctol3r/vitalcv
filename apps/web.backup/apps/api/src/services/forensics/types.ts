import type { Prisma } from '@prisma/client';

export type ForensicsSignalCategory = 'identity' | 'document' | 'behavior' | 'registry';

export type ForensicsSeverity = 'low' | 'medium' | 'high';

export interface ForensicsSignal {
  id: string;
  clinicianId: string;
  category: ForensicsSignalCategory;
  type: string;
  severity: ForensicsSeverity;
  score: number;
  description: string;
  observedAt: string;
  metadata?: Record<string, unknown>;
}

export interface StoredIdentityForensics {
  id: string;
  clinicianId: string;
  riskScore: number;
  signals: Prisma.JsonValue;
  lastReviewed: Date;
}

export interface ForensicsRiskBreakdown {
  normalizedScore: number;
  weightedScore: number;
  categories: Record<ForensicsSignalCategory, number>;
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function scoreFromSeverity(severity: ForensicsSeverity): number {
  switch (severity) {
    case 'high':
      return 0.9;
    case 'medium':
      return 0.65;
    default:
      return 0.35;
  }
}

export function severityFromScore(score: number): ForensicsSeverity {
  if (score >= 0.75) {
    return 'high';
  }
  if (score >= 0.45) {
    return 'medium';
  }
  return 'low';
}

export function buildSignalId(category: ForensicsSignalCategory, type: string): string {
  return `${category}:${type}`.toLowerCase();
}

export function serializeSignals(signals: ForensicsSignal[]): Prisma.InputJsonValue {
  return signals.map((signal) => ({
    ...signal,
    metadata: signal.metadata ?? {},
  })) as Prisma.InputJsonValue;
}










