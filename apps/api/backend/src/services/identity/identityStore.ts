import { createHash, randomUUID } from 'node:crypto';
import prisma, { Prisma } from '../../graphql/prisma_client';
import {
  buildClaimArtifactTrace,
  finalizeVerificationReceipt,
  normalizeEvidenceBundle,
  resolveClaimArtifactTrace,
  withTraceableClaim,
} from './evidenceModel';
import type {
  CanonicalIdentitySummary,
  NormalizedClaim,
  VerificationReceipt,
} from './evidenceModel';
import type { EvidenceTier } from './sourceCatalog';

/**
 * 🔥 CRITICAL FIX: Safe serializers for Prisma/Postgres
 * Prevents 08P01 / 22P03 binary errors
 */
function safeJSON(v: any) {
  if (v === undefined || v === null) return {};
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return {};
  }
}

function safeDate(v: any) {
  if (!v) return new Date();
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

function safeNullableDate(v: any) {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function safeNumber(v: any) {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeInt(v: any) {
  if (v === undefined || v === null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function safeString(v: any) {
  if (v === undefined || v === null) return null;
  return String(v);
}

export type IdentityIngestionStatus =
  | 'QUEUED'
  | 'FETCHING'
  | 'FETCHED'
  | 'PARSED'
  | 'NORMALIZED'
  | 'VERIFIED'
  | 'ALERTED'
  | 'QUARANTINED'
  | 'FAILED';

export type PersistSourceRecordInput = Readonly<{
  sourceRunId?: string;
  sourceId: string;
  subjectNpi: string;
  personProfileId?: string;
  sourceRecordKey?: string;
  sourceUrl?: string;
  fetchHeaders?: Record<string, string>;
  checksum: string;
  trustTier?: EvidenceTier;
  fetchedAt: string;
  observedAt?: string;
  expiresAt?: string;
  parserVersion?: string;
  matchingStrategy?: string;
  schemaVersion?: string;
  status?: IdentityIngestionStatus;
  quarantineReason?: string;
  metadata?: Record<string, unknown>;
}>;

export type AppendIdentityIndexArtifactInput = Readonly<{
  npi: string;
  sourceRunId?: string;
  summary: CanonicalIdentitySummary;
  claimRefs: readonly string[];
  sourceRecordIds: readonly string[];
  matchingStrategy?: string;
  confidenceScore?: number;
  mergeReason?: string;
  conflictReason?: string;
}>;

export type RecordIdentityResolutionDecisionInput = Readonly<{
  subjectNpi: string;
  sourceRunId?: string;
  sourceRecordId?: string;
  verificationArtifactId?: string;
  decisionType: 'LINK' | 'MERGE' | 'UNMERGE' | 'COLLISION' | 'SKIP';
  resolutionKey: string;
  matchingStrategy: string;
  confidenceScore: number;
  mergeReason?: string;
  conflictReason?: string;
  payload?: Record<string, unknown>;
}>;

/**
 * Normalize verification receipt payloads into Prisma-safe scalar values.
 * This keeps undefined, invalid JSON, and invalid timestamp values out of the query.
 */
export function normalizeVerificationRecordInput(data: {
  receiptId: unknown;
  claimRecordId: string | null;
  claimId: unknown;
  sourceRunId: string | null;
  sourceRecordId: string | null;
  verificationArtifactId: string;
  personProfileId: string | null;
  subjectNpi: unknown;
  entityId: unknown;
  field: unknown;
  value: unknown;
  trustTier: unknown;
  confidence: unknown;
  sourceArtifactId: unknown;
  sourceSystem: unknown;
  parserVersion: unknown;
  matchingStrategy: unknown;
  observedAt: unknown;
  explanation: unknown;
  expiresAt: unknown;
  sourceUrl: unknown;
  retrievedAt: unknown;
  rawArtifactRef: unknown;
  checksum: unknown;
  claimType: unknown;
  matchConfidence: unknown;
  freshnessWindowHours: unknown;
  integrityHash: unknown;
}) {
  return {
    receiptId: safeString(data.receiptId) ?? randomUUID(),
    claimRecordId: data.claimRecordId ?? null,
    claimId: safeString(data.claimId) ?? '',
    sourceRunId: data.sourceRunId ?? null,
    sourceRecordId: data.sourceRecordId ?? null,
    verificationArtifactId: data.verificationArtifactId,
    personProfileId: data.personProfileId ?? null,
    subjectNpi: safeString(data.subjectNpi) ?? '',
    entityId: safeString(data.entityId) ?? '',
    field: safeString(data.field) ?? '',
    value: safeJSON(data.value),
    trustTier: safeString(data.trustTier) ?? '',
    confidence: safeNumber(data.confidence) ?? 0,
    sourceArtifactId: safeString(data.sourceArtifactId),
    sourceSystem: safeString(data.sourceSystem) ?? '',
    parserVersion: safeString(data.parserVersion) ?? '',
    matchingStrategy: safeString(data.matchingStrategy),
    observedAt: safeDate(data.observedAt),
    explanation: safeString(data.explanation) ?? '',
    expiresAt: safeNullableDate(data.expiresAt),
    sourceUrl: safeString(data.sourceUrl),
    retrievedAt: safeNullableDate(data.retrievedAt),
    rawArtifactRef: safeString(data.rawArtifactRef),
    checksum: safeString(data.checksum),
    claimType: safeString(data.claimType),
    matchConfidence: safeString(data.matchConfidence),
    freshnessWindowHours: safeInt(data.freshnessWindowHours),
    integrityHash: safeString(data.integrityHash),
  };
}

type ClaimRecordRow = Readonly<{
  id: string;
  claimId: string;
  verificationArtifactId: string | null;
  claimType: string;
  value: Prisma.JsonValue;
  trustTier: string;
  confidenceLabel: string;
  confidenceScore: number;
  sourceId: string;
  parserVersion: string;
  matchingStrategy: string | null;
  status: string;
  observedAt: Date;
  derivedAt: Date;
  validFrom: Date | null;
  validUntil: Date | null;
  expiresAt: Date | null;
  supersededByClaimId: string | null;
  supersedesClaimId: string | null;
  reviewRequired: boolean;
  reviewReason: string | null;
  explanation: string | null;
  freshnessWindowHours: number | null;
  mergeReason: string | null;
  conflictReason: string | null;
}>;

type VerificationReceiptRecordRow = Readonly<{
  receiptId: string;
  claimId: string;
  entityId: string;
  field: string;
  value: Prisma.JsonValue;
  trustTier: string;
  confidence: number;
  sourceArtifactId: string | null;
  sourceSystem: string;
  parserVersion: string;
  matchingStrategy: string | null;
  observedAt: Date;
  explanation: string;
  expiresAt: Date | null;
  sourceUrl: string | null;
  retrievedAt: Date | null;
  rawArtifactRef: string | null;
  checksum: string | null;
  claimType: string | null;
  matchConfidence: string | null;
  freshnessWindowHours: number | null;
  integrityHash: string | null;
}>;

export type PersistedIdentityDelta = Readonly<{
  id: string;
  checksum: string;
  severity: string;
}>;

export type PersistIdentityClaimDeltaInput = Readonly<{
  sourceRunId?: string;
  sourceRecordId?: string;
  verificationArtifactId?: string | null;
  subjectNpi: string;
  sourceId: string;
  claimType: string;
  deltaType:
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
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  trustTier?: EvidenceTier | null;
  previousClaimId?: string | null;
  currentClaimId?: string | null;
  previousValue?: unknown;
  currentValue?: unknown;
  matchingStrategy?: string;
  mergeReason?: string;
  conflictReason?: string;
  observedAt: string;
  checksum: string;
}>;

export type UpdateClaimRecordStateInput = Readonly<{
  claimId: string;
  subjectNpi: string;
  status: 'SUPERSEDED' | 'EXPIRED';
  supersededByClaimId?: string | null;
  expiresAt?: string | null;
}>;

export type PersistTrustAlertRecordInput = Readonly<{
  type: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  subject: string;
  sourceRunId?: string;
  sourceRecordId?: string;
  verificationArtifactId?: string | null;
  identityDeltaId?: string;
  checksum: string;
  recommendedAction: string;
  observedAt?: string;
}>;

type IdentityStorePrismaClient = {
  sourceRecord: {
    findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>;
    create(args: Record<string, unknown>): Promise<{ id: string }>;
  };
  verificationArtifact: {
    findFirst(args: Record<string, unknown>): Promise<{ id: string; generation: number | null } | null>;
    create(args: Record<string, unknown>): Promise<{ id: string }>;
    update(args: Record<string, unknown>): Promise<{ id: string }>;
    findMany(args: Record<string, unknown>): Promise<Array<{
      id: string;
      checksum: string;
      sourceUrl?: string | null;
      fetchedAt?: Date | null;
      observedAt?: Date | null;
    }>>;
  };
  identityResolutionDecision: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
  };
  identityClaimDelta: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
  };
  trustAlertRecord: {
    create(args: Record<string, unknown>): Promise<{ id: string; alertId: string }>;
  };
};

const identityPrisma = prisma as unknown as IdentityStorePrismaClient;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toNullableDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function getClaimRecordClient(): {
  findMany?: (args: Record<string, unknown>) => Promise<ClaimRecordRow[]>;
  findFirst?: (args: Record<string, unknown>) => Promise<ClaimRecordRow | { id: string } | null>;
  create?: (args: Record<string, unknown>) => Promise<{ id: string }>;
  update?: (args: Record<string, unknown>) => Promise<{ id: string }>;
} {
  return (prisma as unknown as {
    claimRecord?: {
      findMany?: (args: Record<string, unknown>) => Promise<ClaimRecordRow[]>;
      findFirst?: (args: Record<string, unknown>) => Promise<ClaimRecordRow | { id: string } | null>;
      create?: (args: Record<string, unknown>) => Promise<{ id: string }>;
      update?: (args: Record<string, unknown>) => Promise<{ id: string }>;
    };
  }).claimRecord ?? {};
}

function getVerificationReceiptRecordClient(): {
  findMany?: (args: Record<string, unknown>) => Promise<VerificationReceiptRecordRow[]>;
  create?: (args: Record<string, unknown>) => Promise<{ id: string }>;
} {
  return (prisma as unknown as {
    verificationReceiptRecord?: {
      findMany?: (args: Record<string, unknown>) => Promise<VerificationReceiptRecordRow[]>;
      create?: (args: Record<string, unknown>) => Promise<{ id: string }>;
    };
  }).verificationReceiptRecord ?? {};
}

export async function persistSourceRecord(
  input: PersistSourceRecordInput,
): Promise<{ id: string; created: boolean }> {
  const existing = await identityPrisma.sourceRecord.findFirst({
    where: {
      sourceId: input.sourceId,
      subjectNpi: input.subjectNpi,
      checksum: input.checksum,
    },
    select: { id: true },
  });

  if (existing) {
    return { id: existing.id, created: false };
  }

  const created = await identityPrisma.sourceRecord.create({
    data: {
      sourceRunId: input.sourceRunId ?? null,
      sourceId: input.sourceId,
      subjectNpi: input.subjectNpi,
      personProfileId: input.personProfileId ?? null,
      sourceRecordKey: input.sourceRecordKey ?? input.subjectNpi,
      sourceUrl: input.sourceUrl ?? null,
      fetchHeaders: input.fetchHeaders ? toJsonValue(input.fetchHeaders) : undefined,
      checksum: input.checksum,
      trustTier: input.trustTier ?? null,
      fetchedAt: new Date(input.fetchedAt),
      observedAt: toNullableDate(input.observedAt),
      expiresAt: toNullableDate(input.expiresAt),
      parserVersion: input.parserVersion ?? null,
      matchingStrategy: input.matchingStrategy ?? null,
      schemaVersion: input.schemaVersion ?? null,
      status: input.status ?? 'FETCHED',
      quarantineReason: input.quarantineReason ?? null,
      metadata: input.metadata ? toJsonValue(input.metadata) : undefined,
    },
    select: { id: true },
  });

  return { id: created.id, created: true };
}

export async function persistClaimRecords(input: {
  sourceRunId?: string;
  sourceRecordId?: string;
  verificationArtifactId: string;
  personProfileId?: string;
  subjectNpi: string;
  claims: readonly NormalizedClaim[];
  matchingStrategy?: string;
  mergeReason?: string;
  conflictReason?: string;
}): Promise<readonly string[]> {
  const claimClient = getClaimRecordClient();
  if (!claimClient.create) {
    return input.claims.map((claim) => claim.claimId);
  }

  const persistedClaimIds: string[] = [];

  for (const claim of input.claims) {
    const tracedClaim = withTraceableClaim(claim);
    resolveClaimArtifactTrace(tracedClaim);

    try {
      await claimClient.create({
        data: {
          claimId: tracedClaim.claimId,
          sourceRunId: input.sourceRunId ?? null,
          sourceRecordId: input.sourceRecordId ?? null,
          verificationArtifactId: input.verificationArtifactId,
          personProfileId: input.personProfileId ?? null,
          subjectNpi: input.subjectNpi,
          claimType: tracedClaim.claimType,
          value: toJsonValue(tracedClaim.value),
          trustTier: tracedClaim.tier,
          confidenceLabel: tracedClaim.confidence,
          confidenceScore: tracedClaim.confidenceScore,
          sourceId: tracedClaim.sourceId,
          parserVersion: tracedClaim.parserVersion,
          matchingStrategy: input.matchingStrategy ?? tracedClaim.sourceId,
          status: tracedClaim.status,
          observedAt: new Date(tracedClaim.observedAt),
          derivedAt: new Date(tracedClaim.derivedAt),
          validFrom: toNullableDate(tracedClaim.validFrom),
          validUntil: toNullableDate(tracedClaim.validUntil),
          expiresAt: toNullableDate(tracedClaim.expiresAt),
          supersededByClaimId: tracedClaim.supersededBy ?? null,
          supersedesClaimId: tracedClaim.supersedes ?? null,
          reviewRequired: tracedClaim.reviewRequired,
          reviewReason: tracedClaim.reviewReason ?? null,
          explanation: tracedClaim.explanation ?? null,
          freshnessWindowHours: tracedClaim.freshnessWindowHours ?? null,
          mergeReason: input.mergeReason ?? null,
          conflictReason: input.conflictReason ?? tracedClaim.reviewReason ?? null,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }

    persistedClaimIds.push(claim.claimId);
  }

  return Object.freeze(persistedClaimIds);
}

export async function persistVerificationReceiptRecords(input: {
  sourceRunId?: string;
  sourceRecordId?: string;
  verificationArtifactId: string;
  personProfileId?: string;
  subjectNpi: string;
  claims: readonly NormalizedClaim[];
  receipts: readonly VerificationReceipt[];
  matchingStrategy?: string;
}): Promise<void> {
  const receiptClient = getVerificationReceiptRecordClient();
  const claimClient = getClaimRecordClient();

  if (!receiptClient.create) {
    return;
  }

  const claimById = new Map(input.claims.map((claim) => [claim.claimId, claim] as const));

  for (const receipt of input.receipts) {
    const finalizedReceipt = finalizeVerificationReceipt(
      receipt,
      claimById.get(receipt.claim_id),
    );
    let claimRecordId: string | null = null;

    if (claimClient.findFirst) {
      const claimRecord = await claimClient.findFirst({
        where: {
          claimId: finalizedReceipt.claim_id,
          verificationArtifactId: input.verificationArtifactId,
        },
        select: { id: true },
      });
      claimRecordId = claimRecord?.id ?? null;
    }

    try {
      const data = normalizeVerificationRecordInput({
        receiptId: finalizedReceipt.receipt_id,
        claimRecordId,
        claimId: finalizedReceipt.claim_id,
        sourceRunId: input.sourceRunId ?? null,
        sourceRecordId: input.sourceRecordId ?? null,
        verificationArtifactId: input.verificationArtifactId,
        personProfileId: input.personProfileId ?? null,
        subjectNpi: input.subjectNpi,
        entityId: finalizedReceipt.entity_id,
        field: finalizedReceipt.field,
        value: finalizedReceipt.value,
        trustTier: finalizedReceipt.tier,
        confidence: finalizedReceipt.confidence,
        sourceArtifactId: finalizedReceipt.source_artifact_id ?? null,
        sourceSystem: finalizedReceipt.source_system,
        parserVersion: finalizedReceipt.parser_version,
        matchingStrategy: input.matchingStrategy ?? null,
        observedAt: finalizedReceipt.observed_at,
        explanation: finalizedReceipt.explanation,
        expiresAt: finalizedReceipt.expires_at,
        sourceUrl: finalizedReceipt.source_url ?? null,
        retrievedAt: finalizedReceipt.retrieved_at ?? null,
        rawArtifactRef: finalizedReceipt.raw_artifact_ref ?? null,
        checksum: finalizedReceipt.checksum ?? null,
        claimType: finalizedReceipt.claim_type ?? null,
        matchConfidence: finalizedReceipt.match_confidence ?? null,
        freshnessWindowHours: finalizedReceipt.freshness_window_hours ?? null,
        integrityHash: finalizedReceipt.integrity_hash ?? null,
      });

      await receiptClient.create({
        data,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }
}

async function findClaimRecordRow(
  claimId: string,
  subjectNpi: string,
): Promise<ClaimRecordRow | null> {
  const claimClient = getClaimRecordClient();
  if (!claimClient.findFirst) {
    return null;
  }

  const row = await claimClient.findFirst({
    where: { claimId, subjectNpi },
  });

  if (!row || !('claimId' in row) || !('status' in row)) {
    return null;
  }

  return row as ClaimRecordRow;
}

export async function updateClaimRecordState(
  input: UpdateClaimRecordStateInput,
): Promise<{ id: string } | null> {
  const claimClient = getClaimRecordClient();
  if (!claimClient.findFirst || !claimClient.update) {
    return null;
  }

  const existing = await findClaimRecordRow(input.claimId, input.subjectNpi);
  if (!existing) {
    return null;
  }

  return claimClient.update({
    where: { id: existing.id },
    data: {
      status: input.status,
      supersededByClaimId:
        typeof input.supersededByClaimId === 'undefined'
          ? existing.supersededByClaimId
          : input.supersededByClaimId,
      expiresAt:
        typeof input.expiresAt === 'undefined'
          ? existing.expiresAt
          : toNullableDate(input.expiresAt),
    },
    select: { id: true },
  });
}

export async function persistIdentityClaimDeltas(
  deltas: readonly PersistIdentityClaimDeltaInput[],
): Promise<readonly PersistedIdentityDelta[]> {
  const persisted: PersistedIdentityDelta[] = [];

  for (const delta of deltas) {
    const previousClaimRecord = delta.previousClaimId
      ? await findClaimRecordRow(delta.previousClaimId, delta.subjectNpi)
      : null;
    const currentClaimRecord = delta.currentClaimId
      ? await findClaimRecordRow(delta.currentClaimId, delta.subjectNpi)
      : null;

    try {
      const created = await identityPrisma.identityClaimDelta.create({
        data: {
          sourceRunId: delta.sourceRunId ?? null,
          sourceRecordId: delta.sourceRecordId ?? null,
          verificationArtifactId: delta.verificationArtifactId ?? null,
          previousClaimRecordId: previousClaimRecord?.id ?? null,
          currentClaimRecordId: currentClaimRecord?.id ?? null,
          subjectNpi: delta.subjectNpi,
          sourceId: delta.sourceId,
          claimType: delta.claimType,
          deltaType: delta.deltaType,
          severity: delta.severity,
          trustTier: delta.trustTier ?? null,
          previousValue:
            typeof delta.previousValue === 'undefined' ? undefined : toJsonValue(delta.previousValue),
          currentValue:
            typeof delta.currentValue === 'undefined' ? undefined : toJsonValue(delta.currentValue),
          matchingStrategy: delta.matchingStrategy ?? null,
          mergeReason: delta.mergeReason ?? null,
          conflictReason: delta.conflictReason ?? null,
          checksum: delta.checksum,
          observedAt: new Date(delta.observedAt),
        },
        select: { id: true },
      });

      persisted.push({
        id: created.id,
        checksum: delta.checksum,
        severity: delta.severity,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  return Object.freeze(persisted);
}

export async function persistTrustAlertRecord(
  input: PersistTrustAlertRecordInput,
): Promise<{ id: string; alertId: string } | null> {
  try {
    const created = await identityPrisma.trustAlertRecord.create({
      data: {
        alertId: randomUUID(),
        type: input.type,
        severity: input.severity,
        title: input.title,
        description: input.description,
        subject: input.subject,
        sourceRunId: input.sourceRunId ?? null,
        sourceRecordId: input.sourceRecordId ?? null,
        verificationArtifactId: input.verificationArtifactId ?? null,
        identityDeltaId: input.identityDeltaId ?? null,
        checksum: input.checksum,
        recommendedAction: input.recommendedAction,
        observedAt: toNullableDate(input.observedAt),
      },
      select: {
        id: true,
        alertId: true,
      },
    });

    return created;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return null;
    }
    throw error;
  }
}

export async function appendIdentityIndexArtifact(
  input: AppendIdentityIndexArtifactInput,
): Promise<{ id: string; checksum: string; generation: number }> {
  const previous = await identityPrisma.verificationArtifact.findFirst({
    where: { npi: input.npi, source: 'IDENTITY_INDEX' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, generation: true },
  });

  const generation = (previous?.generation ?? 0) + 1;
  const rawPayload = {
    _identityIndex: true,
    generatedAt: new Date().toISOString(),
    previousArtifactId: previous?.id ?? null,
    claimRefs: [...input.claimRefs],
    sourceRecordIds: [...input.sourceRecordIds],
    summary: input.summary,
  };
  const checksum = stableHash({
    npi: input.npi,
    generation,
    previousArtifactId: previous?.id ?? null,
    claimRefs: input.claimRefs,
    sourceRecordIds: input.sourceRecordIds,
    summary: input.summary,
  });

  const artifact = await identityPrisma.verificationArtifact.create({
    data: {
      npi: input.npi,
      source: 'IDENTITY_INDEX',
      status: 'ACTIVE',
      artifactType: 'IDENTITY_INDEX',
      parserVersion: 'identity-index/v1',
      matchingStrategy: input.matchingStrategy ?? 'CANONICAL_AGGREGATION',
      trustTier: input.summary.highestTier,
      confidenceScore: input.confidenceScore ?? null,
      conflictReason: input.conflictReason ?? null,
      mergeReason: input.mergeReason ?? null,
      sourceRunId: input.sourceRunId ?? null,
      checksum,
      rawPayload: toJsonValue(rawPayload),
      lifecycleState: 'active',
      verifiedAt: new Date(),
      observedAt: new Date(input.summary.lastIngestedAt),
      generation,
      supersedesArtifactId: previous?.id ?? null,
    },
    select: { id: true },
  });

  if (previous?.id) {
    await identityPrisma.verificationArtifact.update({
      where: { id: previous.id },
      data: {
        supersededByArtifactId: artifact.id,
        status: 'SUPERSEDED',
        lifecycleState: 'superseded',
      },
      select: { id: true },
    }).catch(() => null);
  }

  return { id: artifact.id, checksum, generation };
}

export async function recordIdentityResolutionDecision(
  input: RecordIdentityResolutionDecisionInput,
): Promise<void> {
  await identityPrisma.identityResolutionDecision.create({
    data: {
      subjectNpi: input.subjectNpi,
      sourceRunId: input.sourceRunId ?? null,
      sourceRecordId: input.sourceRecordId ?? null,
      verificationArtifactId: input.verificationArtifactId ?? null,
      decisionType: input.decisionType,
      resolutionKey: input.resolutionKey,
      matchingStrategy: input.matchingStrategy,
      confidenceScore: input.confidenceScore,
      mergeReason: input.mergeReason ?? null,
      conflictReason: input.conflictReason ?? null,
      payload: input.payload ? toJsonValue(input.payload) : undefined,
    },
  });
}

export async function loadClaimRecordsForNpi(npi: string): Promise<NormalizedClaim[]> {
  const claimClient = getClaimRecordClient();
  if (claimClient.findMany) {
    const records = await claimClient.findMany({
      where: { subjectNpi: npi },
      orderBy: { createdAt: 'desc' },
    });

    const deduped = new Map<string, NormalizedClaim>();
    const artifactByClaimId = new Map<string, string>();
    for (const record of records) {
      if (record.status === 'SUPERSEDED' || record.status === 'EXPIRED') {
        continue;
      }
      if (deduped.has(record.claimId)) {
        continue;
      }

      if (record.verificationArtifactId) {
        artifactByClaimId.set(record.claimId, record.verificationArtifactId);
      }

      deduped.set(record.claimId, {
        claimId: record.claimId,
        claimType: record.claimType as NormalizedClaim['claimType'],
        subjectNpi: npi,
        value: record.value as NormalizedClaim['value'],
        tier: record.trustTier as NormalizedClaim['tier'],
        confidence: record.confidenceLabel as NormalizedClaim['confidence'],
        confidenceScore: record.confidenceScore,
        sourceId: record.sourceId,
        artifactId: '',
        artifactChecksum: '',
        parserVersion: record.parserVersion,
        derivedAt: record.derivedAt.toISOString(),
        observedAt: record.observedAt.toISOString(),
        validFrom: record.validFrom?.toISOString() ?? null,
        validUntil: record.validUntil?.toISOString() ?? null,
        expiresAt: record.expiresAt?.toISOString() ?? null,
        status: record.status as NormalizedClaim['status'],
        supersededBy: record.supersededByClaimId,
        supersedes: record.supersedesClaimId,
        reviewRequired: record.reviewRequired,
        reviewReason: record.reviewReason,
        humanReviewAt: null,
        explanation: record.explanation ?? undefined,
        freshnessWindowHours: record.freshnessWindowHours,
      });
    }

    const artifactRows = await prisma.verificationArtifact.findMany({
      where: { npi },
      select: { id: true, checksum: true, sourceUrl: true, fetchedAt: true, observedAt: true },
    });
    const artifactById = new Map(artifactRows.map((artifact) => [artifact.id, artifact]));
    const checksumByClaimId = new Map<string, string>();
    for (const [claimId, artifactId] of artifactByClaimId.entries()) {
      checksumByClaimId.set(
        claimId,
        artifactById.get(artifactId)?.checksum ?? '',
      );
    }

    return [...deduped.values()].map((claim) => {
      const hydratedClaim = {
        ...claim,
        artifactId: artifactByClaimId.get(claim.claimId) ?? claim.artifactId,
        artifactChecksum: checksumByClaimId.get(claim.claimId) ?? claim.artifactChecksum,
      };

      try {
        return withTraceableClaim({
          ...hydratedClaim,
          ...buildClaimArtifactTrace({
            sourceId: claim.sourceId,
            sourceUrl: artifactById.get(artifactByClaimId.get(claim.claimId) ?? '')?.sourceUrl ?? claim.source_url,
            retrievedAt:
              artifactById.get(artifactByClaimId.get(claim.claimId) ?? '')?.fetchedAt?.toISOString()
              ?? artifactById.get(artifactByClaimId.get(claim.claimId) ?? '')?.observedAt?.toISOString()
              ?? claim.retrieved_at
              ?? claim.derivedAt
              ?? claim.observedAt,
            artifactId: artifactByClaimId.get(claim.claimId) ?? claim.artifactId,
            checksum: checksumByClaimId.get(claim.claimId) ?? claim.artifactChecksum,
            claimType: claim.claimType,
            matchConfidence: claim.match_confidence ?? claim.confidence,
          }),
        });
      } catch {
        return hydratedClaim;
      }
    });
  }

  const artifacts = await prisma.verificationArtifact.findMany({
    where: { npi, lifecycleState: 'active', source: { not: 'TRUST_STATE_ENGINE' } },
    select: { rawPayload: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const claims: NormalizedClaim[] = [];
  const seen = new Set<string>();

  for (const artifact of artifacts) {
    const rawClaims = ((artifact.rawPayload as Record<string, unknown>)?._claims ?? []) as NormalizedClaim[];
    for (const claim of rawClaims) {
      if (seen.has(claim.claimId)) {
        continue;
      }
      seen.add(claim.claimId);
      claims.push(claim);
    }
  }

  return normalizeEvidenceBundle({ claims, receipts: [] }).claims;
}

export async function loadVerificationReceiptRecordsForNpi(
  npi: string,
): Promise<VerificationReceipt[]> {
  const receiptClient = getVerificationReceiptRecordClient();
  if (receiptClient.findMany) {
    const rows = await receiptClient.findMany({
      where: { subjectNpi: npi },
      orderBy: { issuedAt: 'desc' },
    });

    return rows.map((row) => ({
      receipt_id: row.receiptId,
      claim_id: row.claimId,
      entity_id: row.entityId,
      field: row.field,
      value: row.value,
      tier: row.trustTier as VerificationReceipt['tier'],
      confidence: row.confidence,
      source_artifact_id: row.sourceArtifactId ?? '',
      source_system: row.sourceSystem,
      observed_at: row.observedAt.toISOString(),
      parser_version: row.parserVersion,
      expires_at: row.expiresAt?.toISOString() ?? null,
      explanation: row.explanation,
      source_url: row.sourceUrl ?? undefined,
      retrieved_at: row.retrievedAt?.toISOString() ?? undefined,
      raw_artifact_ref: row.rawArtifactRef ?? undefined,
      checksum: row.checksum ?? undefined,
      claim_type: row.claimType ? row.claimType as VerificationReceipt['claim_type'] : undefined,
      match_confidence: row.matchConfidence
        ? row.matchConfidence as VerificationReceipt['match_confidence']
        : undefined,
      freshness_window_hours: row.freshnessWindowHours,
      integrity_hash: row.integrityHash ?? undefined,
    }));
  }

  const artifacts = await prisma.verificationArtifact.findMany({
    where: { npi, lifecycleState: 'active', source: { not: 'TRUST_STATE_ENGINE' } },
    select: { rawPayload: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return artifacts.flatMap(
    (artifact) =>
      (((artifact.rawPayload as Record<string, unknown>)?._receipts ?? []) as VerificationReceipt[]),
  );
}
