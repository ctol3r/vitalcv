import type {
  Prisma,
  VcvCredential,
  VcvCredentialDomain,
  VcvVerificationLevel,
  VerificationArtifact,
} from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { deriveCanonicalId } from '../../domain/entity/npiRouter';
import {
  isCredentialCurrentStatus,
  normalizeCredentialStatus,
} from '../../domain/entity/contracts';
import { sha256ForPayload } from '../../utils/deterministic';
import type {
  EnrollmentValue,
  ExclusionValue,
  LicenseValue,
  NormalizedClaim,
  NpiIdentityValue,
  VerificationReceipt,
} from '../identity/evidenceModel';
import { resolveEntityFromNpi } from './entityResolutionService';

type JsonRecord = Record<string, unknown>;

type MaterializationAuthority = {
  authorityKey: string;
  displayName: string;
  metadata?: JsonRecord;
};

type MaterializedCredentialObservation = {
  subjectNpi: string;
  domain: VcvCredentialDomain;
  credentialType: string;
  status: string;
  verificationLevel: VcvVerificationLevel;
  claimValue: JsonRecord;
  artifactIds: string[];
  receiptIds: string[];
  claimId?: string;
  issuedAt?: Date | null;
  expiresAt?: Date | null;
  verifiedAt?: Date | null;
  observedAt?: Date | null;
  nextReverifyAt?: Date | null;
  jurisdiction?: string | null;
  metadata: JsonRecord;
  trustTier?: string | null;
  confidence?: number | null;
  authority: MaterializationAuthority;
  familyIdentity: string;
};

type MaterializeClaimsInput = {
  subjectNpi: string;
  verificationArtifactId: string;
  claims: readonly NormalizedClaim[];
  receipts: readonly VerificationReceipt[];
};

type MaterializeResult = {
  credentialIds: string[];
};

type VerificationArtifactSnapshot = Pick<
  VerificationArtifact,
  | 'id'
  | 'npi'
  | 'source'
  | 'status'
  | 'rawPayload'
  | 'observedAt'
  | 'verifiedAt'
  | 'expiresAt'
  | 'trustTier'
  | 'confidenceScore'
>;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonRecord;
  }

  return {};
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function mergeStrings(...values: Array<readonly string[] | null | undefined>): string[] {
  const merged = new Set<string>();
  for (const value of values) {
    for (const item of value ?? []) {
      const normalized = item.trim();
      if (normalized) {
        merged.add(normalized);
      }
    }
  }

  return Array.from(merged).sort((left, right) => left.localeCompare(right));
}

function pickLatestDate(...values: Array<Date | null | undefined>): Date | null {
  return values
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
}

function observationTimestamp(credential: Pick<VcvCredential, 'observedAt' | 'createdAt'>): number {
  return (credential.observedAt ?? credential.createdAt).getTime();
}

function familyKeyForObservation(input: {
  subjectId: string;
  domain: VcvCredentialDomain;
  credentialType: string;
  jurisdiction?: string | null;
  familyIdentity: string;
}): string {
  return `family:${sha256ForPayload({
    subjectId: input.subjectId,
    domain: input.domain,
    credentialType: input.credentialType,
    jurisdiction: input.jurisdiction ?? null,
    familyIdentity: input.familyIdentity,
  })}`;
}

function credentialKeyForObservation(input: {
  familyKey: string;
  status: string;
  claimValue: JsonRecord;
  expiresAt?: Date | null;
  observedAt?: Date | null;
}): string {
  return `cred:${sha256ForPayload({
    familyKey: input.familyKey,
    status: normalizeCredentialStatus(input.status),
    claimValue: input.claimValue,
    expiresAt: input.expiresAt?.toISOString() ?? null,
    observedAt: input.observedAt?.toISOString() ?? null,
  })}`;
}

function verificationLevelForTier(tier: string | null | undefined): VcvVerificationLevel {
  const normalized = normalizeCredentialStatus(tier);
  if (normalized === 'GOLD') {
    return 'SOURCE_VERIFIED';
  }
  if (normalized === 'SILVER') {
    return 'SOURCE_MATCHED';
  }
  return 'SELF_REPORTED';
}

