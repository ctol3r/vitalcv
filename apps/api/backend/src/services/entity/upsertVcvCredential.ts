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
import type { NormalizedClaim } from '../identity/evidenceModel';
import type { ClaimType } from '../identity/sourceCatalog';
import type { VcvCredentialDomain, VcvVerificationLevel } from '@prisma/client';
import { log } from '../../obs/logger';
import { FRESHNESS_WINDOWS_DAYS } from '../../domain/entity/contracts';

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
  if (reviewRequired)               return 'PENDING_REVIEW';
  if (claimStatus === 'ACTIVE')     return 'ACTIVE';
  if (claimStatus === 'INACTIVE')   return 'EXPIRED';
  return 'UNKNOWN';
}

// ── Freshness window → nextReverifyAt ─────────────────────────────────────────

function computeNextReverify(domain: VcvCredentialDomain, verifiedAt: Date): Date {
  const days = FRESHNESS_WINDOWS_DAYS[domain as keyof typeof FRESHNESS_WINDOWS_DAYS] ?? 90;
  const d = new Date(verifiedAt);
  d.setDate(d.getDate() + days);
  return d;
}

// ── Claim value extraction helpers ────────────────────────────────────────────

function extractJurisdiction(claimType: ClaimType, value: unknown): string | undefined {
  const v = value as Record<string, unknown>;
  if (claimType === 'LICENSE' || claimType === 'NURSING_LICENSE') {
    return v['licenseState'] as string ?? v['state'] as string ?? undefined;
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
    issuedAt:  parseDate(v['issueDate'] ?? v['issuedAt'] ?? v['enrollmentDate'] ?? v['exclusionDate']),
    expiresAt: parseDate(v['expirationDate'] ?? v['expiresAt'] ?? v['reinstatementDate']),
  };
}

function deriveCredentialType(claimType: ClaimType, value: unknown): string {
  const v = value as Record<string, unknown>;
  switch (claimType) {
    case 'LICENSE':
    case 'NURSING_LICENSE': {
      const state = (v['licenseState'] ?? v['state'] ?? '') as string;
      const type  = (v['licenseType']  ?? 'STATE_LICENSE') as string;
      return state ? `${type}_${state}`.toUpperCase() : type.toUpperCase();
    }
    case 'BOARD_CERTIFICATION':
    case 'BOARD_CERT_FLAG': {
      const board = (v['boardName'] ?? v['specialty'] ?? 'BOARD_CERT') as string;
      return board.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
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
      return 'NPI_ENROLLMENT';
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
  const domain = CLAIM_TO_DOMAIN[claim.claimType];
  if (!domain) return null;

  const verificationLevel = tierToLevel(claim.tier, claim.confidenceScore ?? 0.5);
  const status            = claimStatusToCredStatus(claim.status, claim.reviewRequired ?? false);
  const credentialType    = deriveCredentialType(claim.claimType, claim.value);
  const jurisdiction      = extractJurisdiction(claim.claimType, claim.value);
  const { issuedAt, expiresAt } = extractDates(claim.claimType, claim.value);
  const verifiedAt        = new Date(claim.observedAt);
  const nextReverifyAt    = computeNextReverify(domain, verifiedAt);
  const issuerId          = await getIssuerId(claim.sourceId);

  const claimValue = JSON.parse(JSON.stringify(claim.value)) as import('@prisma/client').Prisma.InputJsonValue;

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
        domain,
        credentialType,
        status,
        verificationLevel,
        claimValue,
        claimId:           claim.claimId ?? undefined,
        artifactIds:       claim.artifactId ? [claim.artifactId] : [],
        issuedAt,
        expiresAt,
        verifiedAt,
        nextReverifyAt,
        jurisdiction,
        metadata: {
          sourceId:   claim.sourceId,
          confidence: claim.confidence,
          tier:       claim.tier,
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
