/**
 * identityIngestionPipeline.ts — Multi-source identity ingestion orchestrator
 *
 * Pipeline stages for each source:
 *   1. FETCH    — capture raw response + checksum + source metadata
 *   2. STORE    — persist append-only VerificationArtifact + SourceRecord
 *   3. PARSE    — derive claims + receipts with parser_version
 *   4. NORMALIZE — persist ClaimRecord + VerificationReceiptRecord
 *   5. DELTA    — compare against the prior artifact for the same source
 *   6. INDEX    — append a new IDENTITY_INDEX VerificationArtifact
 *
 * PersonProfile remains canonical and stable; resolver/index metadata never
 * leaks into it. Identity index state lives in append-only artifacts.
 */

import { createHash } from 'node:crypto';
import prisma, { Prisma } from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { lookupProvider as leieLookupProvider, type LookupProviderInput } from './leieCache';
import {
  buildPecosFetchedRecord,
  buildPecosSingleProviderQueryUrl,
} from './pecosContract';
import {
  checksumOf,
  parseNppesResult,
  parseOigResult,
  parsePecosRecord,
  type NormalizedClaim,
  type VerificationReceipt,
} from './claimEngine';
import {
  fetchOpenPayments, parseOpenPayments,
  fetchSamGov, parseSamGovResult,
  fetchDoctorsAndClinicians, parseDoctorsAndClinicians,
} from './phase2Sources';
import {
  fetchNursys, parseNursysResult,
  fetchStateBoardLicense, parseStateBoardResult,
  extractPracticeStates,
} from './phase3Sources';
import { selectPhysicianLicensureLaunchState } from './physicianLicensureLaunchLane';
import {
  fetchOpenAlex, parseOpenAlexResult,
  fetchClinicalTrials, parseClinicalTrialsResult,
  fetchPubMed, parsePubMedResult,
} from './phase4Sources';
import {
  buildIdentitySummary,
  normalizeEvidenceBundle,
  type CanonicalIdentitySummary,
} from './evidenceModel';
import {
  appendIdentityIndexArtifact,
  loadClaimRecordsForNpi,
  loadVerificationReceiptRecordsForNpi,
  persistClaimRecords,
  persistIdentityClaimDeltas,
  persistSourceRecord,
  persistVerificationReceiptRecords,
  recordIdentityResolutionDecision,
  updateClaimRecordState,
  type IdentityIngestionStatus,
} from './identityStore';
import { materializeClaimsToVcvCredentials } from '../entity/vcvCredentialMaterializer';
import { getSource, type EvidenceTier } from './sourceCatalog';
import {
  emitWatchtowerArtifactsForPersistedDeltas,
  recordSkippedSourceWatchtower,
  scanSourceStalenessForNpi,
} from './watchtowerEngine';

export interface IngestionResult {
  npi: string;
  source: string;
  artifactId: string | null;
  sourceRunId?: string;
  sourceRecordId?: string;
  claimIds?: readonly string[];
  credentialIds?: readonly string[];
  claimsEmitted: number;
  deltaEvents: DeltaEvent[];
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED';
  latencyMs: number;
  error?: string;
}

export interface DeltaEvent {
  type:
    | 'CLAIM_ADDED'
    | 'CLAIM_CHANGED'
    | 'CLAIM_EXPIRED'
    | 'EXCLUSION_DETECTED'
    | 'LICENSE_STATUS_CHANGED'
    | 'NEW_SANCTION_HIT'
    | 'NEW_PAYMENT_RELATIONSHIP'
    | 'PROVIDER_MOVED_ORGANIZATION'
    | 'PROVIDER_MOVED_LOCATION'
    | 'LICENSE_STATE_CHANGED'
    | 'BOARD_CERT_STATUS_CHANGED'
    | 'SOURCE_STALE'
    | 'SOURCE_DISAPPEARED';
  claimType: string;
  previous: unknown;
  current: unknown;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  fieldPath?: string;
}

export interface FullIngestionReport {
  npi: string;
  triggeredAt: string;
  durationMs: number;
  sourcesRun: number;
  sourcesOk: number;
  sourcesFailed: number;
  claimsTotal: number;
  deltaEvents: DeltaEvent[];
  results: IngestionResult[];
  identity: CanonicalIdentitySummary | null;
}

type SourceFetchResult = Readonly<{
  raw: unknown;
  checksum: string;
  fetchedAt: string;
  sourceUrl: string;
  fetchHeaders: Record<string, string>;
}>;

type ParsedSourceResult = Readonly<{
  status: 'SUCCESS' | 'SKIPPED';
  claims: readonly NormalizedClaim[];
  receipts: readonly VerificationReceipt[];
  matchingStrategy: string;
  mergeReason?: string;
  conflictReason?: string;
}>;

type ExistingArtifactRecord = Readonly<{
  id: string;
  checksum: string;
  rawPayload: Prisma.JsonValue | null;
}>;

type DeltaEventWithLineage = DeltaEvent & Readonly<{
  previousClaimId?: string | null;
  currentClaimId?: string | null;
  trustTier?: EvidenceTier | null;
  matchingStrategy?: string;
  mergeReason?: string;
  conflictReason?: string;
}>;

type PersistableDeltaEventWithLineage = DeltaEventWithLineage & Readonly<{
  type:
    | 'CLAIM_ADDED'
    | 'CLAIM_CHANGED'
    | 'CLAIM_EXPIRED'
    | 'EXCLUSION_DETECTED'
    | 'LICENSE_STATUS_CHANGED'
    | 'NEW_SANCTION_HIT'
    | 'NEW_PAYMENT_RELATIONSHIP'
    | 'PROVIDER_MOVED_ORGANIZATION'
    | 'PROVIDER_MOVED_LOCATION'
    | 'LICENSE_STATE_CHANGED'
    | 'BOARD_CERT_STATUS_CHANGED';
}>;

type ClaimTransition = Readonly<{
  claimId: string;
  status: 'SUPERSEDED' | 'EXPIRED';
  supersededByClaimId?: string | null;
  expiresAt?: string | null;
}>;

type ClaimComparisonResult = Readonly<{
  claims: readonly NormalizedClaim[];
  deltaEvents: readonly DeltaEventWithLineage[];
  transitions: readonly ClaimTransition[];
}>;

type SourceHandler = (npi: string, observedAt: string) => Promise<IngestionResult>;

