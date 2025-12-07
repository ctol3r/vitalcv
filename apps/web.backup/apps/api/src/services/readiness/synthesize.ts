import { differenceInDays } from 'date-fns';
import {
  PrismaClient,
  type Prisma,
  type ReadinessSignal as ReadinessSignalRecord,
} from '@prisma/client';
import {
  collectReadinessSignals,
  type ReadinessSignalType,
  TRACKED_SIGNAL_TYPES,
  isReadinessSignalType,
} from './signals';
import { recordReadinessChange } from './changelog';

const prisma = new PrismaClient();

const SIGNAL_WEIGHTS: Record<ReadinessSignalType, number> = {
  license: 0.18,
  board: 0.12,
  sanctions: 0.14,
  npdb: 0.12,
  compact: 0.1,
  dea: 0.1,
  privilege: 0.12,
  experience: 0.12,
};

type WeightMap = Record<ReadinessSignalType, number>;

export interface ReadinessSynthesisOptions {
  prisma?: PrismaClient;
  refreshSignals?: boolean;
}

export interface SynthesizedSignal {
  type: ReadinessSignalType;
  score: number;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface ReadinessSynthesisResult {
  clinicianId: string;
  readinessScore: number;
  recencyPenalty: number;
  weights: WeightMap;
  signalBreakdown: SynthesizedSignal[];
  recommendedActions: string[];
}

export async function synthesizeReadinessV5(
  clinicianId: string,
  options: ReadinessSynthesisOptions = {},
): Promise<ReadinessSynthesisResult> {
  const client = options.prisma ?? prisma;

  const existingScore = await client.clinicianReadinessScore.findUnique({
    where: { clinicianId },
  });

  const { signals, previousSignals } = await collectReadinessSignals(clinicianId, {
    prisma: client,
    refresh: options.refreshSignals ?? true,
  });

  const normalizedWeights = normalizeWeights(SIGNAL_WEIGHTS);
  const enriched = buildSignalBreakdown(signals);

  const weightedScore = enriched.reduce((total, signal) => {
    const weight = normalizedWeights[signal.type] ?? 0;
    return total + signal.effectiveScore * weight;
  }, 0);

  const recencyPenalty = deriveRecencyPenalty(signals);
  const readinessScore = clamp01(weightedScore - recencyPenalty);
  const recommendedActions = recommendActions(enriched);

  await client.clinicianReadinessScore.upsert({
    where: { clinicianId },
    update: {
      score: readinessScore,
      factors: buildFactorSnapshot(enriched, recencyPenalty, normalizedWeights, recommendedActions),
    },
    create: {
      clinicianId,
      score: readinessScore,
      factors: buildFactorSnapshot(enriched, recencyPenalty, normalizedWeights, recommendedActions),
    },
  });

  await recordReadinessChange({
    clinicianId,
    previousScore: existingScore?.score ?? null,
    nextScore: readinessScore,
    previousSignals,
    currentSignals: signals,
  });

  return {
    clinicianId,
    readinessScore,
    recencyPenalty,
    weights: normalizedWeights,
    signalBreakdown: enriched.map(({ effectiveScore, ...rest }) => rest),
    recommendedActions,
  };
}

function buildSignalBreakdown(signals: ReadinessSignalRecord[]) {
  return signals
    .map((signal) => {
      const type = isReadinessSignalType(signal.type) ? signal.type : TRACKED_SIGNAL_TYPES[0];
      const metadata = toMetadataRecord(signal.metadata);
      return {
        type,
        score: signal.score,
        effectiveScore: deriveEffectiveScore(signal, metadata),
        updatedAt: signal.updatedAt.toISOString(),
        metadata,
      };
    })
    .sort(
      (a, b) => TRACKED_SIGNAL_TYPES.indexOf(a.type) - TRACKED_SIGNAL_TYPES.indexOf(b.type),
    );
}

function deriveEffectiveScore(
  signal: ReadinessSignalRecord,
  metadata: Record<string, unknown>,
): number {
  const riskScore = typeof metadata.riskScore === 'number' ? metadata.riskScore : null;
  if (typeof riskScore === 'number' && Number.isFinite(riskScore)) {
    return clamp01(1 - riskScore);
  }
  return clamp01(signal.score);
}

function deriveRecencyPenalty(signals: ReadinessSignalRecord[]): number {
  if (!signals.length) {
    return 0;
  }
  const oldest = signals.reduce<Date | null>((current, signal) => {
    if (!current) return signal.updatedAt;
    return signal.updatedAt < current ? signal.updatedAt : current;
  }, null);

  if (!oldest) {
    return 0;
  }

  const days = differenceInDays(new Date(), oldest);
  return clamp01(Math.min(days / 200, 0.12));
}

function recommendActions(
  signals: Array<{
    type: ReadinessSignalType;
    score: number;
    metadata: Record<string, unknown>;
  }>,
): string[] {
  return [...signals]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((signal) => buildActionForSignal(signal.type, signal.metadata));
}

function buildActionForSignal(
  type: ReadinessSignalType,
  metadata: Record<string, unknown>,
): string {
  switch (type) {
    case 'license': {
      const state = typeof metadata.state === 'string' ? metadata.state : 'primary state';
      const lastCheck = formatAsDate(metadata.lastCheckedAt);
      return `Refresh PSV in ${state} (last check ${lastCheck}).`;
    }
    case 'board': {
      const mismatches =
        typeof metadata.mismatchCount === 'number' ? metadata.mismatchCount : 0;
      return mismatches > 0
        ? `Resolve ${mismatches} open board mismatch${mismatches === 1 ? '' : 'es'}.`
        : 'Schedule next board audit to keep clean room fresh.';
    }
    case 'sanctions': {
      const risk =
        typeof metadata.sanctionsProbability === 'number'
          ? metadata.sanctionsProbability
          : 0.08;
      return `Re-run sanctions sweep (current risk ${(risk * 100).toFixed(1)}%).`;
    }
    case 'npdb': {
      const adverse =
        typeof metadata.adverseActions === 'number' ? metadata.adverseActions : 0;
      return adverse > 0
        ? `Escalate NPDB review (${adverse} adverse action${adverse === 1 ? '' : 's'}).`
        : 'Capture NPDB attestation to lock in clean history.';
    }
    case 'compact': {
      const eligibility =
        typeof metadata.compactEligibility === 'string'
          ? metadata.compactEligibility
          : 'PENDING';
      return `File compact paperwork (status: ${eligibility}).`;
    }
    case 'dea': {
      const expiration = formatAsDate(metadata.expiration);
      return `Renew DEA credential before ${expiration}.`;
    }
    case 'privilege': {
      const active =
        typeof metadata.activeSignals === 'number' ? metadata.activeSignals : 0;
      return active > 0
        ? `Work with medical staff office to resolve ${active} privilege safety flag${
            active === 1 ? '' : 's'
          }.`
        : 'Capture fresh privilege eligibility evidence this quarter.';
    }
    case 'experience':
    default: {
      return 'Record recent case logs & procedure volume to strengthen experience signal.';
    }
  }
}

function buildFactorSnapshot(
  signals: Array<{
    type: ReadinessSignalType;
    score: number;
    metadata: Record<string, unknown>;
  }>,
  recencyPenalty: number,
  weights: WeightMap,
  actions: string[],
): Prisma.JsonObject {
  return {
    readinessComponents: signals.reduce<Record<string, number>>((map, signal) => {
      map[signal.type] = signal.score;
      return map;
    }, {}),
    recencyPenalty,
    weights,
    recommendedActions: actions,
    synthesizedAt: new Date().toISOString(),
  };
}

function normalizeWeights(weights: Record<ReadinessSignalType, number>): WeightMap {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  return Object.entries(weights).reduce<WeightMap>(
    (map, [key, value]) => {
      map[key as ReadinessSignalType] = total === 0 ? 0 : value / total;
      return map;
    },
    {} as WeightMap,
  );
}

function toMetadataRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function formatAsDate(value: unknown): string {
  if (typeof value !== 'string') {
    return 'recently';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'recently';
  }
  return parsed.toLocaleDateString();
}










