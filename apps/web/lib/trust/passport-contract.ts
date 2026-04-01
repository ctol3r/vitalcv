import type { PassportSourceCoverageReport } from '@/lib/trust/source-coverage';
import type { CanonicalTruthSet } from '../../../../packages/trust-state';

export type ReadinessStatus = 'READY' | 'PARTIAL' | 'BLOCKED';
export type PassportTrustPostureState =
  | 'current'
  | 'stale'
  | 'gated'
  | 'review_required'
  | 'blocked'
  | 'missing';

export type PassportTrustPostureDimensionId =
  | 'identity'
  | 'safety'
  | 'authority'
  | 'eligibility';

export interface PassportTrustPostureDimension {
  id: PassportTrustPostureDimensionId;
  label: string;
  state: PassportTrustPostureState;
  detail: string;
  checkedAt?: string;
}

export interface PassportTrustPostureFreshnessItem {
  id: PassportTrustPostureDimensionId;
  label: string;
  source: string;
  state: 'current' | 'partial' | 'stale';
  checkedAt?: string;
  note: string;
}

export interface PassportTrustPostureFreshness {
  state: 'current' | 'partial' | 'stale';
  label: string;
  items: PassportTrustPostureFreshnessItem[];
}

export interface PassportTrustPosture {
  band: string;
  bandLabel: string;
  score: number;
  dimensions: PassportTrustPostureDimension[];
  freshness: PassportTrustPostureFreshness;
  safeToRelyOnNow: string[];
  missingItems: string[];
  gatedItems: string[];
  reviewRequiredItems: string[];
  staleItems: string[];
  blockers: string[];
}

export interface PassportReadinessBreakdown {
  identityPct: number;
  exclusionPct: number;
  licensurePct: number;
  enrollmentPct: number;
  whatIsMissing: string[];
}

export interface PassportData {
  entityId:    string;
  npi?:        string;
  identity: {
    displayName: string;
    specialty?:  string;
    entityType:  string;
    status:      string;
    npi?:        string;
  };
  authority: {
    credentials: Array<{
      id:                string;
      domain:            string;
      type:              string;
      status:            string;
      verificationLevel: string;
      issuerEntityId?:   string;
      issuerName?:       string;
      sourceId?:         string;
      jurisdiction?:     string;
      issuedAt?:         string;
      expiresAt?:        string;
      verifiedAt?:       string;
      observedAt?:       string;
      stale:             boolean;
      confidenceLabel:   string;
      claimConfidenceLabel: string;
      matchConfidence?:  string;
      sourceLatency?:    string;
      dataFreshness:     string;
      dataFreshnessLabel: string;
      dataFreshnessCadence?: string;
      claimState?:       string;
      statusLabel?:      string;
      dataVersion?:      string;
      revalidationDue?:  string;
      identityOnly?:     boolean;
      sourceDisclaimer?: string;
      nextReverifyAt?:   string;
      reviewRequired:      boolean;
      authorityClaimCode?:  string;
      boardOrderSeverity?:  string;
      connectorState?:      string;
      participationStatus?: string;
      sourceScope?:         string;
    }>;
    summary: { active: number; expired: number; stale: number; missing: string[] };
  };
  training: {
    records: Array<{
      id:               string;
      recordType:       string;
      degreeOrTitle?:   string;
      specialty?:       string;
      programName?:     string;
      institutionName?: string;
      endYear?:         number;
      completed:        boolean;
      verificationLevel: string;
    }>;
    hasDegree:        boolean;
    degreeVerified:   boolean;
    hasResidency:     boolean;
    fellowshipCount:  number;
  };
  standing: {
    exclusionClear:   boolean;
    exclusionStatus:  'CLEAR' | 'EXCLUDED' | 'POSSIBLE_MATCH' | 'UNCHECKED' | 'UNKNOWN';
    exclusionCheckedAt?: string;
    exclusionConfidenceLabel?: string;
    licensureStatus:  'verified' | 'pending' | 'expired' | 'unknown';
    deaStatus:        'registered' | 'none' | 'unknown';
    pecosStatus:      'enrolled' | 'not_enrolled' | 'unknown';
    pecosEnrollmentStatus: 'ENROLLED' | 'NOT_FOUND' | 'UNKNOWN' | 'UNCHECKED' | 'OPTED_OUT';
    enrollmentSourceLabel: string;
    enrollmentDataFreshness: string;
    enrollmentSourceLatency?: string;
    enrollmentNote: string | null;
    enrollmentObservedAt?: string;
    enrollmentDataVersion?: string;
    enrollmentStatusLabel?: string;
    enrollmentFreshnessLabel?: string;
    enrollmentConfidenceLabel?: string;
    negativeFindings: string[];
  };
  readiness: {
    status:             ReadinessStatus;
    score:              number;
    level:              string;
    breakdown?:         PassportReadinessBreakdown;
    blockers:           string[];
    gaps:               string[];
    estimatedStartDays: number | null;
    nextActions:        Array<{
      id:       string;
      title:    string;
      detail:   string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
    }>;
  };
  sources: { checked: string[]; lastFetch: Record<string, string> };
  sourceCoverage: PassportSourceCoverageReport;
  truth?: CanonicalTruthSet;
  trustPosture: PassportTrustPosture;
  lastCheckedAt: string;
}

export type PassportAuthorityCredential = PassportData['authority']['credentials'][number];
export type PassportStanding = PassportData['standing'];
