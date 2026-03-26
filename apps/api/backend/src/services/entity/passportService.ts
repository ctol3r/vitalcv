/**
 * passportService.ts — The Trust Passport
 *
 * Aggregates everything known about an entity into a single response:
 *   identity, authority, training, standing, readiness, sources
 *
 * THIS IS THE PRODUCT.
 *
 * The passport response is the single surface that communicates:
 *   - WHO this person is (identity)
 *   - WHAT they're authorized to do (authority)
 *   - WHERE they trained (training)
 *   - HOW they're standing right now (standing)
 *   - WHEN they can start (readiness → estimatedStartDays)
 *
 * Shape mirrors the spec exactly:
 *   { identity, authority, training, standing, readiness, sources, lastCheckedAt }
 */

import prisma from '../../graphql/prisma_client';
import { getEntityById, resolveEntityFromNpi } from './entityResolutionService';
import {
  getCachedTrustState,
  type ClinicianTrustState,
} from '../trust/trustStateEngine';
import {
  daysUntilExpiry,
  isCredentialBlocking,
  isCredentialCurrentStatus,
  isCredentialSatisfied,
  isCredentialStale,
  isDecisionGrade,
  normalizeExclusionCredentialStatus,
} from '../../domain/entity/contracts';
import { log } from '../../obs/logger';
import {
  resolveCredentialEvidence,
  type CredentialEvidenceResolution,
  type CredentialReceiptEvidence,
} from './evidenceIntegrity';
import { buildReadinessNextActions, type ReadinessNextAction } from './readinessActions';
import { syncBlockerEvents } from '../seal/sealEventCapture';
import {
  createCanonicalSourceCoverage,
  summarizeCanonicalSourceCoverage,
  type CanonicalSourceCoverage,
  type CanonicalSourceCoverageReport,
  type CanonicalSourceCoverageState,
} from '../../../../../../packages/trust-state';
import { getSourceFreshnessWindowHours } from '../identity/sourceCatalog';
import {
  buildPecosEnrollmentNote,
  buildPecosFreshnessLabel,
  isPecosFresh,
  normalizePecosEnrollmentStatus,
  pecosRevalidationDaysRemaining,
  pecosCoverageReason,
  PECOS_SOURCE_LABEL,
  type PecosEnrollmentStatus,
} from '../identity/pecosContract';

export type { ReadinessNextAction };

type JsonRecord = Record<string, unknown>;

// ── Passport shape (spec-aligned) ─────────────────────────────────────────────

export interface PassportIdentity {
  entityId:    string;
  displayName: string;
  npi?:        string;
  specialty?:  string;
  entityType:  string;
  status:      string;   // ACTIVE | DEACTIVATED | UNKNOWN
}

export interface PassportAuthority {
  credentials: PassportCredential[];
  summary: {
    active:  number;
    expired: number;
    stale:   number;
    missing: string[];   // blocking domains with no credential
  };
}

export interface PassportCredential {
  id:                string;
  domain:            string;
  type:              string;
  status:            string;
  verificationLevel: string;
  label?:            string;
  issuerEntityId?:   string;
  issuerName?:       string;
  sourceId?:         string;
  jurisdiction?:     string;
  issuedAt?:         string;
  expiresAt?:        string;
  verifiedAt?:       string;
  observedAt?:       string;
  daysUntilExpiry?:  number;
  stale:             boolean;
  confidenceLabel:   string;
  claimConfidenceLabel: string;
  matchConfidence?:  string;
  matchType?:        string;
  sourceLatency?:    string;
  dataFreshness:     string;
  dataFreshnessLabel: string;
  dataFreshnessCadence?: string;
  claimState?:       string;
  statusLabel?:      string;
  dataVersion?:      string;
  revalidationDue?:  string;
  leieVersionDate?:  string;
  identityOnly?:     boolean;
  sourceDisclaimer?: string;
  nextReverifyAt?:   string;
  reviewRequired:      boolean;
  // Authority truth fields (M14/MS15) — read from metadata JSONB
  authorityClaimCode?:  string;   // e.g. 'PHYSICIAN_LICENSE_ACTIVE', 'BOARD_ORDER_PRESENT', 'AUTHORITY_UNAVAILABLE'
  boardOrderSeverity?:  string;   // 'NONE'|'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'
  connectorState?:      string;   // 'configured'|'connected'|'unavailable'|'unresolved'
  participationStatus?: string;   // 'verified_result'|'non_participating_state'|'institution_access_unavailable'|...
  sourceScope?:         string;   // 'FSMB_MED_API'|'NURSYS_AUTHORIZED_PATH'|...
}

export interface PassportTraining {
  records: PassportEducationRecord[];
  hasDegree:          boolean;
  degreeVerified:     boolean;
  hasResidency:       boolean;
  fellowshipCount:    number;
}

export interface PassportEducationRecord {
  id:             string;
  recordType:     string;
  degreeOrTitle?: string;
  specialty?:     string;
  programName?:   string;
  institutionName?: string;
  endYear?:       number;
  completed:      boolean;
  verificationLevel: string;
}

export interface PassportStanding {
  exclusionClear:   boolean;
  exclusionStatus:  'CLEAR' | 'EXCLUDED' | 'POSSIBLE_MATCH' | 'UNCHECKED' | 'UNKNOWN';
  exclusionCheckedAt?: string;
  exclusionConfidenceLabel?: string;
  licensureStatus:  'verified' | 'pending' | 'expired' | 'unknown';
  deaStatus:        'registered' | 'none' | 'unknown';
  /** @deprecated Use pecosEnrollmentStatus for canonical state */
  pecosStatus:      'enrolled' | 'not_enrolled' | 'unknown';
  /** MS16-A: Canonical PECOS enrollment state with full 4-way distinction */
  pecosEnrollmentStatus: PecosEnrollmentStatus;
  /** MS16-A: Human-readable source label — always "CMS PECOS" */
  enrollmentSourceLabel: string;
  /** MS16-A: Data freshness cadence — always "Quarterly" */
  enrollmentDataFreshness: string;
  /** MS16-A: Source latency cadence — PECOS is never real-time */
  enrollmentSourceLatency?: string;
  /** MS16-A: Explicit human-readable note for UI labeling */
  enrollmentNote: string | null;
  enrollmentObservedAt?: string;
  enrollmentDataVersion?: string;
  enrollmentStatusLabel?: string;
  enrollmentFreshnessLabel?: string;
  enrollmentConfidenceLabel?: string;
  negativeFindings: string[];
}

export interface PassportReadiness {
  status:             'READY' | 'PARTIAL' | 'BLOCKED';
  score:              number;    // 0–100
  readiness_score:    number;
  level:              string;    // L0–L3
  blockers:           string[];
  gaps:               string[];
  nextActions:        ReadinessNextAction[];
  estimatedStartDays: number | null;
}

export interface PassportSources {
  checked:   string[];
  lastFetch: Record<string, string>;  // source → ISO timestamp
}

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

export interface TrustPassport {
  entityId:       string;
  npi?:           string;
  identity:       PassportIdentity;
  authority:      PassportAuthority;
  training:       PassportTraining;
  standing:       PassportStanding;
  readiness:      PassportReadiness;
  sources:        PassportSources;
  sourceCoverage: CanonicalSourceCoverageReport;
  trustPosture:   PassportTrustPosture;
  lastCheckedAt:  string;
}

// ── Blocking domains ──────────────────────────────────────────────────────────

const BLOCKING_DOMAINS = ['IDENTITY', 'LICENSURE', 'EXCLUSION_CHECK'] as const;

const ESTIMATED_START_DAYS: Record<string, number> = {
  READY:   3,
  PARTIAL: 14,
  BLOCKED: null as unknown as number,
};

function dedupeStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function onlyUuids(values: string[]): string[] {
  return values.filter((v) => UUID_RE.test(v));
}

