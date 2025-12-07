import { PrismaClient } from '@prisma/client';

export type CompactEligibility = 'FULL' | 'PARTIAL' | 'NONE';

export interface ReadinessSignals {
  clinicianId: string;
  licenseFreshnessDays: number;
  sanctionsProbability: number;
  npdbHistory: {
    adverseActions: number;
    lastReportAt?: string | null;
  };
  compactEligibility: CompactEligibility;
}

export type ReadinessOverrides = Partial<Omit<ReadinessSignals, 'clinicianId'>>;

export interface ReadinessEngineResult {
  score: number;
  rationale: {
    components: {
      licenseFreshness: number;
      sanctions: number;
      npdb: number;
      compact: number;
    };
    notes: string[];
  };
  factors: Record<string, unknown>;
}

const prisma = new PrismaClient();

export class ReadinessEngine {
  async evaluateAndStore(signals: ReadinessSignals): Promise<ReadinessEngineResult> {
    const result = this.compute(signals);

    await prisma.clinicianReadinessScore.upsert({
      where: { clinicianId: signals.clinicianId },
      update: {
        score: result.score,
        factors: result.factors,
      },
      create: {
        clinicianId: signals.clinicianId,
        score: result.score,
        factors: result.factors,
      },
    });

    return result;
  }

  compute(signals: ReadinessSignals): ReadinessEngineResult {
    const components = {
      licenseFreshness: clamp(1 - signals.licenseFreshnessDays / 365, 0, 1),
      sanctions: clamp(1 - signals.sanctionsProbability, 0, 1),
      npdb: clamp(1 - signals.npdbHistory.adverseActions * 0.25, 0, 1),
      compact: deriveCompactScore(signals.compactEligibility),
    };

    const score =
      components.licenseFreshness * 0.35 +
      components.sanctions * 0.25 +
      components.npdb * 0.2 +
      components.compact * 0.2;

    const notes: string[] = [];
    if (signals.licenseFreshnessDays > 180) {
      notes.push('Primary source verification older than six months.');
    }
    if (signals.sanctionsProbability > 0.3) {
      notes.push('Sanctions risk flagged by rules engine.');
    }
    if (signals.npdbHistory.adverseActions > 0) {
      notes.push('Open NPDB history requires manual review.');
    }
    if (signals.compactEligibility === 'NONE') {
      notes.push('Clinician not part of any compact network.');
    }

    return {
      score: Number(score.toFixed(4)),
      rationale: { components, notes },
      factors: {
        clinicianId: signals.clinicianId,
        licenseFreshnessDays: signals.licenseFreshnessDays,
        sanctionsProbability: signals.sanctionsProbability,
        sanctions: {
          hasActive: signals.sanctionsProbability >= 0.35,
        },
        npdbHistory: signals.npdbHistory,
        compactEligibility: signals.compactEligibility,
        readinessComponents: components,
        notes,
      },
    };
  }
}

export function buildDefaultSignals(
  clinicianId: string,
  overrides: ReadinessOverrides = {}
): ReadinessSignals {
  return {
    clinicianId,
    licenseFreshnessDays: overrides.licenseFreshnessDays ?? 45,
    sanctionsProbability: overrides.sanctionsProbability ?? 0.08,
    npdbHistory: overrides.npdbHistory ?? { adverseActions: 0 },
    compactEligibility: overrides.compactEligibility ?? 'PARTIAL',
  };
}

function deriveCompactScore(eligibility: CompactEligibility): number {
  switch (eligibility) {
    case 'FULL':
      return 1;
    case 'PARTIAL':
      return 0.75;
    case 'NONE':
    default:
      return 0.45;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}