function issuerForClaim(claim: NormalizedClaim): MaterializationAuthority | null {
  switch (claim.claimType) {
    case 'NPI_IDENTITY':
      return {
        authorityKey: 'cms:nppes',
        displayName: 'CMS NPPES',
        metadata: { source: 'NPPES_API' },
      };
    case 'EXCLUSION_STATUS': {
      const value = claim.value as ExclusionValue;
      if (value.source === 'SAM_GOV') {
        return {
          authorityKey: 'gsa:sam',
          displayName: 'SAM.gov',
          metadata: { source: 'SAM_GOV' },
        };
      }

      return {
        authorityKey: 'hhs:oig',
        displayName: 'HHS OIG LEIE',
        metadata: { source: 'OIG_LEIE' },
      };
    }
    case 'ENROLLMENT_STATUS':
      return {
        authorityKey: 'cms:pecos',
        displayName: 'CMS PECOS',
        metadata: { source: 'PECOS' },
      };
    case 'LICENSE':
    case 'NURSING_LICENSE': {
      const value = claim.value as LicenseValue;
      const state = value.state.trim().toUpperCase();
      return {
        authorityKey: `state_board:${state}`,
        displayName: `${state} State Board`,
        metadata: { source: value.source, state },
      };
    }
    default:
      return null;
  }
}

function mapExclusionStatusFromClaim(claim: NormalizedClaim, value: ExclusionValue): string {
  if (claim.reviewRequired) {
    return claim.confidence === 'UNCERTAIN' ? 'UNCERTAIN' : 'REVIEW_REQUIRED';
  }
  if (value.excluded) {
    return 'EXCLUDED';
  }
  if (value.matchType === 'NO_MATCH') {
    return 'CLEAR';
  }
  return claim.confidence === 'UNCERTAIN' ? 'UNCERTAIN' : 'REVIEW_REQUIRED';
}

function mapLicenseStatus(value: LicenseValue, claim: NormalizedClaim): string {
  if (claim.reviewRequired) {
    return 'REVIEW_REQUIRED';
  }

  const normalized = normalizeCredentialStatus(value.licenseStatus);
  if (normalized === 'ACTIVE') return 'ACTIVE';
  if (normalized === 'EXPIRED') return 'EXPIRED';
  if (normalized === 'SUSPENDED') return 'SUSPENDED';
  if (normalized === 'REVOKED') return 'REVOKED';
  return 'UNRESOLVED';
}

