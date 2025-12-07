/**
 * B203A-ML-004: LabelGenerator
 *
 * Labels historical data with safety states based on actual restrictions/holds.
 * Uses timeline events as ground truth.
 */

import type { SafetyFeatureVector } from '../models/SafetyFeatureVector.js';

export type SafetyLabel = 'SAFE' | 'AT_RISK' | 'HIGH_RISK' | 'HOLD_TRIGGERED' | 'SUSPENDED';

export interface TimelineEvent {
  eventType: string;
  timestamp: Date;
  clinicianId: string;
  details?: {
    state?: string;
    reason?: string;
    privilegeGrantedId?: string;
    signalIds?: string[];
  };
}

export interface LabeledFeatureVector extends SafetyFeatureVector {
  label: SafetyLabel;
  labelSource: string; // 'timeline_event' | 'inferred' | 'manual'
  labelConfidence?: number; // 0 to 1
}

export interface LabelGenerationOptions {
  /**
   * Look-ahead window in days for finding events after feature vector timestamp
   * Default: 60 days
   */
  lookAheadDays?: number;

  /**
   * Whether to infer labels from feature values if no timeline event found
   * Default: false
   */
  inferFromFeatures?: boolean;

  /**
   * Thresholds for inferring labels from features
   */
  inferenceThresholds?: {
    atRisk?: number; // Feature risk score threshold
    highRisk?: number;
  };
}

/**
 * LabelGenerator class
 */
export class LabelGenerator {
  /**
   * Generate labels for feature vectors based on timeline events
   */
  generateLabels(
    featureVectors: SafetyFeatureVector[],
    timelineEvents: TimelineEvent[],
    options: LabelGenerationOptions = {}
  ): LabeledFeatureVector[] {
    const {
      lookAheadDays = 60,
      inferFromFeatures = false,
      inferenceThresholds = {
        atRisk: 0.4,
        highRisk: 0.7,
      },
    } = options;

    // Sort timeline events by timestamp
    const sortedEvents = [...timelineEvents].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Group events by clinician
    const eventsByClinician = new Map<string, TimelineEvent[]>();
    for (const event of sortedEvents) {
      const existing = eventsByClinician.get(event.clinicianId) || [];
      existing.push(event);
      eventsByClinician.set(event.clinicianId, existing);
    }

    // Label each feature vector
    const labeled: LabeledFeatureVector[] = [];

    for (const vector of featureVectors) {
      const label = this.labelFromTimeline(
        vector,
        eventsByClinician.get(vector.clinicianId) || [],
        lookAheadDays
      );

      if (label) {
        labeled.push({
          ...vector,
          label: label.label,
          labelSource: 'timeline_event',
          labelConfidence: 1.0,
        });
      } else if (inferFromFeatures) {
        const inferredLabel = this.inferLabelFromFeatures(vector, inferenceThresholds);
        if (inferredLabel) {
          labeled.push({
            ...vector,
            label: inferredLabel.label,
            labelSource: 'inferred',
            labelConfidence: inferredLabel.confidence,
          });
        } else {
          // Default to SAFE if no inference
          labeled.push({
            ...vector,
            label: 'SAFE',
            labelSource: 'inferred',
            labelConfidence: 0.5,
          });
        }
      } else {
        // No label if no event and inference disabled
        labeled.push({
          ...vector,
          label: 'SAFE',
          labelSource: 'inferred',
          labelConfidence: 0.3, // Low confidence default
        });
      }
    }

    return labeled;
  }

  /**
   * Label feature vector from timeline events
   */
  private labelFromTimeline(
    vector: SafetyFeatureVector,
    events: TimelineEvent[],
    lookAheadDays: number
  ): { label: SafetyLabel; confidence: number } | null {
    const vectorTime = vector.timestamp.getTime();
    const lookAheadTime = vectorTime + (lookAheadDays * 24 * 60 * 60 * 1000);

    // Find events within look-ahead window
    const relevantEvents = events.filter(
      (e) => e.timestamp.getTime() >= vectorTime && e.timestamp.getTime() <= lookAheadTime
    );

    if (relevantEvents.length === 0) {
      return null;
    }

    // Find the most severe event
    let mostSevere: TimelineEvent | null = null;
    let mostSevereLevel = 0;

    for (const event of relevantEvents) {
      const level = this.getEventSeverityLevel(event);
      if (level > mostSevereLevel) {
        mostSevereLevel = level;
        mostSevere = event;
      }
    }

    if (!mostSevere) {
      return null;
    }

    const label = this.eventToLabel(mostSevere);
    return { label, confidence: 1.0 };
  }

