/**
 * B208B-QS-006: QualitySentinelModel
 *
 * Implements hybrid detection: statistical (EWMA, Z-score), ML clustering, trend analysis
 */

import type { QualitySignal } from '../../qualityFusion/models/QualitySignal.js';

export interface MicroSignalDataPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface SentinelModelInput {
  clinicianId: string;
  extractorId: string;
  dataPoints: MicroSignalDataPoint[];
  lookbackDays?: number;
}

export interface SentinelModelResult {
  clinicianId: string;
  extractorId: string;
  anomalyScore: number; // 0-1 scale
  detectedAnomalies: DetectedAnomaly[];
  statisticalMetrics: StatisticalMetrics;
  clusteringResult?: ClusteringResult;
  trendAnalysis: TrendAnalysis;
  evaluatedAt: Date;
}

export interface DetectedAnomaly {
  timestamp: Date;
  value: number;
  method: 'EWMA' | 'Z_SCORE' | 'CLUSTERING' | 'TREND';
  severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  zScore?: number;
  ewmaDeviation?: number;
  clusterId?: string;
  trendSlope?: number;
  metadata?: Record<string, unknown>;
}

export interface StatisticalMetrics {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  median: number;
  ewma: number;
  ewmaVariance: number;
}

export interface ClusteringResult {
  clusterCount: number;
  outlierClusterId?: string;
  silhouetteScore?: number;
  clusterAssignments: number[];
}

export interface TrendAnalysis {
  slope: number;
  direction: 'INCREASING' | 'DECREASING' | 'STABLE';
  significance: number; // 0-1, how significant the trend is
  rSquared?: number;
}

const DEFAULT_LOOKBACK_DAYS = 90;
const DEFAULT_EWMA_ALPHA = 0.3; // Smoothing factor
const DEFAULT_Z_SCORE_THRESHOLD = 2.5; // Standard deviations
const DEFAULT_MIN_SAMPLES = 10; // Minimum data points for analysis

export class QualitySentinelModel {
  private readonly ewmaAlpha: number;
  private readonly zScoreThreshold: number;
  private readonly minSamples: number;

  constructor(options: {
    ewmaAlpha?: number;
    zScoreThreshold?: number;
    minSamples?: number;
  } = {}) {
    this.ewmaAlpha = options.ewmaAlpha ?? DEFAULT_EWMA_ALPHA;
    this.zScoreThreshold = options.zScoreThreshold ?? DEFAULT_Z_SCORE_THRESHOLD;
    this.minSamples = options.minSamples ?? DEFAULT_MIN_SAMPLES;
  }

  /**
   * Analyze micro-signal data using hybrid detection methods
   */
  analyze(input: SentinelModelInput): SentinelModelResult {
    const { clinicianId, extractorId, dataPoints, lookbackDays = DEFAULT_LOOKBACK_DAYS } = input;

    // Filter data points within lookback window
    const lookbackDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    const filteredPoints = dataPoints
      .filter((p) => p.timestamp >= lookbackDate)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (filteredPoints.length < this.minSamples) {
      // Return baseline result if insufficient data
      return {
        clinicianId,
        extractorId,
        anomalyScore: 0,
        detectedAnomalies: [],
        statisticalMetrics: this.computeBaselineMetrics(filteredPoints),
        trendAnalysis: {
          slope: 0,
          direction: 'STABLE',
          significance: 0,
        },
        evaluatedAt: new Date(),
      };
    }

    const values = filteredPoints.map((p) => p.value);

    // 1. Statistical Analysis (EWMA + Z-score)
    const statisticalMetrics = this.computeStatisticalMetrics(filteredPoints);
    const ewmaAnomalies = this.detectEWMAAnomalies(filteredPoints, statisticalMetrics);
    const zScoreAnomalies = this.detectZScoreAnomalies(filteredPoints, statisticalMetrics);

    // 2. ML Clustering (K-means based outlier detection)
    const clusteringResult = this.performClustering(values);
    const clusteringAnomalies = this.detectClusteringAnomalies(
      filteredPoints,
      clusteringResult
    );

    // 3. Trend Analysis
    const trendAnalysis = this.analyzeTrend(filteredPoints);
    const trendAnomalies = this.detectTrendAnomalies(filteredPoints, trendAnalysis);

    // Combine all detected anomalies
    const allAnomalies = [
      ...ewmaAnomalies,
      ...zScoreAnomalies,
      ...clusteringAnomalies,
      ...trendAnomalies,
    ];

    // Deduplicate and merge anomalies at the same timestamp
    const mergedAnomalies = this.mergeAnomalies(allAnomalies);

    // Compute overall anomaly score (0-1)
    const anomalyScore = this.computeAnomalyScore(mergedAnomalies, statisticalMetrics);

    return {
      clinicianId,
      extractorId,
      anomalyScore,
      detectedAnomalies: mergedAnomalies,
      statisticalMetrics,
      clusteringResult,
      trendAnalysis,
      evaluatedAt: new Date(),
    };
  }

