/**
 * passport.ts — Portable professional authority identity
 *
 * Access modes:
 *   public     (default) — publicly verifiable fields, redacted OIG details, deduped credentials
 *   wallet     (?mode=wallet&token=<npi>) — clinician self-view, all fields, full sanctions detail
 *   selective  (?mode=selective&disclose=licenses,certifications,privileges,sanctions,decisions)
 *
 * Routes:
 *   GET /api/passport/:npi                                    — full passport (mode param)
 *   GET /api/passport/:npi/trust                              — trust summary
 *   GET /api/passport/:npi/disclose?fields=licenses,certs     — selective disclosure
 *   GET /api/passport/:npi/embed.svg                          — badge SVG
 *   GET /api/passport/:npi/card.json                          — JSON-LD
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { proofRateLimit } from '../middleware/rateLimitFactory';
import { log } from '../obs/logger';
import { emitLearningEvent } from '../services/feedback/prismaEventStore';
import { generateShareLink } from '../services/passport/shareLink';
import { buildPassportByNpi } from '../services/entity/passportService';
import { buildEmployerEvidencePacket } from '../services/entity/employerPacket';
import { sha256ForPayload } from '../utils/deterministic';
import {
  getCachedTrustState,
  computeClinicianTrustState,
  type ClinicianTrustState,
  type TrustBand as ReadinessLevel,
} from '../services/trust/trustStateEngine';

import { authMiddleware } from '../middleware/authMiddleware';

const NPI_RE = /^\d{10}$/;
const PUBLIC_TYPES = new Set(['NPI_IDENTITY', 'NPI_ENROLLMENT', 'STATE_LICENSE', 'BOARD_CERTIFICATION', 'ENROLLMENT', 'SANCTIONS_CHECK', 'IDENTITY', 'PUBLICATION', 'AFFILIATION']);

export type PublicTrustBand = 'GREEN' | 'YELLOW' | 'RED';
export type PassportCredentialStatus =
  | 'ACTIVE'
  | 'PENDING'
  | 'EXPIRED'
  | 'REVOKED'
  | 'SUSPENDED'
  | 'UNKNOWN';

export type CredentialType =
  | 'NPI_IDENTITY'
  | 'NPI_ENROLLMENT'
  | 'STATE_LICENSE'
  | 'BOARD_CERTIFICATION'
  | 'DEA_REGISTRATION'
  | 'OIG_EXCLUSION'
  | 'PRIMARY_SOURCE_VERIFICATION'
  | 'ENROLLMENT'
  | 'SANCTIONS_CHECK'
  | 'IDENTITY'
  | 'PUBLICATION'
  | 'AFFILIATION';

type ProviderRecord = {
  fullName: string | null;
  taxonomyCode: string | null;
  providerType: string | null;
  stateOfPractice: string | null;
};

type VerificationArtifactRecord = {
  id: string;
  source: string;
  status: string;
  verifiedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  rawPayload: unknown;
};

export type PassportCredential = {
  id: string;
  type: CredentialType;
  name: string;
  issuer: string;
  status: PassportCredentialStatus;
  verifiedAt: string | null;
  expiresAt: string | null;
  isPublic: boolean;
};

type SanctionsStatus = {
  status: 'CLEAR' | 'FLAGGED' | 'UNKNOWN';
  checkedAt: string | null;
  /** Only present in wallet mode */
  matchType?: string;
  /** Only present in wallet mode */
  detail?: string;
};

type PassportPrivilege = {
  facility: string;
  privilegeType: string;
  status: 'ACTIVE' | 'AT_RISK' | 'REVOKED';
  grantedAt: string | null;
  capsuleId: string;
};

type PassportDecision = {
  id: string;
  decisionType: string;
  status: 'VALID' | 'AT_RISK' | 'INVALID';
  /** Redacted in public mode */
  organization: string | null;
  grantedAt: string | null;
  artifactHash: string;
};

type PassportAccessMode = 'public' | 'wallet' | 'selective' | 'authorized';

export type PassportDocument = {
  npi: string;
  accessMode: PassportAccessMode;
  public: {
    name: string;
    specialty: string;
    providerType: string;
    state: string;
    trustBand: PublicTrustBand;
    readinessScore: number;
    totalCredentials: number;
    activeCredentials: number;
    shareUrl: string;
    embedUrl: string;
  };
  credentials: PassportCredential[];
  sanctions: SanctionsStatus;
  privileges: PassportPrivilege[];
  decisions: PassportDecision[];
  meta: {
    methodology: string;
    computedAt: string;
    passportVersion: '2.0';
    disclosedFields?: string[];
  };
};

