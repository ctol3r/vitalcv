export type PrivilegeStatus = 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'PENDING';

export interface ClinicianPrivilege {
  code: string;
  facilityId?: string;
  status: PrivilegeStatus;
  restrictedReason?: string;
  expiresOn?: string;
}

export interface PayerContract {
  payerId: string;
  status: 'ENROLLED' | 'PENDING' | 'DENIED';
  coverage: 'FULL' | 'LIMITED';
  productLines?: string[];
}

export interface EHRReadiness {
  vendor: string;
  ready: boolean;
  trained?: boolean;
  lastValidated?: string;
  features?: string[];
}

export type Weekday = 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

export interface AvailabilityWindow {
  day: Weekday;
  start: string; // HH:mm in local time
  end: string; // HH:mm in local time
  timezone?: string;
  mode?: 'IN_PERSON' | 'HYBRID' | 'VIRTUAL';
}

export interface RiskProfile {
  overall: number; // 0 - 1
  complianceStatus: 'PASS' | 'AT_RISK' | 'FAIL';
  driftSignal?: 'LOW' | 'MEDIUM' | 'HIGH';
  qualityHazard?: boolean;
  payerFlags?: string[];
  notes?: string;
}

export interface MobilityProfile {
  status: 'locked' | 'portable' | 'instantly_onboardable';
  lastAssessed?: string;
  supportedOrgIds?: string[];
}

export interface ClinicianProfile {
  id: string;
  name: string;
  orgId: string;
  specialties: string[];
  stateLicenses: string[];
  compactEligibleStates: string[];
  privileges: ClinicianPrivilege[];
  payerCoverage: PayerContract[];
  ehrReadiness: EHRReadiness[];
  availability: AvailabilityWindow[];
  risk: RiskProfile;
  yearsExperience?: number;
  rating?: number; // 0 - 1
  burnoutRisk?: number; // 0 - 1
  mobility?: MobilityProfile;
  embeddings?: number[];
}

export interface ShiftWindow {
  day: Weekday;
  start: string;
  end: string;
  timezone?: string;
}

export interface DemandSignal {
  id: string;
  orgId: string;
  department: string;
  role: string;
  locationState: string;
  requiredPrivileges: string[];
  preferredPayers: string[];
  ehrVendor: string;
  riskTolerance: {
    maxRiskScore: number;
    allowComplianceAtRisk?: boolean;
    allowDrift?: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  shift: ShiftWindow;
  minExperienceYears?: number;
  mobilityPolicy?: 'INTRA_ORG_ONLY' | 'ALLOW_CROSS_ORG';
  demandPerWeek?: number;
}

export interface CoverageSnapshot {
  privileges: number;
  payerAlignment: number;
  availability: number;
  experience: number;
  ehr: number;
  riskModifier: number;
}

export interface MatchHighlight {
  label: string;
  detail: string;
  sentiment: 'positive' | 'neutral' | 'warning';
}

export interface MatchCandidate {
  clinicianId: string;
  clinicianName: string;
  demandId: string;
  score: number;
  coverage: CoverageSnapshot;
  highlights: MatchHighlight[];
  mobilityContext?: {
    allowed: boolean;
    reason: string;
  };
}

export interface MatchRejection {
  clinicianId: string;
  clinicianName: string;
  demandId: string;
  reason: string;
  tags?: string[];
}

export interface WorkforceMatchOptions {
  minScore?: number;
  maxResults?: number;
  logRejection?: (rejection: MatchRejection) => void;
}

