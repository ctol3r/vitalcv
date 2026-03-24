/**
 * upsertVcvCredential.ts — Materialize ingest claims → VcvCredential rows
 *
 * This is the bridge between the identity pipeline and the Passport.
 *
 * Flow:
 *   ingestClinicianIdentity() produces NormalizedClaim[]
 *   → mapClaimToCredential() derives domain/type/level/status
 *   → upsertVcvCredential() persists to vcv_credentials (idempotent on claimId)
 *
 * Idempotency: claimId is deterministic (sha256 of claimType+sourceId+npi+value).
 * Re-running ingest updates the existing row rather than creating duplicates.
 *
 * Issuer linkage: NPPES, OIG, PECOS canonical issuer entities are seeded at
 * startup. This file maps source IDs to canonical issuer entity IDs via
 * the issuer registry.
 *
 * Domain mapping (ClaimType → VcvCredentialDomain):
 *   NPI_IDENTITY, PERSONAL_IDENTITY → IDENTITY
 *   LICENSE, NURSING_LICENSE         → LICENSURE
 *   BOARD_CERTIFICATION, BOARD_CERT_FLAG → BOARD_CERTIFICATION
 *   DEA_REGISTRATION                 → DEA_REGISTRATION
 *   ENROLLMENT_STATUS, ORDER_REFERRAL → MEDICARE_ENROLLMENT
 *   EXCLUSION_STATUS, SANCTION_RECORD, FEDERAL_EXCLUSION → EXCLUSION_CHECK
 *   INSTITUTION_AFFILIATION          → HOSPITAL_PRIVILEGE
 *   (others skipped — not credential-domain claims)
 */

import prisma from '../../graphql/prisma_client';
import type {
  AuthorityUnavailableValue,
  BoardCertValue,
  LicenseValue,
  NormalizedClaim,
  TrainingCompletionValue,
} from '../identity/evidenceModel';
import type { ClaimType } from '../identity/sourceCatalog';
import type { VcvCredentialDomain, VcvVerificationLevel } from '@prisma/client';
import { log } from '../../obs/logger';
import { FRESHNESS_WINDOWS_DAYS } from '../../domain/entity/contracts';
import {
  authorityStatusForClaim,
  defaultAuthorityTruthFields,
  type AuthorityClaimCode,
  type AuthorityParticipationStatus,
  type AuthoritySourceScope,
  type AuthorityTargetDomain,
  type BoardOrderSeverity,
} from '../authority/contracts';
import {
  computePecosRevalidationDue,
  normalizePecosEnrollmentStatus,
} from '../identity/pecosContract';

// ── Source metadata ────────────────────────────────────────────────────────────

/** How often this source publishes new data */
export const SOURCE_DATA_FRESHNESS: Record<string, string> = {
  NPPES_API:          'Updated daily',
  NPPES_BULK:         'Updated daily',
  OIG_LEIE:           'Updated monthly',
  PECOS_PUBLIC:       'Updated quarterly',
  DOCTORS_CLINICIANS: 'Updated quarterly',
  NURSYS:             'Updated in real-time',
  FSMB:               'Updated weekly',
  DEA:                'Updated in real-time',
  SAM_GOV:            'Updated daily',
  STATE_BOARD:        'Varies by state',
  ACGME:              'Updated annually',
  LCME:               'Updated annually',
  CAQH:               'Updated quarterly',
};

/** Human-readable confidence label */
export function confidenceLabel(tier: string, score: number, reviewRequired: boolean): string {
  if (reviewRequired)              return 'Review recommended';
  if (tier === 'GOLD'  && score >= 0.9) return 'Confirmed';
  if (tier === 'GOLD'  && score >= 0.5) return 'Likely match';
  if (tier === 'SILVER'&& score >= 0.8) return 'Likely match';
  return 'Unverified';
}

// ── Domain mapping ─────────────────────────────────────────────────────────────

