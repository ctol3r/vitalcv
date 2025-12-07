/**
 * B203A-ML-002: FeatureExtractor service
 *
 * Aggregates signals from OPPE, FPPE, drift, risk, compliance, and enrollment services.
 * Outputs normalized feature vector for predictive safety analysis.
 */

import { z } from 'zod';
import type { SafetyFeatures } from '../models/SafetyFeatureVector.js';
import { createSafetyFeatureVector } from '../models/SafetyFeatureVector.js';

export interface FeatureExtractorInput {
  clinicianId: string;
  timestamp?: Date;
}

export interface OPPEData {
  trend: number; // -1 to 1 (declining to improving)
  lastReviewScore?: number; // 0 to 1
  caseCount?: number;
  complications?: number;
}

export interface FPPEData {
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED';
  outcomes: number; // 0 to 1 (poor to excellent)
  startAt?: Date;
  endAt?: Date;
}

export interface DriftData {
  eventCount: number;
  severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  lastEventAt?: Date;
}

export interface ComplianceData {
  licenseExpiryDays?: number; // Days until license expires (negative if expired)
  boardExpiryDays?: number; // Days until board cert expires
  deaExpiryDays?: number; // Days until DEA expires
  pecosStatus: 'ENROLLED' | 'PENDING' | 'DEACTIVATED' | 'UNKNOWN';
}

export interface EnrollmentData {
  payerDenialRate: number; // 0 to 1 (normalized denial rate)
  enrollmentDecline: number; // 0 to 1 (0 = stable, 1 = significant decline)
}

export interface RiskData {
  complicationRate: number; // 0 to 1 (normalized)
  riskScore?: number; // 0 to 1
}

export interface EHRData {
  mismatchCount: number;
  lastMismatchAt?: Date;
}

/**
 * Normalize a value to 0-1 range
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  const normalized = (value - min) / (max - min);
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Normalize days until expiry to 0-1 freshness score
 * Assumes 5 years (1825 days) is "fresh" and 0 or negative is "expired"
 */
function normalizeExpiryDays(days: number | undefined): number {
  if (days === undefined) return 0.5; // Unknown = neutral
  if (days <= 0) return 0; // Expired
  const maxDays = 1825; // 5 years
  return normalize(days, 0, maxDays);
}

/**
 * Normalize count to 0-1 range using logarithmic scaling
 */
function normalizeCount(count: number, maxCount: number = 10): number {
  if (count <= 0) return 0;
  if (count >= maxCount) return 1;
  // Logarithmic scaling for better distribution
  return Math.log10(1 + (count / maxCount) * 9) / Math.log10(10);
}

/**
 * Extract OPPE trend feature
 */
function extractOPPETrend(oppeData: OPPEData | null): number {
  if (!oppeData) return 0; // Neutral if no data

  // Use trend directly if provided (-1 to 1)
  if (oppeData.trend !== undefined) {
    return Math.max(-1, Math.min(1, oppeData.trend));
  }

  // Calculate trend from metrics if available
  if (oppeData.lastReviewScore !== undefined) {
    // Convert score (0-1) to trend (-1 to 1) by comparing to threshold
    const threshold = 0.7; // 70% is considered "good"
    return (oppeData.lastReviewScore - threshold) * 2; // Scale to -1 to 1
  }

  return 0; // Default to neutral
}

/**
 * Extract FPPE outcomes feature
 */
function extractFPPEOutcomes(fppeData: FPPEData | null): number {
  if (!fppeData) return 0.5; // Neutral if no data

  // Use outcomes directly if provided (0 to 1)
  if (fppeData.outcomes !== undefined) {
    return Math.max(0, Math.min(1, fppeData.outcomes));
  }

  // Infer from status
  switch (fppeData.status) {
    case 'COMPLETED':
      return 0.8; // Generally positive
    case 'OPEN':
      return 0.5; // In progress, neutral
    case 'CANCELLED':
      return 0.2; // Negative signal
    default:
      return 0.5;
  }
}

/**
 * Extract complication rate feature
 */
function extractComplicationRate(riskData: RiskData | null): number {
  if (!riskData) return 0; // No complications if no data

  return Math.max(0, Math.min(1, riskData.complicationRate));
}