  /**
   * Get severity level for an event (higher = more severe)
   */
  private getEventSeverityLevel(event: TimelineEvent): number {
    const eventType = event.eventType.toUpperCase();
    const details = event.details || {};
    const state = details.state?.toUpperCase();

    // SUSPENDED is most severe
    if (eventType.includes('SUSPEND') || state === 'SUSPENDED') {
      return 5;
    }

    // HOLD is high severity
    if (eventType.includes('HOLD') || state === 'HOLD') {
      return 4;
    }

    // RESTRICTED is medium-high
    if (state === 'RESTRICTED') {
      return 3;
    }

    // PENDING_REVIEW is medium
    if (state === 'PENDING_REVIEW') {
      return 2;
    }

    // Safety signals are risk indicators
    if (eventType.includes('SIGNAL') || eventType.includes('RISK')) {
      return 1;
    }

    return 0;
  }

  /**
   * Convert timeline event to safety label
   */
  private eventToLabel(event: TimelineEvent): SafetyLabel {
    const eventType = event.eventType.toUpperCase();
    const details = event.details || {};
    const state = details.state?.toUpperCase();

    // Check for SUSPENDED
    if (eventType.includes('SUSPEND') || state === 'SUSPENDED') {
      return 'SUSPENDED';
    }

    // Check for HOLD
    if (eventType.includes('HOLD') || state === 'HOLD') {
      return 'HOLD_TRIGGERED';
    }

    // Check for RESTRICTED or HIGH_RISK signals
    if (state === 'RESTRICTED' || eventType.includes('HIGH_RISK') || eventType.includes('CRITICAL')) {
      return 'HIGH_RISK';
    }

    // Check for PENDING_REVIEW or AT_RISK signals
    if (state === 'PENDING_REVIEW' || eventType.includes('AT_RISK') || eventType.includes('MEDIUM')) {
      return 'AT_RISK';
    }

    // Default to AT_RISK for any safety-related event
    if (eventType.includes('SAFETY') || eventType.includes('SIGNAL') || eventType.includes('RISK')) {
      return 'AT_RISK';
    }

    // Default to SAFE if event doesn't match known patterns
    return 'SAFE';
  }

  /**
   * Infer label from feature values
   */
  private inferLabelFromFeatures(
    vector: SafetyFeatureVector,
    thresholds: { atRisk?: number; highRisk?: number }
  ): { label: SafetyLabel; confidence: number } | null {
    const { atRisk = 0.4, highRisk = 0.7 } = thresholds;

    // Calculate composite risk score
    const riskScore = this.calculateRiskScore(vector.features);

    if (riskScore >= highRisk) {
      return { label: 'HIGH_RISK', confidence: 0.7 };
    }

    if (riskScore >= atRisk) {
      return { label: 'AT_RISK', confidence: 0.6 };
    }

    return null; // SAFE doesn't need inference
  }

  /**
   * Calculate composite risk score from features
   */
  private calculateRiskScore(features: SafetyFeatureVector['features']): number {
    // Weighted combination of risk indicators
    const weights = {
      oppe_trend: -0.1, // Negative (declining trend = higher risk)
      fppe_outcomes: -0.15, // Negative (poor outcomes = higher risk)
      complication_rate: 0.2,
      drift_events: 0.15,
      license_freshness: -0.1, // Negative (expired = higher risk)
      board_freshness: -0.1,
      dea_expiry: -0.1,
      pecos_status: -0.05,
      payer_denials: 0.1,
      ehr_mismatches: 0.15,
    };

    let riskScore = 0;
    for (const [key, weight] of Object.entries(weights)) {
      const value = features[key as keyof typeof features];
      // For negative weights, invert the value (1 - value)
      const contribution = weight < 0 ? (1 - value) * Math.abs(weight) : value * weight;
      riskScore += contribution;
    }

    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, riskScore));
  }

  /**
   * Get label distribution statistics
   */
  getLabelDistribution(labeled: LabeledFeatureVector[]): Record<SafetyLabel, number> {
    const distribution: Record<SafetyLabel, number> = {
      SAFE: 0,
      AT_RISK: 0,
      HIGH_RISK: 0,
      HOLD_TRIGGERED: 0,
      SUSPENDED: 0,
    };

    for (const vector of labeled) {
      distribution[vector.label]++;
    }

    return distribution;
  }
}

/**
 * Default label generator instance
 */
export const labelGenerator = new LabelGenerator();