const HEX32_RE = /^[0-9a-f]{32}$/i;
function onlyReceiptIds(values: string[]): string[] {
  return values.filter((v) => UUID_RE.test(v) || HEX32_RE.test(v));
}

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonRecord;
  }

  return {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function latestIso(left?: string, right?: string): string | undefined {
  if (!left) return right;
  if (!right) return left;

  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (!Number.isFinite(leftMs)) return right;
  if (!Number.isFinite(rightMs)) return left;
  return leftMs >= rightMs ? left : right;
}

function normalizePublicExclusionStatus(
  status: string | undefined,
): PassportStanding['exclusionStatus'] | undefined {
  const normalized = (status ?? '').trim().toUpperCase();
  if (normalized === 'CLEAR') return 'CLEAR';
  if (normalized === 'EXCLUDED') return 'EXCLUDED';
  if (normalized === 'POSSIBLE_MATCH' || normalized === 'REVIEW_REQUIRED') return 'POSSIBLE_MATCH';
  if (normalized === 'UNCHECKED' || normalized === 'UNCERTAIN' || normalized === 'UNKNOWN') return 'UNCHECKED';
  return undefined;
}

function exclusionStatusFromCredential(
  credential: {
    status: string;
    metadata: unknown;
    claimValue: unknown;
  } | null | undefined,
): PassportStanding['exclusionStatus'] {
  if (!credential) {
    return 'UNKNOWN';
  }

  const metadata = asRecord(credential.metadata);
  const claimValue = asRecord(credential.claimValue);
  const explicit =
    normalizePublicExclusionStatus(stringValue(metadata.claimState))
    ?? normalizePublicExclusionStatus(stringValue(claimValue.claimState))
    ?? normalizePublicExclusionStatus(stringValue(claimValue.verdict));
  if (explicit) {
    return explicit;
  }

  const normalized = normalizeExclusionCredentialStatus(credential.status);
  if (normalized === 'CLEAR') return 'CLEAR';
  if (normalized === 'EXCLUDED') return 'EXCLUDED';
  if (normalized === 'REVIEW_REQUIRED') return 'POSSIBLE_MATCH';
  if (normalized === 'UNCERTAIN') return 'UNCHECKED';
  return 'UNKNOWN';
}

function getVerificationReceiptRecordClient(): {
  findMany?: (args: Record<string, unknown>) => Promise<Array<{
    receiptId: string;
    sourceArtifactId: string | null;
    verificationArtifactId: string | null;
  }>>;
} {
  return (prisma as unknown as {
    verificationReceiptRecord?: {
      findMany?: (args: Record<string, unknown>) => Promise<Array<{
        receiptId: string;
        sourceArtifactId: string | null;
        verificationArtifactId: string | null;
      }>>;
    };
  }).verificationReceiptRecord ?? {};
}

type SourceProofRefs = {
  artifactIds: string[];
  receiptIds: string[];
};

function buildProofRefsBySource(input: {
  credentials: readonly Pick<PassportCredential, 'id' | 'sourceId'>[];
  credentialEvidence: ReadonlyMap<string, CredentialEvidenceResolution>;
  artifactsById: ReadonlyMap<string, { source: string }>;
}): ReadonlyMap<string, SourceProofRefs> {
  const refsBySource = new Map<string, { artifactIds: Set<string>; receiptIds: Set<string> }>();

  for (const credential of input.credentials) {
    const evidence = input.credentialEvidence.get(credential.id);
    if (!evidence) {
      continue;
    }

    const sourceIds = dedupeStrings([
      ...(credential.sourceId ? [credential.sourceId] : []),
      ...evidence.validArtifactIds
        .map((artifactId) => input.artifactsById.get(artifactId)?.source)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    ]);

    for (const sourceId of sourceIds) {
      const current = refsBySource.get(sourceId) ?? {
        artifactIds: new Set<string>(),
        receiptIds: new Set<string>(),
      };

      for (const artifactId of evidence.validArtifactIds) {
        current.artifactIds.add(artifactId);
      }
      for (const receiptId of evidence.validReceiptIds) {
        current.receiptIds.add(receiptId);
      }

      refsBySource.set(sourceId, current);
    }
  }

  return new Map(
    Array.from(refsBySource.entries()).map(([sourceId, refs]) => [
      sourceId,
      {
        artifactIds: [...refs.artifactIds].sort((left, right) => left.localeCompare(right)),
        receiptIds: [...refs.receiptIds].sort((left, right) => left.localeCompare(right)),
      },
    ]),
  );
}

function buildFallbackPassportSourceCoverage(input: {
  identity: PassportIdentity;
  authority: PassportAuthority;
  standing: PassportStanding;
  lastCheckedAt: string;
}): CanonicalSourceCoverage[] {
  const licensureCredential = input.authority.credentials.find(
    (credential) => credential.domain === 'LICENSURE',
  );
  const pecosCredential = input.authority.credentials.find(
    (credential) => credential.domain === 'MEDICARE_ENROLLMENT',
  );
  const licensureSourceId = licensureCredential?.sourceId ?? 'STATE_BOARD';
  const licensureState =
    licensureCredential?.authorityClaimCode === 'AUTHORITY_UNAVAILABLE'
      ? licensureCredential.participationStatus === 'institution_access_unavailable'
        ? 'accessRequired'
        : licensureCredential.participationStatus === 'manual_verification_required'
          ? 'notDecisionGrade'
          : 'unavailable'
      : licensureCredential?.reviewRequired
        ? 'reviewRequired'
        : licensureCredential?.stale
          ? 'stale'
          : licensureCredential
            ? 'live'
            : 'notChecked';
  const pecosDaysRemaining = pecosRevalidationDaysRemaining(
    pecosCredential?.nextReverifyAt ?? pecosCredential?.revalidationDue ?? null,
  );
  const pecosFresh = isPecosFresh({
    status: input.standing.pecosEnrollmentStatus,
    revalidationDue:
      pecosCredential?.nextReverifyAt
      ?? pecosCredential?.revalidationDue
      ?? null,
    observedAt: pecosCredential?.observedAt ?? null,
  });
  const pecosState = input.standing.pecosEnrollmentStatus === 'UNCHECKED'
    ? 'notChecked'
    : !pecosFresh
      ? 'stale'
    : input.standing.pecosEnrollmentStatus === 'UNKNOWN'
      ? 'partial'
      : 'live';

  return [
    createCanonicalSourceCoverage({
      sourceId: 'NPPES_API',
      state: input.identity.npi ? 'live' : 'notChecked',
      reason: input.identity.npi
        ? 'NPPES identity checked'
        : 'NPPES identity source not yet checked',
      checkedAt: input.lastCheckedAt,
      freshnessWindowHours: getSourceFreshnessWindowHours('NPPES_API'),
    }),
    createCanonicalSourceCoverage({
      sourceId: 'OIG_LEIE',
      state: input.standing.exclusionStatus === 'UNCHECKED'
        ? 'notChecked'
        : input.standing.exclusionStatus === 'POSSIBLE_MATCH'
          ? 'reviewRequired'
          : input.standing.exclusionStatus === 'UNKNOWN'
            ? 'partial'
            : 'live',
      reason:
        input.standing.exclusionStatus === 'CLEAR'
          ? 'OIG LEIE check clear'
          : input.standing.exclusionStatus === 'EXCLUDED'
            ? 'OIG LEIE exclusion confirmed'
            : input.standing.exclusionStatus === 'POSSIBLE_MATCH'
              ? 'OIG LEIE returned a possible match and requires human adjudication'
              : input.standing.exclusionStatus === 'UNKNOWN'
                ? 'OIG LEIE outcome could not be resolved from the current source result'
                : 'OIG LEIE source not yet checked',
      checkedAt: input.standing.exclusionCheckedAt ?? null,
      freshnessWindowHours: getSourceFreshnessWindowHours('OIG_LEIE'),
    }),
    createCanonicalSourceCoverage({
      sourceId: licensureSourceId,
      state: licensureState,
      reason:
        licensureState === 'live'
          ? 'Licensure checked'
          : licensureState === 'accessRequired'
            ? 'CA physician licensure lane requires live state-board or FSMB access'
            : licensureState === 'notDecisionGrade'
              ? 'State licensure is outside the current production lane and must be verified manually'
          : licensureState === 'reviewRequired'
            ? 'Licensure source requires manual review'
            : licensureState === 'stale'
              ? 'Licensure evidence is stale and must be refreshed'
              : licensureState === 'unavailable'
              ? 'Licensure source is unavailable'
                : 'Licensure source not yet checked',
      checkedAt:
        licensureCredential?.observedAt
        ?? licensureCredential?.verifiedAt
        ?? null,
      freshnessWindowHours: getSourceFreshnessWindowHours(licensureSourceId),
    }),
    createCanonicalSourceCoverage({
      sourceId: 'PECOS_PUBLIC',
      state: pecosState,
      reason: pecosCoverageReason({
        status: input.standing.pecosEnrollmentStatus,
        checked: input.standing.pecosEnrollmentStatus !== 'UNCHECKED',
        fresh: pecosFresh,
        daysRemaining: pecosDaysRemaining,
      }),
      checkedAt: input.standing.enrollmentObservedAt ?? null,
      freshnessWindowHours: getSourceFreshnessWindowHours('PECOS_PUBLIC'),
    }),
  ];
}

function buildPassportSourceCoverage(input: {
  trustState: ClinicianTrustState | null;
  identity: PassportIdentity;
  authority: PassportAuthority;
  standing: PassportStanding;
  lastCheckedAt: string;
  proofBySource: ReadonlyMap<string, SourceProofRefs>;
}): CanonicalSourceCoverageReport {
  const baseChecks = input.trustState?.sourceCoverage?.length
    ? input.trustState.sourceCoverage
    : buildFallbackPassportSourceCoverage({
        identity: input.identity,
        authority: input.authority,
        standing: input.standing,
        lastCheckedAt: input.lastCheckedAt,
      });

  const checks = baseChecks
    .map((check) => createCanonicalSourceCoverage({
      sourceId: check.sourceId,
      state: check.state,
      reason: check.reason,
      checkedAt: check.checkedAt ?? null,
      artifactId: check.artifactId ?? null,
      sourceUrl: check.sourceUrl ?? null,
      rawArtifactRef: check.rawArtifactRef ?? check.artifactId ?? null,
      checksum: check.checksum ?? null,
      parserVersion: check.parserVersion ?? null,
      freshnessWindowHours: check.freshnessWindowHours ?? null,
      proof: input.proofBySource.get(check.sourceId) ?? null,
    }))
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId));

  return {
    checks,
    summary: summarizeCanonicalSourceCoverage(checks),
  };
}