/**
 * Extract drift events feature
 */
function extractDriftEvents(driftData: DriftData[] | null): number {
  if (!driftData || driftData.length === 0) return 0;

  // Count events with severity weighting
  let weightedCount = 0;
  for (const event of driftData) {
    const weight = event.severity === 'CRITICAL' ? 4 :
                   event.severity === 'HIGH' ? 3 :
                   event.severity === 'MED' ? 2 : 1;
    weightedCount += weight;
  }

  return normalizeCount(weightedCount, 20); // Max 20 weighted events
}

/**
 * Extract license freshness feature
 */
function extractLicenseFreshness(complianceData: ComplianceData | null): number {
  if (!complianceData || complianceData.licenseExpiryDays === undefined) {
    return 0.5; // Unknown = neutral
  }

  return normalizeExpiryDays(complianceData.licenseExpiryDays);
}

/**
 * Extract board freshness feature
 */
function extractBoardFreshness(complianceData: ComplianceData | null): number {
  if (!complianceData || complianceData.boardExpiryDays === undefined) {
    return 0.5; // Unknown = neutral
  }

  return normalizeExpiryDays(complianceData.boardExpiryDays);
}

/**
 * Extract DEA expiry feature
 */
function extractDEAExpiry(complianceData: ComplianceData | null): number {
  if (!complianceData || complianceData.deaExpiryDays === undefined) {
    return 0.5; // Unknown = neutral
  }

  return normalizeExpiryDays(complianceData.deaExpiryDays);
}

/**
 * Extract PECOS status feature
 */
function extractPECOSStatus(complianceData: ComplianceData | null): number {
  if (!complianceData) return 0; // Not enrolled if no data

  switch (complianceData.pecosStatus) {
    case 'ENROLLED':
      return 1.0;
    case 'PENDING':
      return 0.5;
    case 'DEACTIVATED':
      return 0.0;
    case 'UNKNOWN':
      return 0.3; // Slight negative signal
    default:
      return 0;
  }
}

/**
 * Extract payer denials feature
 */
function extractPayerDenials(enrollmentData: EnrollmentData | null): number {
  if (!enrollmentData) return 0; // No denials if no data

  return Math.max(0, Math.min(1, enrollmentData.payerDenialRate));
}

/**
 * Extract EHR mismatches feature
 */
function extractEHRMismatches(ehrData: EHRData | null): number {
  if (!ehrData || ehrData.mismatchCount === undefined) return 0;

  return normalizeCount(ehrData.mismatchCount, 5); // Max 5 mismatches = 1.0
}

/**
 * FeatureExtractor class
 */
export class FeatureExtractor {
  /**
   * Extract features for a clinician
   */
  async extractFeatures(
    input: FeatureExtractorInput,
    data: {
      oppe?: OPPEData | null;
      fppe?: FPPEData | null;
      drift?: DriftData[] | null;
      compliance?: ComplianceData | null;
      enrollment?: EnrollmentData | null;
      risk?: RiskData | null;
      ehr?: EHRData | null;
    }
  ): Promise<SafetyFeatures> {
    const features: SafetyFeatures = {
      oppe_trend: extractOPPETrend(data.oppe || null),
      fppe_outcomes: extractFPPEOutcomes(data.fppe || null),
      complication_rate: extractComplicationRate(data.risk || null),
      drift_events: extractDriftEvents(data.drift || null),
      license_freshness: extractLicenseFreshness(data.compliance || null),
      board_freshness: extractBoardFreshness(data.compliance || null),
      dea_expiry: extractDEAExpiry(data.compliance || null),
      pecos_status: extractPECOSStatus(data.compliance || null),
      payer_denials: extractPayerDenials(data.enrollment || null),
      ehr_mismatches: extractEHRMismatches(data.ehr || null),
    };

    return features;
  }

  /**
   * Create a feature vector from extracted features
   */
  createFeatureVector(
    clinicianId: string,
    features: SafetyFeatures,
    timestamp?: Date
  ) {
    return createSafetyFeatureVector({
      clinicianId,
      timestamp: timestamp || new Date(),
      features,
    });
  }
}

/**
 * Default feature extractor instance
 */
export const featureExtractor = new FeatureExtractor();

