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
import { getCachedTrustState } from '../trust/trustStateEngine';
import {
  daysUntilExpiry,
  isCredentialBlocking,
  isCredentialCurrentStatus,
  isCredentialSatisfied,
  isCredentialStale,
  normalizeExclusionCredentialStatus,
} from '../../domain/entity/contracts';
import { log } from '../../obs/logger';
import { resolveCredentialEvidence, type CredentialReceiptEvidence } from './evidenceIntegrity';
import { buildReadinessNextActions, type ReadinessNextAction } from './readinessActions';

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
  reviewRequired:    boolean;
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
  pecosStatus:      'enrolled' | 'not_enrolled' | 'unknown';
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
      sourceDisclaimer: stringValue(meta.sourceDisclaimer) ?? stringValue(claimValue.sourceDisclaimer),
      reviewRequired:   (meta.reviewRequired as boolean | undefined) ?? false,
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
  if (
    trustState?.blockers?.includes('ENROLLMENT_NOT_FOUND')
    || (
    credList.find((credential) => credential.id === pecosCred?.id)?.claimState === 'ENROLLMENT_NOT_FOUND'
    || (pecosCred && !isCredentialSatisfied(pecosCred))
    )
  ) {
    negativeFindings.push('PECOS enrollment not found');
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

  const standing: PassportStanding = {
    exclusionClear,
    exclusionStatus,
    exclusionCheckedAt: exclusionCred?.observedAt?.toISOString() ?? exclusionCred?.verifiedAt?.toISOString(),
    exclusionConfidenceLabel:
      credList.find((credential) => credential.id === exclusionCred?.id)?.claimConfidenceLabel,
    licensureStatus,
    deaStatus:  deaCred ? (isCredentialSatisfied(deaCred) ? 'registered' : 'none') : 'unknown',
    pecosStatus: pecosCred ? (isCredentialSatisfied(pecosCred) ? 'enrolled' : 'not_enrolled') : 'unknown',
    enrollmentObservedAt:
      credList.find((credential) => credential.id === pecosCred?.id)?.observedAt,
    enrollmentDataVersion:
      credList.find((credential) => credential.id === pecosCred?.id)?.dataVersion,
    enrollmentStatusLabel:
      credList.find((credential) => credential.id === pecosCred?.id)?.statusLabel,
    enrollmentFreshnessLabel:
      credList.find((credential) => credential.id === pecosCred?.id)?.dataFreshnessLabel,
    enrollmentConfidenceLabel:
      credList.find((credential) => credential.id === pecosCred?.id)?.claimConfidenceLabel,
    negativeFindings,
  };

  // ── Readiness ─────────────────────────────────────────────────────────────
  const blockers: string[] = [
    ...negativeFindings,
    ...missingBlocking.map(d => `Missing: ${d}`),
    ...evidenceGaps,
  ];
  if (usableCredentials.some(isCredentialBlocking)) blockers.push('Credentials require review');
  if (credList.some(c => c.status === 'EXPIRED')) blockers.push('Expired credentials');

  const gaps: string[] = [
    ...(trustState?.gap_summary ?? []),
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
  const nextActions = buildReadinessNextActions({
    missingBlockingDomains: missingBlocking,
    blockers: normalizedBlockers,
    gaps: normalizedGaps,
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

  log('info', 'passport_built', {
    entityId, npi, readinessStatus, score: readiness.score,
    credentials: credList.length, education: eduRecords.length,
  });

  return {
    entityId,
    npi,
    identity: {
      entityId,
      displayName: entity.displayName,
      npi,
      specialty:   meta.specialty as string | undefined,
      entityType:  entity.entityType,
      status:      (meta.status as string | undefined) ?? 'ACTIVE',
    },
    authority,
    training,
    standing,
    readiness,
    sources,
    lastCheckedAt: entity.verifiedAt?.toISOString() ?? new Date().toISOString(),
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