function mapObservationFromClaim(
  claim: NormalizedClaim,
  artifact: VerificationArtifactSnapshot | null,
  receiptIds: string[],
): MaterializedCredentialObservation | null {
  const authority = issuerForClaim(claim);
  if (!authority) {
    return null;
  }

  const observedAt = parseDate(claim.observedAt);
  const verifiedAt = parseDate(artifact?.verifiedAt) ?? parseDate(claim.derivedAt);
  const nextReverifyAt = parseDate(artifact?.expiresAt);

  switch (claim.claimType) {
    case 'NPI_IDENTITY': {
      const value = claim.value as NpiIdentityValue;
      return {
        subjectNpi: claim.subjectNpi,
        domain: 'IDENTITY',
        credentialType: 'NPI_ENROLLMENT',
        status: value.status === 'D' ? 'REVOKED' : 'ACTIVE',
        verificationLevel: verificationLevelForTier(claim.tier),
        claimValue: {
          npi: value.npi,
          enumerationType: value.enumerationType,
          enumerationDate: value.enumerationDate,
          lastUpdated: value.lastUpdated,
          status: value.status,
          credential: value.credential,
        },
        artifactIds: [claim.artifactId],
        receiptIds,
        claimId: claim.claimId,
        issuedAt: parseDate(value.enumerationDate) ?? observedAt,
        expiresAt: null,
        verifiedAt,
        observedAt,
        nextReverifyAt,
        jurisdiction: null,
        metadata: {
          sourceId: claim.sourceId,
          claimType: claim.claimType,
          reviewRequired: claim.reviewRequired,
          reviewReason: claim.reviewReason,
        },
        trustTier: claim.tier,
        confidence: claim.confidenceScore,
        authority,
        familyIdentity: value.npi,
      };
    }
    case 'EXCLUSION_STATUS': {
      const value = claim.value as ExclusionValue;
      return {
        subjectNpi: claim.subjectNpi,
        domain: 'EXCLUSION_CHECK',
        credentialType: value.source === 'SAM_GOV' ? 'SAM_GOV' : 'OIG_LEIE',
        status: mapExclusionStatusFromClaim(claim, value),
        verificationLevel: verificationLevelForTier(claim.tier),
        claimValue: {
          excluded: value.excluded,
          exclusionType: value.exclusionType,
          exclusionDate: value.exclusionDate,
          reinstatementDate: value.reinstatementDate,
          matchType: value.matchType,
          waiverState: value.waiverState,
          source: value.source,
        },
        artifactIds: [claim.artifactId],
        receiptIds,
        claimId: claim.claimId,
        issuedAt: parseDate(value.exclusionDate) ?? observedAt,
        expiresAt: null,
        verifiedAt,
        observedAt,
        nextReverifyAt,
        jurisdiction: value.waiverState,
        metadata: {
          sourceId: claim.sourceId,
          claimType: claim.claimType,
          reviewRequired: claim.reviewRequired,
          reviewReason: claim.reviewReason,
          matchType: value.matchType,
        },
        trustTier: claim.tier,
        confidence: claim.confidenceScore,
        authority,
        familyIdentity: value.source,
      };
    }
    case 'ENROLLMENT_STATUS': {
      const value = claim.value as EnrollmentValue;
      return {
        subjectNpi: claim.subjectNpi,
        domain: 'MEDICARE_ENROLLMENT',
        credentialType: value.source === 'PECOS' ? 'PECOS_ENROLLMENT' : 'MEDICARE_ENROLLMENT',
        status: claim.reviewRequired ? 'REVIEW_REQUIRED' : value.enrolled ? 'ACTIVE' : 'UNRESOLVED',
        verificationLevel: verificationLevelForTier(claim.tier),
        claimValue: {
          enrolled: value.enrolled,
          enrollmentType: value.enrollmentType,
          eligibleToOrderRefer: value.eligibleToOrderRefer,
          source: value.source,
        },
        artifactIds: [claim.artifactId],
        receiptIds,
        claimId: claim.claimId,
        issuedAt: observedAt,
        expiresAt: null,
        verifiedAt,
        observedAt,
        nextReverifyAt,
        jurisdiction: null,
        metadata: {
          sourceId: claim.sourceId,
          claimType: claim.claimType,
          reviewRequired: claim.reviewRequired,
          reviewReason: claim.reviewReason,
        },
        trustTier: claim.tier,
        confidence: claim.confidenceScore,
        authority,
        familyIdentity: value.source,
      };
    }
    case 'LICENSE':
    case 'NURSING_LICENSE': {
      const value = claim.value as LicenseValue;
      return {
        subjectNpi: claim.subjectNpi,
        domain: 'LICENSURE',
        credentialType: claim.claimType === 'NURSING_LICENSE' ? 'NURSING_LICENSE' : 'STATE_LICENSE',
        status: mapLicenseStatus(value, claim),
        verificationLevel: verificationLevelForTier(claim.tier),
        claimValue: {
          state: value.state,
          licenseNumber: value.licenseNumber,
          issueDate: value.issueDate,
          expiryDate: value.expiryDate,
          licenseStatus: value.licenseStatus,
          disciplinaryActions: value.disciplinaryActions,
          source: value.source,
        },
        artifactIds: [claim.artifactId],
        receiptIds,
        claimId: claim.claimId,
        issuedAt: parseDate(value.issueDate) ?? observedAt,
        expiresAt: parseDate(value.expiryDate),
        verifiedAt,
        observedAt,
        nextReverifyAt,
        jurisdiction: value.state,
        metadata: {
          sourceId: claim.sourceId,
          claimType: claim.claimType,
          reviewRequired: claim.reviewRequired,
          reviewReason: claim.reviewReason,
        },
        trustTier: claim.tier,
        confidence: claim.confidenceScore,
        authority,
        familyIdentity: `${value.state}:${value.licenseNumber ?? claim.claimId}`,
      };
    }
    default:
      return null;
  }
}

