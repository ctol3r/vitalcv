/**
 * B206B-WF-006: SupplyForecastFeatureExtractor
 *
 * Extracts features for supply forecasting:
 * - License expirations
 * - Board expirations
 * - DEA expirations
 * - Upcoming privilege renewals
 * - Predictive safety risk
 * - Mobility readiness
 * - Enrollment cycles
 * - Compact eligibility shifts
 * - Enrollment completeness (v2) - affects supply readiness
 */

import { z } from 'zod';
import type { SafetyFeatures } from '../../predictiveSafety/models/SafetyFeatureVector.js';
import type { MobilityReadinessStatus } from '../../workforce/matching/mobilityIntegration.js';
import {
  enrollmentCompletenessCalculator,
  type PECOSEnrollment,
  type MedicaidEnrollment,
  type PayerEnrollment,
} from '../../competency/extractors/enrollmentCompleteness.js';

export interface SupplyFeatureExtractorInput {
  clinicianId: string;
  timestamp?: Date;
}

export interface LicenseExpirationData {
  licenseId: string;
  state: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  renewalRequired: boolean;
}

export interface BoardExpirationData {
  boardId: string;
  boardName: string;
  specialty: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  maintenanceRequired: boolean;
}

export interface DEAExpirationData {
  deaNumber: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  renewalRequired: boolean;
}

export interface PrivilegeRenewalData {
  privilegeCode: string;
  privilegeName: string;
  renewalDueDate: Date;
  daysUntilRenewal: number;
  status: 'ACTIVE' | 'PENDING_RENEWAL' | 'EXPIRED';
}

export interface EnrollmentCycleData {
  payerId: string;
  payerName: string;
  enrollmentStatus: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'SUSPENDED';
  renewalDueDate?: Date;
  daysUntilRenewal?: number;
  cycleType: 'ANNUAL' | 'BIENNIAL' | 'QUARTERLY';
}

export interface CompactEligibilityData {
  compactType: 'IMLC' | 'PSY' | 'NURSE' | 'COUNSELING';
  currentEligibility: boolean;
  eligibilityChangeDate?: Date;
  daysUntilChange?: number;
  reason?: string;
}

export interface SupplyFeatures {
  // Credential expirations (0-1, where 0 = expired/expiring soon, 1 = fresh)
  licenseExpirationRisk: number; // 0 = expired/expiring, 1 = fresh
  boardExpirationRisk: number; // 0 = expired/expiring, 1 = fresh
  deaExpirationRisk: number; // 0 = expired/expiring, 1 = fresh

  // Privilege renewals (0-1, where 0 = no renewals due, 1 = many renewals due)
  privilegeRenewalPressure: number; // 0 = no renewals, 1 = many renewals due

  // Predictive safety risk (0-1, from safety forecast)
  predictiveSafetyRisk: number; // 0 = low risk, 1 = high risk

  // Mobility readiness (0-1, where 0 = blocked, 1 = instantly onboardable)
  mobilityReadiness: number; // 0 = blocked, 0.5 = portable, 1 = instantly onboardable

  // Enrollment cycles (0-1, where 0 = no enrollments due, 1 = many enrollments due)
  enrollmentCyclePressure: number; // 0 = no enrollments due, 1 = many due

  // Compact eligibility (0-1, where 0 = losing eligibility, 1 = gaining/maintaining)
  compactEligibilityStability: number; // 0 = losing eligibility, 1 = stable/gaining

  // Enrollment completeness readiness (0-1, where 0 = incomplete/expiring, 1 = fully enrolled)
  // Low completeness reduces supply readiness (e.g., upcoming payer collapse)
  enrollmentReadiness: number; // 0 = incomplete/expiring, 1 = fully enrolled
}

export const SupplyFeaturesSchema = z.object({
  licenseExpirationRisk: z.number().min(0).max(1),
  boardExpirationRisk: z.number().min(0).max(1),
  deaExpirationRisk: z.number().min(0).max(1),
  privilegeRenewalPressure: z.number().min(0).max(1),
  predictiveSafetyRisk: z.number().min(0).max(1),
  mobilityReadiness: z.number().min(0).max(1),
  enrollmentCyclePressure: z.number().min(0).max(1),
  compactEligibilityStability: z.number().min(0).max(1),
  enrollmentReadiness: z.number().min(0).max(1),
});

export type SupplyFeatureVector = z.infer<typeof SupplyFeaturesSchema>;

/**
 * Normalize days until expiry to 0-1 freshness score
 * Assumes 2 years (730 days) is "fresh" and 0 or negative is "expired"
 */
