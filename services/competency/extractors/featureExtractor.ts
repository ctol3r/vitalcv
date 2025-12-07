/**
 * B205A-CCI-002: CompetencyFeatureExtractor
 *
 * Builds vector from OPPE, FPPE, Fusion, Drift, NCI, Passport, Mobility, Enrollment, EHR sync, privilege DAG.
 * Includes deterministic mode for tests.
 */

import type { CompetencyFeatures } from '../models/CompetencyFeatureVector.js';
import { createCompetencyFeatureVector } from '../models/CompetencyFeatureVector.js';
import { caseComplexityCalculator, type ProcedureCase } from './caseComplexity.js';
import { privilegeBreadthDepthCalculator, type PrivilegeNode } from './privilegeBreadthDepth.js';
import { enrollmentCompletenessCalculator, type PECOSEnrollment, type MedicaidEnrollment, type PayerEnrollment } from './enrollmentCompleteness.js';

export interface FeatureExtractorInput {
  clinicianId: string;
  timestamp?: Date;
  deterministic?: boolean; // For tests
}

export interface OPPEData {
  trend: number; // -1 to 1 (declining to improving)
  lastReviewScore?: number; // 0 to 1
  caseCount?: number;
  complications?: number;
}

export interface FPPEData {
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED';
  score: number; // 0 to 1 (poor to excellent)
  startAt?: Date;
  endAt?: Date;
}

export interface FusionData {
  qualityScore?: number; // 0 to 1
  safetyScore?: number; // 0 to 1
  outcomes?: {
    successRate?: number;
    adverseEvents?: number;
  };
}

export interface DriftData {
  eventCount: number;
  severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  lastEventAt?: Date;
  events?: Array<{
    severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
    type: string;
  }>;
}

export interface NCIData {
  published?: boolean;
  lastPublishedAt?: Date;
  trustScore?: number; // 0 to 1
}

export interface PassportData {
  shared?: boolean;
  lastSharedAt?: Date;
  recipientCount?: number;
}

export interface MobilityData {
  compactEligible?: boolean;
  eligibleStates?: string[];
  activeStates?: string[];
}

export interface EHRData {
  synced?: boolean;
  lastSyncAt?: Date;
  mismatchCount?: number;
}

export interface CredentialData {
  licenseExpiryDays?: number; // Days until license expires (negative if expired)
  boardExpiryDays?: number; // Days until board cert expires
  boardCertificationDate?: Date; // Date of last board certification
  deaExpiryDays?: number; // Days until DEA expires
  trainingStartDate?: Date; // Start of training/residency
}

export interface SafetyData {
  eventCount?: number;
  severity?: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  lastEventAt?: Date;
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
  return Math.log10(1 + (count / maxCount) * 9) / Math.log10(10);
}

/**
 * Normalize years to 0-1 range
 */
function normalizeYears(years: number | undefined, maxYears: number = 40): number {
  if (years === undefined) return 0.5; // Unknown = neutral
  if (years <= 0) return 0;
  return normalize(years, 0, maxYears);
}

/**
 * Extract case volume feature
 */
function extractCaseVolume(oppeData: OPPEData | null, procedures: ProcedureCase[]): number {
  let totalCases = 0;

  if (oppeData?.caseCount !== undefined) {
    totalCases = oppeData.caseCount;
  } else if (procedures.length > 0) {
    totalCases = procedures.reduce((sum, p) => sum + (p.caseCount || 0), 0);
  }

  // Normalize: assume max 1000 cases per period
  return normalizeCount(totalCases, 1000);
}

/**
 * Extract case complexity index
 */
function extractCaseComplexityIndex(procedures: ProcedureCase[]): number {
  if (procedures.length === 0) return 0;
  const result = caseComplexityCalculator.calculate(procedures);
  return result.complexityIndex;
}

/**
 * Extract complication rate
 */
function extractComplicationRate(oppeData: OPPEData | null, procedures: ProcedureCase[]): number {
  let totalCases = 0;
  let totalComplications = 0;

  if (oppeData) {
    totalCases = oppeData.caseCount || 0;
    totalComplications = oppeData.complications || 0;
  }

  if (procedures.length > 0) {
    for (const proc of procedures) {
      totalCases += proc.caseCount || 0;
      totalComplications += proc.complicationCount || 0;
    }
  }

  if (totalCases === 0) return 0;
  return Math.min(1, totalComplications / totalCases);
}

