/**
 * Workforce Command Center - Core Models
 * Phase 1: Workforce Overview Dashboard
 */

export type WorkforceDashboardState = 'loading' | 'ready' | 'error';

export interface WorkforceOverview {
  totalActiveClinicians: number;
  credentialedCount: number;
  verifiedCount: number;
  anchoredCount: number;
  complianceHealthScore: number;
  averageTrustScore: number;
  anchorFreshnessIndex: number;
  lastUpdated: string;
}

export interface CredentialProportions {
  credentialed: number; // percentage
  verified: number; // percentage
  anchored: number; // percentage
}

export interface SpecialtyDistribution {
  specialty: string;
  count: number;
  percentage: number;
  averageTrustScore: number;
  complianceRate: number;
}

export interface RoleCoverage {
  role: 'RN' | 'MD' | 'PA' | 'CRNA' | 'PT' | 'Specialist' | 'Other';
  count: number;
  targetCount: number;
  coveragePercentage: number;
  averageTrustScore: number;
  fullyCredentialed: number;
}

export interface WorkforceDashboardData {
  overview: WorkforceOverview;
  credentialProportions: CredentialProportions;
  specialtyDistribution: SpecialtyDistribution[];
  roleCoverage: RoleCoverage[];
  lastUpdated: string;
}

export interface Unit {
  id: string;
  name: string;
  type: 'ICU' | 'ED' | 'Med/Surg' | 'OR' | 'L&D' | 'Psych' | 'Telemedicine';
  providerCount: number;
  readinessStatus: 'green' | 'amber' | 'red';
  specialtyAlignment: string[];
  coverageDeficit: number;
  averageTrustScore: number;
  chainEvidenceHash: string | null;
}

export interface UnitDetail {
  unit: Unit;
  roster: ClinicianRoster[];
  deficiencies: Deficiency[];
  anchorFreshness: AnchorFreshnessMap;
  credentialGaps: CredentialGap[];
  recommendedHiring: HiringRecommendation[];
}

export interface ClinicianRoster {
  id: string;
  name: string;
  role: string;
  trustScore: number;
  eligibilityScore: number;
  credentialHealth: 'excellent' | 'good' | 'fair' | 'poor';
  specialties: string[];
  lastVerified: string;
}

export interface Deficiency {
  id: string;
  type: 'missing_cert' | 'expiring_license' | 'dea_shortage' | 'chain_stale';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedClinicians: string[];
  deadline?: string;
}

export interface AnchorFreshnessMap {
  [clinicianId: string]: {
    lastAnchored: string;
    daysSinceAnchor: number;
    freshness: 'fresh' | 'stale' | 'critical';
  };
}

export interface CredentialGap {
  id: string;
  type: 'license' | 'certification' | 'dea' | 'board_cert';
  daysUntilGap: number;
  affectedCount: number;
  unitId: string;
  forecastDate: string;
}

export interface HiringRecommendation {
  id: string;
  role: string;
  specialty: string;
  priority: 'critical' | 'high' | 'medium';
  reason: string;
  suggestedJobPosting?: string;
}

export interface WorkforcePrediction {
  forecastedShortages: SpecialtyShortage[];
  expiringLicensure: LicensureExpiration[];
  deaRenewalWaves: DEARenewalWave[];
  annualCredentialCycles: CredentialCycle[];
  chainInconsistencies: ChainInconsistency[];
}

export interface SpecialtyShortage {
  specialty: string;
  currentCount: number;
  projectedCount: number;
  deficit: number;
  forecastDate: string;
  urgency: 'critical' | 'high' | 'medium';
}

export interface LicensureExpiration {
  state: string;
  count: number;
  expirationDate: string;
  daysUntilExpiration: number;
}

export interface DEARenewalWave {
  month: string;
  count: number;
  urgency: 'critical' | 'high' | 'medium';
}

export interface CredentialCycle {
  type: string;
  renewalMonth: string;
  count: number;
  averageProcessingDays: number;
}

export interface ChainInconsistency {
  unitId: string;
  inconsistencyType: 'stale_anchor' | 'missing_evidence' | 'hash_mismatch';
  affectedCount: number;
  severity: 'critical' | 'high' | 'medium';
}








