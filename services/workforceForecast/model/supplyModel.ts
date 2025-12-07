/**
 * B206B-WF-007: SupplyForecastModel
 *
 * Predicts supplyReadiness per clinician per time window.
 * Uses CCI (Credential Cycle Index) + forecastSafety + credential cycles.
 */

import type { SupplyFeatures } from '../extractors/supplyFeatures.js';
import type { SafetyFeatures } from '../../predictiveSafety/models/SafetyFeatureVector.js';

export interface SupplyForecastInput {
  clinicianId: string;
  features: SupplyFeatures;
  safetyFeatures?: SafetyFeatures | null;
  timestamp: Date;
  timeWindowDays?: number; // Default 30 days
}

export interface SupplyReadinessPrediction {
  clinicianId: string;
  timeWindowStart: Date;
  timeWindowEnd: Date;
  supplyReadiness: number; // 0-1, where 1 = fully ready, 0 = unavailable
  confidence: number; // 0-1
  factors: {
    credentialCycles: number; // 0-1, impact of credential cycles
    safetyRisk: number; // 0-1, impact of safety risk
    mobility: number; // 0-1, impact of mobility readiness
    enrollmentCycles: number; // 0-1, impact of enrollment cycles
  };
  predictedGaps: Array<{
    startDate: Date;
    endDate: Date;
    reason: string;
    severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  }>;
  timestamp: Date;
}

/**
 * Calculate Credential Cycle Index (CCI)
 * CCI measures the combined impact of credential expirations and renewals
 */
function calculateCCI(features: SupplyFeatures): number {
  // Weighted combination of credential expiration risks
  const credentialRisk =
    (1 - features.licenseExpirationRisk) * 0.4 +
    (1 - features.boardExpirationRisk) * 0.3 +
    (1 - features.deaExpirationRisk) * 0.3;

  // Privilege renewal pressure adds to risk
  const renewalPressure = features.privilegeRenewalPressure * 0.2;

  // CCI: 0 = all credentials expiring, 1 = all credentials fresh
  const cci = 1 - Math.min(1, credentialRisk + renewalPressure);
  return Math.max(0, Math.min(1, cci));
}

/**
 * Predict supply readiness for a time window
 */
export class SupplyForecastModel {
  /**
   * Predict supply readiness
   */
  async predict(
    input: SupplyForecastInput
  ): Promise<SupplyReadinessPrediction> {
    const timeWindowDays = input.timeWindowDays || 30;
    const timeWindowStart = input.timestamp;
    const timeWindowEnd = new Date(
      timeWindowStart.getTime() + timeWindowDays * 24 * 60 * 60 * 1000
    );

    // Calculate CCI
    const cci = calculateCCI(input.features);

    // Extract factors
    const credentialCycles = cci; // CCI directly impacts readiness
    const safetyRisk = 1 - input.features.predictiveSafetyRisk; // Invert: high safety risk = low readiness
    const mobility = input.features.mobilityReadiness;
    const enrollmentCycles =
      1 - input.features.enrollmentCyclePressure; // Invert: high pressure = low readiness
    const compactStability = input.features.compactEligibilityStability;

    // Weighted combination for overall readiness
    // Higher weight on credentials and safety, moderate on mobility
    const supplyReadiness =
      credentialCycles * 0.35 +
      safetyRisk * 0.25 +
      mobility * 0.20 +
      enrollmentCycles * 0.10 +
      compactStability * 0.10;

    // Clamp to 0-1
    const readiness = Math.max(0, Math.min(1, supplyReadiness));

    // Calculate confidence based on data completeness
    const confidence = this.calculateConfidence(input.features);

    // Predict gaps based on features
    const predictedGaps = this.predictGaps(
      input.features,
      timeWindowStart,
      timeWindowEnd
    );

    return {
      clinicianId: input.clinicianId,
      timeWindowStart,
      timeWindowEnd,
      supplyReadiness: readiness,
      confidence,
      factors: {
        credentialCycles,
        safetyRisk,
        mobility,
        enrollmentCycles,
      },
      predictedGaps,
      timestamp: input.timestamp,
    };
  }

