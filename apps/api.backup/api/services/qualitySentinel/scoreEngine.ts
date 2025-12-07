/**
 * B208B-QS-007: AnomalyScoreEngine
 *
 * Computes anomalyScore 0-1 with severity recommendations
 */

import type { SentinelModelResult } from './model/sentinelModel.js';

export interface AnomalyScoreResult {
  anomalyScore: number; // 0-1 scale
  severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  recommendations: string[];
  confidence: number; // 0-1 scale
  contributingFactors: ContributingFactor[];
  evaluatedAt: Date;
}

export interface ContributingFactor {
  factor: string;
  weight: number;
  description: string;
}

export interface AnomalyScoreEngineOptions {
  criticalThreshold?: number;
  highThreshold?: number;
  medThreshold?: number;
  minConfidenceSamples?: number;
}

const DEFAULT_OPTIONS: Required<AnomalyScoreEngineOptions> = {
  criticalThreshold: 0.8,
  highThreshold: 0.6,
  medThreshold: 0.4,
  minConfidenceSamples: 10,
};

export class AnomalyScoreEngine {
  private readonly options: Required<AnomalyScoreEngineOptions>;

  constructor(options: AnomalyScoreEngineOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Compute anomaly score with severity recommendations from sentinel model results
   */
  computeScore(modelResult: SentinelModelResult): AnomalyScoreResult {
    const { anomalyScore, detectedAnomalies, statisticalMetrics, clusteringResult, trendAnalysis } =
      modelResult;

    // Determine severity based on anomaly score
    const severity = this.determineSeverity(anomalyScore);

    // Compute confidence based on data quality and sample size
    const confidence = this.computeConfidence(modelResult);

    // Identify contributing factors
    const contributingFactors = this.identifyContributingFactors(modelResult);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      severity,
      anomalyScore,
      contributingFactors,
      modelResult
    );

    return {
      anomalyScore,
      severity,
      recommendations,
      confidence,
      contributingFactors,
      evaluatedAt: new Date(),
    };
  }

  /**
   * Determine severity level from anomaly score
   */
  private determineSeverity(anomalyScore: number): AnomalyScoreResult['severity'] {
    if (anomalyScore >= this.options.criticalThreshold) return 'CRITICAL';
    if (anomalyScore >= this.options.highThreshold) return 'HIGH';
    if (anomalyScore >= this.options.medThreshold) return 'MED';
    return 'LOW';
  }

  /**
   * Compute confidence score based on data quality
   */
  private computeConfidence(modelResult: SentinelModelResult): number {
    const { detectedAnomalies, statisticalMetrics, clusteringResult, trendAnalysis } = modelResult;

    // Base confidence on sample size
    const sampleSize = detectedAnomalies.length + 1; // +1 to avoid division by zero
    const sampleConfidence = Math.min(1, sampleSize / this.options.minConfidenceSamples);

    // Boost confidence if multiple detection methods agree
    const methodAgreement = this.computeMethodAgreement(detectedAnomalies);
    const methodConfidence = methodAgreement > 0.5 ? 0.9 : 0.7;

    // Boost confidence if clustering result is available and has good silhouette score
    const clusteringConfidence =
      clusteringResult?.silhouetteScore !== undefined
        ? Math.max(0.5, clusteringResult.silhouetteScore)
        : 0.5;

    // Boost confidence if trend analysis shows significant trend
    const trendConfidence = trendAnalysis.significance > 0.7 ? 0.85 : 0.6;

    // Boost confidence if statistical metrics are stable (low variance)
    const varianceConfidence =
      statisticalMetrics.stdDev > 0
        ? Math.min(1, 1 / (1 + statisticalMetrics.stdDev / statisticalMetrics.mean))
        : 0.5;

    // Weighted average
    const confidence =
      sampleConfidence * 0.3 +
      methodConfidence * 0.25 +
      clusteringConfidence * 0.2 +
      trendConfidence * 0.15 +
      varianceConfidence * 0.1;

    return Number(Math.min(1, Math.max(0, confidence)).toFixed(3));
  }

  /**
   * Compute agreement between different detection methods
   */
  private computeMethodAgreement(anomalies: SentinelModelResult['detectedAnomalies']): number {
    if (anomalies.length === 0) return 0;

    const methods = new Set(anomalies.map((a) => a.method));
    const methodCount = methods.size;

    // More methods detecting anomalies = higher agreement
    // Normalize to 0-1 scale (1-4 methods)
    return Math.min(1, methodCount / 4);
  }

