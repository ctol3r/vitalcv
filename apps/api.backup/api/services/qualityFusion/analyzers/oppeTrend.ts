import {
  QualitySignal,
  createQualitySignal,
  QualitySignalSeverity,
} from '../models/QualitySignal';

export interface OppeMetricsSample {
  caseId?: string;
  periodStart: Date;
  periodEnd: Date;
  caseCount: number;
  complications?: number;
  issuesFlagged?: number;
  licenseIssues?: number;
  boardAlerts?: number;
  deaFindings?: number;
}

export interface OppeTrendAnalyzerInput {
  clinicianId: string;
  specialty?: string;
  cases: OppeMetricsSample[];
  options?: Partial<OppeTrendAnalyzerOptions>;
}

export interface OppeTrendAnalyzerOptions {
  minSamples: number;
  slopeThreshold: number;
  varianceThreshold: number;
  volumeDipThreshold: number;
}

const DEFAULT_OPTIONS: OppeTrendAnalyzerOptions = {
  minSamples: 3,
  slopeThreshold: 0.05,
  varianceThreshold: 0.35,
  volumeDipThreshold: 0.35,
};

export function analyzeOppeTrends(input: OppeTrendAnalyzerInput): QualitySignal[] {
  const options = { ...DEFAULT_OPTIONS, ...input.options };
  if (!input.cases || input.cases.length < options.minSamples) {
    return [];
  }

  const sortedCases = [...input.cases].sort(
    (a, b) => a.periodEnd.getTime() - b.periodEnd.getTime(),
  );
  const qualityScores = sortedCases.map(computeQualityScore);
  const signals: QualitySignal[] = [];
  const windowStart = sortedCases[0].periodStart;
  const windowEnd = sortedCases[sortedCases.length - 1].periodEnd;

  // Trend detection
  const slope = linearRegressionSlope(qualityScores);
  if (slope < -options.slopeThreshold) {
    signals.push(
      createQualitySignal({
        clinicianId: input.clinicianId,
        signalType: 'OPPE_LOW',
        severity: slope < -options.slopeThreshold * 2 ? 'CRITICAL' : 'HIGH',
        timestamp: windowEnd,
        details: {
          summary: 'OPPE quality trend is deteriorating',
          metric: 'quality_score',
          observedValue: Number(slope.toFixed(3)),
          threshold: -options.slopeThreshold,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
          tags: input.specialty ? [input.specialty] : undefined,
        },
        source: 'qualityFusion/oppeTrend',
      }),
    );
  }

  // Variability detection
  const variability = coefficientOfVariation(qualityScores);
  if (variability > options.varianceThreshold) {
    signals.push(
      createQualitySignal({
        clinicianId: input.clinicianId,
        signalType: 'EXCESSIVE_VARIANCE',
        severity: variability > options.varianceThreshold * 1.5 ? 'HIGH' : 'MED',
        timestamp: windowEnd,
        details: {
          summary: 'OPPE quality scores show unusual variability',
          metric: 'quality_score_cv',
          observedValue: Number(variability.toFixed(2)),
          threshold: options.varianceThreshold,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
          tags: input.specialty ? [input.specialty] : undefined,
        },
        source: 'qualityFusion/oppeTrend',
      }),
    );
  }

  // Volume dip detection
  const caseVolumes = sortedCases.map((sample) => sample.caseCount);
  const averageVolume = mean(caseVolumes);
  const latestVolume = caseVolumes[caseVolumes.length - 1];
  if (averageVolume > 0 && latestVolume < averageVolume * (1 - options.volumeDipThreshold)) {
    const severity =
      latestVolume < averageVolume * (1 - options.volumeDipThreshold * 1.5)
        ? 'HIGH'
        : ('MED' as QualitySignalSeverity);
    signals.push(
      createQualitySignal({
        clinicianId: input.clinicianId,
        signalType: 'LOW_VOLUME',
        severity,
        timestamp: sortedCases[sortedCases.length - 1].periodEnd,
        details: {
          summary: 'Recent OPPE cycle has a significant case volume dip',
          metric: 'case_volume',
          observedValue: latestVolume,
          expectedValue: Number(averageVolume.toFixed(1)),
          threshold: Number((averageVolume * (1 - options.volumeDipThreshold)).toFixed(1)),
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
        },
        source: 'qualityFusion/oppeTrend',
      }),
    );
  }

  return signals;
}

function computeQualityScore(sample: OppeMetricsSample): number {
  const penalty =
    (sample.complications ?? 0) +
    (sample.issuesFlagged ?? 0) +
    (sample.licenseIssues ?? 0) +
    (sample.boardAlerts ?? 0) +
    (sample.deaFindings ?? 0);
  const base = Math.max(sample.caseCount, 1);
  const score = (sample.caseCount - penalty) / base;
  return Math.max(0, Number(score.toFixed(4)));
}

function linearRegressionSlope(values: number[]): number {
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(values);

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  if (denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], precomputedMean?: number): number {
  if (values.length <= 1) {
    return 0;
  }
  const avg = precomputedMean ?? mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function coefficientOfVariation(values: number[]): number {
  const avg = mean(values);
  if (avg === 0) {
    return 0;
  }
  return standardDeviation(values, avg) / Math.abs(avg);
}