function materializeFromVerificationArtifact(
  artifact: VerificationArtifactSnapshot,
): MaterializedCredentialObservation | null {
  const rawPayload = asRecord(artifact.rawPayload);
  const payloadJson = asRecord(rawPayload.payload_json);
  const observedAt = artifact.observedAt ?? artifact.verifiedAt;
  const verifiedAt = artifact.verifiedAt;
  const nextReverifyAt = artifact.expiresAt;

  if (artifact.source === 'NPPES' || artifact.source === 'NPPES_API') {
    return {
      subjectNpi: artifact.npi,
      domain: 'IDENTITY',
      credentialType: 'NPI_ENROLLMENT',
      status: normalizeCredentialStatus(artifact.status) === 'ACTIVE' ? 'ACTIVE' : 'UNRESOLVED',
      verificationLevel: 'SOURCE_VERIFIED',
      claimValue: {
        npi: artifact.npi,
        providerName: payloadJson.provider_name,
        providerType: payloadJson.provider_type,
        taxonomyCode: payloadJson.taxonomy_code,
        practiceState: payloadJson.practice_state,
      },
      artifactIds: [artifact.id],
      receiptIds: [],
      issuedAt: observedAt,
      expiresAt: null,
      verifiedAt,
      observedAt,
      nextReverifyAt,
      jurisdiction: null,
      metadata: {
        source: artifact.source,
        sourceStatus: payloadJson.source_status,
      },
      trustTier: artifact.trustTier,
      confidence: artifact.confidenceScore,
      authority: {
        authorityKey: 'cms:nppes',
        displayName: 'CMS NPPES',
        metadata: { source: artifact.source },
      },
      familyIdentity: artifact.npi,
    };
  }

  if (artifact.source === 'OIG' || artifact.source === 'OIG_LEIE') {
    const status = normalizeCredentialStatus(artifact.status);
    const excluded = status === 'EXCLUDED';
    const materializedStatus =
      status === 'CLEAR'
        ? 'CLEAR'
        : status === 'EXCLUDED'
          ? 'EXCLUDED'
          : status === 'UNCERTAIN' || status === 'CHECK_FAILED'
            ? 'UNCERTAIN'
            : status === 'REVIEW_REQUIRED'
              ? 'REVIEW_REQUIRED'
              : 'UNCERTAIN';

    return {
      subjectNpi: artifact.npi,
      domain: 'EXCLUSION_CHECK',
      credentialType: 'OIG_LEIE',
      status: materializedStatus,
      verificationLevel: 'SOURCE_VERIFIED',
      claimValue: {
        excluded,
        exclusionType: payloadJson.exclusion_type,
        exclusionDate: payloadJson.exclusion_date,
        reinstatementDate: payloadJson.reinstatement_date,
        waiverState: payloadJson.waiver_state,
        sourceUrl: payloadJson.source_url,
      },
      artifactIds: [artifact.id],
      receiptIds: [],
      issuedAt: parseDate(payloadJson.exclusion_date as string | undefined) ?? observedAt,
      expiresAt: null,
      verifiedAt,
      observedAt,
      nextReverifyAt,
      jurisdiction: typeof payloadJson.waiver_state === 'string' ? payloadJson.waiver_state : null,
      metadata: {
        source: artifact.source,
        sourceUrl: payloadJson.source_url,
      },
      trustTier: artifact.trustTier,
      confidence: artifact.confidenceScore,
      authority: {
        authorityKey: 'hhs:oig',
        displayName: 'HHS OIG LEIE',
        metadata: { source: artifact.source },
      },
      familyIdentity: 'OIG_LEIE',
    };
  }

  if (artifact.source === 'STATE_BOARD') {
    const jurisdiction = typeof payloadJson.state === 'string' ? payloadJson.state : null;
    const boardName =
      typeof payloadJson.board_name === 'string'
        ? payloadJson.board_name
        : `${jurisdiction ?? 'UNKNOWN'} State Board`;
    return {
      subjectNpi: artifact.npi,
      domain: 'LICENSURE',
      credentialType: 'STATE_LICENSE',
      status: normalizeCredentialStatus(artifact.status) || 'UNRESOLVED',
      verificationLevel: 'SOURCE_VERIFIED',
      claimValue: {
        state: payloadJson.state,
        licenseNumber: payloadJson.license_number,
        boardName,
      },
      artifactIds: [artifact.id],
      receiptIds: [],
      issuedAt: observedAt,
      expiresAt: artifact.expiresAt,
      verifiedAt,
      observedAt,
      nextReverifyAt,
      jurisdiction,
      metadata: {
        source: artifact.source,
        boardName,
      },
      trustTier: artifact.trustTier,
      confidence: artifact.confidenceScore,
      authority: {
        authorityKey: `state_board:${jurisdiction ?? 'UNKNOWN'}`,
        displayName: boardName,
        metadata: { state: jurisdiction },
      },
      familyIdentity: `${jurisdiction ?? 'UNKNOWN'}:${String(payloadJson.license_number ?? artifact.id)}`,
    };
  }

  return null;
}

