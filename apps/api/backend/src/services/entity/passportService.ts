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
} from '../../../../../../packages/trust-state';
import { getSourceFreshnessWindowHours } from '../identity/sourceCatalog';

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
  leieVersionDate?:  string;
  identityOnly?:     boolean;
  sourceDisclaimer?: string;
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

/**
 * MS16-A: Normalized PECOS enrollment state — distinct from legacy pecosStatus.
 *   ENROLLED    — found in CMS PECOS data (source-confirmed)
 *   NOT_FOUND   — source checked, record absent (may indicate not enrolled or data lag)
 *   UNKNOWN     — source was checked but result inconclusive
 *   UNCHECKED   — PECOS source has not been queried yet
 */
export type PecosEnrollmentStatus = 'ENROLLED' | 'NOT_FOUND' | 'UNKNOWN' | 'UNCHECKED';

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
  const licensureSourceId = licensureCredential?.sourceId ?? 'STATE_BOARD';
  const licensureState = licensureCredential?.connectorState === 'unavailable'
    || licensureCredential?.connectorState === 'unresolved'
    ? 'unavailable'
    : licensureCredential?.reviewRequired
      ? 'reviewRequired'
      : licensureCredential?.stale
        ? 'stale'
        : licensureCredential
          ? 'live'
          : 'notChecked';
  const pecosState = input.standing.pecosEnrollmentStatus === 'UNCHECKED'
    ? 'notChecked'
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
    }),
    createCanonicalSourceCoverage({
      sourceId: licensureSourceId,
      state: licensureState,
      reason:
        licensureState === 'live'
          ? 'Licensure checked'
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
    }),
    createCanonicalSourceCoverage({
      sourceId: 'PECOS_PUBLIC',
      state: pecosState,
      reason:
        input.standing.pecosEnrollmentStatus === 'ENROLLED'
          ? 'PECOS quarterly enrollment checked'
          : input.standing.pecosEnrollmentStatus === 'NOT_FOUND'
            ? 'PECOS quarterly release does not show Medicare enrollment for this NPI'
            : input.standing.pecosEnrollmentStatus === 'UNKNOWN'
              ? 'PECOS enrollment outcome could not be resolved from the quarterly release'
              : 'PECOS enrollment source not yet checked',
      checkedAt: input.standing.enrollmentObservedAt ?? null,
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
      proof: input.proofBySource.get(check.sourceId) ?? null,
    }))
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId));

  return {
    checks,
    summary: summarizeCanonicalSourceCoverage(checks),
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
  const artifactIds = dedupeStrings(credentials.flatMap((credential) => credential.artifactIds));
  const receiptIds = dedupeStrings(credentials.flatMap((credential) => credential.receiptIds));
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
  const parserVersionBySource = new Map<string, string>();
  for (const artifact of artifacts) {
    if (artifact.parserVersion && !parserVersionBySource.has(artifact.source)) {
      parserVersionBySource.set(artifact.source, artifact.parserVersion);
    }
  }
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
      leieVersionDate:  stringValue(meta.leieVersionDate) ?? stringValue(claimValue.leieVersionDate),
      identityOnly:     (meta.identityOnly as boolean | undefined) ?? (claimValue.identityOnly as boolean | undefined),
      sourceDisclaimer:    stringValue(meta.sourceDisclaimer) ?? stringValue(claimValue.sourceDisclaimer),
      reviewRequired:      (meta.reviewRequired as boolean | undefined) ?? false,
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
    hasResidency: eduRecords.some(r => r.recordType === 'RESIDENCY_COMPLETION' && r.completed),
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
    if (pecosClaimState === 'ENROLLMENT_NOT_FOUND' || pecosClaimState === 'NOT_FOUND') return 'NOT_FOUND';
    if (pecosClaimState === 'UNKNOWN') return 'UNKNOWN';
    if (pecosClaimState === 'UNCHECKED') return 'UNCHECKED';
    if (pecosClaimState === 'ENROLLED') return 'ENROLLED';

    // Trust state engine has its own PecosStatus vocabulary — map to canonical
    if (trustState?.pecosStatus === 'NOT_FOUND') return 'NOT_FOUND';
    if (trustState?.pecosStatus === 'UNKNOWN') return 'UNKNOWN';
    if (trustState?.pecosStatus === 'ENROLLED') return 'ENROLLED';

    // Fallback: use credential object state
    if (isCredentialSatisfied(pecosCred)) return 'ENROLLED';
    if (pecosCred.status === 'ACTIVE') return 'ENROLLED';
    if (pecosCred.status === 'REVIEW_REQUIRED' || pecosCred.status === 'UNRESOLVED') return 'UNKNOWN';
    return 'UNKNOWN';
  }

  const pecosEnrollmentStatus = derivePecosEnrollmentStatus();

  function buildEnrollmentNote(status: PecosEnrollmentStatus, dataVersion?: string): string | null {
    const versionSuffix = dataVersion ? ` — ${dataVersion}` : '';
    switch (status) {
      case 'ENROLLED':
        return `Medicare enrolled${versionSuffix}`;
      case 'NOT_FOUND':
        return `Not found in the quarterly CMS PECOS release${versionSuffix ? ` (${dataVersion})` : ''} — may indicate non-enrollment or publication lag`;
      case 'UNKNOWN':
        return 'Enrollment status could not be resolved from the current quarterly PECOS data';
      case 'UNCHECKED':
        return 'Medicare enrollment has not been checked';
    }
  }

  const legacyPecosStatus: PassportStanding['pecosStatus'] =
    pecosEnrollmentStatus === 'ENROLLED' ? 'enrolled' : 'unknown';

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
    enrollmentSourceLabel: 'CMS PECOS',
    // MS16-A: Always human-readable "Quarterly" — normalize raw QUARTERLY token
    enrollmentDataFreshness: 'Quarterly',
    enrollmentSourceLatency: pecosCredEntry?.sourceLatency ?? 'QUARTERLY',
    enrollmentNote: buildEnrollmentNote(
      pecosEnrollmentStatus,
      pecosCredEntry?.dataVersion ?? undefined,
    ),
    enrollmentObservedAt: pecosCredEntry?.observedAt,
    enrollmentDataVersion: pecosCredEntry?.dataVersion,
    enrollmentStatusLabel: pecosCredEntry?.statusLabel,
    enrollmentFreshnessLabel: pecosCredEntry?.dataFreshnessLabel,
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