function normalizeExpiryDays(days: number | undefined): number {
  if (days === undefined) return 0.5; // Unknown = neutral
  if (days <= 0) return 0; // Expired
  if (days <= 30) return 0.1; // Expiring very soon
  if (days <= 90) return 0.3; // Expiring soon
  if (days <= 180) return 0.5; // Expiring in 6 months
  const maxDays = 730; // 2 years
  return Math.min(1, days / maxDays);
}

/**
 * Extract license expiration risk
 */
function extractLicenseExpirationRisk(
  licenses: LicenseExpirationData[] | null
): number {
  if (!licenses || licenses.length === 0) return 0.5; // Unknown = neutral

  // Use the most critical (earliest expiry) license
  const earliestExpiry = Math.min(
    ...licenses.map((l) => l.daysUntilExpiry)
  );
  return normalizeExpiryDays(earliestExpiry);
}

/**
 * Extract board expiration risk
 */
function extractBoardExpirationRisk(
  boards: BoardExpirationData[] | null
): number {
  if (!boards || boards.length === 0) return 0.5; // Unknown = neutral

  // Use the most critical (earliest expiry) board cert
  const earliestExpiry = Math.min(
    ...boards.map((b) => b.daysUntilExpiry)
  );
  return normalizeExpiryDays(earliestExpiry);
}

/**
 * Extract DEA expiration risk
 */
function extractDEAExpirationRisk(dea: DEAExpirationData[] | null): number {
  if (!dea || dea.length === 0) return 0.5; // Unknown = neutral

  // Use the most critical (earliest expiry) DEA
  const earliestExpiry = Math.min(...dea.map((d) => d.daysUntilExpiry));
  return normalizeExpiryDays(earliestExpiry);
}

/**
 * Extract privilege renewal pressure
 */
function extractPrivilegeRenewalPressure(
  privileges: PrivilegeRenewalData[] | null
): number {
  if (!privileges || privileges.length === 0) return 0; // No renewals = no pressure

  const now = new Date();
  const next90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Count privileges due for renewal in next 90 days
  const renewalsDue = privileges.filter((p) => {
    if (p.status === 'EXPIRED') return true;
    if (p.status === 'PENDING_RENEWAL') return true;
    return p.renewalDueDate <= next90Days && p.daysUntilRenewal <= 90;
  }).length;

  // Normalize: 0 renewals = 0, 5+ renewals = 1.0
  return Math.min(1, renewalsDue / 5);
}

/**
 * Extract enrollment cycle pressure
 */
function extractEnrollmentCyclePressure(
  enrollments: EnrollmentCycleData[] | null
): number {
  if (!enrollments || enrollments.length === 0) return 0; // No enrollments = no pressure

  const now = new Date();
  const next180Days = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  // Count enrollments due for renewal in next 180 days
  const renewalsDue = enrollments.filter((e) => {
    if (e.enrollmentStatus === 'EXPIRED') return true;
    if (e.renewalDueDate && e.renewalDueDate <= next180Days) {
      return (e.daysUntilRenewal ?? Infinity) <= 180;
    }
    return false;
  }).length;

  // Normalize: 0 renewals = 0, 3+ renewals = 1.0
  return Math.min(1, renewalsDue / 3);
}

/**
 * Extract compact eligibility stability
 */
function extractCompactEligibilityStability(
  compacts: CompactEligibilityData[] | null
): number {
  if (!compacts || compacts.length === 0) return 0.5; // Unknown = neutral

  // Check if any eligibility is changing soon (next 90 days)
  const now = new Date();
  const next90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const eligibilityChanges = compacts.filter((c) => {
    if (!c.eligibilityChangeDate) return false;
    return (
      c.eligibilityChangeDate <= next90Days &&
      (c.daysUntilChange ?? Infinity) <= 90
    );
  });

  if (eligibilityChanges.length === 0) {
    // No changes = stable
    const allEligible = compacts.every((c) => c.currentEligibility);
    return allEligible ? 1.0 : 0.5;
  }

  // If losing eligibility, return low score
  const losingEligibility = eligibilityChanges.some(
    (c) => c.currentEligibility && c.eligibilityChangeDate
  );
  return losingEligibility ? 0.2 : 0.8; // Losing = 0.2, gaining = 0.8
}

/**
 * Map mobility readiness status to 0-1 score
 */