const TRUST_POSTURE_BAND_LABELS: Record<string, string> = {
  L3: 'High trust',
  L2: 'Moderate trust',
  L1: 'Partial trust',
  L0: 'Insufficient trust',
};

const COVERAGE_REASON_PRIORITY: Record<CanonicalSourceCoverageState, number> = {
  reviewRequired: 0,
  stale: 1,
  accessRequired: 2,
  gated: 3,
  partial: 4,
  notDecisionGrade: 5,
  notChecked: 6,
  unavailable: 7,
  mock: 8,
  live: 9,
};

const COVERAGE_GATED_STATES: readonly CanonicalSourceCoverageState[] = ['gated', 'accessRequired'];
const COVERAGE_MISSING_STATES: readonly CanonicalSourceCoverageState[] = [
  'notDecisionGrade',
  'notChecked',
  'partial',
  'unavailable',
  'mock',
];

function pushUniqueValue(values: string[], value?: string | null): void {
  if (!value) {
    return;
  }

  const normalized = value.trim();
  if (!normalized || values.includes(normalized)) {
    return;
  }

  values.push(normalized);
}

function findCoverageChecks(
  report: CanonicalSourceCoverageReport,
  sourceIds: readonly string[],
): CanonicalSourceCoverage[] {
  const aliases = new Set(sourceIds.filter((value) => value.trim().length > 0));
  if (aliases.size === 0) {
    return [];
  }

  return report.checks.filter((check) => aliases.has(check.sourceId));
}

function hasCoverageState(
  checks: readonly CanonicalSourceCoverage[],
  states: readonly CanonicalSourceCoverageState[],
): boolean {
  return checks.some((check) => states.includes(check.state));
}

function findPrioritizedCoverageCheck(
  checks: readonly CanonicalSourceCoverage[],
  states?: readonly CanonicalSourceCoverageState[],
): CanonicalSourceCoverage | undefined {
  const filtered = states
    ? checks.filter((check) => states.includes(check.state))
    : [...checks];

  return [...filtered].sort((left, right) => (
    COVERAGE_REASON_PRIORITY[left.state] - COVERAGE_REASON_PRIORITY[right.state]
    || left.sourceId.localeCompare(right.sourceId)
  ))[0];
}

function latestCheckedAtFromChecks(
  checks: readonly CanonicalSourceCoverage[],
): string | undefined {
  return checks.reduce<string | undefined>(
    (latest, check) => latestIso(latest, check.checkedAt ?? undefined),
    undefined,
  );
}

function latestCredentialTimestamp(
  credentials: readonly Pick<PassportCredential, 'observedAt' | 'verifiedAt'>[],
): string | undefined {
  return credentials.reduce<string | undefined>(
    (latest, credential) => latestIso(latestIso(latest, credential.observedAt), credential.verifiedAt),
    undefined,
  );
}

function resolvePostureState(input: {
  blocked?: boolean;
  reviewRequired?: boolean;
  stale?: boolean;
  gated?: boolean;
  current?: boolean;
}): PassportTrustPostureState {
  if (input.blocked) return 'blocked';
  if (input.reviewRequired) return 'review_required';
  if (input.stale) return 'stale';
  if (input.gated) return 'gated';
  if (input.current) return 'current';
  return 'missing';
}

function freshnessStateForLayer(input: {
  checks: readonly CanonicalSourceCoverage[];
  stale: boolean;
}): PassportTrustPostureFreshnessItem['state'] {
  if (input.stale || hasCoverageState(input.checks, ['stale'])) {
    return 'stale';
  }

  if (input.checks.length > 0 && input.checks.every((check) => check.state === 'live')) {
    return 'current';
  }

  return 'partial';
}

