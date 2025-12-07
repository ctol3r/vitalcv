/**
 * B208A-QS-002: OPPEMicroDriftExtractor
 *
 * Detects slight downward trend or variance before formal OPPE failure.
 * Uses rolling windows to identify subtle patterns that precede formal OPPE issues.
 */

import type {
  CreateQualityMicroSignalInput,
  QualityMicroSignalSeverity,
} from '../models/QualityMicroSignal.js';
import { createQualityMicroSignal } from '../models/QualityMicroSignal.js';

export interface OPPECase {
  id: string;
  clinicianId: string;
  reviewDate: Date;
  score?: number; // 0-1 normalized score
  caseCount?: number;
  complications?: number;
  outcome?: 'PASS' | 'FAIL' | 'MARGINAL' | 'PENDING';
}

export interface OPPEMicroDriftConfig {
  windowSize: number; // Number of reviews to consider in rolling window
  minWindowSize: number; // Minimum reviews needed to detect drift
  trendThreshold: number; // Slope threshold for downward trend (negative value)
  varianceThreshold: number; // Coefficient of variation threshold
  minCaseCount?: number; // Minimum cases needed for meaningful analysis
}

const DEFAULT_CONFIG: OPPEMicroDriftConfig = {
  windowSize: 6, // Last 6 reviews
  minWindowSize: 3, // Need at least 3 reviews
  trendThreshold: -0.05, // 5% decline per review
  varianceThreshold: 0.25, // 25% coefficient of variation
  minCaseCount: 10,
};

/**
 * Calculate linear regression slope for trend detection
 */
function calculateSlope(values: number[]): number {
  if (values.length < 2) return 0;

  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return slope;
}

/**
 * Calculate coefficient of variation (CV) = stdDev / mean
 */
function calculateCoefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;

  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return stdDev / mean;
}

/**
 * Extract OPPE micro-drift signals
 */
export class OPPEMicroDriftExtractor {
  private config: OPPEMicroDriftConfig;

  constructor(config?: Partial<OPPEMicroDriftConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Extract micro-drift signals from OPPE cases
   */
  extract(
    clinicianId: string,
    oppeCases: OPPECase[]
  ): CreateQualityMicroSignalInput[] {
    const signals: CreateQualityMicroSignalInput[] = [];

    if (oppeCases.length < this.config.minWindowSize) {
      return signals;
    }

    // Sort by review date (oldest first)
    const sortedCases = [...oppeCases].sort(
      (a, b) => a.reviewDate.getTime() - b.reviewDate.getTime()
    );

    // Use rolling window approach
    for (let i = this.config.windowSize - 1; i < sortedCases.length; i++) {
      const window = sortedCases.slice(i - this.config.windowSize + 1, i + 1);
      const windowSignals = this.analyzeWindow(clinicianId, window);
      signals.push(...windowSignals);
    }

    return signals;
  }

  /**
   * Analyze a rolling window of OPPE cases
   */
  private analyzeWindow(
    clinicianId: string,
    window: OPPECase[]
  ): CreateQualityMicroSignalInput[] {
    const signals: CreateQualityMicroSignalInput[] = [];

    // Filter cases with scores
    const scoredCases = window.filter((c) => c.score !== undefined);
    if (scoredCases.length < this.config.minWindowSize) {
      return signals;
    }

    // Check minimum case count if configured
    const totalCases = window.reduce((sum, c) => sum + (c.caseCount || 0), 0);
    if (this.config.minCaseCount && totalCases < this.config.minCaseCount) {
      return signals;
    }

    const scores = scoredCases.map((c) => c.score!);

    // Detect downward trend
    const slope = calculateSlope(scores);
    if (slope < this.config.trendThreshold) {
      const severity: QualityMicroSignalSeverity = slope < this.config.trendThreshold * 2 ? 'MEDIUM' : 'LOW';
      signals.push(
        createQualityMicroSignal({
          clinicianId,
          signalType: 'WEAK_OPPE_DRIFT',
          severity,
          timestamp: window[window.length - 1].reviewDate,
          details: {
            summary: `Slight downward trend detected in OPPE scores (slope: ${slope.toFixed(4)})`,
            metric: 'OPPE_SCORE_TREND',
            observedValue: slope,
            expectedValue: 0,
            threshold: this.config.trendThreshold,
            sampleSize: scores.length,
            windowStart: window[0].reviewDate.toISOString(),
            windowEnd: window[window.length - 1].reviewDate.toISOString(),
            evidence: [
              { label: 'Slope', value: slope },
              { label: 'Window Size', value: scores.length },
              { label: 'Mean Score', value: scores.reduce((a, b) => a + b, 0) / scores.length },
            ],
          },
          source: 'OPPEMicroDriftExtractor',
        })
      );
    }

    // Detect excessive variance
    const cv = calculateCoefficientOfVariation(scores);
    if (cv > this.config.varianceThreshold) {
      const severity: QualityMicroSignalSeverity = cv > this.config.varianceThreshold * 1.5 ? 'MEDIUM' : 'LOW';
      signals.push(
        createQualityMicroSignal({
          clinicianId,
          signalType: 'WEAK_OPPE_DRIFT',
          severity,
          timestamp: window[window.length - 1].reviewDate,
          details: {
            summary: `Excessive variance in OPPE scores (CV: ${cv.toFixed(4)})`,
            metric: 'OPPE_SCORE_VARIANCE',
            observedValue: cv,
            expectedValue: 0.1, // Expected CV around 10%
            threshold: this.config.varianceThreshold,
            sampleSize: scores.length,
            windowStart: window[0].reviewDate.toISOString(),
            windowEnd: window[window.length - 1].reviewDate.toISOString(),
            evidence: [
              { label: 'Coefficient of Variation', value: cv },
              { label: 'Window Size', value: scores.length },
              { label: 'Score Range', value: Math.max(...scores) - Math.min(...scores) },
            ],
          },
          source: 'OPPEMicroDriftExtractor',
        })
      );
    }

    return signals;
  }
}

/**
 * Default extractor instance
 */
export const oppeMicroDriftExtractor = new OPPEMicroDriftExtractor();

