/**
 * B224A-REP-004: ReputationDeltaTracker
 *
 * Tracks changes in reputation scores over time.
 * Emits events when thresholds are crossed.
 * Used by supervision and autonomy engines.
 */

import { PrismaClient } from '@prisma/client';
import { getReputation } from './models/ClinicianReputation.js';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

/**
 * Reputation delta event
 */
export interface ReputationDeltaEvent {
  clinicianId: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  thresholdCrossed?: string;
  timestamp: Date;
}

/**
 * Threshold configuration
 */
export interface ReputationThresholds {
  criticalLow: number; // Below this triggers critical alert
  low: number; // Below this triggers warning
  high: number; // Above this is good
  excellent: number; // Above this is excellent
}

export const DEFAULT_THRESHOLDS: ReputationThresholds = {
  criticalLow: 30,
  low: 50,
  high: 70,
  excellent: 85,
};

/**
 * ReputationDeltaTracker class
 */
export class ReputationDeltaTracker extends EventEmitter {
  private thresholds: ReputationThresholds;
  private previousScores: Map<string, number> = new Map();

  constructor(thresholds: ReputationThresholds = DEFAULT_THRESHOLDS) {
    super();
    this.thresholds = thresholds;
  }

  /**
   * Track reputation change for a clinician
   */
  async trackChange(
    clinicianId: string,
    currentScore: number
  ): Promise<ReputationDeltaEvent | null> {
    const previousScore = this.previousScores.get(clinicianId) ?? 0;
    const delta = currentScore - previousScore;

    // Only emit event if there's a significant change (>= 1 point)
    if (Math.abs(delta) < 1) {
      return null;
    }

    const event: ReputationDeltaEvent = {
      clinicianId,
      previousScore,
      currentScore,
      delta,
      timestamp: new Date(),
    };

    // Check for threshold crossings
    const thresholdCrossed = this.checkThresholdCrossing(previousScore, currentScore);
    if (thresholdCrossed) {
      event.thresholdCrossed = thresholdCrossed;
      this.emit('thresholdCrossed', event);
    }

    // Emit delta event
    this.emit('delta', event);

    // Store current score
    this.previousScores.set(clinicianId, currentScore);

    // Persist to database (could create a ReputationDeltaHistory table)
    await this.persistDelta(event);

    return event;
  }

  /**
   * Check if a threshold was crossed
   */
  private checkThresholdCrossing(
    previousScore: number,
    currentScore: number
  ): string | undefined {
    const thresholds = [
      { name: 'criticalLow', value: this.thresholds.criticalLow },
      { name: 'low', value: this.thresholds.low },
      { name: 'high', value: this.thresholds.high },
      { name: 'excellent', value: this.thresholds.excellent },
    ];

    for (const threshold of thresholds) {
      // Crossed going down
      if (previousScore >= threshold.value && currentScore < threshold.value) {
        return `crossed_${threshold.name}_down`;
      }
      // Crossed going up
      if (previousScore < threshold.value && currentScore >= threshold.value) {
        return `crossed_${threshold.name}_up`;
      }
    }

    return undefined;
  }

  /**
   * Persist delta to database
   */
  private async persistDelta(event: ReputationDeltaEvent): Promise<void> {
    // In a production system, you might want to create a ReputationDeltaHistory table
    // For now, we'll just log it or store in a JSON field
    // This is a placeholder that can be extended
  }

  /**
   * Initialize tracker with current scores from database
   */
  async initialize(clinicianIds: string[]): Promise<void> {
    for (const clinicianId of clinicianIds) {
      const reputation = await getReputation(clinicianId);
      if (reputation) {
        this.previousScores.set(clinicianId, reputation.overallScore);
      } else {
        this.previousScores.set(clinicianId, 0);
      }
    }
  }

  /**
   * Get previous score for a clinician
   */
  getPreviousScore(clinicianId: string): number {
    return this.previousScores.get(clinicianId) ?? 0;
  }

  /**
   * Update thresholds
   */
  updateThresholds(thresholds: Partial<ReputationThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get current thresholds
   */
  getThresholds(): ReputationThresholds {
    return { ...this.thresholds };
  }
}

/**
 * Default tracker instance
 */
export const reputationDeltaTracker = new ReputationDeltaTracker();

// Set up event handlers for supervision and autonomy engines
reputationDeltaTracker.on('thresholdCrossed', (event: ReputationDeltaEvent) => {
  // This would notify supervision and autonomy engines
  console.log(`[ReputationDeltaTracker] Threshold crossed for ${event.clinicianId}:`, event);
});

reputationDeltaTracker.on('delta', (event: ReputationDeltaEvent) => {
  // This would log or process delta events
  if (Math.abs(event.delta) >= 5) {
    console.log(`[ReputationDeltaTracker] Significant change for ${event.clinicianId}:`, event);
  }
});

