import {
  CANONICAL_TRUTH_STATUSES,
  summarizeCanonicalSourceCoverage,
  type CanonicalTruthSet,
} from '@vitalcv/trust-state';
import {
  normalizePassportSourceCoverageChecks,
  type PassportSourceCoverageReport,
} from '@/lib/trust/source-coverage';
import { resolvePassportTruthSet } from '@/lib/trust/passport-truth-set';

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

export type DecisionPostureStatus = 'READY' | 'PARTIAL' | 'BLOCKED';

export interface DecisionPostureSource {
  sourceId: string;
  dimension: PassportTrustPostureDimensionId;
  state: string;
  checkedAt: string | null;
  expiresAt: string | null;
  reason: string;
}

export interface DecisionPosture {
  status: DecisionPostureStatus;
  headline: string;
  proven: DecisionPostureSource[];
  missing: DecisionPostureSource[];
  blockers: string[];
  freshness: PassportTrustPostureFreshness;
  nextAction: string;
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
    readiness_score?:   number;
    level:              string;
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
  decisionPosture?: DecisionPosture;
  lastCheckedAt: string;
}

export type PassportAuthorityCredential = PassportData['authority']['credentials'][number];
export type PassportStanding = PassportData['standing'];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isNullableString(value: unknown): value is string | null | undefined {
  return typeof value === 'string' || value === null || typeof value === 'undefined';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null | undefined {
  return value === null || typeof value === 'undefined' || isNumber(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNullableBoolean(value: unknown): value is boolean | null | undefined {
  return value === null || typeof value === 'undefined' || isBoolean(value);
}

function isUnknownRecordMap(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every(isString);
}

function isReadinessStatus(value: unknown): value is ReadinessStatus {
  return value === 'READY' || value === 'PARTIAL' || value === 'BLOCKED';
}

function isDecisionPostureStatus(value: unknown): value is DecisionPostureStatus {
  return isReadinessStatus(value);
}

function isPriority(value: unknown): value is 'HIGH' | 'MEDIUM' | 'LOW' {
  return value === 'HIGH' || value === 'MEDIUM' || value === 'LOW';
}

function isCanonicalTruthStatus(value: unknown): boolean {
  return CANONICAL_TRUTH_STATUSES.includes(value as (typeof CANONICAL_TRUTH_STATUSES)[number]);
}

function isPassportNextAction(value: unknown): boolean {
  return isRecord(value)
    && isString(value.id)
    && isString(value.title)
    && isString(value.detail)
    && isPriority(value.priority);
}

function isPassportCredential(value: unknown): boolean {
  return isRecord(value)
    && isString(value.id)
    && isString(value.domain)
    && isString(value.type)
    && isString(value.status)
    && isString(value.verificationLevel)
    && isBoolean(value.stale)
    && isString(value.confidenceLabel)
    && isString(value.claimConfidenceLabel)
    && isString(value.dataFreshness)
    && isString(value.dataFreshnessLabel)
    && isBoolean(value.reviewRequired)
    && isNullableString(value.issuerEntityId)
    && isNullableString(value.issuerName)
    && isNullableString(value.sourceId)
    && isNullableString(value.jurisdiction)
    && isNullableString(value.issuedAt)
    && isNullableString(value.expiresAt)
    && isNullableString(value.verifiedAt)
    && isNullableString(value.observedAt)
    && isNullableString(value.matchConfidence)
    && isNullableString(value.sourceLatency)
    && isNullableString(value.dataFreshnessCadence)
    && isNullableString(value.claimState)
    && isNullableString(value.statusLabel)
    && isNullableString(value.dataVersion)
    && isNullableString(value.revalidationDue)
    && isNullableBoolean(value.identityOnly)
    && isNullableString(value.sourceDisclaimer)
    && isNullableString(value.nextReverifyAt)
    && isNullableString(value.authorityClaimCode)
    && isNullableString(value.boardOrderSeverity)
    && isNullableString(value.connectorState)
    && isNullableString(value.participationStatus)
    && isNullableString(value.sourceScope);
}

function isTrainingRecord(value: unknown): boolean {
  return isRecord(value)
    && isString(value.id)
    && isString(value.recordType)
    && isBoolean(value.completed)
    && isString(value.verificationLevel)
    && isNullableString(value.degreeOrTitle)
    && isNullableString(value.specialty)
    && isNullableString(value.programName)
    && isNullableString(value.institutionName)
    && isNullableNumber(value.endYear);
}

function isTrustPostureDimension(value: unknown): boolean {
  return isRecord(value)
    && isString(value.id)
    && isString(value.label)
    && isString(value.state)
    && isString(value.detail)
    && isNullableString(value.checkedAt);
}

function isTrustPostureFreshnessItem(value: unknown): boolean {
  return isRecord(value)
    && isString(value.id)
    && isString(value.label)
    && isString(value.source)
    && (value.state === 'current' || value.state === 'partial' || value.state === 'stale')
    && isNullableString(value.checkedAt)
    && isString(value.note);
}

function isTrustPosture(value: unknown): boolean {
  return isRecord(value)
    && isString(value.band)
    && isString(value.bandLabel)
    && isNumber(value.score)
    && Array.isArray(value.dimensions)
    && value.dimensions.every(isTrustPostureDimension)
    && isRecord(value.freshness)
    && (
      value.freshness.state === 'current'
      || value.freshness.state === 'partial'
      || value.freshness.state === 'stale'
    )
    && isString(value.freshness.label)
    && Array.isArray(value.freshness.items)
    && value.freshness.items.every(isTrustPostureFreshnessItem)
    && isStringArray(value.safeToRelyOnNow)
    && isStringArray(value.missingItems)
    && isStringArray(value.gatedItems)
    && isStringArray(value.reviewRequiredItems)
    && isStringArray(value.staleItems)
    && isStringArray(value.blockers);
}

function isDecisionPostureSource(value: unknown): boolean {
  return isRecord(value)
    && isString(value.sourceId)
    && isString(value.dimension)
    && isString(value.state)
    && isNullableString(value.checkedAt)
    && isNullableString(value.expiresAt)
    && isString(value.reason);
}

function isDecisionPosture(value: unknown): value is DecisionPosture {
  return isRecord(value)
    && isDecisionPostureStatus(value.status)
    && isString(value.headline)
    && Array.isArray(value.proven)
    && value.proven.every(isDecisionPostureSource)
    && Array.isArray(value.missing)
    && value.missing.every(isDecisionPostureSource)
    && isStringArray(value.blockers)
    && isRecord(value.freshness)
    && isString(value.nextAction);
}

export function isPassportData(value: unknown): value is PassportData {
  if (!isRecord(value)) {
    return false;
  }

  return isString(value.entityId)
    && isRecord(value.identity)
    && isString(value.identity.displayName)
    && isString(value.identity.entityType)
    && isString(value.identity.status)
    && isNullableString(value.identity.specialty)
    && isNullableString(value.identity.npi)
    && isRecord(value.authority)
    && Array.isArray(value.authority.credentials)
    && value.authority.credentials.every(isPassportCredential)
    && isRecord(value.authority.summary)
    && isNumber(value.authority.summary.active)
    && isNumber(value.authority.summary.expired)
    && isNumber(value.authority.summary.stale)
    && isStringArray(value.authority.summary.missing)
    && isRecord(value.training)
    && Array.isArray(value.training.records)
    && value.training.records.every(isTrainingRecord)
    && isBoolean(value.training.hasDegree)
    && isBoolean(value.training.degreeVerified)
    && isBoolean(value.training.hasResidency)
    && isNumber(value.training.fellowshipCount)
    && isRecord(value.standing)
    && isBoolean(value.standing.exclusionClear)
    && isString(value.standing.exclusionStatus)
    && isNullableString(value.standing.exclusionCheckedAt)
    && isNullableString(value.standing.exclusionConfidenceLabel)
    && isString(value.standing.licensureStatus)
    && isString(value.standing.deaStatus)
    && isString(value.standing.pecosStatus)
    && isString(value.standing.pecosEnrollmentStatus)
    && isString(value.standing.enrollmentSourceLabel)
    && isString(value.standing.enrollmentDataFreshness)
    && isNullableString(value.standing.enrollmentSourceLatency)
    && isNullableString(value.standing.enrollmentNote)
    && isNullableString(value.standing.enrollmentObservedAt)
    && isNullableString(value.standing.enrollmentDataVersion)
    && isNullableString(value.standing.enrollmentStatusLabel)
    && isNullableString(value.standing.enrollmentFreshnessLabel)
    && isNullableString(value.standing.enrollmentConfidenceLabel)
    && isStringArray(value.standing.negativeFindings)
    && isRecord(value.readiness)
    && isReadinessStatus(value.readiness.status)
    && isNumber(value.readiness.score)
    && isString(value.readiness.level)
    && isStringArray(value.readiness.blockers)
    && isStringArray(value.readiness.gaps)
    && isNullableNumber(value.readiness.estimatedStartDays)
    && Array.isArray(value.readiness.nextActions)
    && value.readiness.nextActions.every(isPassportNextAction)
    && isRecord(value.sources)
    && isStringArray(value.sources.checked)
    && isUnknownRecordMap(value.sources.lastFetch)
    && isRecord(value.sourceCoverage)
    && Array.isArray(value.sourceCoverage.checks)
    && isString(value.lastCheckedAt)
    && isTrustPosture(value.trustPosture)
    && (typeof value.truth === 'undefined' || isRecord(value.truth))
    && (typeof value.decisionPosture === 'undefined' || isDecisionPosture(value.decisionPosture));
}

export function normalizePassportData(value: unknown): PassportData | null {
  if (!isPassportData(value)) {
    return null;
  }

  const passport = value as PassportData;
  const normalizedChecks = normalizePassportSourceCoverageChecks(passport.sourceCoverage);
  const normalized: PassportData = {
    ...passport,
    readiness: {
      ...passport.readiness,
      status: passport.readiness.status,
      readiness_score: isNumber((passport.readiness as UnknownRecord).readiness_score)
        ? (passport.readiness as UnknownRecord).readiness_score as number
        : passport.readiness.score,
    },
    sourceCoverage: {
      checks: normalizedChecks,
      summary: summarizeCanonicalSourceCoverage(normalizedChecks),
    },
  };

  normalized.truth = resolvePassportTruthSet(normalized);

  if (!normalized.decisionPosture || !isDecisionPosture(normalized.decisionPosture)) {
    delete normalized.decisionPosture;
  }

  return normalized;
}

export function assertPassportData(
  value: unknown,
  context = 'passport payload',
): PassportData {
  const normalized = normalizePassportData(value);
  if (!normalized) {
    throw new Error(`Invalid ${context}.`);
  }
  return normalized;
}