  /**
   * Identify contributing factors to the anomaly score
   */
  private identifyContributingFactors(
    modelResult: SentinelModelResult
  ): ContributingFactor[] {
    const factors: ContributingFactor[] = [];
    const { detectedAnomalies, statisticalMetrics, clusteringResult, trendAnalysis } = modelResult;

    // Factor 1: Number of detected anomalies
    if (detectedAnomalies.length > 0) {
      const anomalyCount = detectedAnomalies.length;
      const weight = Math.min(1, anomalyCount / 10); // Normalize to 0-1
      factors.push({
        factor: 'anomaly_count',
        weight,
        description: `${anomalyCount} anomaly(ies) detected across ${new Set(detectedAnomalies.map(a => a.method)).size} detection method(s)`,
      });
    }

    // Factor 2: Severity distribution
    const severityCounts = {
      CRITICAL: detectedAnomalies.filter((a) => a.severity === 'CRITICAL').length,
      HIGH: detectedAnomalies.filter((a) => a.severity === 'HIGH').length,
      MED: detectedAnomalies.filter((a) => a.severity === 'MED').length,
      LOW: detectedAnomalies.filter((a) => a.severity === 'LOW').length,
    };

    if (severityCounts.CRITICAL > 0) {
      factors.push({
        factor: 'critical_anomalies',
        weight: 0.9,
        description: `${severityCounts.CRITICAL} critical severity anomaly(ies) detected`,
      });
    }

    if (severityCounts.HIGH > 0) {
      factors.push({
        factor: 'high_anomalies',
        weight: 0.7,
        description: `${severityCounts.HIGH} high severity anomaly(ies) detected`,
      });
    }

    // Factor 3: Statistical deviation
    if (statisticalMetrics.stdDev > 0) {
      const coefficientOfVariation = statisticalMetrics.stdDev / Math.abs(statisticalMetrics.mean);
      if (coefficientOfVariation > 0.3) {
        factors.push({
          factor: 'high_variance',
          weight: Math.min(1, coefficientOfVariation),
          description: `High variance in data (CV: ${coefficientOfVariation.toFixed(2)})`,
        });
      }
    }

    // Factor 4: Clustering outliers
    if (clusteringResult?.outlierClusterId !== undefined) {
      const outlierCount = clusteringResult.clusterAssignments.filter(
        (a) => a === clusteringResult.outlierClusterId
      ).length;
      if (outlierCount > 0) {
        factors.push({
          factor: 'clustering_outliers',
          weight: Math.min(1, outlierCount / 5),
          description: `${outlierCount} data point(s) identified as outliers via clustering`,
        });
      }
    }

    // Factor 5: Trend analysis
    if (trendAnalysis.direction === 'DECREASING' && trendAnalysis.significance > 0.5) {
      factors.push({
        factor: 'negative_trend',
        weight: trendAnalysis.significance,
        description: `Significant decreasing trend detected (slope: ${trendAnalysis.slope.toFixed(3)}, significance: ${trendAnalysis.significance.toFixed(2)})`,
      });
    }

    // Factor 6: EWMA deviation
    const highEwmaDeviation = detectedAnomalies.filter(
      (a) => a.ewmaDeviation && a.ewmaDeviation > 3
    ).length;
    if (highEwmaDeviation > 0) {
      factors.push({
        factor: 'ewma_deviation',
        weight: Math.min(1, highEwmaDeviation / 3),
        description: `${highEwmaDeviation} point(s) with high EWMA deviation`,
      });
    }

    // Factor 7: Z-score extremes
    const extremeZScores = detectedAnomalies.filter(
      (a) => a.zScore && a.zScore > 3
    ).length;
    if (extremeZScores > 0) {
      factors.push({
        factor: 'extreme_z_scores',
        weight: Math.min(1, extremeZScores / 2),
        description: `${extremeZScores} point(s) with extreme Z-scores (>3σ)`,
      });
    }

    // Sort by weight (descending)
    return factors.sort((a, b) => b.weight - a.weight);
  }

  /**
   * Generate recommendations based on severity and contributing factors
   */
  private generateRecommendations(
    severity: AnomalyScoreResult['severity'],
    anomalyScore: number,
    factors: ContributingFactor[],
    modelResult: SentinelModelResult
  ): string[] {
    const recommendations: string[] = [];

    // Base recommendations by severity
    switch (severity) {
      case 'CRITICAL':
        recommendations.push('Immediate review required: Critical anomalies detected');
        recommendations.push('Consider temporary restriction pending investigation');
        recommendations.push('Escalate to quality committee for urgent review');
        break;
      case 'HIGH':
        recommendations.push('High-priority review recommended within 24-48 hours');
        recommendations.push('Monitor closely for pattern escalation');
        recommendations.push('Consider enhanced monitoring or additional data collection');
        break;
      case 'MED':
        recommendations.push('Review recommended within 1 week');
        recommendations.push('Continue monitoring for trend changes');
        recommendations.push('Consider targeted intervention if pattern persists');
        break;
      case 'LOW':
        recommendations.push('Routine monitoring sufficient');
        recommendations.push('Review if additional anomalies detected');
        break;
    }

    // Factor-specific recommendations
    for (const factor of factors.slice(0, 3)) {
      // Top 3 factors
      switch (factor.factor) {
        case 'critical_anomalies':
          recommendations.push('Investigate root cause of critical anomalies immediately');
          break;
        case 'high_variance':
          recommendations.push('Review data collection process for consistency issues');
          break;
        case 'negative_trend':
          recommendations.push('Investigate factors contributing to declining trend');
          recommendations.push('Consider intervention to reverse trend');
          break;
        case 'clustering_outliers':
          recommendations.push('Review outlier data points for data quality issues');
          break;
        case 'ewma_deviation':
          recommendations.push('Investigate sudden changes in baseline metrics');
          break;
        case 'extreme_z_scores':
          recommendations.push('Review extreme values for measurement errors or genuine issues');
          break;
      }
    }

    // Method-specific recommendations
    const methods = new Set(modelResult.detectedAnomalies.map((a) => a.method));
    if (methods.has('TREND') && modelResult.trendAnalysis.direction === 'DECREASING') {
      recommendations.push('Trend analysis indicates sustained decline - investigate systemic causes');
    }

    if (methods.has('CLUSTERING')) {
      recommendations.push('Clustering analysis suggests distinct outlier patterns - review grouping');
    }

    // Remove duplicates and limit to top recommendations
    const uniqueRecommendations = Array.from(new Set(recommendations));
    return uniqueRecommendations.slice(0, 8); // Limit to top 8
  }
}

