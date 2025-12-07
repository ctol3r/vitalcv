/**
 * B222B-ETH-006: BiasDetectionEngine
 *
 * Monitors autonomous decisions for potential bias (e.g. geographical, demographic, institutional);
 * flags anomalies; integrates with ResearchKernel.
 */

import { createLogger } from '@chai-vc/logging-core';
import { PrismaClient } from '@prisma/client';

const logger = createLogger({ service: 'ethics-bias-detector' });
const prisma = new PrismaClient();

/**
 * Types of bias that can be detected
 */
export enum BiasType {
  GEOGRAPHICAL = 'geographical',
  DEMOGRAPHIC = 'demographic',
  INSTITUTIONAL = 'institutional',
  TEMPORAL = 'temporal',
  SPECIALTY = 'specialty',
}

/**
 * Bias detection result
 */
export interface BiasDetectionResult {
  /** Whether bias was detected */
  biasDetected: boolean;
  /** Type of bias detected */
  biasType?: BiasType;
  /** Severity level (0-1, where 1 is most severe) */
  severity: number;
  /** Description of the detected bias */
  description: string;
  /** Statistical evidence supporting the detection */
  evidence: {
    metric: string;
    value: number;
    threshold: number;
    comparison?: {
      group: string;
      value: number;
    };
  };
  /** Recommendations for mitigation */
  recommendations?: string[];
  /** Timestamp of detection */
  detectedAt: Date;
}

/**
 * Autonomous decision context for bias analysis
 */
export interface AutonomousDecisionContext {
  /** Decision ID */
  decisionId: string;
  /** Organization ID */
  orgId?: string;
  /** Region/geographical area */
  region?: string;
  /** Decision type */
  decisionType: string;
  /** Subject demographics (anonymized) */
  demographics?: {
    ageGroup?: string;
    gender?: string;
    ethnicity?: string;
    specialty?: string;
  };
  /** Institution information */
  institution?: {
    type?: string;
    size?: string;
    region?: string;
  };
  /** Decision outcome */
  outcome: 'approved' | 'rejected' | 'deferred' | 'pending';
  /** Decision metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp */
  timestamp: Date;
}

/**
 * ResearchKernel interface for integration
 * This is a placeholder - actual ResearchKernel implementation would be provided separately
 */
export interface ResearchKernel {
  /**
   * Query research data for bias analysis
   */
  queryBiasMetrics(params: {
    decisionType: string;
    timeRange: { start: Date; end: Date };
    filters?: Record<string, unknown>;
  }): Promise<{
    totalDecisions: number;
    byDemographic: Record<string, number>;
    byGeographical: Record<string, number>;
    byInstitutional: Record<string, number>;
    approvalRates: Record<string, number>;
  }>;
}

/**
 * Bias detection configuration
 */
export interface BiasDetectionConfig {
  /** Thresholds for different bias types */
  thresholds: {
    geographical: number; // Minimum difference in approval rates between regions
    demographic: number; // Minimum difference in approval rates between demographics
    institutional: number; // Minimum difference in approval rates between institutions
    temporal: number; // Minimum difference in approval rates over time
  };
  /** Time window for analysis (in days) */
  analysisWindowDays: number;
  /** Minimum sample size for statistical significance */
  minSampleSize: number;
  /** ResearchKernel instance */
  researchKernel?: ResearchKernel;
}

/**
 * Default bias detection configuration
 */
const DEFAULT_CONFIG: BiasDetectionConfig = {
  thresholds: {
    geographical: 0.15, // 15% difference
    demographic: 0.20, // 20% difference
    institutional: 0.15, // 15% difference
    temporal: 0.10, // 10% difference
  },
  analysisWindowDays: 30,
  minSampleSize: 50,
};

/**
 * BiasDetectionEngine
 *
 * Monitors autonomous decisions for potential bias and flags anomalies.
 */
export class BiasDetectionEngine {
  private config: BiasDetectionConfig;
  private researchKernel?: ResearchKernel;

  constructor(config?: Partial<BiasDetectionConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.researchKernel = config?.researchKernel;
  }

  /**
   * Analyze an autonomous decision for potential bias
   */
  async analyzeDecision(
    context: AutonomousDecisionContext
  ): Promise<BiasDetectionResult | null> {
    logger.info('Analyzing decision for bias', {
      decisionId: context.decisionId,
      decisionType: context.decisionType,
    });

    const results: BiasDetectionResult[] = [];

    // Check geographical bias
    if (context.region) {
      const geoResult = await this.checkGeographicalBias(context);
      if (geoResult) results.push(geoResult);
    }

    // Check demographic bias
    if (context.demographics) {
      const demoResult = await this.checkDemographicBias(context);
      if (demoResult) results.push(demoResult);
    }

    // Check institutional bias
    if (context.institution) {
      const instResult = await this.checkInstitutionalBias(context);
      if (instResult) results.push(instResult);
    }

    // Check temporal bias
    const tempResult = await this.checkTemporalBias(context);
    if (tempResult) results.push(tempResult);

    // Return the most severe bias detected
    if (results.length === 0) {
      return null;
    }

    const mostSevere = results.reduce((prev, current) =>
      current.severity > prev.severity ? current : prev
    );

    // Log bias detection
    await this.logBiasDetection(context, mostSevere);

    return mostSevere;
  }

