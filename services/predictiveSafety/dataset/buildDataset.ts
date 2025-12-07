/**
 * B203A-ML-003: HistoricalSafetyDatasetBuilder
 *
 * Builds N×M matrix of features from last 12 months.
 * Integrates EHR mismatch, enrollment decline, and compact changes.
 * Ensures balanced dataset.
 */

import type { SafetyFeatureVector } from '../models/SafetyFeatureVector.js';
import { featureVectorToArray, FEATURE_NAMES } from '../models/SafetyFeatureVector.js';

export interface DatasetRow {
  clinicianId: string;
  timestamp: Date;
  features: number[]; // Array of 10 feature values
  label?: string; // Optional label (SAFE, AT_RISK, HIGH_RISK, HOLD_TRIGGERED, SUSPENDED)
}

export interface Dataset {
  rows: DatasetRow[];
  featureNames: readonly string[];
  clinicianIds: string[];
  dateRange: {
    start: Date;
    end: Date;
  };
  statistics: {
    totalRows: number;
    uniqueClinicians: number;
    labelDistribution?: Record<string, number>;
  };
}

export interface BuildDatasetOptions {
  /**
   * Number of months to look back (default: 12)
   */
  monthsBack?: number;

  /**
   * Minimum number of feature vectors per clinician (default: 1)
   */
  minVectorsPerClinician?: number;

  /**
   * Maximum number of feature vectors per clinician (default: unlimited)
   */
  maxVectorsPerClinician?: number;

  /**
   * Whether to include labels (default: false)
   */
  includeLabels?: boolean;

  /**
   * Whether to balance the dataset (default: false)
   * If true, will sample equal numbers from each label class
   */
  balanceDataset?: boolean;

  /**
   * Target number of samples per class when balancing (default: minimum class size)
   */
  targetSamplesPerClass?: number;
}

/**
 * HistoricalSafetyDatasetBuilder class
 */
export class HistoricalSafetyDatasetBuilder {
  /**
   * Build dataset from feature vectors
   */
  buildDataset(
    featureVectors: SafetyFeatureVector[],
    options: BuildDatasetOptions = {}
  ): Dataset {
    const {
      monthsBack = 12,
      minVectorsPerClinician = 1,
      maxVectorsPerClinician,
      includeLabels = false,
      balanceDataset = false,
    } = options;

    // Filter by date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const filteredVectors = featureVectors.filter(
      (v) => v.timestamp >= startDate && v.timestamp <= endDate
    );

    // Group by clinician
    const byClinician = new Map<string, SafetyFeatureVector[]>();
    for (const vector of filteredVectors) {
      const existing = byClinician.get(vector.clinicianId) || [];
      existing.push(vector);
      byClinician.set(vector.clinicianId, existing);
    }

    // Filter by min/max vectors per clinician
    const validClinicians = Array.from(byClinician.entries()).filter(([_, vectors]) => {
      if (vectors.length < minVectorsPerClinician) return false;
      if (maxVectorsPerClinician && vectors.length > maxVectorsPerClinician) return false;
      return true;
    });

    // Convert to dataset rows
    let rows: DatasetRow[] = [];
    for (const [clinicianId, vectors] of validClinicians) {
      // Sort by timestamp
      const sorted = vectors.sort((a, b) =>
        a.timestamp.getTime() - b.timestamp.getTime()
      );

      // Limit to maxVectorsPerClinician if specified
      const limited = maxVectorsPerClinician
        ? sorted.slice(-maxVectorsPerClinician)
        : sorted;

      for (const vector of limited) {
        rows.push({
          clinicianId,
          timestamp: vector.timestamp,
          features: featureVectorToArray(vector.features),
          label: includeLabels ? (vector as any).label : undefined,
        });
      }
    }

    // Balance dataset if requested
    if (balanceDataset && includeLabels) {
      rows = this.balanceDataset(rows, options.targetSamplesPerClass);
    }

    // Calculate statistics
    const uniqueClinicians = new Set(rows.map(r => r.clinicianId));
    const labelDistribution: Record<string, number> = {};
    if (includeLabels) {
      for (const row of rows) {
        if (row.label) {
          labelDistribution[row.label] = (labelDistribution[row.label] || 0) + 1;
        }
      }
    }

    return {
      rows,
      featureNames: FEATURE_NAMES,
      clinicianIds: Array.from(uniqueClinicians),
      dateRange: {
        start: startDate,
        end: endDate,
      },
      statistics: {
        totalRows: rows.length,
        uniqueClinicians: uniqueClinicians.size,
        labelDistribution: includeLabels ? labelDistribution : undefined,
      },
    };
  }

  /**
   * Balance dataset by sampling equal numbers from each label class
   */
  private balanceDataset(
    rows: DatasetRow[],
    targetSamplesPerClass?: number
  ): DatasetRow[] {
    // Group by label
    const byLabel = new Map<string, DatasetRow[]>();
    for (const row of rows) {
      const label = row.label || 'UNLABELED';
      const existing = byLabel.get(label) || [];
      existing.push(row);
      byLabel.set(label, existing);
    }

    // Find minimum class size
    const classSizes = Array.from(byLabel.values()).map(v => v.length);
    const minSize = Math.min(...classSizes);
    const targetSize = targetSamplesPerClass || minSize;

    // Sample from each class
    const balanced: DatasetRow[] = [];
    for (const [label, classRows] of byLabel.entries()) {
      if (classRows.length <= targetSize) {
        // Use all rows if class is smaller than target
        balanced.push(...classRows);
      } else {
        // Randomly sample targetSize rows
        const shuffled = [...classRows].sort(() => Math.random() - 0.5);
        balanced.push(...shuffled.slice(0, targetSize));
      }
    }

    return balanced;
  }

  /**
   * Convert dataset to matrix format (N×M)
   * Returns [featuresMatrix, labelsArray] where:
   * - featuresMatrix: number[][] (N rows × M features)
   * - labelsArray: string[] (N labels, optional)
   */
  toMatrix(dataset: Dataset): {
    featuresMatrix: number[][];
    labelsArray?: string[];
  } {
    const featuresMatrix = dataset.rows.map(row => row.features);
    const labelsArray = dataset.rows.map(row => row.label).filter(
      (label): label is string => label !== undefined
    );

    return {
      featuresMatrix,
      labelsArray: labelsArray.length > 0 ? labelsArray : undefined,
    };
  }

  /**
   * Get feature statistics for dataset
   */
  getFeatureStatistics(dataset: Dataset): Record<string, {
    min: number;
    max: number;
    mean: number;
    std: number;
  }> {
    const stats: Record<string, {
      min: number;
      max: number;
      mean: number;
      std: number;
    }> = {};

    for (let i = 0; i < FEATURE_NAMES.length; i++) {
      const featureName = FEATURE_NAMES[i];
      const values = dataset.rows.map(row => row.features[i]);

      const min = Math.min(...values);
      const max = Math.max(...values);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);

      stats[featureName] = { min, max, mean, std };
    }

    return stats;
  }
}

/**
 * Default dataset builder instance
 */
export const datasetBuilder = new HistoricalSafetyDatasetBuilder();