async function ensureSubjectEntityId(subjectNpi: string): Promise<string> {
  const existing = await prisma.vcvEntity.findFirst({
    where: { npi: subjectNpi },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const resolved = await resolveEntityFromNpi(subjectNpi);
  return resolved.entity.id;
}

async function ensureIssuerEntityId(authority: MaterializationAuthority): Promise<string> {
  const canonicalId = deriveCanonicalId('organization', authority.authorityKey);
  const existing = await prisma.vcvEntity.findUnique({
    where: { canonicalId },
    select: { id: true, sourceIds: true },
  });

  if (existing) {
    await prisma.vcvEntity.update({
      where: { id: existing.id },
      data: {
        displayName: authority.displayName,
        sourceIds: mergeStrings(existing.sourceIds, [authority.authorityKey]),
        metadata: authority.metadata ? toJsonValue(authority.metadata) : undefined,
      },
    });
    return existing.id;
  }

  const created = await prisma.vcvEntity.create({
    data: {
      entityType: 'ORGANIZATION',
      canonicalId,
      displayName: authority.displayName,
      sourceIds: [authority.authorityKey],
      verifiedAt: new Date(),
      metadata: authority.metadata ? toJsonValue(authority.metadata) : toJsonValue({}),
    },
    select: { id: true },
  });

  return created.id;
}

export async function upsertVcvCredential(
  observation: MaterializedCredentialObservation,
): Promise<VcvCredential> {
  const subjectId = await ensureSubjectEntityId(observation.subjectNpi);
  const issuerId = await ensureIssuerEntityId(observation.authority);
  const familyKey = familyKeyForObservation({
    subjectId,
    domain: observation.domain,
    credentialType: observation.credentialType,
    jurisdiction: observation.jurisdiction,
    familyIdentity: observation.familyIdentity,
  });
  const credentialKey = credentialKeyForObservation({
    familyKey,
    status: observation.status,
    claimValue: observation.claimValue,
    expiresAt: observation.expiresAt,
    observedAt: observation.observedAt,
  });

  return prisma.$transaction(async (tx) => {
    const existingExact = await tx.vcvCredential.findUnique({
      where: { credentialKey },
    });

    if (existingExact) {
      return tx.vcvCredential.update({
        where: { id: existingExact.id },
        data: {
          issuerId,
          artifactIds: mergeStrings(existingExact.artifactIds, observation.artifactIds),
          receiptIds: mergeStrings(existingExact.receiptIds, observation.receiptIds),
          claimId: observation.claimId ?? existingExact.claimId,
          status: observation.status,
          claimValue: toJsonValue(observation.claimValue),
          verificationLevel: observation.verificationLevel,
          issuedAt: pickLatestDate(existingExact.issuedAt, observation.issuedAt),
          expiresAt: pickLatestDate(existingExact.expiresAt, observation.expiresAt),
          verifiedAt: pickLatestDate(existingExact.verifiedAt, observation.verifiedAt),
          observedAt: pickLatestDate(existingExact.observedAt, observation.observedAt),
          nextReverifyAt: pickLatestDate(existingExact.nextReverifyAt, observation.nextReverifyAt),
          jurisdiction: observation.jurisdiction ?? existingExact.jurisdiction,
          metadata: toJsonValue({
            ...asRecord(existingExact.metadata),
            ...observation.metadata,
          }),
          trustTier: observation.trustTier ?? existingExact.trustTier,
          confidence: observation.confidence ?? existingExact.confidence,
        },
      });
    }

    const familyRows = await tx.vcvCredential.findMany({
      where: {
        subjectId,
        credentialFamilyKey: familyKey,
        status: { not: 'SUPERSEDED' },
      },
      orderBy: [
        { observedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    const newestFamilyRow = familyRows[0] ?? null;
    if (
      newestFamilyRow
      && observation.observedAt
      && observation.observedAt.getTime() < observationTimestamp(newestFamilyRow)
    ) {
      return newestFamilyRow;
    }

    const created = await tx.vcvCredential.create({
      data: {
        subjectId,
        issuerId,
        credentialKey,
        credentialFamilyKey: familyKey,
        domain: observation.domain,
        credentialType: observation.credentialType,
        status: observation.status,
        verificationLevel: observation.verificationLevel,
        claimValue: toJsonValue(observation.claimValue),
        artifactIds: mergeStrings(observation.artifactIds),
        receiptIds: mergeStrings(observation.receiptIds),
        claimId: observation.claimId ?? null,
        issuedAt: observation.issuedAt ?? null,
        expiresAt: observation.expiresAt ?? null,
        verifiedAt: observation.verifiedAt ?? null,
        observedAt: observation.observedAt ?? null,
        nextReverifyAt: observation.nextReverifyAt ?? null,
        jurisdiction: observation.jurisdiction ?? null,
        metadata: toJsonValue(observation.metadata),
        trustTier: observation.trustTier ?? null,
        confidence: observation.confidence ?? null,
        supersedesCredentialId: newestFamilyRow?.id ?? null,
      },
    });

    if (familyRows.length > 0) {
      await tx.vcvCredential.updateMany({
        where: {
          id: { in: familyRows.map((credential) => credential.id) },
        },
        data: {
          status: 'SUPERSEDED',
          supersededByCredentialId: created.id,
        },
      });
    }

    return created;
  });
}

export async function materializeClaimsToVcvCredentials(
  input: MaterializeClaimsInput,
): Promise<MaterializeResult> {
  const artifact = await prisma.verificationArtifact.findUnique({
    where: { id: input.verificationArtifactId },
    select: {
      id: true,
      npi: true,
      source: true,
      status: true,
      rawPayload: true,
      observedAt: true,
      verifiedAt: true,
      expiresAt: true,
      trustTier: true,
      confidenceScore: true,
    },
  });

  const receiptIdsByClaimId = new Map<string, string[]>();
  for (const receipt of input.receipts) {
    const existing = receiptIdsByClaimId.get(receipt.claim_id) ?? [];
    existing.push(receipt.receipt_id);
    receiptIdsByClaimId.set(receipt.claim_id, existing);
  }

  const credentialIds: string[] = [];
  for (const claim of input.claims) {
    const observation = mapObservationFromClaim(
      claim,
      artifact,
      receiptIdsByClaimId.get(claim.claimId) ?? [],
    );
    if (!observation) {
      continue;
    }

    const credential = await upsertVcvCredential(observation);
    credentialIds.push(credential.id);
  }

  if (credentialIds.length === 0 && artifact) {
    const fallback = materializeFromVerificationArtifact(artifact);
    if (fallback) {
      const credential = await upsertVcvCredential(fallback);
      credentialIds.push(credential.id);
    }
  }

  return { credentialIds: mergeStrings(credentialIds) };
}

export async function materializeVerificationArtifactToVcvCredentials(
  verificationArtifactId: string,
): Promise<MaterializeResult> {
  const artifact = await prisma.verificationArtifact.findUnique({
    where: { id: verificationArtifactId },
    select: {
      id: true,
      npi: true,
      source: true,
      status: true,
      rawPayload: true,
      observedAt: true,
      verifiedAt: true,
      expiresAt: true,
      trustTier: true,
      confidenceScore: true,
    },
  });
  if (!artifact) {
    return { credentialIds: [] };
  }

  const observation = materializeFromVerificationArtifact(artifact);
  if (!observation) {
    return { credentialIds: [] };
  }

  const credential = await upsertVcvCredential(observation);
  return { credentialIds: [credential.id] };
}

export async function replayVcvCredentialsForNpi(npi: string): Promise<MaterializeResult> {
  const artifacts = await prisma.verificationArtifact.findMany({
    where: {
      npi,
      source: {
        in: ['NPPES', 'NPPES_API', 'OIG', 'OIG_LEIE', 'PECOS_PUBLIC', 'STATE_BOARD'],
      },
    },
    orderBy: [
      { observedAt: 'asc' },
      { verifiedAt: 'asc' },
      { createdAt: 'asc' },
    ],
    select: {
      id: true,
      npi: true,
      source: true,
      status: true,
      rawPayload: true,
      observedAt: true,
      verifiedAt: true,
      expiresAt: true,
      trustTier: true,
      confidenceScore: true,
    },
  });

  const credentialIds: string[] = [];
  for (const artifact of artifacts) {
    const result = await materializeVerificationArtifactToVcvCredentials(artifact.id);
    credentialIds.push(...result.credentialIds);
  }

  log('info', 'vcv_credential_replay_complete', {
    npi,
    credentialCount: credentialIds.length,
  });

  return { credentialIds: mergeStrings(credentialIds) };
}

export function isCredentialReadyForUse(
  credential: Pick<VcvCredential, 'domain' | 'status'>,
): boolean {
  return isCredentialCurrentStatus(credential.domain, credential.status);
}