function mapMobilityReadinessToScore(
  status: MobilityReadinessStatus | null
): number {
  if (!status) return 0.5; // Unknown = neutral

  switch (status) {
    case 'instantly_onboardable':
      return 1.0;
    case 'portable':
      return 0.5;
    case 'blocked':
      return 0.0;
    default:
      return 0.5;
  }
}

/**
 * Extract enrollment readiness from enrollment completeness v2
 * Low completeness or upcoming payer collapse reduces supply readiness
 */
function extractEnrollmentReadiness(input: {
  pecos?: PECOSEnrollment | null;
  medicaid?: MedicaidEnrollment[];
  payers?: PayerEnrollment[];
}): number {
  const result = enrollmentCompletenessCalculator.calculate(input);

  // Use completeness score directly as readiness
  // Missing required payers or expired enrollments reduce readiness
  let readiness = result.completeness;

  // Additional penalty for missing required payers (indicates upcoming collapse)
  if (result.missingRequiredPayers.length > 0) {
    // Each missing required payer reduces readiness by 10%
    const penalty = Math.min(0.3, result.missingRequiredPayers.length * 0.1);
    readiness = Math.max(0, readiness - penalty);
  }

  // Penalty for expired PECOS (critical for Medicare)
  if (result.pecosScore < 1.0 && result.breakdown.pecos.status === 'ENROLLED') {
    // Expired PECOS reduces readiness
    readiness = Math.max(0, readiness - 0.2);
  }

  // Penalty for expired Medicaid enrollments
  if (result.medicaidScore < 1.0 && result.breakdown.medicaid.totalStates > 0) {
    const medicaidGap = 1.0 - result.medicaidScore;
    readiness = Math.max(0, readiness - medicaidGap * 0.15);
  }

  return Math.min(1, Math.max(0, readiness));
}

/**
 * SupplyForecastFeatureExtractor class
 */
export class SupplyForecastFeatureExtractor {
  /**
   * Extract supply forecast features for a clinician
   */
  async extractFeatures(
    input: SupplyFeatureExtractorInput,
    data: {
      licenses?: LicenseExpirationData[] | null;
      boards?: BoardExpirationData[] | null;
      dea?: DEAExpirationData[] | null;
      privileges?: PrivilegeRenewalData[] | null;
      safetyFeatures?: SafetyFeatures | null;
      mobilityStatus?: MobilityReadinessStatus | null;
      enrollments?: EnrollmentCycleData[] | null;
      compacts?: CompactEligibilityData[] | null;
      enrollmentCompleteness?: {
        pecos?: PECOSEnrollment | null;
        medicaid?: MedicaidEnrollment[];
        payers?: PayerEnrollment[];
      } | null;
    }
  ): Promise<SupplyFeatures> {
    const features: SupplyFeatures = {
      licenseExpirationRisk: extractLicenseExpirationRisk(
        data.licenses || null
      ),
      boardExpirationRisk: extractBoardExpirationRisk(data.boards || null),
      deaExpirationRisk: extractDEAExpirationRisk(data.dea || null),
      privilegeRenewalPressure: extractPrivilegeRenewalPressure(
        data.privileges || null
      ),
      predictiveSafetyRisk: data.safetyFeatures
        ? // Invert safety risk: high safety risk = low supply readiness
          1 - Math.max(
            data.safetyFeatures.oppe_trend < 0
              ? Math.abs(data.safetyFeatures.oppe_trend)
              : 0,
            data.safetyFeatures.complication_rate,
            data.safetyFeatures.drift_events,
            1 - data.safetyFeatures.license_freshness,
            1 - data.safetyFeatures.board_freshness,
            1 - data.safetyFeatures.dea_expiry
          )
        : 0.5, // Unknown = neutral
      mobilityReadiness: mapMobilityReadinessToScore(
        data.mobilityStatus || null
      ),
      enrollmentCyclePressure: extractEnrollmentCyclePressure(
        data.enrollments || null
      ),
      compactEligibilityStability: extractCompactEligibilityStability(
        data.compacts || null
      ),
      enrollmentReadiness: extractEnrollmentReadiness(
        data.enrollmentCompleteness || {}
      ),
    };

    return features;
  }

  /**
   * Create a feature vector from extracted features
   */
  createFeatureVector(
    clinicianId: string,
    features: SupplyFeatures,
    timestamp?: Date
  ) {
    return {
      clinicianId,
      timestamp: timestamp || new Date(),
      features,
    };
  }
}

/**
 * Default feature extractor instance
 */
export const supplyFeatureExtractor = new SupplyForecastFeatureExtractor();

