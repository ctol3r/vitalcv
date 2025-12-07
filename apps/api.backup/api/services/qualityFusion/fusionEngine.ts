import {
  DriftEventSeverity,
  DriftEventStatus,
  PrismaClient,
  QualitySignalSeverity,
  SafetySignalSeverity,
} from '@prisma/client';
import type { QualitySignal } from './models/QualitySignal.js';

export interface FusionEngineRunInput {
  clinicianId: string;
  lookbackDays?: number;
}

export interface FusionBreakdownEntry {
  label: 'quality' | 'drift' | 'safety';
  score: number;
  weight: number;
}

export interface FusionEngineResult {
  clinicianId: string;
  fusionScore: number;
  evaluatedAt: Date;
  breakdown: FusionBreakdownEntry[];
  qualitySignals: QualitySignal[];
  driftOpen: number;
  safetyAlerts: number;
}

const QUALITY_WEIGHTS: Record<QualitySignalSeverity, number> = {
  LOW: 0.02,
  MED: 0.05,
  HIGH: 0.12,
  CRITICAL: 0.2,
};

const DRIFT_WEIGHTS: Record<DriftEventSeverity, number> = {
  INFO: 0.01,
  WARNING: 0.08,
  CRITICAL: 0.15,
};

const SAFETY_WEIGHTS: Record<SafetySignalSeverity, number> = {
  LOW: 0.02,
  MED: 0.06,
  HIGH: 0.15,
  CRITICAL: 0.25,
};

export class FusionEngine {
  constructor(private readonly prisma: PrismaClient = new PrismaClient()) {}

  async run(input: FusionEngineRunInput): Promise<FusionEngineResult> {
    const lookbackMs =
      (input.lookbackDays ?? 90) * 24 * 60 * 60 * 1000;
    const lookbackDate = new Date(Date.now() - lookbackMs);

    const [qualitySignals, driftEvents, safetySignals] =
      await Promise.all([
        this.prisma.qualitySignal.findMany({
          where: {
            clinicianId: input.clinicianId,
            timestamp: { gte: lookbackDate },
          },
          orderBy: { timestamp: 'desc' },
          take: 100,
        }),
        this.prisma.driftEvent.findMany({
          where: {
            clinicianId: input.clinicianId,
            status: { in: [DriftEventStatus.OPEN, DriftEventStatus.ACKNOWLEDGED] },
            triggeredAt: { gte: lookbackDate },
          },
          select: { id: true, severity: true },
        }),
        this.prisma.privilegeSafetySignal.findMany({
          where: {
            clinicianId: input.clinicianId,
            detectedAt: { gte: lookbackDate },
            resolvedAt: null,
          },
          select: { id: true, severity: true },
        }),
      ]);

    const domainSignals: QualitySignal[] = qualitySignals.map((signal) => ({
      clinicianId: signal.clinicianId,
      signalType: signal.signalType,
      severity: signal.severity,
      timestamp: signal.timestamp,
      details: (signal.details ?? undefined) as Record<string, unknown> | undefined,
      source: signal.source ?? undefined,
    }));

    const qualityPenalty = domainSignals.reduce(
      (sum, signal) => sum + (QUALITY_WEIGHTS[signal.severity] ?? 0),
      0,
    );
    const driftPenalty = driftEvents.reduce(
      (sum, event) => sum + (DRIFT_WEIGHTS[event.severity] ?? 0),
      0,
    );
    const safetyPenalty = safetySignals.reduce(
      (sum, signal) => sum + (SAFETY_WEIGHTS[signal.severity] ?? 0),
      0,
    );

    const breakdown: FusionBreakdownEntry[] = [
      { label: 'quality', score: clamp(1 - qualityPenalty, 0, 1), weight: 0.5 },
      { label: 'drift', score: clamp(1 - driftPenalty, 0, 1), weight: 0.2 },
      { label: 'safety', score: clamp(1 - safetyPenalty, 0, 1), weight: 0.3 },
    ];

    const fusionScore = Number(
      breakdown.reduce((total, entry) => total + entry.score * entry.weight, 0).toFixed(3),
    );

    return {
      clinicianId: input.clinicianId,
      fusionScore,
      evaluatedAt: new Date(),
      breakdown,
      qualitySignals: domainSignals,
      driftOpen: driftEvents.length,
      safetyAlerts: safetySignals.length,
    };
  }
}

export const fusionEngine = new FusionEngine();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