  /**
   * Check for geographical bias
   */
  private async checkGeographicalBias(
    context: AutonomousDecisionContext
  ): Promise<BiasDetectionResult | null> {
    if (!context.region) {
      return null;
    }

    const metrics = await this.getBiasMetrics(context, 'geographical');
    if (!metrics) {
      return null;
    }

    const regionApprovalRate = metrics.approvalRates[context.region] || 0;
    const overallApprovalRate =
      Object.values(metrics.approvalRates).reduce((a, b) => a + b, 0) /
      Object.keys(metrics.approvalRates).length;

    const difference = Math.abs(regionApprovalRate - overallApprovalRate);

    if (difference > this.config.thresholds.geographical) {
      const severity = Math.min(difference / this.config.thresholds.geographical, 1.0);

      return {
        biasDetected: true,
        biasType: BiasType.GEOGRAPHICAL,
        severity,
        description: `Geographical bias detected: ${context.region} has ${(difference * 100).toFixed(1)}% ${regionApprovalRate > overallApprovalRate ? 'higher' : 'lower'} approval rate than average`,
        evidence: {
          metric: 'approval_rate_difference',
          value: difference,
          threshold: this.config.thresholds.geographical,
          comparison: {
            group: 'overall_average',
            value: overallApprovalRate,
          },
        },
        recommendations: [
          'Review decision criteria for regional consistency',
          'Consider regional context in decision-making',
          'Audit recent decisions in this region',
        ],
        detectedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Check for demographic bias
   */
  private async checkDemographicBias(
    context: AutonomousDecisionContext
  ): Promise<BiasDetectionResult | null> {
    if (!context.demographics) {
      return null;
    }

    const metrics = await this.getBiasMetrics(context, 'demographic');
    if (!metrics) {
      return null;
    }

    // Check each demographic dimension
    const demographicKeys = Object.keys(context.demographics).filter(
      (k) => context.demographics![k as keyof typeof context.demographics]
    );

    for (const key of demographicKeys) {
      const value = context.demographics[key as keyof typeof context.demographics];
      if (!value) continue;

      const groupApprovalRate = metrics.approvalRates[`${key}:${value}`] || 0;
      const overallApprovalRate =
        Object.values(metrics.approvalRates).reduce((a, b) => a + b, 0) /
        Object.keys(metrics.approvalRates).length;

      const difference = Math.abs(groupApprovalRate - overallApprovalRate);

      if (difference > this.config.thresholds.demographic) {
        const severity = Math.min(difference / this.config.thresholds.demographic, 1.0);

        return {
          biasDetected: true,
          biasType: BiasType.DEMOGRAPHIC,
          severity,
          description: `Demographic bias detected: ${key}=${value} has ${(difference * 100).toFixed(1)}% ${groupApprovalRate > overallApprovalRate ? 'higher' : 'lower'} approval rate than average`,
          evidence: {
            metric: 'approval_rate_difference',
            value: difference,
            threshold: this.config.thresholds.demographic,
            comparison: {
              group: 'overall_average',
              value: overallApprovalRate,
            },
          },
          recommendations: [
            'Review decision criteria for demographic fairness',
            'Ensure decision-making process is equitable across demographics',
            'Conduct bias audit for this demographic group',
          ],
          detectedAt: new Date(),
        };
      }
    }

    return null;
  }

  /**
   * Check for institutional bias
   */
  private async checkInstitutionalBias(
    context: AutonomousDecisionContext
  ): Promise<BiasDetectionResult | null> {
    if (!context.institution) {
      return null;
    }

    const metrics = await this.getBiasMetrics(context, 'institutional');
    if (!metrics) {
      return null;
    }

    const institutionKey = `${context.institution.type || 'unknown'}_${context.institution.size || 'unknown'}`;
    const institutionApprovalRate = metrics.approvalRates[institutionKey] || 0;
    const overallApprovalRate =
      Object.values(metrics.approvalRates).reduce((a, b) => a + b, 0) /
      Object.keys(metrics.approvalRates).length;

    const difference = Math.abs(institutionApprovalRate - overallApprovalRate);

    if (difference > this.config.thresholds.institutional) {
      const severity = Math.min(difference / this.config.thresholds.institutional, 1.0);

      return {
        biasDetected: true,
        biasType: BiasType.INSTITUTIONAL,
        severity,
        description: `Institutional bias detected: ${institutionKey} has ${(difference * 100).toFixed(1)}% ${institutionApprovalRate > overallApprovalRate ? 'higher' : 'lower'} approval rate than average`,
        evidence: {
          metric: 'approval_rate_difference',
          value: difference,
          threshold: this.config.thresholds.institutional,
          comparison: {
            group: 'overall_average',
            value: overallApprovalRate,
          },
        },
        recommendations: [
          'Review decision criteria for institutional fairness',
          'Ensure decision-making process is consistent across institutions',
          'Audit recent decisions for this institution type',
        ],
        detectedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Check for temporal bias (changes over time)
   */
  private async checkTemporalBias(
    context: AutonomousDecisionContext
  ): Promise<BiasDetectionResult | null> {
    const metrics = await this.getBiasMetrics(context, 'temporal');
    if (!metrics) {
      return null;
    }

    // Compare recent period vs historical average
    const recentApprovalRate = metrics.approvalRates['recent'] || 0;
    const historicalApprovalRate = metrics.approvalRates['historical'] || 0;

    const difference = Math.abs(recentApprovalRate - historicalApprovalRate);

    if (difference > this.config.thresholds.temporal) {
      const severity = Math.min(difference / this.config.thresholds.temporal, 1.0);

      return {
        biasDetected: true,
        biasType: BiasType.TEMPORAL,
        severity,
        description: `Temporal bias detected: Recent approval rate (${(recentApprovalRate * 100).toFixed(1)}%) differs from historical average (${(historicalApprovalRate * 100).toFixed(1)}%) by ${(difference * 100).toFixed(1)}%`,
        evidence: {
          metric: 'approval_rate_difference',
          value: difference,
          threshold: this.config.thresholds.temporal,
          comparison: {
            group: 'historical_average',
            value: historicalApprovalRate,
          },
        },
        recommendations: [
          'Review recent changes to decision criteria',
          'Investigate temporal patterns in decision-making',
          'Ensure consistency in decision-making over time',
        ],
        detectedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Get bias metrics from ResearchKernel or database
   */
  private async getBiasMetrics(
    context: AutonomousDecisionContext,
    dimension: 'geographical' | 'demographic' | 'institutional' | 'temporal'
  ): Promise<{
    totalDecisions: number;
    approvalRates: Record<string, number>;
  } | null> {
    // Use ResearchKernel if available
    if (this.researchKernel) {
      try {
        const endDate = context.timestamp;
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - this.config.analysisWindowDays);

        const metrics = await this.researchKernel.queryBiasMetrics({
          decisionType: context.decisionType,
          timeRange: { start: startDate, end: endDate },
        });

        // Check if we have enough samples
        if (metrics.totalDecisions < this.config.minSampleSize) {
          logger.debug('Insufficient sample size for bias analysis', {
            totalDecisions: metrics.totalDecisions,
            minSampleSize: this.config.minSampleSize,
          });
          return null;
        }

        return {
          totalDecisions: metrics.totalDecisions,
          approvalRates: metrics.approvalRates,
        };
      } catch (error) {
        logger.error('Error querying ResearchKernel for bias metrics', { error });
      }
    }

    // Fallback: Query database directly
    // This is a simplified implementation - in production, would query actual decision data
    logger.debug('ResearchKernel not available, using database fallback', {
      dimension,
    });

    // Placeholder: In production, would query actual decision records
    return null;
  }

  /**
   * Log bias detection to audit trail
   */
  private async logBiasDetection(
    context: AutonomousDecisionContext,
    result: BiasDetectionResult
  ): Promise<void> {
    try {
      // In production, would store in EthicsAuditTrail
      logger.warn('Bias detected in autonomous decision', {
        decisionId: context.decisionId,
        biasType: result.biasType,
        severity: result.severity,
        description: result.description,
      });

      // TODO: Integrate with EthicsAuditTrail service
      // await ethicsAuditTrail.logBiasCheck(context, result);
    } catch (error) {
      logger.error('Error logging bias detection', { error });
    }
  }

  /**
   * Set ResearchKernel instance
   */
  setResearchKernel(kernel: ResearchKernel): void {
    this.researchKernel = kernel;
    logger.info('ResearchKernel set for BiasDetectionEngine');
  }
}

/**
 * Create a new BiasDetectionEngine instance
 */
export function createBiasDetectionEngine(
  config?: Partial<BiasDetectionConfig>
): BiasDetectionEngine {
  return new BiasDetectionEngine(config);
}