const CLAIM_TO_DOMAIN: Partial<Record<ClaimType, VcvCredentialDomain>> = {
  NPI_IDENTITY:          'IDENTITY',
  PERSONAL_IDENTITY:     'IDENTITY',
  LICENSE:               'LICENSURE',
  LICENSE_DISCIPLINE:    'LICENSURE',
  NURSING_LICENSE:       'LICENSURE',
  NURSING_DISCIPLINE:    'LICENSURE',
  BOARD_CERTIFICATION:   'BOARD_CERTIFICATION',
  BOARD_CERT_FLAG:       'BOARD_CERTIFICATION',
  TRAINING_COMPLETION:   'TRAINING',
  DEA_REGISTRATION:      'DEA_REGISTRATION',
  ENROLLMENT_STATUS:     'MEDICARE_ENROLLMENT',
  ORDER_REFERRAL:        'MEDICARE_ENROLLMENT',
  EXCLUSION_STATUS:      'EXCLUSION_CHECK',
  SANCTION_RECORD:       'EXCLUSION_CHECK',
  FEDERAL_EXCLUSION:     'EXCLUSION_CHECK',
  INSTITUTION_AFFILIATION: 'HOSPITAL_PRIVILEGE',
};

// ── Trust tier → VerificationLevel ────────────────────────────────────────────

function tierToLevel(tier: string, confidence: number): VcvVerificationLevel {
  if (tier === 'GOLD'   && confidence >= 0.9) return 'SOURCE_VERIFIED';
  if (tier === 'GOLD'   && confidence >= 0.5) return 'SOURCE_MATCHED';
  if (tier === 'SILVER' && confidence >= 0.8) return 'SOURCE_MATCHED';
  return 'SELF_REPORTED';
}

// ── Status mapping ─────────────────────────────────────────────────────────────