function buildPassportTrustPosture(input: {
  identity: PassportIdentity;
  authority: PassportAuthority;
  training: PassportTraining;
  standing: PassportStanding;
  readiness: PassportReadiness;
  sourceCoverage: CanonicalSourceCoverageReport;
  lastCheckedAt: string;
}): PassportTrustPosture {
  const safeToRelyOnNow: string[] = [];
  const missingItems: string[] = [];
  const gatedItems: string[] = [];
  const reviewRequiredItems: string[] = [];
  const staleItems: string[] = [];
  const blockers = [...input.readiness.blockers];

  const identityChecks = findCoverageChecks(input.sourceCoverage, ['NPPES_API', 'NPPES']);
  const safetyChecks = findCoverageChecks(input.sourceCoverage, ['OIG_LEIE', 'OIG']);
  const licensureCredentials = input.authority.credentials.filter((credential) => credential.domain === 'LICENSURE');
  const authorityChecks = findCoverageChecks(
    input.sourceCoverage,
    dedupeStrings([
      'STATE_BOARD',
      'FSMB_MED_API',
      'FSMB_PDC',
      'NURSYS',
      'NURSYS_AUTHORIZED_PATH',
      ...licensureCredentials
        .map((credential) => credential.sourceId)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    ]),
  );
  const eligibilityChecks = findCoverageChecks(input.sourceCoverage, ['PECOS_PUBLIC']);

  const identityCurrent = Boolean(input.identity.displayName && input.identity.npi && hasCoverageState(identityChecks, ['live']));
  const identityStale = Boolean(input.identity.displayName && hasCoverageState(identityChecks, ['stale']));
  const identityGated = hasCoverageState(identityChecks, COVERAGE_GATED_STATES);
  const identityReviewRequired = hasCoverageState(identityChecks, ['reviewRequired']);
  const identityState = resolvePostureState({
    current: identityCurrent,
    stale: identityStale,
    gated: identityGated,
    reviewRequired: identityReviewRequired,
  });
  const identityCheckedAt = latestIso(
    latestCheckedAtFromChecks(identityChecks),
    input.lastCheckedAt,
  );
  const identityDetail =
    identityState === 'current'
      ? 'Identity is confirmed in CMS NPPES and is safe to rely on now.'
      : identityState === 'stale'
        ? findPrioritizedCoverageCheck(identityChecks, ['stale'])?.reason ?? 'CMS NPPES identity evidence is stale and should be refreshed.'
        : identityState === 'gated'
          ? findPrioritizedCoverageCheck(identityChecks, COVERAGE_GATED_STATES)?.reason ?? 'CMS NPPES identity access is currently gated.'
          : identityState === 'review_required'
            ? findPrioritizedCoverageCheck(identityChecks, ['reviewRequired'])?.reason ?? 'CMS NPPES identity evidence requires review before relying on it.'
            : findPrioritizedCoverageCheck(identityChecks, COVERAGE_MISSING_STATES)?.reason ?? 'CMS NPPES identity has not been confirmed yet.';
  if (identityState === 'current') {
    pushUniqueValue(safeToRelyOnNow, 'Identity confirmed via CMS NPPES.');
  } else if (identityState === 'stale') {
    pushUniqueValue(staleItems, identityDetail);
  } else if (identityState === 'gated') {
    pushUniqueValue(gatedItems, identityDetail);
  } else if (identityState === 'review_required') {
    pushUniqueValue(reviewRequiredItems, identityDetail);
  } else {
    pushUniqueValue(missingItems, identityDetail);
  }

  const safetyBlocked = input.standing.exclusionStatus === 'EXCLUDED';
  const safetyReviewRequired =
    input.standing.exclusionStatus === 'POSSIBLE_MATCH'
    || hasCoverageState(safetyChecks, ['reviewRequired']);
  const safetyStale =
    input.standing.exclusionStatus === 'CLEAR'
    && hasCoverageState(safetyChecks, ['stale']);
  const safetyGated = hasCoverageState(safetyChecks, COVERAGE_GATED_STATES);
  const safetyCurrent =
    input.standing.exclusionStatus === 'CLEAR'
    && hasCoverageState(safetyChecks, ['live'])
    && !safetyStale;
  const safetyState = resolvePostureState({
    blocked: safetyBlocked,
    reviewRequired: safetyReviewRequired,
    stale: safetyStale,
    gated: safetyGated,
    current: safetyCurrent,
  });
  const safetyCheckedAt = latestIso(
    latestCheckedAtFromChecks(safetyChecks),
    input.standing.exclusionCheckedAt,
  );
  const safetyDetail =
    safetyState === 'current'
      ? 'Current OIG/LEIE exclusion screening is clear.'
      : safetyState === 'blocked'
        ? 'Current OIG/LEIE screening shows an exclusion record that blocks readiness.'
        : safetyState === 'review_required'
          ? findPrioritizedCoverageCheck(safetyChecks, ['reviewRequired'])?.reason ?? 'OIG/LEIE returned a possible match and requires manual review.'
          : safetyState === 'stale'
            ? findPrioritizedCoverageCheck(safetyChecks, ['stale'])?.reason ?? 'OIG/LEIE screening is stale and should be refreshed.'
            : safetyState === 'gated'
              ? findPrioritizedCoverageCheck(safetyChecks, COVERAGE_GATED_STATES)?.reason ?? 'OIG/LEIE access is currently gated.'
              : findPrioritizedCoverageCheck(safetyChecks, COVERAGE_MISSING_STATES)?.reason ?? 'OIG/LEIE screening has not been confirmed yet.';
  if (safetyState === 'current') {
    pushUniqueValue(safeToRelyOnNow, 'OIG/LEIE exclusion check is clear.');
  } else if (safetyState === 'blocked') {
    pushUniqueValue(blockers, safetyDetail);
  } else if (safetyState === 'review_required') {
    pushUniqueValue(reviewRequiredItems, safetyDetail);
  } else if (safetyState === 'stale') {
    pushUniqueValue(staleItems, safetyDetail);
  } else if (safetyState === 'gated') {
    pushUniqueValue(gatedItems, safetyDetail);
  } else {
    pushUniqueValue(missingItems, safetyDetail);
  }

  const authorityHasBlockingFinding = input.standing.negativeFindings.some((finding) => (
    /license expired|license discipline|board order severity blocks readiness/i.test(finding)
  ));
  const authorityHasBlockingCredential = licensureCredentials.some((credential) => (
    credential.status === 'EXPIRED'
    || credential.authorityClaimCode === 'RN_LICENSE_EXPIRED'
    || credential.authorityClaimCode === 'RN_LICENSE_DISCIPLINED'
    || (
      credential.authorityClaimCode === 'BOARD_ORDER_PRESENT'
      && ['HIGH', 'CRITICAL'].includes((credential.boardOrderSeverity ?? '').toUpperCase())
    )
  ));
  const authorityBlocked = input.standing.licensureStatus === 'expired'
    || authorityHasBlockingFinding
    || authorityHasBlockingCredential;
  const authorityReviewRequired = !authorityBlocked && (
    licensureCredentials.some((credential) => (
      credential.reviewRequired
      || credential.authorityClaimCode === 'BOARD_ORDER_PRESENT'
    ))
    || hasCoverageState(authorityChecks, ['reviewRequired'])
    || input.standing.negativeFindings.some((finding) => /board order requires manual review/i.test(finding))
  );
  const authorityGated = !authorityBlocked && !authorityReviewRequired && (
    licensureCredentials.some((credential) => credential.participationStatus === 'institution_access_unavailable')
    || hasCoverageState(authorityChecks, COVERAGE_GATED_STATES)
  );
  const authorityStale = !authorityBlocked && !authorityReviewRequired && !authorityGated && (
    licensureCredentials.some((credential) => credential.stale)
    || hasCoverageState(authorityChecks, ['stale'])
  );
  const authorityCurrent = !authorityBlocked && !authorityReviewRequired && !authorityGated && !authorityStale
    && input.standing.licensureStatus === 'verified'
    && licensureCredentials.some((credential) => (
      isCredentialCurrentStatus(credential.domain, credential.status)
      && isDecisionGrade({
        domain: credential.domain,
        verifiedAt: credential.verifiedAt,
        sourceId: credential.sourceId,
        reviewRequired: credential.reviewRequired,
      })
    ))
    && hasCoverageState(authorityChecks, ['live']);
  const authorityState = resolvePostureState({
    blocked: authorityBlocked,
    reviewRequired: authorityReviewRequired,
    stale: authorityStale,
    gated: authorityGated,
    current: authorityCurrent,
  });
  const authorityCheckedAt = latestIso(
    latestCheckedAtFromChecks(authorityChecks),
    latestCredentialTimestamp(licensureCredentials),
  );
  const authorityDetail =
    authorityState === 'current'
      ? 'Active state licensure is verified from a live authority source.'
      : authorityState === 'blocked'
        ? input.standing.negativeFindings.find((finding) => /license expired|license discipline|board order/i.test(finding))
          ?? 'Licensure issues currently block readiness.'
        : authorityState === 'review_required'
          ? input.standing.negativeFindings.find((finding) => /board order requires manual review/i.test(finding))
            ?? findPrioritizedCoverageCheck(authorityChecks, ['reviewRequired'])?.reason
            ?? 'Licensure evidence requires manual review before it is decision-grade.'
          : authorityState === 'gated'
            ? findPrioritizedCoverageCheck(authorityChecks, COVERAGE_GATED_STATES)?.reason
              ?? 'Licensure verification requires institutional source access.'
            : authorityState === 'stale'
              ? findPrioritizedCoverageCheck(authorityChecks, ['stale'])?.reason
                ?? 'Licensure evidence is stale and should be refreshed.'
              : findPrioritizedCoverageCheck(authorityChecks, COVERAGE_MISSING_STATES)?.reason
                ?? 'Live state licensure proof is not available yet.';
  if (authorityState === 'current') {
    pushUniqueValue(safeToRelyOnNow, 'Active state licensure is verified from a live authority source.');
  } else if (authorityState === 'blocked') {
    pushUniqueValue(blockers, authorityDetail);
  } else if (authorityState === 'review_required') {
    pushUniqueValue(reviewRequiredItems, authorityDetail);
  } else if (authorityState === 'gated') {
    pushUniqueValue(gatedItems, authorityDetail);
  } else if (authorityState === 'stale') {
    pushUniqueValue(staleItems, authorityDetail);
  } else {
    pushUniqueValue(missingItems, authorityDetail);
  }

  const eligibilityReviewRequired = hasCoverageState(eligibilityChecks, ['reviewRequired'])
    || input.readiness.blockers.some((blocker) => /enrollment.*review/i.test(blocker));
  const eligibilityGated = hasCoverageState(eligibilityChecks, COVERAGE_GATED_STATES);
  const eligibilityStale =
    input.standing.pecosEnrollmentStatus === 'ENROLLED'
    && (
      hasCoverageState(eligibilityChecks, ['stale'])
      || input.standing.enrollmentFreshnessLabel === 'Stale — refresh required'
      || (input.standing.enrollmentFreshnessLabel ?? '').startsWith('Revalidation due')
    );
  const eligibilityCurrent =
    input.standing.pecosEnrollmentStatus === 'ENROLLED'
    && hasCoverageState(eligibilityChecks, ['live'])
    && !eligibilityStale;
  const eligibilityState = resolvePostureState({
    blocked: input.standing.pecosEnrollmentStatus === 'NOT_FOUND',
    reviewRequired: eligibilityReviewRequired,
    stale: eligibilityStale,
    gated: eligibilityGated,
    current: eligibilityCurrent,
  });
  const eligibilityCheckedAt = latestIso(
    latestCheckedAtFromChecks(eligibilityChecks),
    input.standing.enrollmentObservedAt,
  );
  const pecosCurrentSuffix = input.standing.enrollmentDataVersion
    ? ` (${input.standing.enrollmentDataVersion})`
    : '';
  const eligibilityDetail =
    eligibilityState === 'current'
      ? `CMS PECOS shows Medicare enrollment${pecosCurrentSuffix}.`
      : eligibilityState === 'blocked'
        ? input.standing.enrollmentNote ?? 'CMS PECOS does not show an enrolled provider record, which blocks readiness.'
        : eligibilityState === 'review_required'
          ? findPrioritizedCoverageCheck(eligibilityChecks, ['reviewRequired'])?.reason
            ?? 'PECOS enrollment requires review before relying on it.'
          : eligibilityState === 'gated'
            ? findPrioritizedCoverageCheck(eligibilityChecks, COVERAGE_GATED_STATES)?.reason
              ?? 'PECOS access is currently gated.'
            : eligibilityState === 'stale'
              ? input.standing.enrollmentFreshnessLabel
                ?? findPrioritizedCoverageCheck(eligibilityChecks, ['stale'])?.reason
                ?? 'PECOS evidence is stale and should be refreshed.'
              : findPrioritizedCoverageCheck(eligibilityChecks, COVERAGE_MISSING_STATES)?.reason
                ?? input.standing.enrollmentNote
                ?? 'PECOS enrollment has not been confirmed yet.';
  if (eligibilityState === 'current') {
    pushUniqueValue(safeToRelyOnNow, `CMS PECOS shows Medicare enrollment${pecosCurrentSuffix}.`);
  } else if (eligibilityState === 'blocked') {
    pushUniqueValue(blockers, eligibilityDetail);
  } else if (eligibilityState === 'review_required') {
    pushUniqueValue(reviewRequiredItems, eligibilityDetail);
  } else if (eligibilityState === 'gated') {
    pushUniqueValue(gatedItems, eligibilityDetail);
  } else if (eligibilityState === 'stale') {
    pushUniqueValue(staleItems, eligibilityDetail);
  } else {
    pushUniqueValue(missingItems, eligibilityDetail);
  }

  if (input.training.degreeVerified) {
    pushUniqueValue(safeToRelyOnNow, 'Medical degree is source-verified.');
  }
  if (input.training.hasResidency) {
    pushUniqueValue(safeToRelyOnNow, 'Residency completion is source-verified.');
  }

  for (const gap of input.readiness.gaps) {
    if (/stale|revalidation due/i.test(gap)) {
      pushUniqueValue(staleItems, gap);
      continue;
    }
    if (/review/i.test(gap)) {
      pushUniqueValue(reviewRequiredItems, gap);
      continue;
    }
    if (/access required|institution|not connected|gated/i.test(gap)) {
      pushUniqueValue(gatedItems, gap);
      continue;
    }

    pushUniqueValue(missingItems, gap);
  }

  const freshnessItems: PassportTrustPostureFreshnessItem[] = [
    {
      id: 'identity',
      label: 'Identity',
      source: 'CMS NPPES',
      state: freshnessStateForLayer({
        checks: identityChecks,
        stale: identityStale,
      }),
      checkedAt: identityCheckedAt,
      note: identityStale ? identityDetail : identityCurrent ? 'Current attached check' : identityDetail,
    },
    {
      id: 'safety',
      label: 'Safety',
      source: 'OIG LEIE',
      state: freshnessStateForLayer({
        checks: safetyChecks,
        stale: safetyStale,
      }),
      checkedAt: safetyCheckedAt,
      note: safetyStale ? safetyDetail : safetyChecks.every((check) => check.state === 'live') ? 'Current attached check' : safetyDetail,
    },
    {
      id: 'authority',
      label: 'Authority',
      source: licensureCredentials[0]?.issuerName ?? licensureCredentials[0]?.sourceId ?? 'State Boards / FSMB',
      state: freshnessStateForLayer({
        checks: authorityChecks,
        stale: authorityStale,
      }),
      checkedAt: authorityCheckedAt,
      note: authorityStale ? authorityDetail : authorityChecks.length > 0 && authorityChecks.every((check) => check.state === 'live') ? 'Current attached check' : authorityDetail,
    },
    {
      id: 'eligibility',
      label: 'Eligibility',
      source: input.standing.enrollmentSourceLabel ?? 'CMS PECOS',
      state: freshnessStateForLayer({
        checks: eligibilityChecks,
        stale: eligibilityStale,
      }),
      checkedAt: eligibilityCheckedAt,
      note: eligibilityStale ? eligibilityDetail : eligibilityChecks.length > 0 && eligibilityChecks.every((check) => check.state === 'live') ? 'Current attached check' : eligibilityDetail,
    },
  ];

  const freshnessState: PassportTrustPostureFreshness['state'] =
    freshnessItems.some((item) => item.state === 'stale')
      ? 'stale'
      : freshnessItems.some((item) => item.state === 'partial')
        ? 'partial'
        : 'current';
  const freshnessLabel =
    freshnessState === 'stale'
      ? 'Stale sources present'
      : freshnessState === 'partial'
        ? 'Partial source coverage'
        : 'Current attached checks';
  const normalizedBlockers = blockers.filter((blocker) => {
    const normalized = blocker.trim().toUpperCase();

    if (normalized === 'MISSING: IDENTITY' && identityState === 'current') {
      return false;
    }
    if (normalized === 'MISSING: EXCLUSION_CHECK' && safetyState !== 'missing') {
      return false;
    }
    if (normalized === 'MISSING: LICENSURE' && authorityState !== 'missing') {
      return false;
    }

    return true;
  });

  return {
    band: input.readiness.level,
    bandLabel: TRUST_POSTURE_BAND_LABELS[input.readiness.level] ?? 'Trust posture',
    score: input.readiness.score,
    dimensions: [
      {
        id: 'identity',
        label: 'Identity',
        state: identityState,
        detail: identityDetail,
        checkedAt: identityCheckedAt,
      },
      {
        id: 'safety',
        label: 'Safety',
        state: safetyState,
        detail: safetyDetail,
        checkedAt: safetyCheckedAt,
      },
      {
        id: 'authority',
        label: 'Authority',
        state: authorityState,
        detail: authorityDetail,
        checkedAt: authorityCheckedAt,
      },
      {
        id: 'eligibility',
        label: 'Eligibility',
        state: eligibilityState,
        detail: eligibilityDetail,
        checkedAt: eligibilityCheckedAt,
      },
    ],
    freshness: {
      state: freshnessState,
      label: freshnessLabel,
      items: freshnessItems,
    },
    safeToRelyOnNow,
    missingItems,
    gatedItems,
    reviewRequiredItems,
    staleItems,
    blockers: normalizedBlockers,
  };
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Build a full TrustPassport for a given entity ID.
 * For NPI-based lookup, resolve entity first then call this.
 */
export async function buildPassport(entityId: string): Promise<TrustPassport | null> {
  const record = await getEntityById(entityId);
  if (!record) return null;

  const { entity } = record;
  const npi = entity.npi ?? undefined;
  const receiptClient = getVerificationReceiptRecordClient();
  const credentials = await prisma.vcvCredential.findMany({
    where: {
      subjectId: entityId,
      status: { not: 'SUPERSEDED' },
    },
    include: {
      issuer: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
    orderBy: [
      { observedAt: 'desc' },
      { verifiedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });
  const artifactIds = onlyUuids(dedupeStrings(credentials.flatMap((credential) => credential.artifactIds)));
  const receiptIds = onlyReceiptIds(dedupeStrings(credentials.flatMap((credential) => credential.receiptIds)));
  const [artifacts, receipts] = await Promise.all([
    artifactIds.length > 0
      ? prisma.verificationArtifact.findMany({
          where: {
            id: { in: artifactIds },
          },
          select: {
            id: true,
            source: true,
            parserVersion: true,
          },
        })
      : Promise.resolve([]),
    receiptIds.length > 0 && receiptClient.findMany
      ? receiptClient.findMany({
          where: {
            receiptId: { in: receiptIds },
          },
          select: {
            receiptId: true,
            sourceArtifactId: true,
            verificationArtifactId: true,
          },
        })
      : Promise.resolve([] as CredentialReceiptEvidence[]),
  ]);
  const artifactsById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  // Build source → parserVersion map from the latest artifact per source (for minimum-contract threading).
  const receiptsById = new Map(receipts.map((receipt) => [receipt.receiptId, receipt]));
  const credentialEvidence = new Map(
    credentials.map((credential) => [credential.id, resolveCredentialEvidence({
      credential: {
        id: credential.id,
        verificationLevel: credential.verificationLevel,
        artifactIds: credential.artifactIds,
        receiptIds: credential.receiptIds,
      },
      artifactsById,
      receiptsById,
    })]),
  );
  const evidenceGaps = dedupeStrings(
    credentials.flatMap((credential) => {
      const evidence = credentialEvidence.get(credential.id);
      if (!evidence || evidence.publicSafe) {
        return [];
      }
      if (evidence.issues.includes('missing_artifact')) {
        return [`Missing artifact source: ${credential.domain}`];
      }
      if (evidence.issues.includes('missing_receipt')) {
        return [`Proof missing: ${credential.domain}`];
      }
      return [`Unbacked credential withheld: ${credential.domain}`];
    }),
  );
  const usableCredentials = credentials.filter((credential) => credentialEvidence.get(credential.id)?.publicSafe ?? false);

  // ── Education records ─────────────────────────────────────────────────────
  const eduRecords = await prisma.vcvEducationRecord.findMany({
    where:   { subjectId: entityId },
    include: { institution: true },
    orderBy: { endYear: 'desc' },
  });

  // ── Trust state (from pipeline) ───────────────────────────────────────────
  let trustState: Awaited<ReturnType<typeof getCachedTrustState>> | null = null;
  if (npi) {
    try {
      trustState = await getCachedTrustState(npi);
    } catch { /* trust state may not exist yet — degrade gracefully */ }
  }

  // ── Authority ─────────────────────────────────────────────────────────────
  const credList: PassportCredential[] = usableCredentials.map(c => {
    // TRUTH INTEGRITY: use the fixed isCredentialStale that treats null verifiedAt as stale
    const stale   = isCredentialStale({ domain: c.domain, verifiedAt: c.verifiedAt });
    const expiry  = daysUntilExpiry(c.expiresAt);
    const meta = asRecord(c.metadata);
    const claimValue = asRecord(c.claimValue);
    const dataFreshnessLabel =
      stringValue(meta.dataFreshnessLabel)
      ?? stringValue(meta.dataFreshness)
      ?? stringValue(claimValue.dataFreshness)
      ?? 'Freshness unavailable';
    const claimConfidenceLabel =
      stringValue(meta.claimConfidenceLabel)
      ?? stringValue(meta.confidenceLabel)
      ?? 'Unverified';
    const observedAt =
      c.observedAt?.toISOString()
      ?? stringValue(meta.observedAt)
      ?? stringValue(claimValue.observedAt);

    return {
      id:                c.id,
      domain:            c.domain,
      type:              c.credentialType,
      status:            c.status,
      verificationLevel: c.verificationLevel,
      label:             stringValue(meta.label) ?? stringValue(claimValue.label),
      issuerEntityId:    stringValue(meta.issuerEntityId) ?? c.issuerId ?? undefined,
      issuerName:        c.issuer?.displayName ?? undefined,
      sourceId:          stringValue(meta.sourceId),
      jurisdiction:      c.jurisdiction ?? undefined,
      issuedAt:          c.issuedAt?.toISOString(),
      expiresAt:         c.expiresAt?.toISOString(),
      verifiedAt:        c.verifiedAt?.toISOString(),
      observedAt,
      nextReverifyAt:    c.nextReverifyAt?.toISOString(),
      daysUntilExpiry:   expiry ?? undefined,
      stale,
      confidenceLabel:    claimConfidenceLabel,
      claimConfidenceLabel,
      matchConfidence:    stringValue(meta.matchConfidence) ?? stringValue(claimValue.matchConfidence),
      matchType:          stringValue(meta.matchType) ?? stringValue(claimValue.matchType),
      sourceLatency:      stringValue(meta.sourceLatency) ?? stringValue(claimValue.sourceLatency),
      dataFreshness:      dataFreshnessLabel,
      dataFreshnessLabel,
      dataFreshnessCadence: stringValue(meta.dataFreshness) ?? stringValue(claimValue.dataFreshness),
      claimState:
        stringValue(meta.claimState)
        ?? stringValue(claimValue.claimState)
        ?? stringValue(claimValue.verdict),
      statusLabel:     stringValue(meta.statusLabel) ?? stringValue(claimValue.statusLabel),
      dataVersion:      stringValue(meta.dataVersion) ?? stringValue(claimValue.dataVersion),
      revalidationDue:  stringValue(meta.revalidationDue) ?? stringValue(claimValue.revalidationDue),
      leieVersionDate:  stringValue(meta.leieVersionDate) ?? stringValue(claimValue.leieVersionDate),
      identityOnly:     (meta.identityOnly as boolean | undefined) ?? (claimValue.identityOnly as boolean | undefined),
      sourceDisclaimer:    stringValue(meta.sourceDisclaimer) ?? stringValue(claimValue.sourceDisclaimer),
      // TRUTH INTEGRITY: reviewRequired is true if:
      //   (a) explicitly flagged in metadata, OR
      //   (b) sourceId is missing — no traceable source means not decision-grade
      reviewRequired: (meta.reviewRequired as boolean | undefined) ?? (!stringValue(meta.sourceId) ? true : false),
      // Authority truth fields (M14/MS15)
      authorityClaimCode:  stringValue(meta.authorityClaimCode) ?? undefined,
      boardOrderSeverity:  stringValue(meta.boardOrderSeverity) ?? undefined,
      connectorState:      stringValue(meta.connectorState) ?? undefined,
      participationStatus: stringValue(meta.participationStatus) ?? undefined,
      sourceScope:         stringValue(meta.sourceScope) ?? undefined,
    };
  });

  const satisfiedCredentials = usableCredentials.filter((credential) => isCredentialSatisfied(credential));
  const activeDomains  = new Set(satisfiedCredentials.map(c => c.domain));
  const missingBlocking = BLOCKING_DOMAINS.filter(d => !activeDomains.has(d as import('@prisma/client').VcvCredentialDomain));

  const authority: PassportAuthority = {
    credentials: credList,
    summary: {
      active:  credList.filter(c => isCredentialSatisfied(c)).length,
      expired: credList.filter(c => c.status === 'EXPIRED').length,
      stale:   credList.filter(c => c.stale).length,
      missing: missingBlocking,
    },
  };

  // ── Training ──────────────────────────────────────────────────────────────
  const training: PassportTraining = {
    records: eduRecords.map(r => ({
      id:               r.id,
      recordType:       r.recordType,
      degreeOrTitle:    r.degreeOrTitle ?? undefined,
      specialty:        r.specialty    ?? undefined,
      programName:      r.programName  ?? undefined,
      institutionName:  r.institution?.displayName,
      endYear:          r.endYear      ?? undefined,
      completed:        r.completed,
      verificationLevel: r.verificationLevel,
    })),
    hasDegree: eduRecords.some(r =>
      ['MEDICAL_DEGREE', 'NURSING_DEGREE', 'ADVANCED_PRACTICE_CERT'].includes(r.recordType) && r.completed,
    ),
    degreeVerified: eduRecords.some(r =>
      ['MEDICAL_DEGREE', 'NURSING_DEGREE', 'ADVANCED_PRACTICE_CERT'].includes(r.recordType) &&
      r.completed && ['SOURCE_VERIFIED', 'CRYPTOGRAPHICALLY_SIGNED'].includes(r.verificationLevel),
    ),
    // verificationLevel guard: mirrors degreeVerified — self-attested residency must not
    // render as 'verified' in the training accordion. Requires SOURCE_VERIFIED or better.
    hasResidency: eduRecords.some(
      r => r.recordType === 'RESIDENCY_COMPLETION'
        && r.completed
        && ['SOURCE_VERIFIED', 'CRYPTOGRAPHICALLY_SIGNED'].includes(r.verificationLevel),
    ),
    fellowshipCount: eduRecords.filter(r => r.recordType === 'FELLOWSHIP_COMPLETION' && r.completed).length,
  };

  // ── Standing — from trust state or credential status ──────────────────────
  const exclusionCred  = usableCredentials.find((credential) => credential.domain === 'EXCLUSION_CHECK');
  const licensureCred  = usableCredentials.find((credential) => credential.domain === 'LICENSURE');
  const deaCred        = usableCredentials.find((credential) => credential.domain === 'DEA_REGISTRATION');
  const pecosCred      = usableCredentials.find((credential) => credential.domain === 'MEDICARE_ENROLLMENT');

  const trustStateExclusionStatus = normalizePublicExclusionStatus(trustState?.exclusionStatus);
  const credentialExclusionStatus = exclusionStatusFromCredential(exclusionCred);
  const exclusionStatus =
    credentialExclusionStatus !== 'UNKNOWN'
      ? credentialExclusionStatus
      : trustStateExclusionStatus ?? 'UNCHECKED';
  const exclusionClear = exclusionStatus === 'CLEAR';

  const negativeFindings: string[] = [];
  if (exclusionStatus === 'EXCLUDED') negativeFindings.push('OIG/LEIE exclusion confirmed');
  if (exclusionStatus === 'POSSIBLE_MATCH') negativeFindings.push('OIG/LEIE possible match requires review');
  if (exclusionStatus === 'UNCHECKED') negativeFindings.push('OIG/LEIE check not yet verified');
  if (trustState?.licensureStatus === 'expired') negativeFindings.push('License expired');
  if (trustState?.blockers?.includes('LICENSE_DISCIPLINED')) negativeFindings.push('License discipline requires resolution');
  if (trustState?.blockers?.includes('BOARD_ORDER_BLOCK')) negativeFindings.push('Board order severity blocks readiness');
  if (trustState?.blockers?.includes('BOARD_ORDER_REVIEW')) negativeFindings.push('Board order requires manual review');
  if (trustState?.gap_summary?.some((gap) => gap.toLowerCase().includes('authority source unavailable'))) {
    negativeFindings.push('Authority verification source unavailable');
  }
  // MS16-A: PECOS negative findings — explicit per state
  // Note: derivePecosEnrollmentStatus() is called after negativeFindings, so we compute inline
  {
    const pecosCredEntryTemp = credList.find((credential) => credential.id === pecosCred?.id);
    const pecosStateTemp = pecosCredEntryTemp?.claimState;
    const isNotFound =
      trustState?.pecosStatus === 'NOT_FOUND'
      || pecosStateTemp === 'ENROLLMENT_NOT_FOUND'
      || pecosStateTemp === 'NOT_FOUND';
    if (isNotFound) {
      negativeFindings.push('Medicare enrollment not found in CMS PECOS data');
    }
  }

  const licensureStatus = trustState?.licensureStatus
    ?? (licensureCred
      ? isCredentialSatisfied(licensureCred)
        ? 'verified'
        : licensureCred.status === 'EXPIRED'
          ? 'expired'
          : licensureCred.status === 'REVIEW_REQUIRED' || licensureCred.status === 'UNRESOLVED'
            ? 'pending'
            : 'unknown'
      : 'unknown');

  // ── MS16-A: PECOS normalized enrollment state ─────────────────────────────
  const pecosCredEntry = credList.find((credential) => credential.id === pecosCred?.id);
  const pecosClaimState = pecosCredEntry?.claimState ?? undefined;

  function derivePecosEnrollmentStatus(): PecosEnrollmentStatus {
    // No PECOS credential at all → UNCHECKED
    if (!pecosCred) return 'UNCHECKED';

    // Explicit claim state signals (credential-level, highest fidelity)
    const normalizedClaimState = normalizePecosEnrollmentStatus({
      claimState: pecosClaimState,
      source: 'PECOS',
    });
    if (normalizedClaimState !== 'UNKNOWN' || pecosClaimState === 'UNKNOWN') {
      return normalizedClaimState;
    }

    // Trust state engine has its own PecosStatus vocabulary — map to canonical
    if (trustState?.pecosStatus) {
      return normalizePecosEnrollmentStatus({
        claimState: trustState.pecosStatus,
        source: 'PECOS',
      });
    }

    // Fallback: use credential object state
    return normalizePecosEnrollmentStatus({
      claimState:
        pecosCred.status === 'REVIEW_REQUIRED' || pecosCred.status === 'UNRESOLVED'
          ? 'UNKNOWN'
          : undefined,
      enrolled: isCredentialSatisfied(pecosCred) || pecosCred.status === 'ACTIVE',
      source: 'PECOS',
    });
  }

  const pecosEnrollmentStatus = derivePecosEnrollmentStatus();
  const pecosRevalidationDue =
    pecosCredEntry?.nextReverifyAt
    ?? pecosCredEntry?.revalidationDue
    ?? null;
  const pecosFreshnessLabel = buildPecosFreshnessLabel({
    status: pecosEnrollmentStatus,
    observedAt: pecosCredEntry?.observedAt ?? null,
    revalidationDue: pecosRevalidationDue,
  });
  const pecosDaysRemaining = pecosRevalidationDaysRemaining(pecosRevalidationDue);
  const pecosEnrollmentNoteBase = buildPecosEnrollmentNote(
    pecosEnrollmentStatus,
    pecosCredEntry?.dataVersion ?? undefined,
  );
  const pecosEnrollmentNote =
    pecosFreshnessLabel === 'Stale — refresh required'
      ? `${pecosEnrollmentNoteBase} Quarterly PECOS evidence is stale and must be refreshed.`
      : pecosFreshnessLabel.startsWith('Revalidation due')
        ? `${pecosEnrollmentNoteBase} ${pecosFreshnessLabel}.`
        : pecosEnrollmentNoteBase;

  const legacyPecosStatus: PassportStanding['pecosStatus'] =
    pecosEnrollmentStatus === 'ENROLLED'
      ? 'enrolled'
      : pecosEnrollmentStatus === 'NOT_FOUND'
        ? 'not_enrolled'
        : 'unknown';

  const standing: PassportStanding = {
    exclusionClear,
    exclusionStatus,
    exclusionCheckedAt: exclusionCred?.observedAt?.toISOString() ?? exclusionCred?.verifiedAt?.toISOString(),
    exclusionConfidenceLabel:
      credList.find((credential) => credential.id === exclusionCred?.id)?.claimConfidenceLabel,
    licensureStatus,
    deaStatus:  deaCred ? (isCredentialSatisfied(deaCred) ? 'registered' : 'none') : 'unknown',
    pecosStatus: legacyPecosStatus,
    // MS16-A canonical fields
    pecosEnrollmentStatus,
    enrollmentSourceLabel: PECOS_SOURCE_LABEL,
    // MS16-A: Always human-readable "Quarterly" — normalize raw QUARTERLY token
    enrollmentDataFreshness: 'Quarterly',
    enrollmentSourceLatency: pecosCredEntry?.sourceLatency ?? 'QUARTERLY',
    enrollmentNote: pecosEnrollmentNote,
    enrollmentObservedAt: pecosCredEntry?.observedAt,
    enrollmentDataVersion: pecosCredEntry?.dataVersion,
    enrollmentStatusLabel: pecosCredEntry?.statusLabel,
    enrollmentFreshnessLabel: pecosFreshnessLabel || pecosCredEntry?.dataFreshnessLabel,
    enrollmentConfidenceLabel: pecosCredEntry?.claimConfidenceLabel,
    negativeFindings,
  };

  // ── Readiness ─────────────────────────────────────────────────────────────
  // MS16-C: Eligibility layer must produce blockers (NOT just negativeFindings)
  const eligibilityBlockers: string[] = [];
  const eligibilityGaps: string[] = [];
  if (pecosEnrollmentStatus === 'NOT_FOUND') {
    eligibilityBlockers.push('Medicare enrollment not found — submit PECOS enrollment (45–60 days)');
  }
  if (pecosEnrollmentStatus === 'UNKNOWN') {
    eligibilityGaps.push('Medicare enrollment status unresolved');
  }
  if (pecosEnrollmentStatus === 'UNCHECKED') {
    eligibilityGaps.push('Medicare enrollment not yet checked');
  }
  if (pecosFreshnessLabel === 'Stale — refresh required') {
    eligibilityGaps.push('PECOS enrollment verification stale');
  } else if (
    pecosFreshnessLabel.startsWith('Revalidation due')
    && pecosDaysRemaining !== null
  ) {
    eligibilityGaps.push(
      `PECOS revalidation due in ${pecosDaysRemaining} day${pecosDaysRemaining === 1 ? '' : 's'}`,
    );
  }

  const blockers: string[] = [
    ...negativeFindings,
    ...eligibilityBlockers,
    ...missingBlocking.map(d => `Missing: ${d}`),
    ...evidenceGaps,
  ];
  if (usableCredentials.some(isCredentialBlocking)) blockers.push('Credentials require review');
  if (credList.some(c => c.status === 'EXPIRED')) blockers.push('Expired credentials');

  const gaps: string[] = [
    ...(trustState?.gap_summary ?? []),
    ...eligibilityGaps,
    ...credList
      .filter((credential) => credential.stale && isCredentialCurrentStatus(credential.domain, credential.status))
      .map((credential) => `Stale: ${credential.domain}`),
  ];
  const normalizedBlockers = dedupeStrings(blockers);
  const normalizedGaps = dedupeStrings(gaps);

  let readinessStatus: 'READY' | 'PARTIAL' | 'BLOCKED' = 'READY';
  if (normalizedBlockers.length > 0)   readinessStatus = 'BLOCKED';
  else if (normalizedGaps.length > 0)  readinessStatus = 'PARTIAL';
  else if (missingBlocking.length > 0) readinessStatus = 'BLOCKED';
  const readinessScore = trustState?.readiness_score ?? (readinessStatus === 'READY' ? 80 : readinessStatus === 'PARTIAL' ? 50 : 20);
  // KPI: sync blocker lifecycle events (fire-and-forget — never blocks passport build).
  // This populates blocker_resolution_events so /pilot-ops blocker metrics are live.
  // syncBlockerEvents opens new blockers and auto-resolves blockers no longer present.
  void syncBlockerEvents(entityId, normalizedBlockers).catch(() => void 0);

  // MS16-C/D: pass pecosEnrollmentStatus so actions can match without string-matching
  const nextActions = buildReadinessNextActions({
    missingBlockingDomains: missingBlocking,
    blockers: normalizedBlockers,
    gaps: normalizedGaps,
    pecosEnrollmentStatus,
  });

  const readiness: PassportReadiness = {
    status:             readinessStatus,
    score:              readinessScore,
    readiness_score:    readinessScore,
    level:              trustState?.readiness_level ?? 'L1',
    blockers:           normalizedBlockers,
    gaps:               normalizedGaps,
    nextActions,
    estimatedStartDays: readinessStatus === 'BLOCKED' ? null : ESTIMATED_START_DAYS[readinessStatus],
  };

  // ── Sources ───────────────────────────────────────────────────────────────
  const sourceLastFetch = new Map<string, string>();
  for (const credential of credList) {
    if (!credential.sourceId) {
      continue;
    }

    const latest =
      latestIso(credential.observedAt, credential.verifiedAt)
      ?? latestIso(credential.verifiedAt, credential.issuedAt);
    if (!latest) {
      continue;
    }

    const current = sourceLastFetch.get(credential.sourceId);
    sourceLastFetch.set(credential.sourceId, latestIso(current, latest) ?? latest);
  }

  if (entity.verifiedAt) {
    for (const sourceId of entity.sourceIds) {
      sourceLastFetch.set(
        sourceId,
        latestIso(sourceLastFetch.get(sourceId), entity.verifiedAt.toISOString()) ?? entity.verifiedAt.toISOString(),
      );
    }
  }

  const sources: PassportSources = {
    checked: Array.from(
      new Set([
        ...entity.sourceIds,
        ...credList.map((credential) => credential.sourceId).filter((value): value is string => Boolean(value)),
      ]),
    ).sort((left, right) => left.localeCompare(right)),
    lastFetch: Object.fromEntries(Array.from(sourceLastFetch.entries()).sort(([left], [right]) => left.localeCompare(right))),
  };

  const meta = entity.metadata as Record<string, unknown>;
  const lastCheckedAt = entity.verifiedAt?.toISOString() ?? new Date().toISOString();
  const identity: PassportIdentity = {
    entityId,
    displayName: entity.displayName,
    npi,
    specialty: meta.specialty as string | undefined,
    entityType: entity.entityType,
    status: (meta.status as string | undefined) ?? 'ACTIVE',
  };
  const sourceCoverage = buildPassportSourceCoverage({
    trustState,
    identity,
    authority,
    standing,
    lastCheckedAt,
    proofBySource: buildProofRefsBySource({
      credentials: credList,
      credentialEvidence,
      artifactsById,
    }),
  });
  const trustPosture = buildPassportTrustPosture({
    identity,
    authority,
    training,
    standing,
    readiness,
    sourceCoverage,
    lastCheckedAt,
  });

  log('info', 'passport_built', {
    entityId, npi, readinessStatus, score: readiness.score,
    credentials: credList.length, education: eduRecords.length,
  });

  return {
    entityId,
    npi,
    identity,
    authority,
    training,
    standing,
    readiness,
    sources,
    sourceCoverage,
    trustPosture,
    lastCheckedAt,
  };
}

/**
 * Build passport by NPI — resolves entity first if needed.
 */
export async function buildPassportByNpi(npi: string): Promise<TrustPassport | null> {
  // Resolve creates/updates entity if needed
  const record = await resolveEntityFromNpi(npi);
  return buildPassport(record.entity.id);
}