  /**
   * Calculate confidence based on data completeness
   */
  private calculateConfidence(features: SupplyFeatures): number {
    // Check if we have data for all key features
    let completeness = 0;
    let total = 0;

    // Credential features (critical)
    if (features.licenseExpirationRisk !== 0.5) {
      completeness += 1;
    }
    total += 1;

    if (features.boardExpirationRisk !== 0.5) {
      completeness += 1;
    }
    total += 1;

    if (features.deaExpirationRisk !== 0.5) {
      completeness += 1;
    }
    total += 1;

    // Safety and mobility (important)
    if (features.predictiveSafetyRisk !== 0.5) {
      completeness += 0.8;
    }
    total += 0.8;

    if (features.mobilityReadiness !== 0.5) {
      completeness += 0.8;
    }
    total += 0.8;

    // Enrollment and compact (moderate)
    if (features.enrollmentCyclePressure !== 0) {
      completeness += 0.5;
    }
    total += 0.5;

    if (features.compactEligibilityStability !== 0.5) {
      completeness += 0.5;
    }
    total += 0.5;

    return Math.min(1, completeness / total);
  }

  /**
   * Predict gaps in supply based on features
   */
  private predictGaps(
    features: SupplyFeatures,
    windowStart: Date,
    windowEnd: Date
  ): Array<{
    startDate: Date;
    endDate: Date;
    reason: string;
    severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  }> {
    const gaps: Array<{
      startDate: Date;
      endDate: Date;
      reason: string;
      severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
    }> = [];

    // License expiration gap
    if (features.licenseExpirationRisk < 0.3) {
      gaps.push({
        startDate: windowStart,
        endDate: windowEnd,
        reason: 'License expiration risk',
        severity:
          features.licenseExpirationRisk < 0.1 ? 'CRITICAL' : 'HIGH',
      });
    }

    // Board expiration gap
    if (features.boardExpirationRisk < 0.3) {
      gaps.push({
        startDate: windowStart,
        endDate: windowEnd,
        reason: 'Board certification expiration risk',
        severity:
          features.boardExpirationRisk < 0.1 ? 'CRITICAL' : 'HIGH',
      });
    }

    // DEA expiration gap
    if (features.deaExpirationRisk < 0.3) {
      gaps.push({
        startDate: windowStart,
        endDate: windowEnd,
        reason: 'DEA expiration risk',
        severity: features.deaExpirationRisk < 0.1 ? 'CRITICAL' : 'HIGH',
      });
    }

    // Safety risk gap
    if (features.predictiveSafetyRisk > 0.7) {
      gaps.push({
        startDate: windowStart,
        endDate: windowEnd,
        reason: 'High predictive safety risk',
        severity:
          features.predictiveSafetyRisk > 0.9 ? 'CRITICAL' : 'HIGH',
      });
    }

    // Privilege renewal gap
    if (features.privilegeRenewalPressure > 0.7) {
      gaps.push({
        startDate: windowStart,
        endDate: windowEnd,
        reason: 'High privilege renewal pressure',
        severity: 'MED',
      });
    }

    // Enrollment cycle gap
    if (features.enrollmentCyclePressure > 0.7) {
      gaps.push({
        startDate: windowStart,
        endDate: windowEnd,
        reason: 'High enrollment renewal pressure',
        severity: 'MED',
      });
    }

    // Compact eligibility gap
    if (features.compactEligibilityStability < 0.3) {
      gaps.push({
        startDate: windowStart,
        endDate: windowEnd,
        reason: 'Compact eligibility loss',
        severity: 'MED',
      });
    }

    return gaps;
  }
}

/**
 * Default model instance
 */
export const supplyForecastModel = new SupplyForecastModel();