function claimStatusToCredStatus(claimStatus: string, reviewRequired: boolean): string {
  if (claimStatus === 'BLOCKED')    return 'SUSPENDED';
  if (claimStatus === 'SUPERSEDED') return 'REVOKED';
  if (reviewRequired)               return 'REVIEW_REQUIRED';
  if (claimStatus === 'ACTIVE')     return 'ACTIVE';
  if (claimStatus === 'EXPIRED')    return 'EXPIRED';
  if (claimStatus === 'UNVERIFIED') return 'UNRESOLVED';
  return 'UNRESOLVED';
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function licenseStatusFromValue(value: unknown): LicenseValue['licenseStatus'] {
  const normalized = stringValue(asRecord(value)['licenseStatus'])?.toUpperCase();
  if (normalized === 'ACTIVE') return 'ACTIVE';
  if (normalized === 'EXPIRED') return 'EXPIRED';
  if (normalized === 'SUSPENDED') return 'SUSPENDED';
  if (normalized === 'REVOKED') return 'REVOKED';
  return 'UNKNOWN';
}

function boardCertificationStatusFromValue(
  value: unknown,
): BoardCertValue['certificationStatus'] {
  const normalized = stringValue(asRecord(value)['certificationStatus'])?.toUpperCase();
  if (normalized === 'CERTIFIED') return 'CERTIFIED';
  if (normalized === 'NOT_CERTIFIED') return 'NOT_CERTIFIED';
  if (normalized === 'LAPSED') return 'LAPSED';
  return 'UNKNOWN';
}

function defaultAuthoritySourceScope(
  claimType: ClaimType,
  sourceId: string,
): AuthoritySourceScope | null {
  if (sourceId === 'FSMB' && claimType === 'BOARD_CERTIFICATION') return 'FSMB_ABMS_INCLUDED';
  if (sourceId === 'FSMB' && claimType === 'TRAINING_COMPLETION') return 'FSMB_TRAINING';
  if (sourceId === 'FSMB') return 'FSMB_MED_API';
  if (sourceId === 'NURSYS') return 'NURSYS_AUTHORIZED_PATH';
  return null;
}

function authorityClaimCodeForClaim(
  claim: NormalizedClaim,
): AuthorityClaimCode | null {
  const value = asRecord(claim.value);
  const explicit = stringValue(value['authorityClaimCode']);
  if (explicit) {
    return explicit as AuthorityClaimCode;
  }

  if (claim.claimType === 'AUTHORITY_UNAVAILABLE') return 'AUTHORITY_UNAVAILABLE';
  if (claim.claimType === 'TRAINING_COMPLETION') return 'TRAINING_COMPLETED';
  if (claim.claimType === 'LICENSE_DISCIPLINE') return 'BOARD_ORDER_PRESENT';
  if (claim.claimType === 'NURSING_DISCIPLINE') return 'RN_LICENSE_DISCIPLINED';

  if (claim.claimType === 'BOARD_CERTIFICATION') {
    const status = boardCertificationStatusFromValue(value);
    return status === 'CERTIFIED' ? 'BOARD_CERTIFIED' : null;
  }

  if (claim.claimType === 'NURSING_LICENSE') {
    const status = licenseStatusFromValue(value);
    if (status === 'ACTIVE') return 'RN_LICENSE_ACTIVE';
    if (status === 'EXPIRED') return 'RN_LICENSE_EXPIRED';
    if (status === 'SUSPENDED' || status === 'REVOKED') return 'RN_LICENSE_DISCIPLINED';
    return null;
  }

  if (claim.claimType === 'LICENSE') {
    const status = licenseStatusFromValue(value);
    return status === 'ACTIVE' ? 'PHYSICIAN_LICENSE_ACTIVE' : null;
  }

  return null;
}

function authorityTargetDomainForClaim(
  claim: NormalizedClaim,
): AuthorityTargetDomain | null {
  if (claim.claimType === 'AUTHORITY_UNAVAILABLE') {
    const value = asRecord(claim.value);
    const explicit = stringValue(value['targetDomain']);
    if (explicit === 'LICENSURE' || explicit === 'BOARD_CERTIFICATION' || explicit === 'TRAINING') {
      return explicit;
    }
  }

  if (claim.claimType === 'BOARD_CERTIFICATION') return 'BOARD_CERTIFICATION';
  if (claim.claimType === 'TRAINING_COMPLETION') return 'TRAINING';
  if (
    claim.claimType === 'LICENSE'
    || claim.claimType === 'LICENSE_DISCIPLINE'
    || claim.claimType === 'NURSING_LICENSE'
    || claim.claimType === 'NURSING_DISCIPLINE'
  ) {
    return 'LICENSURE';
  }

  return null;
}

function authorityMetadataFromClaim(
  claim: NormalizedClaim,
): ReturnType<typeof defaultAuthorityTruthFields> | null {
  const authorityClaimCode = authorityClaimCodeForClaim(claim);
  const targetDomain = authorityTargetDomainForClaim(claim);
  if (!authorityClaimCode || !targetDomain) {
    return null;
  }

  const value = asRecord(claim.value);
  const sourceScope = stringValue(value['sourceScope']) as AuthoritySourceScope | null
    ?? defaultAuthoritySourceScope(claim.claimType, claim.sourceId);
  if (!sourceScope) {
    return null;
  }

  return defaultAuthorityTruthFields({
    authorityClaimCode,
    issuerEntityId: stringValue(value['issuerEntityId']),
    sourceScope,
    effectiveAt:
      stringValue(value['effectiveAt'])
      ?? stringValue(value['issueDate'])
      ?? stringValue(value['certificationDate'])
      ?? stringValue(value['completionDate'])
      ?? claim.observedAt,
    expiresAt:
      stringValue(value['expiresAt'])
      ?? stringValue(value['expiryDate'])
      ?? claim.expiresAt,
    verifiedAt: stringValue(value['verifiedAt']) ?? claim.observedAt,
    dataFreshness: stringValue(value['dataFreshness']) ?? SOURCE_DATA_FRESHNESS[claim.sourceId] ?? 'Freshness unavailable',
    participationStatus:
      (stringValue(value['participationStatus']) as AuthorityParticipationStatus | null)
      ?? (authorityClaimCode === 'AUTHORITY_UNAVAILABLE' ? 'unresolved' : 'verified_result'),
    boardOrderSeverity: (stringValue(value['boardOrderSeverity']) ?? 'NONE') as BoardOrderSeverity,
    connectorState:
      (stringValue(value['connectorState']) as 'configured' | 'unavailable' | 'unresolved' | 'connected' | null)
      ?? (authorityClaimCode === 'AUTHORITY_UNAVAILABLE' ? 'unresolved' : 'connected'),
    targetDomain,
    confidenceLabel: stringValue(value['confidenceLabel']) ?? undefined,
  });
}

function credentialStatusFromClaim(claim: NormalizedClaim): string {
  const authorityMetadata = authorityMetadataFromClaim(claim);
  if (claim.claimType === 'BOARD_CERTIFICATION') {
    const certificationStatus = boardCertificationStatusFromValue(claim.value);
    if (certificationStatus === 'LAPSED') return 'EXPIRED';
    if (!authorityMetadata?.authorityClaimCode) {
      return claimStatusToCredStatus(claim.status, claim.reviewRequired ?? false);
    }
    return authorityStatusForClaim({
      claimCode: authorityMetadata.authorityClaimCode,
    });
  }

  if (claim.claimType === 'TRAINING_COMPLETION') {
    if (authorityMetadata?.authorityClaimCode === 'AUTHORITY_UNAVAILABLE') return 'UNRESOLVED';
    return 'ACTIVE';
  }

  if (
    claim.claimType === 'LICENSE'
    || claim.claimType === 'LICENSE_DISCIPLINE'
    || claim.claimType === 'NURSING_LICENSE'
    || claim.claimType === 'NURSING_DISCIPLINE'
  ) {
    if (!authorityMetadata?.authorityClaimCode) {
      const licenseStatus = licenseStatusFromValue(claim.value);
      if (licenseStatus === 'ACTIVE') return 'ACTIVE';
      if (licenseStatus === 'EXPIRED') return 'EXPIRED';
      if (licenseStatus === 'SUSPENDED') return 'SUSPENDED';
      if (licenseStatus === 'REVOKED') return 'REVOKED';
      return claimStatusToCredStatus(claim.status, claim.reviewRequired ?? false);
    }

    return authorityStatusForClaim({
      claimCode: authorityMetadata.authorityClaimCode,
      boardOrderSeverity: authorityMetadata?.boardOrderSeverity,
    });
  }

  return claimStatusToCredStatus(claim.status, claim.reviewRequired ?? false);
}

// ── Freshness window → nextReverifyAt ─────────────────────────────────────────

function computeNextReverify(claim: NormalizedClaim, domain: VcvCredentialDomain, verifiedAt: Date): Date {
  if (claim.sourceId === 'PECOS_PUBLIC' && claim.claimType === 'ENROLLMENT_STATUS') {
    const value = asRecord(claim.value);
    const explicitDue = stringValue(value['revalidationDue']);
    if (explicitDue) {
      return new Date(explicitDue);
    }
    const pecosDue = computePecosRevalidationDue({
      status: normalizePecosEnrollmentStatus({
        claimState: value['claimState'],
        enrolled: typeof value['enrolled'] === 'boolean' ? value['enrolled'] : null,
        source: value['source'],
      }),
      observedAt: stringValue(value['observedAt']) ?? claim.observedAt,
    });
    if (pecosDue) {
      return new Date(pecosDue);
    }
  }

  const days = FRESHNESS_WINDOWS_DAYS[domain as keyof typeof FRESHNESS_WINDOWS_DAYS] ?? 90;
  const d = new Date(verifiedAt);
  d.setDate(d.getDate() + days);
  return d;
}

// ── Claim value extraction helpers ────────────────────────────────────────────

function extractJurisdiction(claimType: ClaimType, value: unknown): string | undefined {
  const v = value as Record<string, unknown>;
  if (
    claimType === 'LICENSE'
    || claimType === 'LICENSE_DISCIPLINE'
    || claimType === 'NURSING_LICENSE'
    || claimType === 'NURSING_DISCIPLINE'
  ) {
    return v['licenseState'] as string ?? v['state'] as string ?? undefined;
  }
  if (claimType === 'AUTHORITY_UNAVAILABLE') {
    return v['jurisdiction'] as string ?? v['state'] as string ?? undefined;
  }
  if (claimType === 'DEA_REGISTRATION') {
    return v['state'] as string ?? undefined;
  }
  return undefined;
}

function extractDates(claimType: ClaimType, value: unknown): {
  issuedAt?:  Date;
  expiresAt?: Date;
} {
  const v = value as Record<string, unknown>;

  const parseDate = (s: unknown): Date | undefined => {
    if (!s || typeof s !== 'string') return undefined;
    const d = new Date(s);
    return isNaN(d.getTime()) ? undefined : d;
  };

  return {
    issuedAt:  parseDate(v['issueDate'] ?? v['issuedAt'] ?? v['enrollmentDate'] ?? v['exclusionDate'] ?? v['certificationDate'] ?? v['completionDate'] ?? v['effectiveAt']),
    expiresAt: parseDate(v['expirationDate'] ?? v['expiresAt'] ?? v['reinstatementDate'] ?? v['expiryDate']),
  };
}

function deriveCredentialType(claimType: ClaimType, value: unknown): string {
  const v = value as Record<string, unknown>;
  switch (claimType) {
    case 'LICENSE':
    case 'LICENSE_DISCIPLINE':
    case 'NURSING_LICENSE':
    case 'NURSING_DISCIPLINE': {
      const state = (v['licenseState'] ?? v['state'] ?? '') as string;
      const type  = (v['licenseType']  ?? 'STATE_LICENSE') as string;
      return state ? `${type}_${state}`.toUpperCase() : type.toUpperCase();
    }
    case 'BOARD_CERTIFICATION':
    case 'BOARD_CERT_FLAG': {
      const board = (v['boardName'] ?? v['specialty'] ?? 'BOARD_CERT') as string;
      return board.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    }
    case 'TRAINING_COMPLETION': {
      const trainingType = (v['trainingType'] ?? 'TRAINING') as string;
      const programName = (v['programName'] ?? v['institution'] ?? 'PROGRAM') as string;
      return `${trainingType}_${programName}`.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    }
    case 'AUTHORITY_UNAVAILABLE': {
      const scope = (v['sourceScope'] ?? v['targetDomain'] ?? 'AUTHORITY') as string;
      return `AUTHORITY_UNAVAILABLE_${scope}`.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    }
    case 'DEA_REGISTRATION':
      return 'DEA_REGISTRATION';
    case 'ENROLLMENT_STATUS':
      return 'MEDICARE_ENROLLMENT';
    case 'EXCLUSION_STATUS':
      return 'OIG_LEIE_EXCLUSION_CHECK';
    case 'SANCTION_RECORD':
      return 'SANCTION_RECORD';
    case 'FEDERAL_EXCLUSION':
      return 'SAM_GOV_EXCLUSION_CHECK';
    case 'NPI_IDENTITY':
      return 'NPI_IDENTITY';
    case 'PERSONAL_IDENTITY':
      return 'IDENTITY_VERIFICATION';
    case 'INSTITUTION_AFFILIATION':
      return 'HOSPITAL_AFFILIATION';
    default:
      return claimType;
  }
}

// ── Issuer registry (cached after seed) ───────────────────────────────────────

const issuerCache: Record<string, string | null> = {};

async function getIssuerId(sourceId: string): Promise<string | undefined> {
  if (sourceId in issuerCache) return issuerCache[sourceId] ?? undefined;

  const entity = await prisma.vcvEntity.findFirst({
    where: { canonicalId: `ISSUER:${sourceId}` },
    select: { id: true },
  });

  issuerCache[sourceId] = entity?.id ?? null;
  return entity?.id ?? undefined;
}

// ── Core upsert ────────────────────────────────────────────────────────────────

export interface UpsertResult {
  credentialId: string;
  domain:       VcvCredentialDomain;
  action:       'created' | 'updated' | 'skipped';
}

/**
 * Upsert a VcvCredential from a NormalizedClaim.
 * Returns null if the claim type has no credential domain mapping.
 */
export async function upsertVcvCredential(
  claim:    NormalizedClaim,
  entityId: string,
): Promise<UpsertResult | null> {
  const authorityTargetDomain = authorityTargetDomainForClaim(claim);
  const domain = claim.claimType === 'AUTHORITY_UNAVAILABLE'
    ? authorityTargetDomain as VcvCredentialDomain | undefined
    : CLAIM_TO_DOMAIN[claim.claimType];
  if (!domain) return null;

  const verificationLevel = tierToLevel(claim.tier, claim.confidenceScore ?? 0.5);
  const status            = credentialStatusFromClaim(claim);
  const credentialType    = deriveCredentialType(claim.claimType, claim.value);
  const jurisdiction      = extractJurisdiction(claim.claimType, claim.value);
  const { issuedAt, expiresAt } = extractDates(claim.claimType, claim.value);
  const verifiedAt        = new Date(claim.observedAt);
  const nextReverifyAt    = computeNextReverify(claim, domain, verifiedAt);
  const issuerId          = await getIssuerId(claim.sourceId);
  const authorityMetadata = authorityMetadataFromClaim(claim);

  const claimValue = JSON.parse(JSON.stringify(claim.value)) as import('@prisma/client').Prisma.InputJsonValue;
  const credentialFamilyKey = `legacy-family:${entityId}:${domain}:${credentialType}:${jurisdiction ?? 'none'}`;
  const credentialKey = claim.claimId
    ? `legacy-claim:${claim.claimId}`
    : `legacy:${entityId}:${domain}:${credentialType}:${claim.sourceId}`;

  try {
    const existing = claim.claimId
      ? await prisma.vcvCredential.findFirst({ where: { claimId: claim.claimId }, select: { id: true } })
      : null;

    if (existing) {
      await prisma.vcvCredential.update({
        where: { id: existing.id },
        data: {
          status,
          verificationLevel,
          claimValue,
          verifiedAt,
          expiresAt:      expiresAt    ?? undefined,
          issuedAt:       issuedAt     ?? undefined,
          nextReverifyAt,
          jurisdiction:   jurisdiction ?? undefined,
          issuerId:       issuerId     ?? undefined,
          updatedAt:      new Date(),
        },
      });
      return { credentialId: existing.id, domain, action: 'updated' };
    }

    const created = await prisma.vcvCredential.create({
      data: {
        subjectId:         entityId,
        issuerId,
        credentialKey,
        credentialFamilyKey,
        domain,
        credentialType,
        status,
        verificationLevel,
        claimValue,
        claimId:           claim.claimId ?? undefined,
        artifactIds:       claim.artifactId ? [claim.artifactId] : [],
        observedAt:        verifiedAt,
        trustTier:         claim.tier,
        confidence:        claim.confidenceScore ?? null,
        issuedAt,
        expiresAt,
        verifiedAt,
        nextReverifyAt,
        jurisdiction,
        metadata: {
          sourceId:        claim.sourceId,
          confidence:      claim.confidence,
          confidenceScore: claim.confidenceScore,
          tier:            claim.tier,
          confidenceLabel: confidenceLabel(claim.tier, claim.confidenceScore ?? 0.5, claim.reviewRequired ?? false),
          dataFreshness:   SOURCE_DATA_FRESHNESS[claim.sourceId] ?? 'Freshness unknown',
          reviewRequired:  claim.reviewRequired ?? false,
          ...(authorityMetadata ? {
            authorityClaimCode: authorityMetadata.authorityClaimCode,
            issuerEntityId: issuerId ?? authorityMetadata.issuerEntityId,
            sourceScope: authorityMetadata.sourceScope,
            effectiveAt: authorityMetadata.effectiveAt,
            expiresAt: authorityMetadata.expiresAt,
            verifiedAt: authorityMetadata.verifiedAt,
            confidenceLabel: authorityMetadata.confidenceLabel,
            dataFreshness: authorityMetadata.dataFreshness,
            participationStatus: authorityMetadata.participationStatus,
            boardOrderSeverity: authorityMetadata.boardOrderSeverity,
            connectorState: authorityMetadata.connectorState,
            targetDomain: authorityMetadata.targetDomain,
          } : {}),
        } as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    return { credentialId: created.id, domain, action: 'created' };
  } catch (err) {
    log('error', 'upsertVcvCredential failed', {
      entityId, claimType: claim.claimType, claimId: claim.claimId, error: String(err),
    });
    return null;
  }
}

/**
 * Materialize all claims from an ingest run into VcvCredential rows.
 * Called at the end of ingestClinicianIdentity() after entity is resolved.
 */
export async function materializeCredentials(
  claims:   NormalizedClaim[],
  entityId: string,
): Promise<{ created: number; updated: number; skipped: number }> {
  const counts = { created: 0, updated: 0, skipped: 0 };

  for (const claim of claims) {
    const result = await upsertVcvCredential(claim, entityId);
    if (!result)               counts.skipped++;
    else if (result.action === 'created') counts.created++;
    else if (result.action === 'updated') counts.updated++;
    else                       counts.skipped++;
  }

  log('info', 'credentials_materialized', { entityId, ...counts, total: claims.length });
  return counts;
}