export type TrustDocument = {
  npi: string;
  trustBand: PublicTrustBand;
  readinessScore: number;
  readinessStatus: string;
  computedAt: string;
  shareUrl: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickPayload(rawPayload: unknown): Record<string, unknown> | null {
  if (!isRecord(rawPayload)) {
    return null;
  }

  const nestedPayload = rawPayload.payload_json;
  if (isRecord(nestedPayload)) {
    return nestedPayload;
  }

  return rawPayload;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

function joinIdentityName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

function isGenericPassportName(name: string): boolean {
  return (
    name.length === 0
    || /^unknown (provider|organization)$/i.test(name)
    || /^provider not found in nppes$/i.test(name)
    || /^clinician \d{10}$/i.test(name)
    || /^organization \d{10}$/i.test(name)
    || /^npi \d{10}$/i.test(name)
  );
}

function inferNppesIdentityName(artifact: VerificationArtifactRecord): string {
  const payload = pickPayload(artifact.rawPayload);
  const basic = isRecord(payload?.basic) ? payload.basic : payload;
  if (!isRecord(basic)) {
    return '';
  }

  const enumerationType = firstNonEmpty(payload?.enumeration_type, basic.enumeration_type);
  const organizationName = firstNonEmpty(basic.organization_name, basic.organizationName);
  if (enumerationType === 'NPI-2' && organizationName) {
    return organizationName;
  }

  const firstName = firstNonEmpty(
    basic.first_name,
    basic.firstName,
    basic.authorized_official_first_name,
  );
  const lastName = firstNonEmpty(
    basic.last_name,
    basic.lastName,
    basic.authorized_official_last_name,
  );
  const personalName = joinIdentityName(firstName, lastName);
  if (personalName) {
    return personalName;
  }

  return organizationName;
}

function normalizeStatus(value: string): PassportCredentialStatus {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'VERIFIED' || normalized === 'CLEAR') {
    return 'ACTIVE';
  }
  if (normalized === 'PENDING' || normalized === 'NOT_FOUND' || normalized === 'NOT_AVAILABLE') {
    return 'PENDING';
  }
  if (normalized === 'EXPIRED') {
    return 'EXPIRED';
  }
  if (normalized === 'REVOKED' || normalized === 'EXCLUDED') {
    return 'REVOKED';
  }
  if (normalized === 'SUSPENDED' || normalized === 'DEACTIVATED' || normalized === 'CHECK_FAILED') {
    return 'SUSPENDED';
  }
  return 'UNKNOWN';
}

function mapReadinessLevel(level: ReadinessLevel): PublicTrustBand {
  if (level === 'L3' || level === 'L2') {
    return 'GREEN';
  }
  if (level === 'L1') {
    return 'YELLOW';
  }
  return 'RED';
}

function mapCredentialType(source: string, payload: Record<string, unknown> | null): CredentialType {
  const rawType = typeof payload?.credential_type === 'string'
    ? payload.credential_type.trim().toUpperCase()
    : null;

  if (rawType === 'NPI_IDENTITY' || rawType === 'NPI_ENROLLMENT' || rawType === 'STATE_LICENSE' || rawType === 'BOARD_CERTIFICATION'
    || rawType === 'DEA_REGISTRATION' || rawType === 'OIG_EXCLUSION') {
    return rawType;
  }

  const normalizedSource = source.trim().toUpperCase();
  if (normalizedSource === 'NPPES' || normalizedSource === 'CMS' || normalizedSource === 'NPI_REGISTRY') {
    return 'NPI_IDENTITY';
  }
  if (
    normalizedSource === 'STATE_BOARD'
    || normalizedSource === 'NURSYS'
    || normalizedSource === 'FSMB'
    || normalizedSource.includes('LICENSE')
  ) {
    return 'STATE_LICENSE';
  }
  if (normalizedSource === 'ABMS' || normalizedSource.includes('BOARD_CERT')) {
    return 'BOARD_CERTIFICATION';
  }
  if (normalizedSource === 'DEA' || normalizedSource.includes('DEA')) {
    return 'DEA_REGISTRATION';
  }
  if (
    normalizedSource === 'OIG'
    || normalizedSource === 'SAM'
    || normalizedSource === 'NPDB'
    || normalizedSource.includes('EXCLUSION')
    || normalizedSource.includes('SANCTION')
  ) {
    return 'OIG_EXCLUSION';
  }

  return 'PRIMARY_SOURCE_VERIFICATION';
}

function inferIssuer(
  credentialType: CredentialType,
  source: string,
  payload: Record<string, unknown> | null,
  isPublic: boolean,
): string {
  if (!isPublic) {
    return 'Restricted';
  }

  const boardName = typeof payload?.board_name === 'string' ? payload.board_name.trim() : '';
  if (boardName) {
    return boardName;
  }

  if (credentialType === 'NPI_IDENTITY' || credentialType === 'NPI_ENROLLMENT') {
    return 'CMS NPPES';
  }
  if (credentialType === 'DEA_REGISTRATION') {
    return 'U.S. Drug Enforcement Administration';
  }
  if (credentialType === 'BOARD_CERTIFICATION') {
    return 'Specialty Board';
  }

  return source;
}

function inferName(
  credentialType: CredentialType,
  payload: Record<string, unknown> | null,
  isPublic: boolean,
): string {
  if (!isPublic) {
    return 'Restricted credential';
  }

  if (credentialType === 'NPI_IDENTITY' || credentialType === 'NPI_ENROLLMENT') {
    return 'NPI Identity';
  }
  if (credentialType === 'STATE_LICENSE') {
    const state = typeof payload?.state === 'string' ? payload.state.trim() : '';
    return state ? `${state} State License` : 'State License';
  }
  if (credentialType === 'BOARD_CERTIFICATION') {
    const specialty =
      typeof payload?.specialty === 'string' ? payload.specialty.trim()
        : typeof payload?.specialty_name === 'string' ? payload.specialty_name.trim()
          : '';
    return specialty ? `${specialty} Board Certification` : 'Board Certification';
  }
  if (credentialType === 'DEA_REGISTRATION') {
    return 'DEA Registration';
  }
  if (credentialType === 'OIG_EXCLUSION') {
    return 'Sanctions Check';
  }

  return 'Primary Source Verification';
}

function inferSpecialty(
  provider: ProviderRecord | null,
  artifacts: readonly VerificationArtifactRecord[],
): string {
  if (provider?.taxonomyCode && provider.taxonomyCode.trim().length > 0) {
    return provider.taxonomyCode.trim();
  }

  for (const artifact of artifacts) {
    const payload = pickPayload(artifact.rawPayload);
    const specialty =
      typeof payload?.specialty === 'string' ? payload.specialty.trim()
        : typeof payload?.specialty_name === 'string' ? payload.specialty_name.trim()
          : typeof payload?.taxonomy_description === 'string' ? payload.taxonomy_description.trim()
            : '';
    if (specialty) {
      return specialty;
    }

    if (Array.isArray(payload?.taxonomy_descriptions)) {
      const firstLabel = payload.taxonomy_descriptions.find(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      );
      if (firstLabel) {
        return firstLabel.trim();
      }
    }
  }

  return 'Clinical';
}

function inferState(
  provider: ProviderRecord | null,
  artifacts: readonly VerificationArtifactRecord[],
): string {
  if (provider?.stateOfPractice && provider.stateOfPractice.trim().length > 0) {
    return provider.stateOfPractice.trim();
  }

  for (const artifact of artifacts) {
    const payload = pickPayload(artifact.rawPayload);
    const state =
      typeof payload?.state === 'string' ? payload.state.trim()
        : typeof payload?.practice_state === 'string' ? payload.practice_state.trim()
          : '';
    if (state) {
      return state;
    }
  }

  return 'Unknown';
}

function inferClinicianName(
  npi: string,
  provider: ProviderRecord | null,
  artifacts: readonly VerificationArtifactRecord[],
  nppesClaimValue?: Record<string, unknown> | null,
): string {
  // Priority 1: NPPES identity from ClaimRecord (new ingest pipeline)
  if (nppesClaimValue) {
    const firstName = typeof nppesClaimValue.firstName === 'string' ? nppesClaimValue.firstName.trim() : '';
    const lastName = typeof nppesClaimValue.lastName === 'string' ? nppesClaimValue.lastName.trim() : '';
    const credential = typeof nppesClaimValue.credential === 'string' ? nppesClaimValue.credential.trim() : '';
    if (firstName || lastName) {
      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      return credential ? `${fullName}, ${credential}` : fullName;
    }
  }

  // Priority 2: NPPES artifacts from VerificationArtifact (legacy pipeline)
  for (const artifact of artifacts) {
    if (artifact.source === 'NPPES_API' || artifact.source === 'NPPES' || artifact.source === 'NPI_REGISTRY') {
      const nppesName = inferNppesIdentityName(artifact);
      if (nppesName) {
        return nppesName;
      }
    }
  }

  // Fall back to other artifact name fields
  for (const artifact of artifacts) {
    const payload = pickPayload(artifact.rawPayload);
    const providerName = firstNonEmpty(payload?.provider_name, payload?.licensee);
    if (providerName && !isGenericPassportName(providerName)) {
      return providerName;
    }
  }

  const storedName = provider?.fullName?.trim() ?? '';
  if (!isGenericPassportName(storedName)) {
    return storedName;
  }

  return `Clinician ${npi}`;
}

function credentialKey(
  credentialType: CredentialType,
  source: string,
  payload: Record<string, unknown> | null,
): string {
  const state = typeof payload?.state === 'string' ? payload.state.trim().toUpperCase() : '';
  const boardName = typeof payload?.board_name === 'string' ? payload.board_name.trim().toUpperCase() : '';
  return [credentialType, source.trim().toUpperCase(), state, boardName].filter(Boolean).join(':');
}

function buildPublicUrls(npi: string): { shareUrl: string; embedUrl: string } {
  const shareCandidate = generateShareLink(npi).url.split('?')[0];

  try {
    const origin = new URL(shareCandidate).origin;
    return {
      shareUrl: shareCandidate,
      embedUrl: `${origin}/api/passport/${encodeURIComponent(npi)}/embed.svg`,
    };
  } catch {
    return {
      shareUrl: shareCandidate,
      embedUrl: `${shareCandidate.replace(/\/p\/[^/]+$/, '')}/api/passport/${encodeURIComponent(npi)}/embed.svg`,
    };
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function truncateSvgText(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

function buildBadgeSvg(passport: PassportDocument): string {
  const { name, trustBand, readinessScore } = passport.public;
  const chipColor = trustBand === 'GREEN' ? '#10b981' : trustBand === 'YELLOW' ? '#f59e0b' : '#ef4444';
  const chipText = trustBand === 'YELLOW' ? '#111827' : '#ffffff';
  const safeName = escapeXml(truncateSvgText(name, 26));
  const safeBand = escapeXml(trustBand);

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80" role="img"',
    ` aria-label="${escapeXml(`${name} ${trustBand} badge`)}">`,
    '<rect x="0" y="0" width="320" height="80" rx="16" fill="#080e1a"/>',
    '<rect x="16" y="16" width="48" height="48" rx="14" fill="#0f172a" stroke="#1f2937"/>',
    '<path d="M40 26l-10 4v8c0 6 4.3 11.4 10 13 5.7-1.6 10-7 10-13v-8l-10-4Z" fill="#0b1220" stroke="#7dd3fc" stroke-width="1.4"/>',
    '<path d="m35.5 38 3.5 3.5 6.5-7" fill="none" stroke="#7dd3fc" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>',
    `<text x="78" y="30" fill="#f8fafc" font-family="ui-sans-serif, system-ui, sans-serif" font-size="16" font-weight="700">${safeName}</text>`,
    '<text x="78" y="50" fill="#94a3b8" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11">Verified by VitalCV</text>',
    `<rect x="78" y="56" width="82" height="18" rx="9" fill="${chipColor}"/>`,
    `<text x="119" y="69" fill="${chipText}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" font-weight="700" text-anchor="middle">${safeBand}</text>`,
    `<text x="244" y="38" fill="#f8fafc" font-family="ui-sans-serif, system-ui, sans-serif" font-size="24" font-weight="700" text-anchor="middle">${readinessScore}</text>`,
    '<text x="244" y="54" fill="#94a3b8" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" text-anchor="middle">Readiness score</text>',
    '</svg>',
  ].join('');
}

// ── Access mode helpers ──────────────────────────────────────────────────────

/** Wallet mode: require strict Clerk session validation */
function resolveAccessMode(
  npi: string,
  mode: string | undefined,
  clerkUserId: string | undefined,
): PassportAccessMode {
  if (clerkUserId) {
    // If they have a session, grant wallet or authorized view based on role or self
    // For now, if authenticated, allow wallet mode (holder view) or authorized (employer)
    if (mode === 'wallet') return 'wallet';
    if (mode === 'authorized') return 'authorized';
    return 'wallet'; // Default to authenticated view if they have a session
  }
  if (mode === 'selective') return 'selective';
  return 'public';
}

// Selective disclosure field groups
const DISCLOSURE_GROUPS: Record<string, (doc: PassportDocument) => Partial<PassportDocument>> = {
  identity:       d => ({ public: d.public }),
  licenses:       d => ({ credentials: d.credentials.filter(c => c.type === 'STATE_LICENSE') }),
  certifications: d => ({ credentials: d.credentials.filter(c => c.type === 'BOARD_CERTIFICATION') }),
  privileges:     d => ({ privileges: d.privileges }),
  sanctions:      d => ({ sanctions: d.sanctions }),
  decisions:      d => ({ decisions: d.decisions }),
  trust:          d => ({ public: { ...d.public } }),
};

function applySelectiveDisclosure(
  doc: PassportDocument,
  fields: string[],
): PassportDocument {
  const disclosed: Partial<PassportDocument> = { npi: doc.npi, accessMode: 'selective', meta: { ...doc.meta, disclosedFields: fields } };
  let credentials: PassportCredential[] = [];
  for (const field of fields) {
    const fn = DISCLOSURE_GROUPS[field];
    if (!fn) continue;
    const partial = fn(doc);
    if (partial.credentials) credentials = [...credentials, ...partial.credentials];
    Object.assign(disclosed, partial);
  }
  if (fields.some(f => f === 'licenses' || f === 'certifications')) {
    disclosed.credentials = credentials;
  }
  return {
    npi: doc.npi,
    accessMode: 'selective',
    public: disclosed.public ?? { name: '', specialty: '', providerType: '', state: '', trustBand: doc.public.trustBand, readinessScore: doc.public.readinessScore, totalCredentials: 0, activeCredentials: 0, shareUrl: doc.public.shareUrl, embedUrl: doc.public.embedUrl },
    credentials: disclosed.credentials ?? [],
    sanctions: fields.includes('sanctions') ? doc.sanctions : { status: 'UNKNOWN', checkedAt: null },
    privileges: disclosed.privileges ?? [],
    decisions: disclosed.decisions ?? [],
    meta: { ...doc.meta, disclosedFields: fields },
  };
}

// ── ClaimRecord → PassportCredential mapping ────────────────────────────────

type ClaimRecordRow = {
  id: string;
  claimType: string;
  sourceId: string;
  value: unknown;
  status: string;
  observedAt: Date;
  validUntil: Date | null;
  confidenceLabel: string;
  trustTier: string;
};

function claimValueObj(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function mapClaimToCredential(claim: ClaimRecordRow): PassportCredential | null {
  const v = claimValueObj(claim.value);
  const statusMap: Record<string, PassportCredentialStatus> = {
    'ACTIVE': 'ACTIVE', 'A': 'ACTIVE', 'ENROLLED': 'ACTIVE', 'CLEAR': 'ACTIVE',
    'BLOCKED': 'REVOKED', 'EXCLUDED': 'REVOKED', 'REVOKED': 'REVOKED',
    'UNVERIFIED': 'UNKNOWN', 'UNKNOWN': 'UNKNOWN', 'D': 'EXPIRED',
  };
  const status: PassportCredentialStatus = statusMap[claim.status] ?? 'UNKNOWN';
  const verifiedAt = claim.observedAt.toISOString();
  const expiresAt = claim.validUntil?.toISOString() ?? null;

  switch (claim.claimType) {
    case 'ENROLLMENT_STATUS': {
      return {
        id: claim.id,
        type: 'ENROLLMENT',
        name: 'Medicare Enrollment',
        issuer: 'PECOS',
        status,
        verifiedAt,
        expiresAt,
        isPublic: true,
      };
    }
    case 'EXCLUSION_STATUS': {
      return {
        id: claim.id,
        type: 'SANCTIONS_CHECK',
        name: 'OIG Sanctions Check',
        issuer: 'OIG/LEIE',
        status,
        verifiedAt,
        expiresAt,
        isPublic: true,
      };
    }
    case 'LICENSE':
    case 'NURSING_LICENSE': {
      const state = typeof v.state === 'string' ? v.state.trim() : '';
      const licenseType = typeof v.licenseType === 'string' ? v.licenseType.trim() : '';
      const name = state
        ? `${state} ${licenseType || 'State License'}`.trim()
        : licenseType || 'State License';
      const issuer = typeof v.issuer === 'string' ? v.issuer.trim() : (state ? `${state} Board` : claim.sourceId);
      return {
        id: claim.id,
        type: 'STATE_LICENSE',
        name,
        issuer,
        status,
        verifiedAt,
        expiresAt,
        isPublic: true,
      };
    }
    case 'PERSONAL_IDENTITY':
    case 'NPI_IDENTITY': {
      return {
        id: claim.id,
        type: 'IDENTITY',
        name: 'NPI Identity Verification',
        issuer: 'NPPES',
        status,
        verifiedAt,
        expiresAt,
        isPublic: true,
      };
    }
    case 'SPECIALTY': {
      const specialtyName = typeof v.specialtyName === 'string' ? v.specialtyName.trim()
        : typeof v.specialty === 'string' ? v.specialty.trim()
        : typeof v.taxonomyDescription === 'string' ? v.taxonomyDescription.trim()
        : 'Board Certification';
      const boardIssuer = typeof v.boardName === 'string' ? v.boardName.trim() : 'Specialty Board';
      return {
        id: claim.id,
        type: 'BOARD_CERTIFICATION',
        name: specialtyName,
        issuer: boardIssuer,
        status,
        verifiedAt,
        expiresAt,
        isPublic: true,
      };
    }
    case 'PUBLICATION': {
      const title = typeof v.title === 'string' ? v.title.trim()
        : typeof v.publicationTitle === 'string' ? v.publicationTitle.trim()
        : 'Publication';
      const journal = typeof v.journal === 'string' ? v.journal.trim()
        : typeof v.source === 'string' ? v.source.trim()
        : claim.sourceId;
      return {
        id: claim.id,
        type: 'PUBLICATION',
        name: title,
        issuer: journal,
        status,
        verifiedAt,
        expiresAt,
        isPublic: true,
      };
    }
    case 'INSTITUTION_AFFILIATION': {
      const orgName = typeof v.organizationName === 'string' ? v.organizationName.trim()
        : typeof v.institutionName === 'string' ? v.institutionName.trim()
        : 'Institution Affiliation';
      const orgIssuer = typeof v.issuer === 'string' ? v.issuer.trim() : claim.sourceId;
      return {
        id: claim.id,
        type: 'AFFILIATION',
        name: orgName,
        issuer: orgIssuer,
        status,
        verifiedAt,
        expiresAt,
        isPublic: true,
      };
    }
    default:
      return null;
  }
}

function claimCredentialKey(type: CredentialType, sourceId: string, value: Record<string, unknown>): string {
  const state = typeof value.state === 'string' ? value.state.trim().toUpperCase() : '';
  return [type, sourceId.trim().toUpperCase(), state].filter(Boolean).join(':');
}

// ── Data loading ─────────────────────────────────────────────────────────────

export type LoadedPassportData = {
  passport: PassportDocument;
  trust: TrustDocument;
  trustState: ClinicianTrustState;
};

export async function loadPassportData(npi: string): Promise<LoadedPassportData | null> {
  const [provider, artifacts, trustState, capsules, oigArtifact, nppesIdentityClaim, claimRecords] = await Promise.all([
    prisma.provider.findFirst({
      where: { npi },
      select: {
        fullName: true,
        taxonomyCode: true,
        providerType: true,
        stateOfPractice: true,
      },
    }),
    prisma.verificationArtifact.findMany({
      where: {
        npi,
        source: { not: 'TRUST_STATE_ENGINE' },
      },
      select: {
        id: true,
        source: true,
        status: true,
        verifiedAt: true,
        expiresAt: true,
        createdAt: true,
        rawPayload: true,
      },
      orderBy: [
        { verifiedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    }),
    getCachedTrustState(npi),
    // decision capsules for privileges + decisions sections
    prisma.decisionCapsule.findMany({
      where: { subjectNpi: npi },
      orderBy: { decisionTimestamp: 'desc' },
      take: 30,
      select: {
        id: true, decisionType: true, status: true,
        artifactHash: true, decisionTimestamp: true, metadata: true,
      },
    }),
    // latest OIG/LEIE artifact for sanctions status
    prisma.verificationArtifact.findFirst({
      where: { npi, source: { in: ['OIG_LEIE', 'OIG', 'LEIE'] } },
      orderBy: { verifiedAt: 'desc' },
      select: { status: true, verifiedAt: true, rawPayload: true },
    }),
    // NPPES identity from ClaimRecord (new ingest pipeline) — priority source for clinician name
    prisma.claimRecord.findFirst({
      where: { subjectNpi: npi, claimType: 'PERSONAL_IDENTITY', sourceId: 'NPPES_API' },
      orderBy: { observedAt: 'desc' },
      select: { value: true },
    }),
    // All active claims for credential hydration
    prisma.claimRecord.findMany({
      where: { subjectNpi: npi, status: { notIn: ['REVOKED', 'DELETED', 'SUPERSEDED'] } },
      orderBy: { observedAt: 'desc' },
      select: { id: true, claimType: true, sourceId: true, value: true, status: true, observedAt: true, validUntil: true, confidenceLabel: true, trustTier: true },
    }),
  ]);

  // Fall back to live computation if cached trust state expired (1h TTL)
  const resolvedTrustState = trustState ?? await computeClinicianTrustState(npi).catch(() => null);

  if (!resolvedTrustState) {
    return null;
  }

  // Allow passport generation even if only ClaimRecord data exists (no legacy VerificationArtifact)
  if (!provider && artifacts.length === 0 && !nppesIdentityClaim) {
    return null;
  }

  const deduped = new Map<string, PassportCredential>();
  for (const artifact of artifacts) {
    const payload = pickPayload(artifact.rawPayload);
    const type = mapCredentialType(artifact.source, payload);
    const isPublic = PUBLIC_TYPES.has(type);
    const key = credentialKey(type, artifact.source, payload);
    if (deduped.has(key)) {
      continue;
    }

    deduped.set(key, {
      id: artifact.id,
      type,
      name: inferName(type, payload, isPublic),
      issuer: inferIssuer(type, artifact.source, payload, isPublic),
      status: normalizeStatus(artifact.status),
      verifiedAt: artifact.verifiedAt?.toISOString() ?? null,
      expiresAt: artifact.expiresAt?.toISOString() ?? null,
      isPublic,
    });
  }

  // Hydrate from ClaimRecord — ClaimRecord takes priority (newer data)
  for (const claim of claimRecords) {
    const mapped = mapClaimToCredential(claim as ClaimRecordRow);
    if (!mapped) continue;
    const v = claimValueObj(claim.value);
    const key = claimCredentialKey(mapped.type, claim.sourceId, v);
    // ClaimRecord overrides VerificationArtifact for same key
    deduped.set(key, mapped);
  }

  const credentials = Array.from(deduped.values());
  const activeCredentials = credentials.filter((credential) => credential.status === 'ACTIVE').length;
  const trustBand = mapReadinessLevel(resolvedTrustState.readiness_level);
  const { shareUrl, embedUrl } = buildPublicUrls(npi);

  // ── Sanctions status ────────────────────────────────────────────────────────
  const oigPayload = oigArtifact ? (oigArtifact.rawPayload as Record<string, unknown>) : null;
  const oigMatchType = typeof oigPayload?.matchType === 'string' ? oigPayload.matchType : 'NONE';
  const sanctions: SanctionsStatus = {
    status: !oigArtifact ? 'UNKNOWN'
      : oigMatchType !== 'NONE' ? 'FLAGGED'
      : 'CLEAR',
    checkedAt: oigArtifact?.verifiedAt?.toISOString() ?? null,
    // matchType + detail only surfaced in wallet mode (stripped in buildPassportForMode)
    matchType: oigMatchType,
    detail: typeof oigPayload?.exclusionType === 'string' ? oigPayload.exclusionType : undefined,
  };

  // ── Privileges (PRIVILEGING decision capsules) ─────────────────────────────
  const privileges: PassportPrivilege[] = capsules
    .filter(c => c.decisionType === 'PRIVILEGING')
    .map(c => {
      const meta = (c.metadata ?? {}) as Record<string, unknown>;
      const capsuleStatus: PassportPrivilege['status'] =
        c.status === 'VALID' ? 'ACTIVE' :
        c.status === 'AT_RISK' ? 'AT_RISK' : 'REVOKED';
      return {
        facility: typeof meta.organizationName === 'string' ? meta.organizationName
          : typeof meta.facilityName === 'string' ? meta.facilityName : 'Unknown Facility',
        privilegeType: typeof meta.privilegeType === 'string' ? meta.privilegeType : 'Clinical Privileges',
        status: capsuleStatus,
        grantedAt: c.decisionTimestamp?.toISOString() ?? null,
        capsuleId: c.id,
      };
    });

  // ── Decisions (all capsule types) ──────────────────────────────────────────
  const decisions: PassportDecision[] = capsules.map(c => {
    const meta = (c.metadata ?? {}) as Record<string, unknown>;
    const decisionStatus: PassportDecision['status'] =
      c.status === 'VALID' ? 'VALID' :
      c.status === 'AT_RISK' ? 'AT_RISK' : 'INVALID';
    return {
      id: c.id,
      decisionType: c.decisionType,
      status: decisionStatus,
      // organization redacted in public mode — applied in buildPassportForMode
      organization: typeof meta.organizationName === 'string' ? meta.organizationName : null,
      grantedAt: c.decisionTimestamp?.toISOString() ?? null,
      artifactHash: c.artifactHash,
    };
  });

  const passport: PassportDocument = {
    npi,
    accessMode: 'public', // overridden by buildPassportForMode
    public: {
      name: inferClinicianName(npi, provider, artifacts, nppesIdentityClaim?.value as Record<string, unknown> | null),
      specialty: inferSpecialty(provider, artifacts),
      providerType: provider?.providerType?.trim() || 'Unknown',
      state: inferState(provider, artifacts),
      trustBand,
      readinessScore: resolvedTrustState.readiness_score,
      totalCredentials: credentials.length,
      activeCredentials: activeCredentials,
      shareUrl,
      embedUrl,
    },
    credentials,
    sanctions,
    privileges,
    decisions,
    meta: {
      methodology: resolvedTrustState.methodology_version,
      computedAt: resolvedTrustState.computed_at,
      passportVersion: '2.0',
    },
  };

  const trust: TrustDocument = {
    npi,
    trustBand,
    readinessScore: resolvedTrustState.readiness_score,
    readinessStatus: resolvedTrustState.readiness_status,
    computedAt: resolvedTrustState.computed_at,
    shareUrl,
  };

  return {
    passport,
    trust,
    trustState: resolvedTrustState,
  };
}

// ── Mode-based redaction ──────────────────────────────────────────────────────

/**
 * Apply access-mode redactions to a passport document:
 *
 *   public    — public credentials only, sanctions status without details,
 *               decisions without org names, privileges without capsuleIds
 *   wallet    — all credentials, full sanctions (matchType + detail), all decisions
 *   selective — handled by applySelectiveDisclosure()
 */
function buildPassportForMode(
  doc: PassportDocument,
  mode: PassportAccessMode,
): PassportDocument {
  if (mode === 'wallet' || mode === 'authorized') {
    return { ...doc, accessMode: mode };
  }

  // public mode — strip sensitive fields
  return {
    ...doc,
    accessMode: 'public',
    credentials: doc.credentials.filter(c => c.isPublic),
    sanctions: {
      status: doc.sanctions.status,
      checkedAt: doc.sanctions.checkedAt,
      // matchType and detail omitted
    },
    privileges: doc.privileges.map(p => ({
      facility: p.facility,
      privilegeType: p.privilegeType,
      status: p.status,
      grantedAt: p.grantedAt,
      capsuleId: '[redacted]',
    })),
    decisions: doc.decisions.map(d => ({
      ...d,
      organization: null, // org name redacted in public mode
    })),
  };
}

function validateNpi(res: Response, npi: string | undefined): boolean {
  if (!npi || !NPI_RE.test(npi)) {
    res.status(400).json({
      error: 'invalid_npi',
      error_description: 'NPI must be a 10-digit string.',
    });
    return false;
  }

  return true;
}

function maybeNotFound(res: Response, npi: string, doc: PassportDocument | TrustDocument | null): boolean {
  if (!doc) {
    res.status(404).json({
      error: 'passport_not_available',
      error_description: `Passport not available for NPI ${npi}.`,
    });
    return true;
  }

  return false;
}

function logPassportError(route: string, npi: string, error: unknown): void {
  log('error', route, {
    npi,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerPassportRoutes(app: Express): void {
  app.use('/api/passport', authMiddleware);

  /**
   * GET /api/passport/:npi
   *
   * Query params:
   *   mode=public|wallet    — access mode (default: public)
   *   token=<npi>           — required for wallet mode (pilot: NPI as token)
   *
   * public  → credentials filtered to isPublic, org names redacted from decisions
   * wallet  → all credentials + full sanctions detail + unredacted decisions
   */
  app.get('/api/passport/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) return;

    const mode = resolveAccessMode(
      npi,
      req.query.mode as string | undefined,
      (req as any).clerkUserId,
    );

    try {
      const data = await loadPassportData(npi);
      if (!data?.passport) { maybeNotFound(res, npi, null); return; }

      const passport = buildPassportForMode(data.passport, mode);

      // Learning: track profile viewed event (fire-and-forget)
      emitLearningEvent({ type: 'PROFILE_VIEWED', timestamp: new Date(), providerId: npi, metadata: { mode }, payload: {} });

      res.setHeader('X-Passport-Mode', mode);
      res.setHeader('X-Passport-Version', '2.0');
      res.json(passport);
    } catch (error) {
      logPassportError('passport_route_failed', npi, error);
      res.status(500).json({ error: 'Failed to generate passport' });
    }
  });

  /**
   * GET /api/passport/:npi/disclose
   *
   * Selective disclosure endpoint. Returns only the requested field groups.
   * Query param: fields=identity,licenses,certifications,privileges,sanctions,decisions,trust
   *
   * Suitable for verifier-requested presentations — clinician controls which
   * sections are revealed without exposing the full passport.
   */
  app.get('/api/passport/:npi([0-9]{10})/disclose', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) return;

    const raw = typeof req.query.fields === 'string' ? req.query.fields : '';
    const fields = raw.split(',').map(f => f.trim().toLowerCase()).filter(Boolean);

    const validFields = Object.keys(DISCLOSURE_GROUPS);
    const invalid = fields.filter(f => !validFields.includes(f));
    if (invalid.length > 0) {
      res.status(400).json({
        error: 'invalid_fields',
        invalid,
        valid: validFields,
      });
      return;
    }

    if (fields.length === 0) {
      res.status(400).json({
        error: 'fields_required',
        message: 'Specify ?fields=identity,licenses,certifications,privileges,sanctions,decisions,trust',
        valid: validFields,
      });
      return;
    }

    try {
      const data = await loadPassportData(npi);
      if (!data?.passport) { maybeNotFound(res, npi, null); return; }

      const disclosed = applySelectiveDisclosure(data.passport, fields);

      res.setHeader('X-Passport-Mode', 'selective');
      res.setHeader('X-Disclosed-Fields', fields.join(','));
      res.setHeader('X-Passport-Version', '2.0');
      res.json(disclosed);
    } catch (error) {
      logPassportError('passport_disclose_route_failed', npi, error);
      res.status(500).json({ error: 'Failed to generate selective disclosure' });
    }
  });

  app.get('/api/passport/:npi/trust', proofRateLimit, async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) {
      return;
    }

    try {
      const data = await loadPassportData(npi);
      const trust = data?.trust ?? null;
      if (trust === null) {
        maybeNotFound(res, npi, trust);
        return;
      }

      res.json(trust);
    } catch (error) {
      logPassportError('passport_trust_route_failed', npi, error);
      res.status(500).json({ error: 'Failed to generate passport trust summary' });
    }
  });

  app.get('/api/passport/:npi/embed.svg', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) {
      return;
    }

    try {
      const data = await loadPassportData(npi);
      if (!data?.passport) {
        res.status(404).type('image/svg+xml').send('');
        return;
      }

      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(200).send(buildBadgeSvg(data.passport));
    } catch (error) {
      logPassportError('passport_embed_route_failed', npi, error);
      res.status(500).type('image/svg+xml').send('');
    }
  });

  app.get('/api/passport/:npi/card.json', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) {
      return;
    }

    try {
      const data = await loadPassportData(npi);
      const passport = data?.passport ?? null;
      if (passport === null) {
        maybeNotFound(res, npi, passport);
        return;
      }

      res.setHeader('Content-Type', 'application/ld+json; charset=utf-8');
      res.json({
        '@context': 'https://vitalcv.com/schema/v1',
        '@type': 'ClinicianPassport',
        npi,
        name: passport.public.name,
        trustBand: passport.public.trustBand,
        readinessScore: passport.public.readinessScore,
        shareUrl: passport.public.shareUrl,
        badgeUrl: passport.public.embedUrl,
        verifiedAt: passport.meta.computedAt,
        issuer: 'VitalCV',
      });
    } catch (error) {
      logPassportError('passport_card_route_failed', npi, error);
      res.status(500).json({ error: 'Failed to generate passport card' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/passport/:npi/export
  // Wave 3: Clinician-facing structured packet export.
  // Returns the full EmployerEvidencePacketV1 with all Wave 3 fields:
  //   identity, sourceCoverage, freshness, blockers, nextActions,
  //   receiptPresence, trustExplanations, structuredBlockers.
  //
  // Writes an ARTIFACT_EXPORTED audit event before returning the payload.
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/passport/:npi/export', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) {
      return;
    }

    try {
      const passport = await buildPassportByNpi(npi);
      if (!passport) {
        res.status(404).json({
          error: 'not_found',
          error_description: `No passport data found for NPI ${npi}.`,
        });
        return;
      }

      const packet = buildEmployerEvidencePacket({
        passport,
        employerId: 'clinician-self-export',
      });

      // Audit: write ARTIFACT_EXPORTED before returning payload
      const auditMetadata = JSON.parse(JSON.stringify({
        schema: 'vitalcv.clinician-export.v1',
        exportType: 'CLINICIAN_PASSPORT_EXPORT',
        format: 'json',
        clinicianNpi: npi,
        exportedAt: packet.exportedAt,
        manifestHash: sha256ForPayload(packet.manifest),
        sourceIds: packet.manifest.sources.map((s) => s.sourceId),
        receiptReferences: packet.receiptReferences,
        blockerCount: (packet as any).structuredBlockers?.length || 0,
      }));

      await prisma.auditEvent.create({
        data: {
          type: 'ARTIFACT_EXPORTED',
          hash: sha256ForPayload({
            type: 'ARTIFACT_EXPORTED',
            referenceId: npi,
            metadata: auditMetadata,
          }),
          referenceId: passport.entityId,
          clinicianId: npi,
          metadata: auditMetadata,
        },
      });

      log('info', 'clinician_passport_exported', {
        npi_prefix: npi.slice(0, 4) + '····',
        exportedAt: packet.exportedAt,
        score: packet.readiness.score,
        blockers: packet.readiness.blockers.length,
        receiptReferences: packet.receiptReferences,
      });

      const filename = `vitalcv-passport-${npi}-${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json');
      res.json(packet);
    } catch (error) {
      logPassportError('passport_export_route_failed', npi, error);
      res.status(500).json({ error: 'Failed to generate passport export' });
    }
  });
}