  /**
   * Compute statistical metrics including EWMA
   */
  private computeStatisticalMetrics(
    dataPoints: MicroSignalDataPoint[]
  ): StatisticalMetrics {
    const values = dataPoints.map((p) => p.value);
    const mean = this.mean(values);
    const stdDev = this.standardDeviation(values, mean);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const median = this.median(values);

    // Compute EWMA (Exponentially Weighted Moving Average)
    let ewma = values[0] || 0;
    let ewmaVariance = 0;

    for (let i = 1; i < values.length; i++) {
      const prevEwma = ewma;
      ewma = this.ewmaAlpha * values[i] + (1 - this.ewmaAlpha) * prevEwma;
      const deviation = values[i] - prevEwma;
      ewmaVariance = this.ewmaAlpha * deviation * deviation + (1 - this.ewmaAlpha) * ewmaVariance;
    }

    return {
      mean,
      stdDev,
      min,
      max,
      median,
      ewma,
      ewmaVariance: Math.sqrt(ewmaVariance),
    };
  }

  /**
   * Detect anomalies using EWMA (Exponentially Weighted Moving Average)
   */
  private detectEWMAAnomalies(
    dataPoints: MicroSignalDataPoint[],
    metrics: StatisticalMetrics
  ): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];
    let ewma = dataPoints[0]?.value || 0;

    for (let i = 1; i < dataPoints.length; i++) {
      const value = dataPoints[i].value;
      const prevEwma = ewma;
      ewma = this.ewmaAlpha * value + (1 - this.ewmaAlpha) * prevEwma;

      const deviation = Math.abs(value - prevEwma);
      const normalizedDeviation = metrics.ewmaVariance > 0 ? deviation / metrics.ewmaVariance : 0;

      if (normalizedDeviation > this.zScoreThreshold) {
        const severity = this.mapDeviationToSeverity(normalizedDeviation);
        anomalies.push({
          timestamp: dataPoints[i].timestamp,
          value,
          method: 'EWMA',
          severity,
          ewmaDeviation: normalizedDeviation,
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect anomalies using Z-score
   */
  private detectZScoreAnomalies(
    dataPoints: MicroSignalDataPoint[],
    metrics: StatisticalMetrics
  ): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];

    for (const point of dataPoints) {
      if (metrics.stdDev === 0) continue;

      const zScore = Math.abs((point.value - metrics.mean) / metrics.stdDev);

      if (zScore > this.zScoreThreshold) {
        const severity = this.mapZScoreToSeverity(zScore);
        anomalies.push({
          timestamp: point.timestamp,
          value: point.value,
          method: 'Z_SCORE',
          severity,
          zScore,
        });
      }
    }

    return anomalies;
  }

  /**
   * Perform K-means clustering to identify outlier clusters
   */
  private performClustering(values: number[]): ClusteringResult {
    if (values.length < 3) {
      return {
        clusterCount: 1,
        clusterAssignments: values.map(() => 0),
      };
    }

    // Simplified K-means with k=2 (normal vs outlier)
    const k = 2;
    const centroids = this.initializeCentroids(values, k);
    let assignments: number[] = [];
    let iterations = 0;
    const maxIterations = 100;

    while (iterations < maxIterations) {
      // Assign points to nearest centroid
      assignments = values.map((value) => {
        let minDist = Infinity;
        let nearestCluster = 0;
        for (let i = 0; i < k; i++) {
          const dist = Math.abs(value - centroids[i]);
          if (dist < minDist) {
            minDist = dist;
            nearestCluster = i;
          }
        }
        return nearestCluster;
      });

      // Update centroids
      const newCentroids = centroids.map((_, clusterId) => {
        const clusterValues = values.filter((_, idx) => assignments[idx] === clusterId);
        if (clusterValues.length === 0) return centroids[clusterId];
        return this.mean(clusterValues);
      });

      // Check convergence
      const converged = centroids.every(
        (c, i) => Math.abs(c - newCentroids[i]) < 0.001
      );
      if (converged) break;

      centroids.splice(0, k, ...newCentroids);
      iterations++;
    }

    // Identify outlier cluster (smaller cluster or cluster with extreme values)
    const clusterSizes = centroids.map((_, i) =>
      assignments.filter((a) => a === i).length
    );
    const outlierClusterId =
      clusterSizes[0] < clusterSizes[1] ? 0 : clusterSizes[1] < clusterSizes[0] ? 1 : undefined;

    // Compute silhouette score (simplified)
    const silhouetteScore = this.computeSilhouetteScore(values, assignments, centroids);

    return {
      clusterCount: k,
      outlierClusterId,
      silhouetteScore,
      clusterAssignments: assignments,
    };
  }

  /**
   * Detect anomalies based on clustering results
   */
  private detectClusteringAnomalies(
    dataPoints: MicroSignalDataPoint[],
    clustering: ClusteringResult
  ): DetectedAnomaly[] {
    if (!clustering.outlierClusterId) return [];

    const anomalies: DetectedAnomaly[] = [];

    for (let i = 0; i < dataPoints.length; i++) {
      if (clustering.clusterAssignments[i] === clustering.outlierClusterId) {
        anomalies.push({
          timestamp: dataPoints[i].timestamp,
          value: dataPoints[i].value,
          method: 'CLUSTERING',
          severity: 'MED',
          clusterId: clustering.outlierClusterId.toString(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Analyze trend using linear regression
   */
  private analyzeTrend(dataPoints: MicroSignalDataPoint[]): TrendAnalysis {
    if (dataPoints.length < 2) {
      return {
        slope: 0,
        direction: 'STABLE',
        significance: 0,
      };
    }

    const n = dataPoints.length;
    const xValues = dataPoints.map((_, i) => i);
    const yValues = dataPoints.map((p) => p.value);

    const xMean = this.mean(xValues);
    const yMean = this.mean(yValues);

    let numerator = 0;
    let denominator = 0;
    let sumSquaredErrors = 0;
    let totalSumSquares = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = xValues[i] - xMean;
      const yDiff = yValues[i] - yMean;
      numerator += xDiff * yDiff;
      denominator += xDiff * xDiff;
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    // Compute R-squared
    for (let i = 0; i < n; i++) {
      const predicted = slope * xValues[i] + intercept;
      const error = yValues[i] - predicted;
      sumSquaredErrors += error * error;
      totalSumSquares += (yValues[i] - yMean) ** 2;
    }

    const rSquared = totalSumSquares > 0 ? 1 - sumSquaredErrors / totalSumSquares : 0;

    // Determine direction and significance
    const direction: TrendAnalysis['direction'] =
      Math.abs(slope) < 0.001 ? 'STABLE' : slope > 0 ? 'INCREASING' : 'DECREASING';
    const significance = Math.min(1, Math.abs(slope) * n * rSquared);

    return {
      slope,
      direction,
      significance,
      rSquared,
    };
  }

  /**
   * Detect anomalies based on trend analysis
   */
  private detectTrendAnomalies(
    dataPoints: MicroSignalDataPoint[],
    trend: TrendAnalysis
  ): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];

    // Flag significant negative trends or sudden reversals
    if (trend.direction === 'DECREASING' && trend.significance > 0.5) {
      // Mark recent points in a declining trend as anomalies
      const recentPoints = dataPoints.slice(-Math.ceil(dataPoints.length * 0.2));
      for (const point of recentPoints) {
        anomalies.push({
          timestamp: point.timestamp,
          value: point.value,
          method: 'TREND',
          severity: trend.significance > 0.8 ? 'HIGH' : 'MED',
          trendSlope: trend.slope,
        });
      }
    }

    return anomalies;
  }

  /**
   * Merge anomalies detected by multiple methods at the same timestamp
   */
  private mergeAnomalies(anomalies: DetectedAnomaly[]): DetectedAnomaly[] {
    const merged = new Map<string, DetectedAnomaly>();

    for (const anomaly of anomalies) {
      const key = anomaly.timestamp.toISOString();
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, { ...anomaly });
      } else {
        // Merge: take highest severity, combine methods
        const maxSeverity = this.maxSeverity(existing.severity, anomaly.severity);
        merged.set(key, {
          ...existing,
          severity: maxSeverity,
          method: existing.method, // Keep first method, but could combine
          zScore: existing.zScore ?? anomaly.zScore,
          ewmaDeviation: existing.ewmaDeviation ?? anomaly.ewmaDeviation,
          clusterId: existing.clusterId ?? anomaly.clusterId,
          trendSlope: existing.trendSlope ?? anomaly.trendSlope,
        });
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Compute overall anomaly score (0-1) from detected anomalies
   */
  private computeAnomalyScore(
    anomalies: DetectedAnomaly[],
    metrics: StatisticalMetrics
  ): number {
    if (anomalies.length === 0) return 0;

    const severityWeights: Record<DetectedAnomaly['severity'], number> = {
      LOW: 0.1,
      MED: 0.3,
      HIGH: 0.6,
      CRITICAL: 1.0,
    };

    let totalScore = 0;
    for (const anomaly of anomalies) {
      totalScore += severityWeights[anomaly.severity];
    }

    // Normalize by number of data points and severity
    const normalizedScore = Math.min(
      1,
      totalScore / Math.max(1, anomalies.length * 0.5)
    );

    return Number(normalizedScore.toFixed(4));
  }

  /**
   * Map deviation to severity
   */
  private mapDeviationToSeverity(deviation: number): DetectedAnomaly['severity'] {
    if (deviation > this.zScoreThreshold * 3) return 'CRITICAL';
    if (deviation > this.zScoreThreshold * 2) return 'HIGH';
    if (deviation > this.zScoreThreshold * 1.5) return 'MED';
    return 'LOW';
  }

  /**
   * Map Z-score to severity
   */
  private mapZScoreToSeverity(zScore: number): DetectedAnomaly['severity'] {
    if (zScore > this.zScoreThreshold * 3) return 'CRITICAL';
    if (zScore > this.zScoreThreshold * 2) return 'HIGH';
    if (zScore > this.zScoreThreshold * 1.5) return 'MED';
    return 'LOW';
  }

  /**
   * Get maximum severity
   */
  private maxSeverity(
    a: DetectedAnomaly['severity'],
    b: DetectedAnomaly['severity']
  ): DetectedAnomaly['severity'] {
    const order: DetectedAnomaly['severity'][] = ['LOW', 'MED', 'HIGH', 'CRITICAL'];
    return order[Math.max(order.indexOf(a), order.indexOf(b))];
  }

  /**
   * Initialize centroids for K-means
   */
  private initializeCentroids(values: number[], k: number): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const centroids: number[] = [];

    for (let i = 0; i < k; i++) {
      centroids.push(min + ((max - min) * i) / (k - 1));
    }

    return centroids;
  }

  /**
   * Compute silhouette score (simplified)
   */
  private computeSilhouetteScore(
    values: number[],
    assignments: number[],
    centroids: number[]
  ): number {
    if (values.length < 2) return 0;

    let totalSilhouette = 0;
    for (let i = 0; i < values.length; i++) {
      const clusterId = assignments[i];
      const value = values[i];

      // Average distance to points in same cluster
      const sameCluster = values.filter((_, idx) => assignments[idx] === clusterId);
      const a = sameCluster.length > 1
        ? sameCluster.reduce((sum, v) => sum + Math.abs(v - value), 0) / (sameCluster.length - 1)
        : 0;

      // Minimum average distance to other clusters
      let minB = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        if (c === clusterId) continue;
        const otherCluster = values.filter((_, idx) => assignments[idx] === c);
        if (otherCluster.length === 0) continue;
        const b = otherCluster.reduce((sum, v) => sum + Math.abs(v - value), 0) / otherCluster.length;
        minB = Math.min(minB, b);
      }

      const silhouette = minB !== Infinity && (a + minB) > 0 ? (minB - a) / Math.max(a, minB) : 0;
      totalSilhouette += silhouette;
    }

    return totalSilhouette / values.length;
  }

  /**
   * Compute baseline metrics for insufficient data
   */
  private computeBaselineMetrics(dataPoints: MicroSignalDataPoint[]): StatisticalMetrics {
    if (dataPoints.length === 0) {
      return {
        mean: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        median: 0,
        ewma: 0,
        ewmaVariance: 0,
      };
    }

    const values = dataPoints.map((p) => p.value);
    const mean = this.mean(values);
    const stdDev = this.standardDeviation(values, mean);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const median = this.median(values);
    const ewma = values[values.length - 1] || 0;

    return {
      mean,
      stdDev,
      min,
      max,
      median,
      ewma,
      ewmaVariance: stdDev,
    };
  }

  // Utility functions
  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private standardDeviation(values: number[], precomputedMean?: number): number {
    if (values.length <= 1) return 0;
    const mean = precomputedMean ?? this.mean(values);
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  private median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
}

