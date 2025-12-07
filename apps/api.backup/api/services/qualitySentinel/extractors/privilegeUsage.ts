/**
 * B208A-QS-005: PrivilegeUsageAnomalyExtractor
 *
 * Detects outlier privilege usage patterns compared to peers/specialty baselines.
 */

import type {
  CreateQualityMicroSignalInput,
  QualityMicroSignalSeverity,
} from '../models/QualityMicroSignal.js';
import { createQualityMicroSignal } from '../models/QualityMicroSignal.js';

export interface PrivilegeUsage {
  privilegeCode: string;
  privilegeName: string;
  usageCount: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface SpecialtyBaseline {
  specialty: string;
  privilegeCode: string;
  meanUsage: number;
  stdDevUsage: number;
  percentile25: number;
  percentile75: number;
  sampleSize: number;
}

export interface PrivilegeUsageAnomalyConfig {
  zScoreThreshold: number; // Z-score threshold for anomaly detection (e.g., 2.0)
  percentileThreshold: number; // Percentile threshold (e.g., 0.95 = top 5%)
  minUsageForAnalysis: number; // Minimum usage count to consider
  minBaselineSampleSize: number; // Minimum baseline sample size to trust
}

const DEFAULT_CONFIG: PrivilegeUsageAnomalyConfig = {
  zScoreThreshold: 2.0, // 2 standard deviations
  percentileThreshold: 0.95, // Top 5%
  minUsageForAnalysis: 1,
  minBaselineSampleSize: 10,
};

/**
 * Calculate Z-score for usage compared to baseline
 */
function calculateUsageZScore(usage: number, baseline: SpecialtyBaseline): number {
  if (baseline.stdDevUsage === 0) {
    // If no variance, compare to mean
    return usage > baseline.meanUsage ? 1 : -1;
  }
  return (usage - baseline.meanUsage) / baseline.stdDevUsage;
}

/**
 * Check if usage is in extreme percentile
 */
function isExtremePercentile(usage: number, baseline: SpecialtyBaseline): boolean {
  // Check if usage is above 75th percentile significantly
  if (usage > baseline.percentile75) {
    const range = baseline.percentile75 - baseline.percentile25;
    if (range > 0) {
      const excess = usage - baseline.percentile75;
      const excessRatio = excess / range;
      // If usage is more than 50% above the 75th percentile, it's extreme
      return excessRatio > 0.5;
    }
  }
  return false;
}

/**
 * Extract privilege usage anomaly signals
 */
export class PrivilegeUsageAnomalyExtractor {
  private config: PrivilegeUsageAnomalyConfig;

  constructor(config?: Partial<PrivilegeUsageAnomalyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Extract privilege usage anomaly signals
   */
  extract(
    clinicianId: string,
    specialty: string,
    usage: PrivilegeUsage[],
    baselines: SpecialtyBaseline[]
  ): CreateQualityMicroSignalInput[] {
    const signals: CreateQualityMicroSignalInput[] = [];

    // Create baseline lookup map
    const baselineMap = new Map<string, SpecialtyBaseline>();
    for (const baseline of baselines) {
      if (baseline.specialty === specialty && baseline.sampleSize >= this.config.minBaselineSampleSize) {
        baselineMap.set(baseline.privilegeCode, baseline);
      }
    }

    // Analyze each privilege usage
    for (const usageItem of usage) {
      if (usageItem.usageCount < this.config.minUsageForAnalysis) {
        continue;
      }

      const baseline = baselineMap.get(usageItem.privilegeCode);
      if (!baseline) {
        // No baseline available for this privilege
        continue;
      }

      const zScore = calculateUsageZScore(usageItem.usageCount, baseline);
      const isExtreme = isExtremePercentile(usageItem.usageCount, baseline);

      // Detect anomalies: either high Z-score or extreme percentile
      if (Math.abs(zScore) > this.config.zScoreThreshold || isExtreme) {
        const isHighUsage = usageItem.usageCount > baseline.meanUsage;
        const severity: QualityMicroSignalSeverity =
          Math.abs(zScore) > this.config.zScoreThreshold * 1.5 || isExtreme ? 'MEDIUM' : 'LOW';

        const deviation = usageItem.usageCount - baseline.meanUsage;
        const deviationPercent = baseline.meanUsage > 0 ? (deviation / baseline.meanUsage) * 100 : 0;

        signals.push(
          createQualityMicroSignal({
            clinicianId,
            signalType: 'PRIVILEGE_UNUSUAL_USAGE',
            severity,
            timestamp: usageItem.periodEnd,
            details: {
              summary: `Unusual privilege usage: ${usageItem.privilegeName} (${usageItem.usageCount} uses vs ${baseline.meanUsage.toFixed(1)} peer average, ${deviationPercent > 0 ? '+' : ''}${deviationPercent.toFixed(1)}%)`,
              metric: 'PRIVILEGE_USAGE_COUNT',
              observedValue: usageItem.usageCount,
              expectedValue: baseline.meanUsage,
              threshold: baseline.meanUsage + baseline.stdDevUsage * this.config.zScoreThreshold,
              sampleSize: baseline.sampleSize,
              windowStart: usageItem.periodStart.toISOString(),
              windowEnd: usageItem.periodEnd.toISOString(),
              evidence: [
                { label: 'Usage Count', value: usageItem.usageCount },
                { label: 'Peer Mean', value: baseline.meanUsage },
                { label: 'Peer StdDev', value: baseline.stdDevUsage },
                { label: 'Z-Score', value: zScore },
                { label: 'Deviation %', value: deviationPercent },
              ],
              metadata: {
                privilegeCode: usageItem.privilegeCode,
                specialty,
                percentile25: baseline.percentile25,
                percentile75: baseline.percentile75,
                isExtremePercentile: isExtreme,
              },
            },
            source: 'PrivilegeUsageAnomalyExtractor',
          })
        );
      }
    }

    return signals;
  }

  /**
   * Extract signals for multiple privileges at once
   */
  extractBatch(
    clinicianId: string,
    specialty: string,
    usage: PrivilegeUsage[],
    baselines: SpecialtyBaseline[]
  ): CreateQualityMicroSignalInput[] {
    return this.extract(clinicianId, specialty, usage, baselines);
  }
}

/**
 * Default extractor instance
 */
export const privilegeUsageAnomalyExtractor = new PrivilegeUsageAnomalyExtractor();

