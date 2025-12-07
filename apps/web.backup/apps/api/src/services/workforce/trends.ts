import { PrismaClient, type WorkforceTrend } from '@prisma/client';

const prisma = new PrismaClient();

export interface TrendIngestionPayload {
  specialty: string;
  region: string;
  hiringHistory: number[]; // trailing monthly hires
  credentialIssueVelocity: number[]; // issuances per month
  expiringLicenseDensity: number[]; // percentage per month
  credentialBacklog?: number;
  retirementsProjection?: number;
  sanctionsDensity?: number;
}

export interface TrendSignal {
  specialty: string;
  region: string;
  demandMomentum: number;
  supplyElasticity: number;
  credentialRisk: number;
  shortagePressure: number;
  signalConfidence: number;
  metadata?: Record<string, unknown>;
}

export async function ingestWorkforceTrends(
  payloads: TrendIngestionPayload[],
): Promise<TrendSignal[]> {
  const signals: TrendSignal[] = [];

  for (const payload of payloads) {
    const signal = computeTrendSignal(payload);
    signals.push(signal);

    await prisma.workforceTrend.create({
      data: {
        specialty: payload.specialty,
        region: payload.region,
        signals: {
          hiringHistory: payload.hiringHistory,
          credentialIssueVelocity: payload.credentialIssueVelocity,
          expiringLicenseDensity: payload.expiringLicenseDensity,
          credentialBacklog: payload.credentialBacklog ?? null,
          retirementsProjection: payload.retirementsProjection ?? null,
          sanctionsDensity: payload.sanctionsDensity ?? null,
        },
        predicted: signal,
      },
    });
  }

  return signals;
}

export function computeTrendSignal(payload: TrendIngestionPayload): TrendSignal {
  const demandMomentum = slope(payload.hiringHistory);
  const supplyElasticity = normalize(payload.credentialIssueVelocity.slice(-3).reduce((sum, value) => sum + value, 0) / Math.max(1, payload.credentialIssueVelocity.length), 0, 25);
  const credentialRisk = Math.min(
    1,
    average(payload.expiringLicenseDensity.slice(-3)) +
      (payload.credentialBacklog ?? 0) / 100,
  );
  const retirements = normalize(payload.retirementsProjection ?? 0, 0, 50);
  const sanctions = normalize(payload.sanctionsDensity ?? 0.05, 0, 0.3);

  const shortagePressure = clamp(
    demandMomentum * 0.35 +
      (1 - supplyElasticity) * 0.25 +
      credentialRisk * 0.2 +
      retirements * 0.1 +
      sanctions * 0.1,
  );

  const signalConfidence = clamp(
    0.6 +
      0.2 * Math.min(payload.hiringHistory.length, 12) / 12 +
      0.2 * Math.min(payload.credentialIssueVelocity.length, 12) / 12,
  );

  return {
    specialty: payload.specialty,
    region: payload.region,
    demandMomentum: clamp(demandMomentum),
    supplyElasticity,
    credentialRisk,
    shortagePressure,
    signalConfidence,
    metadata: {
      retirements,
      sanctions,
    },
  };
}

export function mapTrendRecord(record: WorkforceTrend): TrendSignal {
  const predicted = (record.predicted as TrendSignal | null) ?? null;
  if (predicted) {
    return predicted;
  }
  return computeTrendSignal({
    specialty: record.specialty,
    region: record.region,
    hiringHistory: toNumberArray(record.signals, 'hiringHistory'),
    credentialIssueVelocity: toNumberArray(record.signals, 'credentialIssueVelocity'),
    expiringLicenseDensity: toNumberArray(record.signals, 'expiringLicenseDensity'),
    credentialBacklog:
      typeof record.signals === 'object' && record.signals
        ? Number((record.signals as Record<string, unknown>).credentialBacklog) || 0
        : 0,
    retirementsProjection:
      typeof record.signals === 'object' && record.signals
        ? Number((record.signals as Record<string, unknown>).retirementsProjection) || 0
        : undefined,
    sanctionsDensity:
      typeof record.signals === 'object' && record.signals
        ? Number((record.signals as Record<string, unknown>).sanctionsDensity) || 0
        : undefined,
  });
}

function slope(series: number[]): number {
  if (series.length < 2) return 0;
  let numerator = 0;
  let denominator = 0;

  const meanX = (series.length - 1) / 2;
  const meanY = average(series);

  series.forEach((value, index) => {
    numerator += (index - meanX) * (value - meanY);
    denominator += Math.pow(index - meanX, 2);
  });

  if (denominator === 0) return 0;
  return clamp(numerator / denominator / 10 + 0.5);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return clamp((value - min) / (max - min));
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function toNumberArray(source: unknown, key: string): number[] {
  if (typeof source !== 'object' || source === null) return [];
  const value = (source as Record<string, unknown>)[key];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'number') return item;
      if (typeof item === 'string') {
        const parsed = Number(item);
        return Number.isNaN(parsed) ? null : parsed;
      }
      return null;
    })
    .filter((item): item is number => typeof item === 'number');
}










