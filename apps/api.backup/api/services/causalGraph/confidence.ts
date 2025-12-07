import type { CausalNode } from './models/CausalNode.js';
import type { PropagationRule } from './propagationRules.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ConfidenceFactors {
  recency: number; // 0-1: How recent the events are
  severity: number; // 0-1: Combined severity of source and target
  historicalPatterns: number; // 0-1: Historical frequency of this relationship
  driftIntensity: number; // 0-1: Intensity of drift events
  forecastAgreement: number; // 0-1: Agreement with forecast models
}

/**
 * CausalConfidenceScorer computes confidence scores for causal edges.
 *
 * Confidence is weighted by:
 * - Recency: More recent events have higher confidence
 * - Severity: Higher severity events have higher confidence
 * - Historical patterns: Frequently observed relationships have higher confidence
 * - Drift intensity: Stronger drift signals have higher confidence
 * - Forecast agreement: Agreement with predictive models increases confidence
 */
export class CausalConfidenceScorer {
  /**
   * Compute confidence score for a causal edge
   */
  async computeConfidenceScore(
    source: CausalNode,
    target: CausalNode,
    rule: PropagationRule
  ): Promise<number> {
    const factors = await this.computeFactors(source, target, rule);
    const baseConfidence = rule.baseConfidence ?? 0.5;

    // Weighted combination of factors
    const weights = {
      recency: 0.2,
      severity: 0.25,
      historicalPatterns: 0.2,
      driftIntensity: 0.15,
      forecastAgreement: 0.2,
    };

    const weightedScore =
      baseConfidence * 0.3 + // Base rule confidence (30%)
      factors.recency * weights.recency +
      factors.severity * weights.severity +
      factors.historicalPatterns * weights.historicalPatterns +
      factors.driftIntensity * weights.driftIntensity +
      factors.forecastAgreement * weights.forecastAgreement;

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, weightedScore));
  }

  /**
   * Compute all confidence factors
   */
  private async computeFactors(
    source: CausalNode,
    target: CausalNode,
    rule: PropagationRule
  ): Promise<ConfidenceFactors> {
    return {
      recency: this.computeRecencyFactor(source, target),
      severity: this.computeSeverityFactor(source, target),
      historicalPatterns: await this.computeHistoricalPatternFactor(source, target, rule),
      driftIntensity: await this.computeDriftIntensityFactor(source, target),
      forecastAgreement: await this.computeForecastAgreementFactor(source, target, rule),
    };
  }

  /**
   * Compute recency factor (0-1)
   * More recent events have higher confidence
   */
  private computeRecencyFactor(source: CausalNode, target: CausalNode): number {
    const now = new Date();
    const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds

    const sourceAge = now.getTime() - source.timestamp.getTime();
    const targetAge = now.getTime() - target.timestamp.getTime();

    // Average recency of both events
    const avgAge = (sourceAge + targetAge) / 2;
    const recency = Math.max(0, 1 - avgAge / maxAge);

    // Bonus if events are close in time (temporal proximity)
    const timeDiff = Math.abs(source.timestamp.getTime() - target.timestamp.getTime());
    const proximityBonus = Math.max(0, 1 - timeDiff / (7 * 24 * 60 * 60 * 1000)); // 7 days

    return (recency * 0.7 + proximityBonus * 0.3);
  }

  /**
   * Compute severity factor (0-1)
   * Higher severity events have higher confidence
   */
  private computeSeverityFactor(source: CausalNode, target: CausalNode): number {
    const severityMap: Record<string, number> = {
      LOW: 0.25,
      MED: 0.5,
      HIGH: 0.75,
      CRITICAL: 1.0,
    };

    const sourceSeverity = source.severity ? severityMap[source.severity] ?? 0.5 : 0.5;
    const targetSeverity = target.severity ? severityMap[target.severity] ?? 0.5 : 0.5;

    // Average severity, with slight boost if both are high
    const avgSeverity = (sourceSeverity + targetSeverity) / 2;
    const bothHighBonus = sourceSeverity >= 0.75 && targetSeverity >= 0.75 ? 0.1 : 0;

    return Math.min(1, avgSeverity + bothHighBonus);
  }

  /**
   * Compute historical pattern factor (0-1)
   * Frequently observed relationships have higher confidence
   */
  private async computeHistoricalPatternFactor(
    source: CausalNode,
    target: CausalNode,
    rule: PropagationRule
  ): Promise<number> {
    try {
      // Count how many times this relationship has been observed
      const count = await prisma.causalEdge.count({
        where: {
          sourceNode: {
            nodeType: source.nodeType,
            sourceEventType: source.sourceEventType,
          },
          targetNode: {
            nodeType: target.nodeType,
            sourceEventType: target.sourceEventType,
          },
          edgeType: rule.edgeType,
        },
      });

      // Normalize: 0 occurrences = 0.5, 10+ occurrences = 1.0
      return Math.min(1, 0.5 + (count / 10) * 0.5);
    } catch (error) {
      // If CausalEdge model doesn't exist yet, return neutral value
      console.warn('Historical pattern computation failed:', error);
      return 0.5;
    }
  }

  /**
   * Compute drift intensity factor (0-1)
   * Stronger drift signals have higher confidence
   */
  private async computeDriftIntensityFactor(
    source: CausalNode,
    target: CausalNode
  ): Promise<number> {
    // If source is a drift event, check its intensity
    if (source.nodeType === 'DRIFT_EVENT') {
      try {
        const driftEvent = await prisma.driftEvent.findUnique({
          where: { id: source.sourceEventId },
        });

        if (driftEvent) {
          // Intensity based on severity and category
          const severityMap: Record<string, number> = {
            INFO: 0.2,
            LOW: 0.4,
            MEDIUM: 0.6,
            HIGH: 0.8,
            CRITICAL: 1.0,
          };

          const baseIntensity = severityMap[driftEvent.severity?.toUpperCase() ?? 'MEDIUM'] ?? 0.6;

          // Critical categories get intensity boost
          const criticalCategories = ['dea', 'licensure', 'board'];
          const categoryBoost = criticalCategories.includes(driftEvent.category.toLowerCase())
            ? 0.15
            : 0;

          return Math.min(1, baseIntensity + categoryBoost);
        }
      } catch (error) {
        console.warn('Drift intensity computation failed:', error);
      }
    }

    // If target is a drift event, check its intensity
    if (target.nodeType === 'DRIFT_EVENT') {
      try {
        const driftEvent = await prisma.driftEvent.findUnique({
          where: { id: target.sourceEventId },
        });

        if (driftEvent) {
          const severityMap: Record<string, number> = {
            INFO: 0.2,
            LOW: 0.4,
            MEDIUM: 0.6,
            HIGH: 0.8,
            CRITICAL: 1.0,
          };

          const baseIntensity = severityMap[driftEvent.severity?.toUpperCase() ?? 'MEDIUM'] ?? 0.6;
          return Math.min(1, baseIntensity);
        }
      } catch (error) {
        console.warn('Drift intensity computation failed:', error);
      }
    }

    // Default: moderate intensity
    return 0.6;
  }

  /**
   * Compute forecast agreement factor (0-1)
   * Agreement with predictive models increases confidence
   */
  private async computeForecastAgreementFactor(
    source: CausalNode,
    target: CausalNode,
    rule: PropagationRule
  ): Promise<number> {
    // Check if there's a forecast risk that predicts this relationship
    try {
      const forecastRisks = await prisma.causalNode.findMany({
        where: {
          nodeType: 'FORECAST_RISK',
          clinicianId: source.clinicianId,
          timestamp: {
            lte: source.timestamp, // Forecast should precede the event
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 5,
      });

      if (forecastRisks.length > 0) {
        // If forecast predicted this type of event, increase confidence
        const predictedTargetType = rule.targetNodeType;
        const hasMatchingForecast = forecastRisks.some((forecast) => {
          const forecastMetadata = forecast.metadata as Record<string, unknown> | undefined;
          const predictedTypes = forecastMetadata?.predictedTypes as string[] | undefined;
          return predictedTypes?.includes(predictedTargetType);
        });

        return hasMatchingForecast ? 0.9 : 0.5;
      }
    } catch (error) {
      console.warn('Forecast agreement computation failed:', error);
    }

    // Default: neutral agreement
    return 0.5;
  }
}

/**
 * Compute confidence score for a causal edge
 */
export async function computeConfidenceScore(
  source: CausalNode,
  target: CausalNode,
  rule: PropagationRule
): Promise<number> {
  const scorer = new CausalConfidenceScorer();
  return scorer.computeConfidenceScore(source, target, rule);
}