/**
 * Extract FPPE score
 */
function extractFPPEScore(fppeData: FPPEData | null): number {
  if (!fppeData) return 0.5; // Neutral if no data

  if (fppeData.score !== undefined) {
    return Math.max(0, Math.min(1, fppeData.score));
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
 * Extract OPPE trend
 */
function extractOPPETrend(oppeData: OPPEData | null): number {
  if (!oppeData) return 0; // Neutral if no data

  if (oppeData.trend !== undefined) {
    return Math.max(-1, Math.min(1, oppeData.trend));
  }

  // Calculate trend from score if available
  if (oppeData.lastReviewScore !== undefined) {
    const threshold = 0.7;
    return (oppeData.lastReviewScore - threshold) * 2; // Scale to -1 to 1
  }

  return 0;
}

/**
 * Extract credential freshness
 */
function extractCredentialFreshness(credentialData: CredentialData | null): number {
  if (!credentialData) return 0.5; // Unknown = neutral

  // Average of license, board, and DEA freshness
  const licenseFreshness = normalizeExpiryDays(credentialData.licenseExpiryDays);
  const boardFreshness = normalizeExpiryDays(credentialData.boardExpiryDays);
  const deaFreshness = normalizeExpiryDays(credentialData.deaExpiryDays);

  return (licenseFreshness + boardFreshness + deaFreshness) / 3;
}

/**
 * Extract privilege depth and breadth
 */
function extractPrivilegeMetrics(privileges: PrivilegeNode[]): { depth: number; breadth: number } {
  if (privileges.length === 0) {
    return { depth: 0, breadth: 0 };
  }

  const result = privilegeBreadthDepthCalculator.calculate(privileges);
  return {
    depth: result.depth,
    breadth: result.breadth,
  };
}

/**
 * Extract enrollment completeness
 */
function extractEnrollmentCompleteness(input: {
  pecos?: PECOSEnrollment | null;
  medicaid?: MedicaidEnrollment[];
  payers?: PayerEnrollment[];
}): number {
  const result = enrollmentCompletenessCalculator.calculate(input);
  return result.completeness;
}

/**
 * Extract mobility readiness
 */
function extractMobilityReadiness(mobilityData: MobilityData | null): number {
  if (!mobilityData) return 0;

  let score = 0;

  // Compact eligibility contributes 50%
  if (mobilityData.compactEligible) {
    score += 0.5;
  }

  // Active states contribute 50%
  const activeStates = mobilityData.activeStates?.length || 0;
  const eligibleStates = mobilityData.eligibleStates?.length || 0;

  if (eligibleStates > 0) {
    const stateScore = Math.min(1, activeStates / eligibleStates);
    score += stateScore * 0.5;
  } else if (activeStates > 0) {
    // If no eligible states defined, but has active states, give partial credit
    score += 0.25;
  }

  return Math.min(1, score);
}

/**
 * Extract safety history
 */
function extractSafetyHistory(safetyData: SafetyData | null): number {
  if (!safetyData || safetyData.eventCount === undefined || safetyData.eventCount === 0) {
    return 1.0; // No events = excellent safety
  }

  // Invert: more events = lower score
  const normalized = normalizeCount(safetyData.eventCount, 20);
  return 1 - normalized; // Invert so 0 events = 1.0, many events = 0.0
}

/**
 * Extract drift history
 */
function extractDriftHistory(driftData: DriftData[] | null): number {
  if (!driftData || driftData.length === 0) return 0; // No drift = 0 (good)

  // Count events with severity weighting
  let weightedCount = 0;
  for (const event of driftData) {
    const weight = event.severity === 'CRITICAL' ? 4 :
                   event.severity === 'HIGH' ? 3 :
                   event.severity === 'MED' ? 2 : 1;
    weightedCount += weight;
  }

  return normalizeCount(weightedCount, 20); // More drift = higher value (bad)
}

/**
 * Extract forecast risk (from predictive models)
 */
function extractForecastRisk(
  fusionData: FusionData | null,
  safetyData: SafetyData | null,
  deterministic: boolean = false
): number {
  // Use fusion safety score if available
  if (fusionData?.safetyScore !== undefined) {
    return Math.max(0, Math.min(1, fusionData.safetyScore));
  }

  // Infer from safety data
  if (safetyData) {
    if (safetyData.severity === 'CRITICAL') return 0.9;
    if (safetyData.severity === 'HIGH') return 0.7;
    if (safetyData.severity === 'MED') return 0.4;
    if (safetyData.severity === 'LOW') return 0.2;
  }

  // Deterministic mode: return neutral
  if (deterministic) {
    return 0.5;
  }

  // Default: low risk
  return 0.2;
}

/**
 * Extract training years
 */
function extractTrainingYears(credentialData: CredentialData | null): number {
  if (!credentialData || !credentialData.trainingStartDate) {
    return 0.5; // Unknown = neutral
  }

  const yearsSinceTraining = (Date.now() - credentialData.trainingStartDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
  return normalizeYears(yearsSinceTraining, 40);
}

/**
 * Extract board recency
 */
function extractBoardRecency(credentialData: CredentialData | null): number {
  if (!credentialData || !credentialData.boardCertificationDate) {
    // Fall back to expiry days if available
    if (credentialData?.boardExpiryDays !== undefined) {
      return normalizeExpiryDays(credentialData.boardExpiryDays);
    }
    return 0.5; // Unknown = neutral
  }

  // Calculate days since certification
  const daysSinceCert = (Date.now() - credentialData.boardCertificationDate.getTime()) / (1000 * 60 * 60 * 24);

  // More recent = higher score (invert: 0 days = 1.0, 10 years = 0.0)
  const maxDays = 3650; // 10 years
  if (daysSinceCert <= 0) return 1.0;
  if (daysSinceCert >= maxDays) return 0.0;
  return 1 - (daysSinceCert / maxDays);
}

/**
 * CompetencyFeatureExtractor class
 */
export class CompetencyFeatureExtractor {
  /**
   * Extract features for a clinician
   */
  async extractFeatures(
    input: FeatureExtractorInput,
    data: {
      oppe?: OPPEData | null;
      fppe?: FPPEData | null;
      fusion?: FusionData | null;
      drift?: DriftData[] | null;
      nci?: NCIData | null;
      passport?: PassportData | null;
      mobility?: MobilityData | null;
      enrollment?: {
        pecos?: PECOSEnrollment | null;
        medicaid?: MedicaidEnrollment[];
        payers?: PayerEnrollment[];
      };
      ehr?: EHRData | null;
      privileges?: PrivilegeNode[];
      procedures?: ProcedureCase[];
      credentials?: CredentialData | null;
      safety?: SafetyData | null;
    }
  ): Promise<CompetencyFeatures> {
    const deterministic = input.deterministic ?? false;

    // Extract privilege metrics
    const privilegeMetrics = extractPrivilegeMetrics(data.privileges || []);

    // Extract enrollment completeness
    const enrollmentCompleteness = extractEnrollmentCompleteness(data.enrollment || {});

    const features: CompetencyFeatures = {
      caseVolume: extractCaseVolume(data.oppe || null, data.procedures || []),
      caseComplexityIndex: extractCaseComplexityIndex(data.procedures || []),
      complicationRate: extractComplicationRate(data.oppe || null, data.procedures || []),
      FPPE_score: extractFPPEScore(data.fppe || null),
      OPPE_trend: extractOPPETrend(data.oppe || null),
      credentialFreshness: extractCredentialFreshness(data.credentials || null),
      privilegeDepth: privilegeMetrics.depth,
      privilegeBreadth: privilegeMetrics.breadth,
      enrollmentCompleteness,
      mobilityReadiness: extractMobilityReadiness(data.mobility || null),
      safetyHistory: extractSafetyHistory(data.safety || null),
      driftHistory: extractDriftHistory(data.drift || null),
      forecastRisk: extractForecastRisk(data.fusion || null, data.safety || null, deterministic),
      trainingYears: extractTrainingYears(data.credentials || null),
      boardRecency: extractBoardRecency(data.credentials || null),
    };

    return features;
  }

  /**
   * Create a feature vector from extracted features
   */
  createFeatureVector(
    clinicianId: string,
    features: CompetencyFeatures,
    timestamp?: Date
  ) {
    return createCompetencyFeatureVector({
      clinicianId,
      timestamp: timestamp || new Date(),
      features,
    });
  }
}

/**
 * Default feature extractor instance
 */
export const competencyFeatureExtractor = new CompetencyFeatureExtractor();

