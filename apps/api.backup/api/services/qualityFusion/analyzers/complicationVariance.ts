import { QualitySignal, createQualitySignal } from '../models/QualitySignal';

export interface ProcedureEventSample {
  eventId?: string;
  occurredAt: Date;
  complication: boolean;
  complicationSeverity?: 'MINOR' | 'MAJOR';
  durationMinutes?: number;
  caseType?: string;
}

export interface SpecialtyBaseline {
  avgComplicationRate: number; // 0-1
  stdComplicationRate?: number;
  avgDurationMinutes?: number;
  stdDurationMinutes?: number;
}

export interface ComplicationVarianceInput {
  clinicianId: string;
  specialty: string;
  events: ProcedureEventSample[];
  baseline: SpecialtyBaseline;
  windowDays?: number;
  minSamples?: number;
}

export interface ComplicationVarianceStats {
  sampleSize: number;
  complicationRate: number;
  durationStdDev?: number;
  windowStart: Date;
  windowEnd: Date;
}

export interface ComplicationVarianceResult {
  signals: QualitySignal[];
  stats: ComplicationVarianceStats;
}

const DEFAULT_WINDOW_DAYS = 90;
const DEFAULT_MIN_SAMPLES = 10;

export function analyzeComplicationVariance(
  input: ComplicationVarianceInput,
): ComplicationVarianceResult {
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const minSamples = input.minSamples ?? DEFAULT_MIN_SAMPLES;
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const scopedEvents = (input.events ?? []).filter(
    (event) =>
      event.occurredAt.getTime() >= windowStart.getTime() &&
      event.occurredAt.getTime() <= windowEnd.getTime(),
  );

  const sampleSize = scopedEvents.length;
  const stats: ComplicationVarianceStats = {
    sampleSize,
    complicationRate: 0,
    durationStdDev: undefined,
    windowStart,
    windowEnd,
  };

  if (sampleSize < minSamples) {
    return { signals: [], stats };
  }

  const complicationCount = scopedEvents.filter((event) => event.complication).length;
  const complicationRate = complicationCount / sampleSize;
  stats.complicationRate = Number(complicationRate.toFixed(4));

  const signals: QualitySignal[] = [];

  const baselineStd =
    input.baseline.stdComplicationRate ?? Math.max(input.baseline.avgComplicationRate * 0.1, 0.01);

  const deviation = complicationRate - input.baseline.avgComplicationRate;
  const zScore = deviation / baselineStd;

  if (deviation > baselineStd) {
    const severity = zScore > 3 ? 'CRITICAL' : zScore > 2 ? 'HIGH' : 'MED';
    signals.push(
      createQualitySignal({
        clinicianId: input.clinicianId,
        signalType: 'COMPLICATION_SPIKE',
        severity,
        timestamp: windowEnd,
        details: {
          summary: `Complication rate for ${input.specialty} exceeds baseline`,
          metric: 'complication_rate',
          observedValue: Number((complicationRate * 100).toFixed(2)),
          expectedValue: Number((input.baseline.avgComplicationRate * 100).toFixed(2)),
          threshold: Number(((input.baseline.avgComplicationRate + baselineStd) * 100).toFixed(2)),
          unit: 'percent',
          sampleSize,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
          metadata: {
            zScore: Number(zScore.toFixed(2)),
            complications: complicationCount,
          },
        },
        source: 'qualityFusion/complicationVariance',
      }),
    );
  }

  // Case variance (duration-based)
  const durations = scopedEvents
    .map((event) => event.durationMinutes)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);

  if (durations.length >= Math.min(minSamples, 5)) {
    const durationStd = calculateStdDev(durations);
    stats.durationStdDev = Number(durationStd.toFixed(2));
    const baselineDurationStd =
      input.baseline.stdDurationMinutes ?? Math.max(input.baseline.avgDurationMinutes ?? 30, 10) * 0.25;

    if (durationStd > baselineDurationStd * 1.5) {
      signals.push(
        createQualitySignal({
          clinicianId: input.clinicianId,
          signalType: 'EXCESSIVE_VARIANCE',
          severity: durationStd > baselineDurationStd * 2 ? 'HIGH' : 'MED',
          timestamp: windowEnd,
          details: {
            summary: `Case duration variance for ${input.specialty} exceeds control limits`,
            metric: 'case_duration_stddev',
            observedValue: Number(durationStd.toFixed(2)),
            expectedValue: Number(baselineDurationStd.toFixed(2)),
            sampleSize: durations.length,
            windowStart: windowStart.toISOString(),
            windowEnd: windowEnd.toISOString(),
          },
          source: 'qualityFusion/complicationVariance',
        }),
      );
    }
  }

  return { signals, stats };
}

function calculateStdDev(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

