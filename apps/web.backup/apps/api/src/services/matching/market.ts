import { clamp01 } from './features';

export interface MarketSignalSnapshot {
  region: string;
  specialty: string;
  demand: number;
  supply: number;
  updatedAt: Date | string;
}

export type MarketPressure = 'tight' | 'balanced' | 'surplus';

export interface MarketEquilibrium {
  region: string;
  specialty: string;
  demandIndex: number;
  supplyIndex: number;
  equilibriumScore: number;
  pressure: MarketPressure;
  marketRatio: number;
  projectedFillTimeDays: number;
  recommendedAction: string;
  refreshedAt: string;
}

export interface MarketEquilibriumOptions {
  baselineDemand?: number;
  baselineSupply?: number;
  priorityRegion?: string;
  prioritySpecialty?: string;
}

const DEFAULT_BASELINE = 100;

export function calculateMarketEquilibrium(
  signals: MarketSignalSnapshot[],
  options: MarketEquilibriumOptions = {},
): MarketEquilibrium {
  const { baselineDemand = DEFAULT_BASELINE, baselineSupply = DEFAULT_BASELINE } = options;
  const scopedSignals = (signals.length ? scopeSignals(signals, options) : []).filter(Boolean);
  if (!scopedSignals.length) {
    scopedSignals.push(
      fallbackMarketSignal(
        options.prioritySpecialty ?? 'GENERAL',
        options.priorityRegion ?? 'NATIONAL',
      ),
    );
  }

  const aggregate = scopedSignals.reduce(
    (acc, signal) => {
      acc.demand += signal.demand;
      acc.supply += signal.supply;
      if (!acc.region) acc.region = signal.region;
      if (!acc.specialty) acc.specialty = signal.specialty;
      return acc;
    },
    {
      demand: 0,
      supply: 0,
      region: options.priorityRegion ?? scopedSignals[0]?.region ?? 'UNKNOWN',
      specialty: options.prioritySpecialty ?? scopedSignals[0]?.specialty ?? 'GENERAL',
    },
  );

  const demandIndex = clamp01(aggregate.demand / baselineDemand);
  const supplyIndex = clamp01(aggregate.supply / baselineSupply);
  const marketRatio = clampRatio(aggregate.demand, aggregate.supply);
  const pressure = derivePressure(marketRatio);
  const equilibriumScore = deriveEquilibriumScore(demandIndex, supplyIndex);
  const projectedFillTimeDays = estimateFillTime(marketRatio);

  return {
    region: aggregate.region,
    specialty: aggregate.specialty,
    demandIndex,
    supplyIndex,
    equilibriumScore,
    pressure,
    marketRatio,
    projectedFillTimeDays,
    recommendedAction: buildRecommendation(pressure, equilibriumScore),
    refreshedAt: newestTimestamp(scopedSignals),
  };
}

export function fallbackMarketSignal(specialty: string, region: string): MarketSignalSnapshot {
  return {
    region,
    specialty,
    demand: DEFAULT_BASELINE * 0.8,
    supply: DEFAULT_BASELINE * 0.85,
    updatedAt: new Date(),
  };
}

function scopeSignals(signals: MarketSignalSnapshot[], options: MarketEquilibriumOptions) {
  const filtered = signals.filter((signal) => {
    if (options.priorityRegion && signal.region !== options.priorityRegion) {
      return false;
    }
    if (options.prioritySpecialty && signal.specialty !== options.prioritySpecialty) {
      return false;
    }
    return true;
  });
  return filtered.length ? filtered : signals;
}

function clampRatio(demand: number, supply: number): number {
  if (supply <= 0) {
    return 2;
  }
  return clamp01(demand / supply) * 2;
}

function derivePressure(ratio: number): MarketPressure {
  if (ratio >= 1.25) {
    return 'tight';
  }
  if (ratio <= 0.85) {
    return 'surplus';
  }
  return 'balanced';
}

function deriveEquilibriumScore(demandIndex: number, supplyIndex: number): number {
  const delta = Math.abs(demandIndex - supplyIndex);
  return clamp01(1 - delta * 0.8);
}

function estimateFillTime(ratio: number): number {
  if (ratio >= 1.5) {
    return 90;
  }
  if (ratio >= 1.2) {
    return 60;
  }
  if (ratio >= 0.9) {
    return 45;
  }
  if (ratio >= 0.75) {
    return 30;
  }
  return 21;
}

function buildRecommendation(pressure: MarketPressure, score: number): string {
  if (pressure === 'tight') {
    return score >= 0.65
      ? 'Escalate incentives to secure commitment within 30 days.'
      : 'Pair with relocation stipend + compact unlock to stay competitive.';
  }
  if (pressure === 'surplus') {
    return 'Supply surplus — focus on trust + efficiency to differentiate.';
  }
  return 'Balanced market — maintain current pipeline velocity.';
}

function newestTimestamp(signals: MarketSignalSnapshot[]): string {
  if (!signals.length) {
    return new Date().toISOString();
  }
  const latest = signals.reduce((latestTs, signal) => {
    const current = new Date(signal.updatedAt).getTime();
    return current > latestTs ? current : latestTs;
  }, 0);
  return new Date(latest || Date.now()).toISOString();
}