type IdentityPipelinePrismaClient = {
  sourceRun: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  fetchJob: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  parseJob: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  claimDerivationJob: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  deltaDetectionJob: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  alertJob: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  sourceRecord: {
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  verificationArtifact: {
    findFirst(args: Record<string, unknown>): Promise<ExistingArtifactRecord | null>;
    create(args: Record<string, unknown>): Promise<{ id: string }>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  auditEvent: {
    create(args: Record<string, unknown>): Promise<unknown>;
  };
};

const identityPrisma = prisma as unknown as IdentityPipelinePrismaClient;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function deterministicHex(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isPersistableDeltaEvent(event: DeltaEventWithLineage): event is PersistableDeltaEventWithLineage {
  return event.type !== 'SOURCE_STALE' && event.type !== 'SOURCE_DISAPPEARED';
}

function deterministicUuid(seed: string): string {
  const hex = deterministicHex(seed);
  const variant = ['8', '9', 'a', 'b'][parseInt(hex.slice(16, 17), 16) % 4];

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return { value };
}

function computeRefreshExpiry(sourceId: string, timestamp: string): string | null {
  const source = getSource(sourceId);
  if (!source) {
    return null;
  }

  const base = Date.parse(timestamp);
  if (!Number.isFinite(base)) {
    return null;
  }

  return new Date(base + source.refreshSlaHours * 60 * 60 * 1000).toISOString();
}

function extractClaimsFromArtifact(artifact: ExistingArtifactRecord): {
  claims: NormalizedClaim[];
  receipts: VerificationReceipt[];
} {
  const rawPayload = asObject(artifact.rawPayload);
  const sourceUrl =
    typeof rawPayload._sourceUrl === 'string' && rawPayload._sourceUrl.length > 0
      ? rawPayload._sourceUrl
      : undefined;
  const retrievedAt =
    typeof rawPayload._retrievedAt === 'string' && rawPayload._retrievedAt.length > 0
      ? rawPayload._retrievedAt
      : undefined;

  return normalizeEvidenceBundle({
    claims: ((rawPayload._claims ?? []) as NormalizedClaim[]).map((claim) => ({
      ...claim,
      artifactId: claim.artifactId || artifact.id,
      artifactChecksum: claim.artifactChecksum || artifact.checksum,
      source_id: claim.source_id || claim.sourceId,
      source_url: claim.source_url || sourceUrl,
      retrieved_at: claim.retrieved_at || retrievedAt || claim.derivedAt || claim.observedAt,
      raw_artifact_ref: claim.raw_artifact_ref || claim.artifactId || artifact.id,
      checksum: claim.checksum || claim.artifactChecksum || artifact.checksum,
      claim_type: claim.claim_type || claim.claimType,
      match_confidence: claim.match_confidence || claim.confidence,
    })),
    receipts: ((rawPayload._receipts ?? []) as VerificationReceipt[]).map((receipt) => ({
      ...receipt,
      source_artifact_id: receipt.source_artifact_id || artifact.id,
      source_url: receipt.source_url || sourceUrl,
      retrieved_at: receipt.retrieved_at || retrievedAt || receipt.observed_at,
      raw_artifact_ref: receipt.raw_artifact_ref || receipt.source_artifact_id || artifact.id,
      checksum: receipt.checksum || artifact.checksum,
    })),
  });
}

function computeIdentityIndexConfidence(claims: readonly NormalizedClaim[]): number {
  if (claims.length === 0) {
    return 0;
  }

  const weightedScore = claims.reduce((total, claim) => {
    if (claim.tier === 'GOLD') return total + 1;
    if (claim.tier === 'SILVER') return total + 0.66;
    return total + 0.33;
  }, 0);

  return Number((weightedScore / claims.length).toFixed(2));
}

async function updateSourceRun(
  sourceRunId: string,
  status: IdentityIngestionStatus,
  data?: {
    lastError?: string | null;
    quarantineReason?: string | null;
    runSummary?: Record<string, unknown>;
    completedAt?: Date | null;
  },
): Promise<void> {
  await identityPrisma.sourceRun.update({
    where: { id: sourceRunId },
    data: {
      status,
      ...(typeof data?.lastError !== 'undefined' ? { lastError: data.lastError } : {}),
      ...(typeof data?.quarantineReason !== 'undefined'
        ? { quarantineReason: data.quarantineReason }
        : {}),
      ...(typeof data?.completedAt !== 'undefined' ? { completedAt: data.completedAt } : {}),
      ...(data?.runSummary ? { runSummary: toJsonValue(data.runSummary) } : {}),
    },
  });
}

async function findExistingArtifact(
  npi: string,
  sourceId: string,
  checksum: string,
): Promise<ExistingArtifactRecord | null> {
  return identityPrisma.verificationArtifact.findFirst({
    where: { npi, source: sourceId, checksum },
    select: { id: true, checksum: true, rawPayload: true },
  });
}

async function storeArtifact(input: {
  artifactId: string;
  npi: string;
  sourceId: string;
  raw: unknown;
  checksum: string;
  claims: readonly NormalizedClaim[];
  receipts: readonly VerificationReceipt[];
  fetchedAt: string;
  observedAt: string;
  sourceUrl: string;
  fetchHeaders: Record<string, string>;
  sourceRunId: string;
  sourceRecordId?: string;
  parserVersion: string;
  matchingStrategy: string;
  status: 'ACTIVE' | 'NOT_FOUND';
  mergeReason?: string;
  conflictReason?: string;
}): Promise<{ id: string }> {
  const source = getSource(input.sourceId);
  const rawPayload = {
    ...asObject(input.raw),
    _sourceId: input.sourceId,
    _sourceUrl: input.sourceUrl,
    _sourceTier: source?.tier ?? 'BRONZE',
    _parserVersion: input.parserVersion,
    _claims: input.claims,
    _receipts: input.receipts,
    _ingestedAt: input.observedAt,
    _retrievedAt: input.fetchedAt,
    _sourceRunId: input.sourceRunId,
    _sourceRecordId: input.sourceRecordId ?? null,
  };

  const artifact = await identityPrisma.verificationArtifact.create({
    data: {
      id: input.artifactId,
      npi: input.npi,
      source: input.sourceId,
      status: input.status,
      artifactType: 'SOURCE_CAPTURE',
      parserVersion: input.parserVersion,
      matchingStrategy: input.matchingStrategy,
      trustTier: source?.tier ?? 'BRONZE',
      mergeReason: input.mergeReason ?? null,
      conflictReason: input.conflictReason ?? null,
      sourceRunId: input.sourceRunId,
      sourceRecordId: input.sourceRecordId ?? null,
      sourceUrl: input.sourceUrl,
      fetchHeaders: toJsonValue(input.fetchHeaders),
      fetchedAt: new Date(input.fetchedAt),
      observedAt: new Date(input.observedAt),
      rawPayload: toJsonValue(rawPayload),
      checksum: input.checksum,
      claimHashes: toJsonValue(
        input.claims.map((claim) => ({
          claimId: claim.claimId,
          claimType: claim.claimType,
        })),
      ),
      lifecycleState: 'active',
      verifiedAt: new Date(input.observedAt),
      expiresAt: computeRefreshExpiry(input.sourceId, input.observedAt)
        ? new Date(computeRefreshExpiry(input.sourceId, input.observedAt)!)
        : null,
    },
    select: { id: true },
  });

  return { id: artifact.id };
}

async function fetchNppes(npi: string): Promise<SourceFetchResult> {
  const sourceUrl = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`;
  const resp = await fetch(sourceUrl, { headers: { Accept: 'application/json' } });
  if (!resp.ok) {
    throw new Error(`NPPES API returned ${resp.status}`);
  }

  const raw = await resp.json();
  return {
    raw,
    checksum: checksumOf(raw),
    fetchedAt: new Date().toISOString(),
    sourceUrl,
    fetchHeaders: headersToObject(resp.headers),
  };
}

async function fetchOig(input: LookupProviderInput): Promise<SourceFetchResult> {
  // The OIG NPI-based REST API endpoint is permanently dead (returns 404).
  // Real exclusion data comes from the monthly LEIE bulk CSV, cached in memory
  // and refreshed every 24h via leieCache.ts.
  const sourceUrl = 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv (cached)';
  try {
    const result = await leieLookupProvider(input);

    if (result.cacheAge === 'unavailable') {
      const raw = {
        verdict: 'UNCHECKED' as const,
        matchType: 'UNCHECKED' as const,
        matchConfidence: 'UNCERTAIN' as const,
        matchScore: null,
        matchedFields: [],
        excluded: false,
        sourceLatency: result.sourceLatency,
        dataFreshness: 'MONTHLY',
        dataVersion: result.dataVersion,
        leieVersionDate: result.leieVersionDate,
        _cacheUnavailable: true,
      };
      return {
        raw,
        checksum: checksumOf({ npi: input.npi, status: 'CACHE_UNAVAILABLE', dataVersion: result.dataVersion }),
        fetchedAt: result.checkedAt,
        sourceUrl,
        fetchHeaders: {},
      };
    }

    const raw = {
      excluded: result.excluded,
      verdict: result.verdict,
      matchType: result.matchType,
      matchConfidence: result.matchConfidence,
      matchScore: result.matchScore,
      matchedFields: result.matchedFields,
      exclusionType: result.entry?.exclusionType || null,
      exclusionDate: result.entry?.exclusionDate || null,
      reinstatementDate: result.entry?.reinstatementDate || null,
      waiverState: result.entry?.waiverState || null,
      source: 'LEIE_CSV',
      cacheAge: result.cacheAge,
      dataVersion: result.dataVersion,
      leieVersionDate: result.leieVersionDate,
      sourceLatency: result.sourceLatency,
      dataFreshness: 'MONTHLY',
      state: result.entry?.state || null,
      specialty: result.entry?.specialty || null,
    };

    return {
      raw,
      checksum: checksumOf(raw),
      fetchedAt: result.checkedAt,
      sourceUrl,
      fetchHeaders: {},
    };
  } catch (err) {
    log('warn', 'identityPipeline: OIG LEIE cache lookup failed', { npi: input.npi, error: String(err) });
    const raw = {
      verdict: 'UNCHECKED' as const,
      matchType: 'UNCHECKED' as const,
      matchConfidence: 'UNCERTAIN' as const,
      matchScore: null,
      matchedFields: [],
      excluded: false,
      sourceLatency: 'MONTHLY' as const,
      dataFreshness: 'MONTHLY',
      leieVersionDate: null,
      _cacheUnavailable: true,
    };
    return {
      raw,
      checksum: checksumOf({ npi: input.npi, status: 'CACHE_ERROR' }),
      fetchedAt: new Date().toISOString(),
      sourceUrl,
      fetchHeaders: {},
    };
  }
}

async function fetchPecos(npi: string): Promise<SourceFetchResult> {
  const sourceUrl = buildPecosSingleProviderQueryUrl(npi);

  try {
    const resp = await fetch(sourceUrl, { headers: { Accept: 'application/json' } });
    if (!resp.ok) {
      throw new Error(`PECOS API ${resp.status}`);
    }

    const data = (await resp.json()) as unknown[];
    const fetchedAt = new Date().toISOString();
    const row =
      Array.isArray(data) && data.length > 0 ? (data[0] as Record<string, unknown>) : null;
    const raw = buildPecosFetchedRecord({
      npi,
      row,
      fetchedAt,
      lastModified: resp.headers.get('last-modified'),
    });

    return {
      raw,
      checksum: checksumOf(raw),
      fetchedAt,
      sourceUrl,
      fetchHeaders: headersToObject(resp.headers),
    };
  } catch (error) {
    log('warn', 'identityPipeline: PECOS fetch failed', { npi, error: String(error) });
    const raw = buildPecosFetchedRecord({
      npi,
      fetchedAt: new Date().toISOString(),
      unavailable: true,
    });

    return {
      raw,
      checksum: checksumOf({ npi, status: 'PECOS_UNAVAILABLE' }),
      fetchedAt: new Date().toISOString(),
      sourceUrl,
      fetchHeaders: {},
    };
  }
}

function deltaSeverityForClaim(
  claimType: string,
  currentValue: unknown,
): DeltaEvent['severity'] {
  const value = asObject(currentValue);

  if (claimType === 'EXCLUSION_STATUS') {
    return value.excluded === true ? 'CRITICAL' : 'HIGH';
  }

  if (claimType === 'LICENSE' || claimType === 'NURSING_LICENSE') {
    const status = typeof value.licenseStatus === 'string' ? value.licenseStatus.toUpperCase() : 'UNKNOWN';
    if (status === 'REVOKED') return 'CRITICAL';
    if (status === 'SUSPENDED' || status === 'EXPIRED') return 'HIGH';
    return 'HIGH';
  }

  if (claimType === 'BOARD_CERTIFICATION') {
    return 'MEDIUM';
  }

  if (
    claimType === 'INDUSTRY_PAYMENT'
    || claimType === 'OWNERSHIP_INTEREST'
    || claimType === 'RESEARCH_PAYMENT'
  ) {
    return 'LOW';
  }

  if (
    claimType === 'NPI_IDENTITY'
    || claimType === 'PERSONAL_IDENTITY'
    || claimType === 'ENROLLMENT_STATUS'
  ) {
    return 'HIGH';
  }

  if (claimType === 'SPECIALTY' || claimType === 'PRACTICE_LOCATION' || claimType === 'MAILING_ADDRESS') {
    return 'MEDIUM';
  }

  return 'LOW';
}

function claimValueChanged(left: unknown, right: unknown): boolean {
  return deterministicHex(left) !== deterministicHex(right);
}

function firstChangedField(
  previousValue: Record<string, unknown>,
  currentValue: Record<string, unknown>,
  fields: readonly string[],
): string | undefined {
  return fields.find((field) => claimValueChanged(previousValue[field] ?? null, currentValue[field] ?? null));
}

function normalizeFamilyPart(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim().toUpperCase();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function stableClaimOrder(left: NormalizedClaim, right: NormalizedClaim): number {
  return left.claimId.localeCompare(right.claimId);
}

function computeClaimFamilyKey(claim: NormalizedClaim): string {
  const value = asObject(claim.value);
  const parts = [claim.sourceId, claim.claimType];

  switch (claim.claimType) {
    case 'NPI_IDENTITY':
    case 'PERSONAL_IDENTITY':
    case 'ENROLLMENT_STATUS':
    case 'ORDER_REFERRAL':
    case 'EXCLUSION_STATUS':
    case 'BOARD_CERT_FLAG':
    case 'CITATION_METRIC':
      return parts.join('|');
    case 'AUTHORITY_UNAVAILABLE':
      return [...parts, normalizeFamilyPart(value.targetDomain), normalizeFamilyPart(value.jurisdiction)].join('|');
    case 'SPECIALTY':
      return [...parts, normalizeFamilyPart(value.state), normalizeFamilyPart(value.licenseNumber), normalizeFamilyPart(value.isPrimary)].join('|');
    case 'PRACTICE_LOCATION':
    case 'MAILING_ADDRESS':
      return [...parts, normalizeFamilyPart(value.addressType), normalizeFamilyPart(value.phone), normalizeFamilyPart(value.fax)].join('|');
    case 'ENDPOINT':
      return [...parts, normalizeFamilyPart(value.endpointType), normalizeFamilyPart(value.endpoint)].join('|');
    case 'GROUP_AFFILIATION':
    case 'INSTITUTION_AFFILIATION':
      return [...parts, normalizeFamilyPart(value.institution), normalizeFamilyPart(value.affiliationType)].join('|');
    case 'LICENSE':
    case 'LICENSE_DISCIPLINE':
    case 'NURSING_LICENSE':
    case 'NURSING_DISCIPLINE':
      return [...parts, normalizeFamilyPart(value.state), normalizeFamilyPart(value.licenseNumber), normalizeFamilyPart(value.source)].join('|');
    case 'BOARD_CERTIFICATION':
      return [...parts, normalizeFamilyPart(value.certifyingBoard), normalizeFamilyPart(value.specialty)].join('|');
    case 'TRAINING_COMPLETION':
      return [...parts, normalizeFamilyPart(value.institution), normalizeFamilyPart(value.programName), normalizeFamilyPart(value.trainingType)].join('|');
    case 'PUBLICATION':
      return [...parts, normalizeFamilyPart(value.openAlexId), normalizeFamilyPart(value.pubmedId), normalizeFamilyPart(value.title)].join('|');
    case 'CLINICAL_TRIAL':
      return [...parts, normalizeFamilyPart(value.nctId), normalizeFamilyPart(value.role)].join('|');
    case 'INDUSTRY_PAYMENT':
    case 'OWNERSHIP_INTEREST':
    case 'RESEARCH_PAYMENT':
      return [...parts, normalizeFamilyPart(value.paymentYear)].join('|');
    default:
      return [...parts, claim.claimId].join('|');
  }
}

export function compareClaimSnapshots(input: {
  priorClaims: readonly NormalizedClaim[];
  newClaims: readonly NormalizedClaim[];
  observedAt: string;
  matchingStrategy: string;
  mergeReason?: string;
  conflictReason?: string;
}): ClaimComparisonResult {
  const events: DeltaEventWithLineage[] = [];
  const transitions: ClaimTransition[] = [];
  const claims = input.newClaims.map((claim) => ({ ...claim }));
  const claimsById = new Map(claims.map((claim) => [claim.claimId, claim] as const));
  const priorFamilies = new Map<string, NormalizedClaim[]>();
  const newFamilies = new Map<string, NormalizedClaim[]>();

  for (const claim of input.priorClaims) {
    const familyKey = computeClaimFamilyKey(claim);
    const existing = priorFamilies.get(familyKey) ?? [];
    existing.push(claim);
    priorFamilies.set(familyKey, existing);
  }

  for (const claim of claims) {
    const familyKey = computeClaimFamilyKey(claim);
    const existing = newFamilies.get(familyKey) ?? [];
    existing.push(claim);
    newFamilies.set(familyKey, existing);
  }

  const familyKeys = new Set([...priorFamilies.keys(), ...newFamilies.keys()]);

  for (const familyKey of familyKeys) {
    const priorFamily = [...(priorFamilies.get(familyKey) ?? [])].sort(stableClaimOrder);
    const newFamily = [...(newFamilies.get(familyKey) ?? [])].sort(stableClaimOrder);
    const remainingPrior = [...priorFamily];
    const remainingNew = [...newFamily];

    for (let index = remainingNew.length - 1; index >= 0; index -= 1) {
      const nextClaim = remainingNew[index]!;
      const priorIndex = remainingPrior.findIndex((priorClaim) => priorClaim.claimId === nextClaim.claimId);
      if (priorIndex >= 0) {
        remainingNew.splice(index, 1);
        remainingPrior.splice(priorIndex, 1);
      }
    }

    const pairedCount = Math.min(remainingPrior.length, remainingNew.length);
    for (let index = 0; index < pairedCount; index += 1) {
      const priorClaim = remainingPrior[index]!;
      const nextClaim = remainingNew[index]!;
      const targetClaim = claimsById.get(nextClaim.claimId);
      if (!targetClaim) {
        continue;
      }

      if (!claimValueChanged(priorClaim.value, nextClaim.value)) {
        continue;
      }

      targetClaim.supersedes = priorClaim.claimId;

      const priorValue = asObject(priorClaim.value);
      const currentValue = asObject(nextClaim.value);
      let type: DeltaEvent['type'] = 'CLAIM_CHANGED';
      let fieldPath: string | undefined;

      if (nextClaim.claimType === 'EXCLUSION_STATUS') {
        type = currentValue.excluded === true && priorValue.excluded !== true
          ? 'NEW_SANCTION_HIT'
          : 'EXCLUSION_DETECTED';
        fieldPath = 'excluded';
      } else if (nextClaim.claimType === 'LICENSE' || nextClaim.claimType === 'NURSING_LICENSE') {
        if (priorValue.state !== currentValue.state) {
          type = 'LICENSE_STATE_CHANGED';
          fieldPath = 'state';
        } else if (priorValue.licenseStatus !== currentValue.licenseStatus) {
          type = 'LICENSE_STATUS_CHANGED';
          fieldPath = 'licenseStatus';
        }
      } else if (nextClaim.claimType === 'BOARD_CERTIFICATION') {
        type = 'BOARD_CERT_STATUS_CHANGED';
        fieldPath = 'certificationStatus';
      } else if (nextClaim.claimType === 'PRACTICE_LOCATION' || nextClaim.claimType === 'MAILING_ADDRESS') {
        type = 'PROVIDER_MOVED_LOCATION';
        fieldPath = firstChangedField(priorValue, currentValue, ['address1', 'address2', 'city', 'state', 'zip']);
      } else if (nextClaim.claimType === 'INSTITUTION_AFFILIATION' || nextClaim.claimType === 'GROUP_AFFILIATION') {
        type = 'PROVIDER_MOVED_ORGANIZATION';
        fieldPath = firstChangedField(priorValue, currentValue, ['institution', 'department', 'title', 'affiliationType']);
      } else if (
        nextClaim.claimType === 'INDUSTRY_PAYMENT'
        || nextClaim.claimType === 'OWNERSHIP_INTEREST'
        || nextClaim.claimType === 'RESEARCH_PAYMENT'
      ) {
        type = 'NEW_PAYMENT_RELATIONSHIP';
        fieldPath = firstChangedField(priorValue, currentValue, ['totalAmount', 'topPayers', 'paymentTypes']);
      }

      events.push({
        type,
        claimType: nextClaim.claimType,
        previous: priorClaim.value,
        current: nextClaim.value,
        severity: deltaSeverityForClaim(nextClaim.claimType, nextClaim.value),
        ...(fieldPath ? { fieldPath } : {}),
        previousClaimId: priorClaim.claimId,
        currentClaimId: nextClaim.claimId,
        trustTier: nextClaim.tier,
        matchingStrategy: input.matchingStrategy,
        mergeReason: input.mergeReason,
        conflictReason: input.conflictReason,
      });
      transitions.push({
        claimId: priorClaim.claimId,
        status: 'SUPERSEDED',
        supersededByClaimId: nextClaim.claimId,
        expiresAt: input.observedAt,
      });
    }

    const unmatchedNew = remainingNew.slice(pairedCount);
    for (const claim of unmatchedNew) {
      const addedValue = asObject(claim.value);
      const addedType: DeltaEvent['type'] =
        claim.claimType === 'EXCLUSION_STATUS' && addedValue.excluded === true
          ? 'NEW_SANCTION_HIT'
          : claim.claimType === 'INDUSTRY_PAYMENT'
              || claim.claimType === 'OWNERSHIP_INTEREST'
              || claim.claimType === 'RESEARCH_PAYMENT'
            ? 'NEW_PAYMENT_RELATIONSHIP'
            : 'CLAIM_ADDED';
      events.push({
        type: addedType,
        claimType: claim.claimType,
        previous: null,
        current: claim.value,
        severity: deltaSeverityForClaim(claim.claimType, claim.value),
        currentClaimId: claim.claimId,
        trustTier: claim.tier,
        matchingStrategy: input.matchingStrategy,
        mergeReason: input.mergeReason,
        conflictReason: input.conflictReason,
      });
    }

    const unmatchedPrior = remainingPrior.slice(pairedCount);
    for (const priorClaim of unmatchedPrior) {
      events.push({
        type: 'CLAIM_EXPIRED',
        claimType: priorClaim.claimType,
        previous: priorClaim.value,
        current: null,
        severity: deltaSeverityForClaim(priorClaim.claimType, priorClaim.value),
        previousClaimId: priorClaim.claimId,
        currentClaimId: null,
        trustTier: priorClaim.tier,
        matchingStrategy: input.matchingStrategy,
        mergeReason: input.mergeReason,
        conflictReason: input.conflictReason,
      });
      transitions.push({
        claimId: priorClaim.claimId,
        status: 'EXPIRED',
        expiresAt: input.observedAt,
      });
    }
  }

  return {
    claims,
    deltaEvents: events,
    transitions,
  };
}

async function compareClaimsAgainstPriorArtifact(
  npi: string,
  sourceId: string,
  newArtifactId: string,
  newClaims: readonly NormalizedClaim[],
  observedAt: string,
  matchingStrategy: string,
  mergeReason?: string,
  conflictReason?: string,
): Promise<ClaimComparisonResult> {
  const prior = await identityPrisma.verificationArtifact.findFirst({
    where: {
      npi,
      source: sourceId,
      lifecycleState: 'active',
      id: { not: newArtifactId },
    },
    orderBy: { createdAt: 'desc' },
    select: { rawPayload: true },
  });

  if (!prior) {
    return {
      claims: newClaims,
      deltaEvents: [],
      transitions: [],
    };
  }

  const priorClaims = normalizeEvidenceBundle({
    claims: ((asObject(prior.rawPayload)._claims ?? []) as NormalizedClaim[]),
    receipts: [],
  }).claims;

  return compareClaimSnapshots({
    priorClaims,
    newClaims,
    observedAt,
    matchingStrategy,
    mergeReason,
    conflictReason,
  });
}

async function executeSourceIngestion(input: {
  npi: string;
  observedAt: string;
  sourceId: string;
  parserVersion: string;
  matchingStrategy: string;
  fetchSource: (npi: string) => Promise<SourceFetchResult>;
  parseSource: (args: {
    npi: string;
    raw: unknown;
    artifactId: string;
    checksum: string;
    observedAt: string;
    sourceUrl: string;
    retrievedAt: string;
  }) => ParsedSourceResult;
}): Promise<IngestionResult> {
  const startedAtMs = Date.now();

  // ── Source governance enforcement ──────────────────────────────────────
  // RED-risk or human-lookup-only sources are blocked at the pipeline level.
  try {
    const { enforceSourcePolicy: enforce } = await import('./sourceGovernance');
    const violations = enforce(input.sourceId);
    const blocks = violations.filter(v => v.severity === 'BLOCK');
    if (blocks.length > 0) {
      log('warn', 'identityPipeline: source BLOCKED by governance policy', {
        sourceId: input.sourceId, npi: input.npi,
        violation: blocks[0]!.message,
      });
      return {
        npi: input.npi, source: input.sourceId, status: 'SKIPPED',
        artifactId: null, claimsEmitted: 0, deltaEvents: [],
        latencyMs: Date.now() - startedAtMs,
        error: `GOVERNANCE BLOCK: ${blocks[0]!.message}`,
      };
    }
  } catch {
    // Governance module not available — proceed with caution
  }
  const sourceRunIdempotencyKey = deterministicHex({
    sourceId: input.sourceId,
    npi: input.npi,
    observedAt: input.observedAt,
  });
  const sourceRun = await identityPrisma.sourceRun.create({
    data: {
      sourceId: input.sourceId,
      subjectNpi: input.npi,
      idempotencyKey: sourceRunIdempotencyKey,
      status: 'QUEUED',
      runSummary: toJsonValue({ stage: 'QUEUED' }),
    },
    select: { id: true },
  });

  const fetchJob = await identityPrisma.fetchJob.create({
    data: {
      sourceRunId: sourceRun.id,
      state: 'QUEUED',
      idempotencyKey: deterministicHex({
        sourceRunId: sourceRun.id,
        phase: 'fetch',
      }),
    },
    select: { id: true },
  });
  const parseJob = await identityPrisma.parseJob.create({
    data: {
      sourceRunId: sourceRun.id,
      state: 'QUEUED',
      idempotencyKey: deterministicHex({
        sourceRunId: sourceRun.id,
        phase: 'parse',
      }),
      parserVersion: input.parserVersion,
    },
    select: { id: true },
  });
  const claimDerivationJob = await identityPrisma.claimDerivationJob.create({
    data: {
      sourceRunId: sourceRun.id,
      state: 'QUEUED',
      idempotencyKey: deterministicHex({
        sourceRunId: sourceRun.id,
        phase: 'claim-derivation',
      }),
    },
    select: { id: true },
  });
  const deltaDetectionJob = await identityPrisma.deltaDetectionJob.create({
    data: {
      sourceRunId: sourceRun.id,
      state: 'QUEUED',
      idempotencyKey: deterministicHex({
        sourceRunId: sourceRun.id,
        phase: 'delta-detection',
      }),
    },
    select: { id: true },
  });
  const alertJob = await identityPrisma.alertJob.create({
    data: {
      sourceRunId: sourceRun.id,
      state: 'QUEUED',
      idempotencyKey: deterministicHex({
        sourceRunId: sourceRun.id,
        phase: 'alert',
      }),
    },
    select: { id: true },
  });

  let sourceRecordId: string | undefined;
  let artifactId: string | null = null;

  try {
    await updateSourceRun(sourceRun.id, 'FETCHING', {
      runSummary: { stage: 'FETCHING' },
    });
    await identityPrisma.fetchJob.update({
      where: { id: fetchJob.id },
      data: { state: 'FETCHING', startedAt: new Date() },
    });

    const fetched = await input.fetchSource(input.npi);

    const sourceRecord = await persistSourceRecord({
      sourceRunId: sourceRun.id,
      sourceId: input.sourceId,
      subjectNpi: input.npi,
      sourceRecordKey: input.npi,
      sourceUrl: fetched.sourceUrl,
      fetchHeaders: fetched.fetchHeaders,
      checksum: fetched.checksum,
      trustTier: getSource(input.sourceId)?.tier ?? 'BRONZE',
      fetchedAt: fetched.fetchedAt,
      observedAt: input.observedAt,
      expiresAt: computeRefreshExpiry(input.sourceId, input.observedAt) ?? undefined,
      parserVersion: input.parserVersion,
      matchingStrategy: input.matchingStrategy,
      status: 'FETCHED',
      metadata: {
        sourceUrl: fetched.sourceUrl,
      },
    });
    sourceRecordId = sourceRecord.id;

    await identityPrisma.fetchJob.update({
      where: { id: fetchJob.id },
      data: {
        state: 'FETCHED',
        checksum: fetched.checksum,
        sourceUrl: fetched.sourceUrl,
        fetchHeaders: toJsonValue(fetched.fetchHeaders),
        completedAt: new Date(),
      },
    });
    await updateSourceRun(sourceRun.id, 'FETCHED', {
      runSummary: {
        stage: 'FETCHED',
        checksum: fetched.checksum,
        sourceRecordId,
      },
    });

    const existingArtifact = await findExistingArtifact(input.npi, input.sourceId, fetched.checksum);
    let parsed: ParsedSourceResult;

    if (existingArtifact) {
      artifactId = existingArtifact.id;
      const extracted = extractClaimsFromArtifact(existingArtifact);
      parsed =
        extracted.claims.length > 0 || extracted.receipts.length > 0
          ? {
              status: 'SUCCESS',
              claims: extracted.claims,
              receipts: extracted.receipts,
              matchingStrategy: input.matchingStrategy,
              mergeReason: 'Reused append-only artifact with matching checksum',
            }
          : input.parseSource({
              npi: input.npi,
              raw: existingArtifact.rawPayload,
              artifactId: existingArtifact.id,
              checksum: existingArtifact.checksum,
              observedAt: input.observedAt,
              sourceUrl: fetched.sourceUrl,
              retrievedAt: fetched.fetchedAt,
            });
    } else {
      artifactId = deterministicUuid(`${input.sourceId}:${input.npi}:${fetched.checksum}`);
      const parsedBundle = input.parseSource({
        npi: input.npi,
        raw: fetched.raw,
        artifactId,
        checksum: fetched.checksum,
        observedAt: input.observedAt,
        sourceUrl: fetched.sourceUrl,
        retrievedAt: fetched.fetchedAt,
      });
      const normalizedBundle = normalizeEvidenceBundle({
        claims: parsedBundle.claims,
        receipts: parsedBundle.receipts,
      });
      parsed = {
        ...parsedBundle,
        claims: normalizedBundle.claims,
        receipts: normalizedBundle.receipts,
      };

      await storeArtifact({
        artifactId,
        npi: input.npi,
        sourceId: input.sourceId,
        raw: fetched.raw,
        checksum: fetched.checksum,
        claims: parsed.claims,
        receipts: parsed.receipts,
        fetchedAt: fetched.fetchedAt,
        observedAt: input.observedAt,
        sourceUrl: fetched.sourceUrl,
        fetchHeaders: fetched.fetchHeaders,
        sourceRunId: sourceRun.id,
        sourceRecordId,
        parserVersion: input.parserVersion,
        matchingStrategy: parsed.matchingStrategy,
        status: parsed.status === 'SKIPPED' ? 'NOT_FOUND' : 'ACTIVE',
        mergeReason: parsed.mergeReason,
        conflictReason: parsed.conflictReason,
      });
    }

    if (existingArtifact) {
      const normalizedBundle = normalizeEvidenceBundle({
        claims: parsed.claims,
        receipts: parsed.receipts,
      });
      parsed = {
        ...parsed,
        claims: normalizedBundle.claims,
        receipts: normalizedBundle.receipts,
      };
    }

    await identityPrisma.parseJob.update({
      where: { id: parseJob.id },
      data: {
        sourceRecordId,
        verificationArtifactId: artifactId,
        state: 'PARSED',
        parserVersion: input.parserVersion,
        completedAt: new Date(),
      },
    });
    await updateSourceRun(sourceRun.id, 'PARSED', {
      runSummary: {
        stage: 'PARSED',
        artifactId,
        claimsEmitted: parsed.claims.length,
      },
    });

    const claimComparison =
      existingArtifact || parsed.status === 'SKIPPED'
        ? {
            claims: parsed.claims,
            deltaEvents: [],
            transitions: [],
          }
        : await compareClaimsAgainstPriorArtifact(
            input.npi,
            input.sourceId,
            artifactId,
            parsed.claims,
            input.observedAt,
            parsed.matchingStrategy,
            parsed.mergeReason,
            parsed.conflictReason,
          );

    const claimIds = await persistClaimRecords({
      sourceRunId: sourceRun.id,
      sourceRecordId,
      verificationArtifactId: artifactId,
      subjectNpi: input.npi,
      claims: claimComparison.claims,
      matchingStrategy: parsed.matchingStrategy,
      mergeReason: parsed.mergeReason,
      conflictReason: parsed.conflictReason,
    });
    for (const transition of claimComparison.transitions) {
      await updateClaimRecordState({
        claimId: transition.claimId,
        subjectNpi: input.npi,
        status: transition.status,
        supersededByClaimId: transition.supersededByClaimId,
        expiresAt: transition.expiresAt,
      });
    }
    await persistVerificationReceiptRecords({
      sourceRunId: sourceRun.id,
      sourceRecordId,
      verificationArtifactId: artifactId,
      subjectNpi: input.npi,
      claims: claimComparison.claims,
      receipts: parsed.receipts,
      matchingStrategy: parsed.matchingStrategy,
    });
    const materializedCredentials = await materializeClaimsToVcvCredentials({
      subjectNpi: input.npi,
      verificationArtifactId: artifactId,
      claims: claimComparison.claims,
      receipts: parsed.receipts,
    });

    await identityPrisma.claimDerivationJob.update({
      where: { id: claimDerivationJob.id },
      data: {
        sourceRecordId,
        verificationArtifactId: artifactId,
        state: 'NORMALIZED',
        completedAt: new Date(),
      },
    });
    await updateSourceRun(sourceRun.id, 'NORMALIZED', {
      runSummary: {
        stage: 'NORMALIZED',
        artifactId,
        claimIds,
        credentialIds: materializedCredentials.credentialIds,
      },
    });

    let deltaEvents = [...claimComparison.deltaEvents];
    const deltaChecksums = new Map<DeltaEventWithLineage, string>();
    const persistableDeltaEvents = deltaEvents.filter(isPersistableDeltaEvent);
    const persistedDeltas = parsed.status === 'SKIPPED'
      ? []
      : await persistIdentityClaimDeltas(
          persistableDeltaEvents.map((event) => {
            const checksum = deterministicHex({
              sourceRunId: sourceRun.id,
              sourceId: input.sourceId,
              claimType: event.claimType,
              deltaType: event.type,
              previousClaimId: event.previousClaimId ?? null,
              currentClaimId: event.currentClaimId ?? null,
              previous: event.previous ?? null,
              current: event.current ?? null,
            });
            deltaChecksums.set(event, checksum);
            return {
              sourceRunId: sourceRun.id,
              sourceRecordId,
              verificationArtifactId: artifactId,
              subjectNpi: input.npi,
              sourceId: input.sourceId,
              claimType: event.claimType,
              deltaType: event.type,
              severity: event.severity,
              trustTier: event.trustTier ?? null,
              previousClaimId: event.previousClaimId ?? null,
              currentClaimId: event.currentClaimId ?? null,
              previousValue: event.previous,
              currentValue: event.current,
              matchingStrategy: event.matchingStrategy,
              mergeReason: event.mergeReason,
              conflictReason: event.conflictReason,
              observedAt: input.observedAt,
              checksum,
            };
          }),
        );

    if (parsed.status === 'SKIPPED' && !existingArtifact) {
      const skippedWatchtower = await recordSkippedSourceWatchtower({
        npi: input.npi,
        sourceId: input.sourceId,
        sourceRunId: sourceRun.id,
        sourceRecordId,
        verificationArtifactId: artifactId,
        observedAt: input.observedAt,
        matchingStrategy: parsed.matchingStrategy,
        mergeReason: parsed.mergeReason,
        conflictReason: parsed.conflictReason,
        status: parsed.status,
      });
      deltaEvents = [...skippedWatchtower.deltaEvents];
    } else if (persistedDeltas.length > 0) {
      const persistedDeltaByChecksum = new Map(
        persistedDeltas.map((delta) => [delta.checksum, delta]),
      );
      await emitWatchtowerArtifactsForPersistedDeltas({
        npi: input.npi,
        sourceId: input.sourceId,
        sourceRunId: sourceRun.id,
        sourceRecordId,
        verificationArtifactId: artifactId,
        observedAt: input.observedAt,
        events: deltaEvents.map((event) => ({
          checksum: deltaChecksums.get(event) ?? deterministicHex(event),
          persistedDeltaId:
            persistedDeltaByChecksum.get(deltaChecksums.get(event) ?? '')?.id ?? null,
          event,
        })),
      });
    }

    await identityPrisma.deltaDetectionJob.update({
      where: { id: deltaDetectionJob.id },
      data: {
        verificationArtifactId: artifactId,
        state: 'VERIFIED',
        completedAt: new Date(),
      },
    });

    await identityPrisma.alertJob.update({
      where: { id: alertJob.id },
      data: {
        verificationArtifactId: artifactId,
        state: deltaEvents.some((event) => event.severity === 'CRITICAL') ? 'ALERTED' : 'VERIFIED',
        completedAt: new Date(),
        lastError:
          deltaEvents.filter((event) => event.severity === 'CRITICAL').length > 0
            ? 'critical_identity_delta_detected'
            : null,
      },
    });

    const terminalStatus: IdentityIngestionStatus =
      deltaEvents.some((event) => event.severity === 'CRITICAL') ? 'ALERTED' : 'VERIFIED';
    await updateSourceRun(sourceRun.id, terminalStatus, {
      completedAt: new Date(),
      runSummary: {
        stage: terminalStatus,
        artifactId,
        sourceRecordId,
        claimCount: claimComparison.claims.length,
        deltaCount: deltaEvents.length,
        duplicateArtifact: Boolean(existingArtifact),
      },
    });

    return {
      npi: input.npi,
      source: input.sourceId,
      artifactId,
      sourceRunId: sourceRun.id,
      sourceRecordId,
      claimIds,
      credentialIds: materializedCredentials.credentialIds,
      claimsEmitted: claimComparison.claims.length,
      deltaEvents: deltaEvents.map(({ type, claimType, previous, current, severity, fieldPath }) => ({
        type,
        claimType,
        previous,
        current,
        severity,
        ...(fieldPath ? { fieldPath } : {}),
      })),
      status: parsed.status,
      latencyMs: Date.now() - startedAtMs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (sourceRecordId) {
      await identityPrisma.sourceRecord.update({
        where: { id: sourceRecordId },
        data: {
          status: 'QUARANTINED',
          quarantineReason: message,
        },
      }).catch(() => null);
    }

    if (artifactId) {
      await identityPrisma.verificationArtifact.update({
        where: { id: artifactId },
        data: {
          status: 'QUARANTINED',
          lifecycleState: 'quarantined',
          conflictReason: message,
        },
      }).catch(() => null);
    }

    await identityPrisma.parseJob.update({
      where: { id: parseJob.id },
      data: {
        sourceRecordId: sourceRecordId ?? null,
        verificationArtifactId: artifactId,
        state: 'QUARANTINED',
        quarantineReason: message,
        lastError: message,
        completedAt: new Date(),
      },
    }).catch(() => null);
    await identityPrisma.claimDerivationJob.update({
      where: { id: claimDerivationJob.id },
      data: {
        sourceRecordId: sourceRecordId ?? null,
        verificationArtifactId: artifactId,
        state: 'FAILED',
        lastError: message,
        completedAt: new Date(),
      },
    }).catch(() => null);
    await identityPrisma.deltaDetectionJob.update({
      where: { id: deltaDetectionJob.id },
      data: {
        verificationArtifactId: artifactId,
        state: 'FAILED',
        lastError: message,
        completedAt: new Date(),
      },
    }).catch(() => null);
    await identityPrisma.alertJob.update({
      where: { id: alertJob.id },
      data: {
        verificationArtifactId: artifactId,
        state: 'FAILED',
        lastError: message,
        completedAt: new Date(),
      },
    }).catch(() => null);
    await identityPrisma.fetchJob.update({
      where: { id: fetchJob.id },
      data: {
        lastError: message,
        completedAt: new Date(),
      },
    }).catch(() => null);
    await updateSourceRun(sourceRun.id, 'QUARANTINED', {
      lastError: message,
      quarantineReason: message,
      completedAt: new Date(),
      runSummary: {
        stage: 'QUARANTINED',
        artifactId,
        sourceRecordId,
        error: message,
      },
    }).catch(() => null);

    return {
      npi: input.npi,
      source: input.sourceId,
      artifactId,
      sourceRunId: sourceRun.id,
      sourceRecordId,
      claimsEmitted: 0,
      deltaEvents: [],
      status: 'FAILED',
      latencyMs: Date.now() - startedAtMs,
      error: message,
    };
  }
}

const handlers: Record<string, SourceHandler> = {
  NPPES_API: async (npi, observedAt) =>
    executeSourceIngestion({
      npi,
      observedAt,
      sourceId: 'NPPES_API',
      parserVersion: 'v1.2.0',
      matchingStrategy: 'NPI_EXACT',
      fetchSource: fetchNppes,
      parseSource: ({ raw, artifactId, checksum, observedAt: parsedObservedAt, sourceUrl, retrievedAt }) => {
        const apiResult = raw as { results?: unknown[] };
        const result = apiResult.results?.[0];

        if (!result) {
          return {
            status: 'SKIPPED',
            claims: [],
            receipts: [],
            matchingStrategy: 'NPI_EXACT',
            mergeReason: 'No official NPPES record returned for this NPI',
          };
        }

        const { claims, receipts } = parseNppesResult(
          npi,
          result as Parameters<typeof parseNppesResult>[1],
          artifactId,
          checksum,
          parsedObservedAt,
          { sourceUrl, retrievedAt },
        );

        return {
          status: 'SUCCESS',
          claims,
          receipts,
          matchingStrategy: 'NPI_EXACT',
          mergeReason: 'Official CMS NPI Registry exact match by NPI',
        };
      },
    }),

  OIG_LEIE: async (npi, observedAt) =>
    executeSourceIngestion({
      npi,
      observedAt,
      sourceId: 'OIG_LEIE',
      parserVersion: 'v1.2.0',
      matchingStrategy: 'NPI_EXACT',
      fetchSource: async (_npi: string) => {
        const existingClaims = await loadClaimRecordsForNpi(_npi);
        const nameValue = asObject(existingClaims.find((claim) => claim.claimType === 'PERSONAL_IDENTITY')?.value);
        const locationValue = asObject(existingClaims.find((claim) => claim.claimType === 'PRACTICE_LOCATION')?.value);
        const specialtyValue = asObject(existingClaims.find((claim) => claim.claimType === 'SPECIALTY')?.value);

        return fetchOig({
          npi: _npi,
          firstName: typeof nameValue.firstName === 'string' ? nameValue.firstName : null,
          middleName: typeof nameValue.middleName === 'string' ? nameValue.middleName : null,
          lastName: typeof nameValue.lastName === 'string' ? nameValue.lastName : null,
          state: typeof locationValue.state === 'string'
            ? locationValue.state
            : typeof specialtyValue.state === 'string'
              ? specialtyValue.state
              : null,
          specialty: typeof specialtyValue.taxonomyDescription === 'string'
            ? specialtyValue.taxonomyDescription
            : null,
        });
      },
      parseSource: ({ raw, artifactId, checksum, observedAt: parsedObservedAt, sourceUrl, retrievedAt }) => {
        const { claims, receipts } = parseOigResult(
          npi,
          raw as Parameters<typeof parseOigResult>[1],
          artifactId,
          checksum,
          parsedObservedAt,
          { sourceUrl, retrievedAt },
        );
        const oigRaw = raw as Record<string, unknown>;
        const matchType = typeof oigRaw.matchType === 'string' ? oigRaw.matchType : 'UNCHECKED';
        const matchingStrategy =
          matchType === 'STRONG_FUZZY' || matchType === 'WEAK'
            ? 'NAME_STATE_SPECIALTY'
            : matchType === 'EXACT'
              ? 'NPI_EXACT'
              : 'MANUAL_REVIEW_REQUIRED';
        const mergeReason =
          matchType === 'STRONG_FUZZY'
            ? 'LEIE possible match derived from strong fuzzy name + state + specialty review'
            : matchType === 'WEAK'
              ? 'LEIE possible match derived from weak fuzzy name review'
              : matchType === 'EXACT'
                ? 'Official OIG LEIE check tied to the requested NPI'
                : 'LEIE monthly CSV could not produce a conclusive match and remains unchecked';

        return {
          status: 'SUCCESS',
          claims,
          receipts,
          matchingStrategy,
          mergeReason,
        };
      },
    }),

  PECOS_PUBLIC: async (npi, observedAt) =>
    executeSourceIngestion({
      npi,
      observedAt,
      sourceId: 'PECOS_PUBLIC',
      parserVersion: 'v1.2.0',
      matchingStrategy: 'NPI_EXACT',
      fetchSource: fetchPecos,
      parseSource: ({ raw, artifactId, checksum, observedAt: parsedObservedAt, sourceUrl, retrievedAt }) => {
        const { claims, receipts } = parsePecosRecord(
          npi,
          raw as Parameters<typeof parsePecosRecord>[1],
          artifactId,
          checksum,
          parsedObservedAt,
          { sourceUrl, retrievedAt },
        );
        const claimState = (raw as { claimState?: string }).claimState;

        return {
          status: claimState === 'NOT_FOUND' ? 'SKIPPED' : 'SUCCESS',
          claims,
          receipts,
          matchingStrategy: 'NPI_EXACT',
          mergeReason:
            claimState === 'NOT_FOUND'
              ? 'Quarterly CMS PECOS release did not contain an enrollment record for this NPI'
              : claimState === 'UNKNOWN'
                ? 'Quarterly CMS PECOS release could not be resolved for this NPI'
                : 'Official quarterly CMS enrollment record exact match by NPI',
        };
      },
    }),

  OPEN_PAYMENTS: async (npi, observedAt) =>
    executeSourceIngestion({
      npi,
      observedAt,
      sourceId: 'OPEN_PAYMENTS',
      parserVersion: 'v1.0.0',
      matchingStrategy: 'NPI_EXACT',
      fetchSource: (_npi: string) => fetchOpenPayments(_npi),
      parseSource: ({ raw, artifactId, checksum, observedAt: parsedObservedAt, sourceUrl, retrievedAt }) => {
        const { claims, receipts } = parseOpenPayments(npi, raw, artifactId, checksum, parsedObservedAt, { sourceUrl, retrievedAt });
        return {
          status: claims.length > 0 ? 'SUCCESS' : 'SKIPPED',
          claims, receipts,
          matchingStrategy: 'NPI_EXACT',
          mergeReason: claims.length > 0
            ? 'CMS Open Payments records matched by NPI'
            : 'No Open Payments records found for this NPI',
        };
      },
    }),

  SAM_GOV: async (npi, observedAt) =>
    executeSourceIngestion({
      npi,
      observedAt,
      sourceId: 'SAM_GOV',
      parserVersion: 'v1.0.0',
      matchingStrategy: 'NAME_FUZZY',
      fetchSource: async (_npi: string) => {
        // Need name for SAM search — try to get from existing NPPES claims
        const existingClaims = await loadClaimRecordsForNpi(_npi);
        const nameClaim = existingClaims.find(c => c.claimType === 'PERSONAL_IDENTITY');
        const val = nameClaim?.value as Record<string, unknown> | undefined;
        return fetchSamGov(_npi, val?.firstName as string | undefined, val?.lastName as string | undefined);
      },
      parseSource: ({ raw, artifactId, checksum, observedAt: parsedObservedAt, sourceUrl, retrievedAt }) => {
        const { claims, receipts } = parseSamGovResult(npi, raw, artifactId, checksum, parsedObservedAt, { sourceUrl, retrievedAt });
        return {
          status: 'SUCCESS',
          claims, receipts,
          matchingStrategy: 'NAME_FUZZY',
          mergeReason: 'SAM.gov exclusion check — name-based search (requires identity verification)',
        };
      },
    }),

  DOCTORS_CLINICIANS: async (npi, observedAt) =>
    executeSourceIngestion({
      npi,
      observedAt,
      sourceId: 'DOCTORS_CLINICIANS',
      parserVersion: 'v1.0.0',
      matchingStrategy: 'NPI_EXACT',
      fetchSource: (_npi: string) => fetchDoctorsAndClinicians(_npi),
      parseSource: ({ raw, artifactId, checksum, observedAt: parsedObservedAt, sourceUrl, retrievedAt }) => {
        const { claims, receipts } = parseDoctorsAndClinicians(npi, raw, artifactId, checksum, parsedObservedAt, { sourceUrl, retrievedAt });
        return {
          status: claims.length > 0 ? 'SUCCESS' : 'SKIPPED',
          claims, receipts,
          matchingStrategy: 'NPI_EXACT',
          mergeReason: claims.length > 0
            ? 'CMS Doctors & Clinicians dataset matched by NPI'
            : 'No D&C records found for this NPI',
        };
      },
    }),

  NURSYS: async (npi, observedAt) =>
    executeSourceIngestion({
      npi,
      observedAt,
      sourceId: 'NURSYS',
      parserVersion: 'v1.0.0',
      matchingStrategy: 'NPI_EXACT',
      fetchSource: (_npi: string) => fetchNursys(_npi),
      parseSource: ({ raw, artifactId, checksum, observedAt: parsedObservedAt, sourceUrl, retrievedAt }) => {
        const { claims, receipts } = parseNursysResult(npi, raw, artifactId, checksum, parsedObservedAt, { sourceUrl, retrievedAt });
        return {
          status: 'SUCCESS',
          claims, receipts,
          matchingStrategy: 'NPI_EXACT',
          mergeReason: 'Nursys national nurse licensure database',
        };
      },
    }),

  STATE_BOARD: async (npi, observedAt) => {
    // Physician licensure launch wedge: only verify the production-enabled CA lane.
    const existingClaims = await loadClaimRecordsForNpi(npi);
    const states = extractPracticeStates(existingClaims);
    const primaryState = selectPhysicianLicensureLaunchState(states);

    if (!primaryState) {
      return {
        npi, source: 'STATE_BOARD', status: 'SKIPPED' as const,
        artifactId: null, claimsEmitted: 0, deltaEvents: [],
        latencyMs: 0,
      };
    }

    const nameClaim = existingClaims.find(c => c.claimType === 'PERSONAL_IDENTITY');
    const lastName = (nameClaim?.value as Record<string, unknown>)?.lastName as string | undefined;

    return executeSourceIngestion({
      npi,
      observedAt,
      sourceId: 'STATE_BOARD',
      parserVersion: 'v1.0.0',
      matchingStrategy: 'NPI_EXACT',
      fetchSource: (_npi: string) => fetchStateBoardLicense(_npi, primaryState, lastName),
      parseSource: ({ raw, artifactId, checksum, observedAt: parsedObservedAt, sourceUrl, retrievedAt }) => {
        const { claims, receipts } = parseStateBoardResult(npi, primaryState, raw, artifactId, checksum, parsedObservedAt, { sourceUrl, retrievedAt });
        return {
          status: claims.length > 0 ? 'SUCCESS' : 'SKIPPED',
          claims, receipts,
          matchingStrategy: 'NPI_EXACT',
          mergeReason: `State board verification for the ${primaryState} physician launch lane`,
        };
      },
    });
  },

  OPENALEX: async (npi, observedAt) => {
    const existingClaims = await loadClaimRecordsForNpi(npi);
    const nameClaim = existingClaims.find(c => c.claimType === 'PERSONAL_IDENTITY');
    const val = nameClaim?.value as Record<string, unknown> | undefined;
    if (!val?.firstName || !val?.lastName) {
      return { npi, source: 'OPENALEX', status: 'SKIPPED' as const, artifactId: null, claimsEmitted: 0, deltaEvents: [], latencyMs: 0 };
    }

    return executeSourceIngestion({
      npi, observedAt, sourceId: 'OPENALEX', parserVersion: 'v1.0.0',
      matchingStrategy: 'NAME_FUZZY',
      fetchSource: () => fetchOpenAlex(val.firstName as string, val.lastName as string),
      parseSource: ({ raw, artifactId, checksum, observedAt: o, sourceUrl, retrievedAt }) => {
        const { claims, receipts } = parseOpenAlexResult(npi, raw, artifactId, checksum, o, { sourceUrl, retrievedAt });
        return { status: claims.length > 0 ? 'SUCCESS' : 'SKIPPED', claims, receipts, matchingStrategy: 'NAME_FUZZY', mergeReason: 'OpenAlex author search by name — Silver-tier, identity verification required' };
      },
    });
  },

  CLINICAL_TRIALS: async (npi, observedAt) => {
    const existingClaims = await loadClaimRecordsForNpi(npi);
    const nameClaim = existingClaims.find(c => c.claimType === 'PERSONAL_IDENTITY');
    const val = nameClaim?.value as Record<string, unknown> | undefined;
    if (!val?.firstName || !val?.lastName) {
      return { npi, source: 'CLINICAL_TRIALS', status: 'SKIPPED' as const, artifactId: null, claimsEmitted: 0, deltaEvents: [], latencyMs: 0 };
    }

    return executeSourceIngestion({
      npi, observedAt, sourceId: 'CLINICAL_TRIALS', parserVersion: 'v1.0.0',
      matchingStrategy: 'NAME_FUZZY',
      fetchSource: () => fetchClinicalTrials(val.firstName as string, val.lastName as string),
      parseSource: ({ raw, artifactId, checksum, observedAt: o, sourceUrl, retrievedAt }) => {
        const { claims, receipts } = parseClinicalTrialsResult(npi, raw, artifactId, checksum, o, { sourceUrl, retrievedAt });
        return { status: claims.length > 0 ? 'SUCCESS' : 'SKIPPED', claims, receipts, matchingStrategy: 'NAME_FUZZY', mergeReason: 'ClinicalTrials.gov investigator search — Silver-tier, identity verification required' };
      },
    });
  },

  PUBMED: async (npi, observedAt) => {
    const existingClaims = await loadClaimRecordsForNpi(npi);
    const nameClaim = existingClaims.find(c => c.claimType === 'PERSONAL_IDENTITY');
    const val = nameClaim?.value as Record<string, unknown> | undefined;
    if (!val?.firstName || !val?.lastName) {
      return { npi, source: 'PUBMED', status: 'SKIPPED' as const, artifactId: null, claimsEmitted: 0, deltaEvents: [], latencyMs: 0 };
    }

    return executeSourceIngestion({
      npi, observedAt, sourceId: 'PUBMED', parserVersion: 'v1.0.0',
      matchingStrategy: 'NAME_FUZZY',
      fetchSource: () => fetchPubMed(val.firstName as string, val.lastName as string),
      parseSource: ({ raw, artifactId, checksum, observedAt: o, sourceUrl, retrievedAt }) => {
        const { claims, receipts } = parsePubMedResult(npi, raw, artifactId, checksum, o, { sourceUrl, retrievedAt });
        return { status: claims.length > 0 ? 'SUCCESS' : 'SKIPPED', claims, receipts, matchingStrategy: 'NAME_FUZZY', mergeReason: 'PubMed author search — Silver-tier, broad name match, identity verification required' };
      },
    });
  },
};

export type IngestionSources = 'NPPES_API' | 'OIG_LEIE' | 'PECOS_PUBLIC' | 'OPEN_PAYMENTS' | 'SAM_GOV' | 'DOCTORS_CLINICIANS' | 'NURSYS' | 'STATE_BOARD' | 'OPENALEX' | 'CLINICAL_TRIALS' | 'PUBMED' | 'ALL';

export async function ingestClinicianIdentity(
  npi: string,
  sources: IngestionSources[] = ['ALL'],
): Promise<FullIngestionReport> {
  const startedAt = Date.now();
  const triggeredAt = new Date().toISOString();
  const runAll = sources.includes('ALL');
  const toRun = runAll ? Object.keys(handlers) : sources.filter((source) => source in handlers);

  log('info', 'identityPipeline: starting', { npi, sources: toRun });

  const settled = await Promise.allSettled(toRun.map((sourceId) => handlers[sourceId]!(npi, triggeredAt)));
  const results: IngestionResult[] = settled.map((result, index) =>
    result.status === 'fulfilled'
      ? result.value
      : {
          npi,
          source: toRun[index]!,
          artifactId: null,
          claimsEmitted: 0,
          deltaEvents: [],
          status: 'FAILED',
          latencyMs: 0,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        },
  );

  let identity: CanonicalIdentitySummary | null = null;
  try {
    const allClaims = await loadClaimRecordsForNpi(npi);
    if (allClaims.length > 0) {
      identity = buildIdentitySummary(npi, allClaims);
      const sourceRecordIds = [...new Set(results.map((result) => result.sourceRecordId).filter(Boolean))] as string[];
      const claimRefs = [...new Set(allClaims.map((claim) => claim.claimId))];
      const identityIndex = await appendIdentityIndexArtifact({
        npi,
        sourceRunId: results.find((result) => result.status === 'SUCCESS')?.sourceRunId,
        summary: identity,
        claimRefs,
        sourceRecordIds,
        matchingStrategy: 'CANONICAL_AGGREGATION',
        confidenceScore: computeIdentityIndexConfidence(allClaims),
        mergeReason:
          sourceRecordIds.length > 1
            ? `Merged ${sourceRecordIds.length} source records using conservative NPI exact linkage`
            : 'Identity index derived from a single authoritative source record',
      });

      if (sourceRecordIds.length > 1) {
        await recordIdentityResolutionDecision({
          subjectNpi: npi,
          sourceRunId: results.find((result) => result.status === 'SUCCESS')?.sourceRunId,
          sourceRecordId: sourceRecordIds[0],
          verificationArtifactId: identityIndex.id,
          decisionType: 'MERGE',
          resolutionKey: deterministicHex({
            npi,
            sourceRecordIds: [...sourceRecordIds].sort(),
          }),
          matchingStrategy: 'NPI_EXACT',
          confidenceScore: computeIdentityIndexConfidence(allClaims),
          mergeReason: 'Merged authoritative source records using exact NPI linkage',
          payload: {
            sourceRecordIds,
            claimRefs,
            identityIndexArtifactId: identityIndex.id,
          },
        });
      }
    }
  } catch (error) {
    log('error', 'identityPipeline: index update failed', { npi, error: String(error) });
  }

  const staleSourceEvents = await scanSourceStalenessForNpi(npi, triggeredAt).catch((error) => {
    log('warn', 'identityPipeline: source staleness scan failed', { npi, error: String(error) });
    return [];
  });
  const deltaEvents = [...results.flatMap((result) => result.deltaEvents), ...staleSourceEvents];
  const criticalDeltas = deltaEvents.filter((event) => event.severity === 'CRITICAL');

  for (const delta of criticalDeltas) {
    await identityPrisma.auditEvent.create({
      data: {
        type: `IDENTITY_DELTA_${delta.type}`,
        hash: deterministicHex(delta),
        clinicianId: npi,
        metadata: toJsonValue(delta),
      },
    }).catch(() => null);
  }

  const report: FullIngestionReport = {
    npi,
    triggeredAt,
    durationMs: Date.now() - startedAt,
    sourcesRun: results.length,
    sourcesOk: results.filter((result) => result.status === 'SUCCESS').length,
    sourcesFailed: results.filter((result) => result.status === 'FAILED').length,
    claimsTotal: results.reduce((total, result) => total + result.claimsEmitted, 0),
    deltaEvents,
    results,
    identity,
  };

  log('info', 'identityPipeline: complete', {
    npi,
    durationMs: report.durationMs,
    claimsTotal: report.claimsTotal,
    sourcesFailed: report.sourcesFailed,
    criticalDeltas: criticalDeltas.length,
  });

  return report;
}

export async function getClaimsForNpi(npi: string): Promise<NormalizedClaim[]> {
  return loadClaimRecordsForNpi(npi);
}

export async function getVerificationReceiptsForNpi(
  npi: string,
): Promise<VerificationReceipt[]> {
  return loadVerificationReceiptRecordsForNpi(npi);
}
