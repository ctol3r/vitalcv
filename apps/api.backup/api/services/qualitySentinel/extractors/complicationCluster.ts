/**
 * B208A-QS-003: ComplicationClusterDetector
 *
 * Finds subtle clusters of complications that are below formal thresholds
 * but still unusual. Example: 2 complications in 20 cases → below threshold but unusual.
 */

import type {
  CreateQualityMicroSignalInput,
  QualityMicroSignalSeverity,
} from '../models/QualityMicroSignal.js';
import { createQualityMicroSignal } from '../models/QualityMicroSignal.js';

export interface ComplicationCase {
  id: string;
  clinicianId: string;
  caseDate: Date;
  hasComplication: boolean;
  complicationType?: string;
  caseComplexity?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ComplicationClusterConfig {
  windowSize: number; // Number of cases to analyze in a window
  minWindowSize: number; // Minimum cases needed for analysis
  clusterThreshold: number; // Complication rate that triggers a signal (e.g., 0.1 = 10%)
  baselineRate: number; // Expected baseline complication rate (e.g., 0.02 = 2%)
  minCasesForCluster: number; // Minimum number of complications to consider it a cluster
}

const DEFAULT_CONFIG: ComplicationClusterConfig = {
  windowSize: 20, // Analyze last 20 cases
  minWindowSize: 10, // Need at least 10 cases
  clusterThreshold: 0.1, // 10% complication rate triggers signal
  baselineRate: 0.02, // 2% baseline rate
  minCasesForCluster: 2, // At least 2 complications needed
};

/**
 * Calculate statistical significance using binomial test approximation
 */
function calculateZScore(observed: number, total: number, expectedRate: number): number {
  if (total === 0) return 0;

  const expected = total * expectedRate;
  const variance = total * expectedRate * (1 - expectedRate);
  if (variance === 0) return 0;

  const zScore = (observed - expected) / Math.sqrt(variance);
  return zScore;
}

/**
 * Extract complication cluster signals
 */
export class ComplicationClusterDetector {
  private config: ComplicationClusterConfig;

  constructor(config?: Partial<ComplicationClusterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Extract complication cluster signals from cases
   */
  extract(
    clinicianId: string,
    cases: ComplicationCase[]
  ): CreateQualityMicroSignalInput[] {
    const signals: CreateQualityMicroSignalInput[] = [];

    if (cases.length < this.config.minWindowSize) {
      return signals;
    }

    // Sort by case date (oldest first)
    const sortedCases = [...cases].sort(
      (a, b) => a.caseDate.getTime() - b.caseDate.getTime()
    );

    // Use sliding window approach
    for (let i = this.config.windowSize - 1; i < sortedCases.length; i++) {
      const window = sortedCases.slice(i - this.config.windowSize + 1, i + 1);
      const windowSignal = this.analyzeWindow(clinicianId, window);
      if (windowSignal) {
        signals.push(windowSignal);
      }
    }

    return signals;
  }

  /**
   * Analyze a window of cases for complication clusters
   */
  private analyzeWindow(
    clinicianId: string,
    window: ComplicationCase[]
  ): CreateQualityMicroSignalInput | null {
    const complications = window.filter((c) => c.hasComplication);
    const complicationCount = complications.length;
    const totalCases = window.length;

    if (complicationCount < this.config.minCasesForCluster) {
      return null;
    }

    const complicationRate = complicationCount / totalCases;

    // Check if rate exceeds threshold
    if (complicationRate < this.config.clusterThreshold) {
      // Below formal threshold, but check if it's statistically unusual
      const zScore = calculateZScore(complicationCount, totalCases, this.config.baselineRate);

      // If z-score > 1.5, it's statistically unusual (one-tailed test)
      if (zScore > 1.5) {
        const severity: QualityMicroSignalSeverity = zScore > 2.5 ? 'MEDIUM' : 'LOW';

        // Group complications by type if available
        const complicationTypes = complications
          .map((c) => c.complicationType || 'UNKNOWN')
          .reduce((acc, type) => {
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

        return createQualityMicroSignal({
          clinicianId,
          signalType: 'MINOR_COMPLICATION_CLUSTER',
          severity,
          timestamp: window[window.length - 1].caseDate,
          details: {
            summary: `Subtle complication cluster detected: ${complicationCount} complications in ${totalCases} cases (${(complicationRate * 100).toFixed(1)}%)`,
            metric: 'COMPLICATION_RATE',
            observedValue: complicationRate,
            expectedValue: this.config.baselineRate,
            threshold: this.config.clusterThreshold,
            sampleSize: totalCases,
            windowStart: window[0].caseDate.toISOString(),
            windowEnd: window[window.length - 1].caseDate.toISOString(),
            evidence: [
              { label: 'Complication Count', value: complicationCount },
              { label: 'Total Cases', value: totalCases },
              { label: 'Complication Rate', value: complicationRate },
              { label: 'Z-Score', value: zScore },
              { label: 'Baseline Rate', value: this.config.baselineRate },
            ],
            metadata: {
              complicationTypes,
              zScore,
            },
          },
          source: 'ComplicationClusterDetector',
        });
      }
    }

    return null;
  }
}

/**
 * Default detector instance
 */
export const complicationClusterDetector = new ComplicationClusterDetector();

