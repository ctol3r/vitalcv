import type { TrendSignal } from './trends';

export interface ForecastOptions {
  horizons?: number[];
  orgId?: string;
}

export interface ForecastHorizon {
  horizonDays: number;
  shortageIndex: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  recommendedHires: number;
}

export interface WorkforceForecastEntry {
  specialty: string;
  region: string;
  shortageIndex: number;
  riskLevel: ForecastHorizon['riskLevel'];
  signalConfidence: number;
  horizons: ForecastHorizon[];
  recommendedHires: number;
  surgeReadiness: number;
}

const DEFAULT_HORIZONS = [30, 60, 90];

export function generateWorkforceForecast(
  trends: TrendSignal[],
  options: ForecastOptions = {},
): WorkforceForecastEntry[] {
  if (!trends.length) return [];

  return trends.map((trend) => {
    const baseShortage = computeShortageIndex(trend);
    const horizons = (options.horizons ?? DEFAULT_HORIZONS).map((horizon) =>
      buildHorizon(baseShortage, trend, horizon),
    );

    const headline = horizons[0];
    const surgeReadiness = Math.max(0, 1 - trend.supplyElasticity);

    return {
      specialty: trend.specialty,
      region: trend.region,
      shortageIndex: headline.shortageIndex,
      riskLevel: headline.riskLevel,
      signalConfidence: trend.signalConfidence,
      horizons,
      recommendedHires: headline.recommendedHires,
      surgeReadiness,
    };
  });
}

function computeShortageIndex(trend: TrendSignal): number {
  return clamp(
    trend.shortagePressure * 0.5 +
      (1 - trend.supplyElasticity) * 0.2 +
      trend.demandMomentum * 0.2 +
      trend.credentialRisk * 0.1,
  );
}

function buildHorizon(
  baseShortage: number,
  trend: TrendSignal,
  horizonDays: number,
): ForecastHorizon {
  const horizonFactor = horizonDays / 90;
  const shortageIndex = clamp(
    baseShortage + horizonFactor * (trend.shortagePressure - 0.5) * 0.2,
  );
  const recommendedHires = Math.round(
    (shortageIndex * 100) / 5 + (1 - trend.supplyElasticity) * 8,
  );

  return {
    horizonDays,
    shortageIndex,
    riskLevel: classifyRisk(shortageIndex),
    recommendedHires,
  };
}

function classifyRisk(score: number): ForecastHorizon['riskLevel'] {
  if (score >= 0.8) return 'critical';
  if (score >= 0.65) return 'high';
  if (score >= 0.45) return 'moderate';
  return 'low';
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}










