/**
 * trustStateEngine.ts — Wave 243: Trust State Engine
 *
 * Connects PSV adapter canonical facts → composite trust state computation
 * → durable storage → queryable API per clinician (by NPI).
 *
 * Evidence gathered:
 *   - NPPES identity (CMS NPI Registry)
 *   - CandidateCredential records (uploaded/parsed documents)
 *   - VerificationArtifact records (PSV check results)
 *   - OIG/LEIE exclusion status
 *
 * Trust bands follow the substrate L0–L3 taxonomy.
 */

import prisma from '../../graphql/prisma_client';
import { appendAuditEvent } from '../audit/auditLedger';
import { checkExclusion } from '../psv/oigLeieChecker';
import { log } from '../../obs/logger';
import { isCredentialIngestionEnabled } from '../credentials/credentialIngestionConfig';
import {
  boardOrderSeverityBlocksReadiness,
  boardOrderSeverityRequiresReview,
  normalizeBoardOrderSeverity,
} from '../authority/contracts';
import {
  getTrustStateMemoryCache,
  setTrustStateMemoryCache,
  recordMemoryHit,
  recordDbHit,
  recordCacheMiss,
} from './trustStateCache';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TrustBand = 'L0' | 'L1' | 'L2' | 'L3';
export type LicensureStatus = 'verified' | 'pending' | 'expired' | 'unknown';
export type ExclusionStatus = 'CLEAR' | 'EXCLUDED' | 'POSSIBLE_MATCH' | 'UNCHECKED' | 'UNKNOWN';
export type PecosStatus = 'ENROLLED' | 'ENROLLMENT_NOT_FOUND' | 'UNKNOWN';

export interface CanonicalFactSummary {
  factType: string;
  source: string;
  status: string;
  verifiedAt?: string;
  expiresAt?: string;
  details?: string;
}

/** Methodology version — bump when scoring logic changes */
export const METHODOLOGY_VERSION = '243.3';

export interface ClinicianTrustState {
  npi: string;
  identityVerified: boolean;
  licensureStatus: LicensureStatus;
  exclusionClear: boolean;
  exclusionStatus?: ExclusionStatus;
  pecosStatus?: PecosStatus;
  credentialCount: number;
  reviewRequired?: boolean;
  blockers?: string[];
  /** L0–L3 readiness level */
  readiness_level: TrustBand;
  /** Human-readable status */
  readiness_status: string;
  /** 0–100 composite score */
  readiness_score: number;
  /** Structured gap summary */
  gap_summary: string[];
  /** Scoring methodology version */
  methodology_version: string;
  /** ISO timestamp of computation */
  computed_at: string;
  /** Backward-compat aliases */
  trustBand: TrustBand;
  trustScore: number;
  facts: CanonicalFactSummary[];
  gaps: string[];
  computedAt: string;
}

type IngestedArtifactRecord = {
  source: string;
  status: string;
  verifiedAt: Date;
  expiresAt: Date | null;
  psvWindowDeadline: Date | null;
  rawPayload: unknown;
};

type AuthorityCredentialRecord = {
  id: string;
  domain: string;
  status: string;
  credentialType: string;
  verifiedAt: Date | null;
  expiresAt: Date | null;
  observedAt: Date | null;
  metadata: unknown;
  claimValue: unknown;
};

type AuthoritySignalSummary = {
  facts: CanonicalFactSummary[];
  gaps: string[];
  blockers: string[];
  credentialCount: number;
  licensureVerified: boolean;
  expiredLicense: boolean;
  disciplinedLicense: boolean;
  boardOrderRequiresReview: boolean;
  boardOrderBlocks: boolean;
  authorityUnavailableLicensure: boolean;
};

// ── NPPES fetch (mirrors liveMatchaService pattern) ───────────────────────────

interface NppesResult {
  firstName: string;
  middleName: string;
  lastName: string;
  enumerationType: string;
  taxonomies: Array<{ code: string; desc?: string; primary: boolean; state?: string }>;
  status: string;
  found: boolean;
}

async function fetchNppes(npi: string): Promise<NppesResult> {
  const url = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { firstName: '', middleName: '', lastName: '', enumerationType: '', taxonomies: [], status: 'UNKNOWN', found: false };
    const data = await res.json() as Record<string, unknown>;
    const result = (data?.results as Record<string, unknown>[])?.[0];
    if (!result) return { firstName: '', middleName: '', lastName: '', enumerationType: '', taxonomies: [], status: 'UNKNOWN', found: false };
    const basic = (result.basic ?? {}) as Record<string, string>;
    const firstName = basic.first_name ?? basic.authorized_official_first_name ?? '';
    const middleName = basic.middle_name ?? '';
    const lastName = basic.last_name ?? basic.authorized_official_last_name ?? '';
    const enumerationType = (result.enumeration_type as string) ?? '';
    const taxonomies = (result.taxonomies as Array<{ code: string; desc?: string; primary: boolean; state?: string }>) ?? [];
    const status = basic.status ?? 'UNKNOWN';
    return { firstName, middleName, lastName, enumerationType, taxonomies, status, found: true };
  } catch {
    return { firstName: '', middleName: '', lastName: '', enumerationType: '', taxonomies: [], status: 'UNKNOWN', found: false };
  }
}

// ── Trust score computation ───────────────────────────────────────────────────

function computeScore(params: {
  identityVerified: boolean;
  licensureStatus: LicensureStatus;
  exclusionClear: boolean;
  exclusionStatus?: ExclusionStatus;
  pecosStatus?: PecosStatus;
  credentialCount: number;
  hasVerifiedArtifacts: boolean;
}): number {
  const exclusionStatus =
    params.exclusionStatus ?? (params.exclusionClear ? 'CLEAR' : 'EXCLUDED');
  const pecosStatus = params.pecosStatus ?? 'UNKNOWN';

  if (exclusionStatus === 'EXCLUDED') {
    return 0;
  }

  let score = 0;

  // Identity: 20 points
  if (params.identityVerified) score += 20;

  // Licensure: 30 points
  if (params.licensureStatus === 'verified') score += 30;
  else if (params.licensureStatus === 'pending') score += 15;

  // Exclusion clear: 30 points
  if (exclusionStatus === 'CLEAR') score += 30;

  // PECOS enrollment: 20 points
  if (pecosStatus === 'ENROLLED') score += 20;

  return Math.min(score, 100);
}

// ── Trust band from score + signals ──────────────────────────────────────────

function deriveBand(params: {
  identityVerified: boolean;
  licensureStatus: LicensureStatus;
  exclusionClear: boolean;
  exclusionStatus?: ExclusionStatus;
  pecosStatus?: PecosStatus;
  trustScore: number;
}): TrustBand {
  const exclusionStatus =
    params.exclusionStatus ?? (params.exclusionClear ? 'CLEAR' : 'EXCLUDED');
  const pecosStatus = params.pecosStatus ?? 'UNKNOWN';
  const reviewRequired =
    exclusionStatus === 'POSSIBLE_MATCH'
    || exclusionStatus === 'UNCHECKED'
    || exclusionStatus === 'UNKNOWN';

  // Hard L0 blockers
  if (exclusionStatus === 'EXCLUDED') return 'L0';
  if (!params.identityVerified) return 'L0';
  if (params.licensureStatus === 'expired') return 'L0';
  if (reviewRequired) return 'L1';
  if (pecosStatus === 'ENROLLMENT_NOT_FOUND') return 'L1';

  if (
    params.trustScore >= 90
    && exclusionStatus === 'CLEAR'
    && pecosStatus === 'ENROLLED'
    && params.licensureStatus === 'verified'
  ) {
    return 'L3';
  }
  if (params.trustScore >= 60) return 'L2';
  if (params.trustScore >= 20) return 'L1';
  return 'L0';
}

// ── Gaps detection ────────────────────────────────────────────────────────────

function detectGaps(params: {
  identityVerified: boolean;
  licensureStatus: LicensureStatus;
  exclusionClear: boolean;
  exclusionStatus?: ExclusionStatus;
  pecosStatus?: PecosStatus;
  credentialCount: number;
  facts: CanonicalFactSummary[];
}): string[] {
  const gaps: string[] = [];
  const exclusionStatus =
    params.exclusionStatus ?? (params.exclusionClear ? 'CLEAR' : 'EXCLUDED');
  const pecosStatus = params.pecosStatus ?? 'UNKNOWN';

  if (!params.identityVerified) gaps.push('NPI identity not verified');
  if (params.licensureStatus === 'unknown') gaps.push('State licensure not verified');
  if (params.licensureStatus === 'expired') gaps.push('State license expired');
  if (exclusionStatus === 'POSSIBLE_MATCH') gaps.push('OIG/LEIE possible match requires review');
  else if (exclusionStatus === 'UNCHECKED' || exclusionStatus === 'UNKNOWN') gaps.push('OIG/LEIE exclusion check unchecked');
  else if (exclusionStatus === 'EXCLUDED') gaps.push('OIG/LEIE exclusion check flagged');
  if (pecosStatus === 'UNKNOWN') gaps.push('PECOS enrollment not verified');
  if (pecosStatus === 'ENROLLMENT_NOT_FOUND') gaps.push('PECOS enrollment not found');
  if (params.credentialCount === 0) gaps.push('No credential documents on file');

  const factTypes = params.facts.map((f) => f.factType.toLowerCase());

  if (!factTypes.some((t) => t.includes('board') || t.includes('certification'))) {
    gaps.push('No board certification on file');
  }
  if (!factTypes.some((t) => t.includes('dea'))) {
    gaps.push('DEA registration not verified');
  }
  if (!factTypes.some((t) => t.includes('malpractice') || t.includes('insurance'))) {
    gaps.push('Malpractice insurance not on file');
  }

  return gaps;
}

function isSourceArtifactFresh(
  artifact: IngestedArtifactRecord | undefined,
  now: Date,
): boolean {
  if (!artifact?.psvWindowDeadline) {
    return false;
  }

  return artifact.psvWindowDeadline.getTime() > now.getTime();
}

function sourceFactType(source: string): CanonicalFactSummary['factType'] {
  const normalized = source.toUpperCase();
  if (normalized === 'NPPES') return 'IdentityClaim';
  if (normalized === 'OIG') return 'Sanction';
  if (normalized === 'OIG_LEIE') return 'Sanction';
  if (normalized === 'PECOS_PUBLIC') return 'Enrollment';
  if (normalized === 'STATE_BOARD') return 'License';
  return 'VerificationRecord';
}

function sourceDetails(artifact: IngestedArtifactRecord): string | undefined {
  const payload = typeof artifact.rawPayload === 'object' && artifact.rawPayload !== null
    ? artifact.rawPayload as Record<string, unknown>
    : null;

  if (!payload) {
    return undefined;
  }

  if (artifact.source === 'NPPES') {
    return typeof payload.provider_name === 'string' ? payload.provider_name : undefined;
  }
  if (artifact.source === 'OIG') {
    return typeof payload.exclusion_type === 'string'
      ? payload.exclusion_type
      : typeof payload.source_url === 'string'
        ? payload.source_url
        : undefined;
  }
  if (artifact.source === 'STATE_BOARD') {
    const boardName = typeof payload.board_name === 'string' ? payload.board_name : '';
    const licenseNumber = typeof payload.license_number === 'string' ? payload.license_number : '';
    const state = typeof payload.state === 'string' ? payload.state : '';
    return [boardName, licenseNumber, state].filter(Boolean).join(' · ') || undefined;
  }
  if (artifact.source === 'PECOS_PUBLIC') {
    const statusLabel = typeof payload.statusLabel === 'string'
      ? payload.statusLabel
      : typeof payload.label === 'string'
        ? payload.label
        : '';
    const dataVersion = typeof payload.dataVersion === 'string' ? payload.dataVersion : '';
    return [statusLabel, dataVersion].filter(Boolean).join(' · ') || undefined;
  }

  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function extractPecosStatus(
  artifact: Pick<IngestedArtifactRecord, 'status' | 'rawPayload'>,
): PecosStatus {
  const payload = asRecord(artifact.rawPayload);
  const claims = Array.isArray(payload._claims) ? payload._claims : [];

  for (const claim of claims) {
    const claimRecord = asRecord(claim);
    if (claimRecord.claimType !== 'ENROLLMENT_STATUS') {
      continue;
    }

    const value = asRecord(claimRecord.value);
    if (typeof value.enrolled === 'boolean') {
      return value.enrolled ? 'ENROLLED' : 'ENROLLMENT_NOT_FOUND';
    }
  }

  const normalizedStatus = artifact.status.toUpperCase();
  if (normalizedStatus === 'NOT_FOUND') {
    return 'ENROLLMENT_NOT_FOUND';
  }
  if (normalizedStatus === 'ACTIVE' || normalizedStatus === 'VERIFIED') {
    return 'ENROLLED';
  }

  return 'UNKNOWN';
}

function normalizeExclusionStatus(
  artifact: Pick<IngestedArtifactRecord, 'status' | 'rawPayload'> | undefined,
  fresh: boolean,
): ExclusionStatus {
  if (!artifact || !fresh) {
    return 'UNCHECKED';
  }

  const normalizedStatus = artifact.status.toUpperCase();
  if (normalizedStatus === 'EXCLUDED') {
    return 'EXCLUDED';
  }
  if (normalizedStatus === 'CLEAR') {
    return 'CLEAR';
  }
  if (normalizedStatus === 'POSSIBLE_MATCH' || normalizedStatus === 'REVIEW_REQUIRED') {
    return 'POSSIBLE_MATCH';
  }
  if (normalizedStatus === 'UNCHECKED' || normalizedStatus === 'UNCERTAIN' || normalizedStatus === 'CHECK_FAILED') {
    return 'UNCHECKED';
  }

  const payload = asRecord(artifact.rawPayload);
  const verdict = typeof payload.verdict === 'string' ? payload.verdict.toUpperCase() : '';
  if (verdict === 'EXCLUDED') {
    return 'EXCLUDED';
  }
  if (verdict === 'CLEAR') {
    return 'CLEAR';
  }
  if (verdict === 'POSSIBLE_MATCH') {
    return 'POSSIBLE_MATCH';
  }
  if (verdict === 'UNCHECKED') {
    return 'UNCHECKED';
  }

  return 'UNCHECKED';
}

function reviewRequiredForExclusionStatus(status: ExclusionStatus | undefined): boolean {
  return status === 'POSSIBLE_MATCH' || status === 'UNCHECKED' || status === 'UNKNOWN';
}

function appendUniqueGap(gaps: string[], gap: string): void {
  if (!gaps.includes(gap)) {
    gaps.push(gap);
  }
}

function isClinicianTrustState(value: unknown): value is ClinicianTrustState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return typeof (value as Record<string, unknown>).npi === 'string';
}

function buildPersistedTrustStatePayload(
  state: ClinicianTrustState,
): ClinicianTrustState & { trust_state_snapshot: ClinicianTrustState } {
  return {
    ...state,
    trust_state_snapshot: { ...state },
  };
}

function extractPersistedTrustState(rawPayload: unknown): ClinicianTrustState | null {
  if (typeof rawPayload !== 'object' || rawPayload === null) {
    return null;
  }

  const payload = rawPayload as Record<string, unknown>;
  if (isClinicianTrustState(payload.trust_state_snapshot)) {
    return payload.trust_state_snapshot;
  }

  return isClinicianTrustState(payload) ? payload : null;
}

async function computeClinicianTrustStateFromIngestedArtifacts(
  npi: string,
): Promise<ClinicianTrustState> {
  const computedAt = new Date().toISOString();
  const now = new Date();
  const facts: CanonicalFactSummary[] = [];

  const artifacts = await prisma.verificationArtifact.findMany({
    where: {
      npi,
      source: { in: ['NPPES', 'NPPES_API', 'OIG', 'OIG_LEIE', 'STATE_BOARD', 'PECOS_PUBLIC'] },
    },
    select: {
      source: true,
      status: true,
      verifiedAt: true,
      expiresAt: true,
      psvWindowDeadline: true,
      rawPayload: true,
    },
    orderBy: [
      { verifiedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  const latestBySource = new Map<string, IngestedArtifactRecord>();
  for (const artifact of artifacts) {
    if (!latestBySource.has(artifact.source)) {
      latestBySource.set(artifact.source, artifact);
    }
  }

  for (const artifact of latestBySource.values()) {
    facts.push({
      factType: sourceFactType(artifact.source),
      source: artifact.source,
      status: artifact.status,
      verifiedAt: artifact.verifiedAt.toISOString(),
      expiresAt: artifact.expiresAt?.toISOString(),
      details: sourceDetails(artifact),
    });
  }

  const nppesArtifact = latestBySource.get('NPPES_API') ?? latestBySource.get('NPPES');
  const oigArtifact = latestBySource.get('OIG_LEIE') ?? latestBySource.get('OIG');
  const licenseArtifact = latestBySource.get('STATE_BOARD');
  const pecosArtifact = latestBySource.get('PECOS_PUBLIC');

  const nppesFresh = isSourceArtifactFresh(nppesArtifact, now);
  const oigFresh = isSourceArtifactFresh(oigArtifact, now);
  const licenseFresh = isSourceArtifactFresh(licenseArtifact, now);
  const pecosFresh = isSourceArtifactFresh(pecosArtifact, now);

  const identityVerified = Boolean(
    nppesArtifact &&
    (nppesArtifact.status === 'ACTIVE' || nppesArtifact.status === 'VERIFIED') &&
    nppesFresh,
  );

  let licensureStatus: LicensureStatus = 'unknown';
  if (licenseArtifact) {
    const licenseExpiredByStatus =
      licenseArtifact.status === 'EXPIRED' ||
      licenseArtifact.status === 'REVOKED' ||
      licenseArtifact.status === 'SUSPENDED';
    const licenseExpiredByDate =
      Boolean(licenseArtifact.expiresAt) &&
      licenseArtifact.expiresAt!.getTime() <= now.getTime();

    if (licenseExpiredByStatus || licenseExpiredByDate) {
      licensureStatus = 'expired';
    } else if (
      (licenseArtifact.status === 'ACTIVE' || licenseArtifact.status === 'VERIFIED') &&
      licenseFresh
    ) {
      licensureStatus = 'verified';
    } else {
      licensureStatus = 'pending';
    }
  }

  const exclusionStatus = normalizeExclusionStatus(oigArtifact, oigFresh);
  const exclusionClear = exclusionStatus === 'CLEAR';
  const pecosStatus: PecosStatus = pecosArtifact && pecosFresh
    ? extractPecosStatus(pecosArtifact)
    : 'UNKNOWN';

  const credentialCount = [nppesArtifact, oigArtifact, licenseArtifact, pecosArtifact].filter((artifact) => {
    if (!artifact) {
      return false;
    }
    const fresh = isSourceArtifactFresh(artifact, now);
    const active = artifact.status === 'ACTIVE' || artifact.status === 'VERIFIED' || artifact.status === 'CLEAR';
    const unexpired = !artifact.expiresAt || artifact.expiresAt.getTime() > now.getTime();
    return fresh && active && unexpired;
  }).length;

  const trustScore = computeScore({
    identityVerified,
    licensureStatus,
    exclusionClear,
    exclusionStatus,
    pecosStatus,
    credentialCount,
    hasVerifiedArtifacts: credentialCount > 0,
  });

  const trustBand = deriveBand({
    identityVerified,
    licensureStatus,
    exclusionClear,
    exclusionStatus,
    pecosStatus,
    trustScore,
  });

  const gaps = detectGaps({
    identityVerified,
    licensureStatus,
    exclusionClear,
    exclusionStatus,
    pecosStatus,
    credentialCount,
    facts,
  });
  const blockers = [
    ...(exclusionStatus === 'EXCLUDED' ? ['EXCLUDED'] : []),
    ...(licensureStatus === 'expired' ? ['LICENSE_EXPIRED'] : []),
    ...(pecosStatus === 'ENROLLMENT_NOT_FOUND' ? ['ENROLLMENT_NOT_FOUND'] : []),
  ];
  const reviewRequired = reviewRequiredForExclusionStatus(exclusionStatus);

  if (!nppesArtifact) {
    appendUniqueGap(gaps, 'NPPES identity artifact missing');
  } else if (!nppesFresh) {
    appendUniqueGap(gaps, 'NPPES identity verification stale');
  }

  if (!oigArtifact) {
    appendUniqueGap(gaps, 'OIG exclusion artifact missing');
  } else if (!oigFresh) {
    appendUniqueGap(gaps, 'OIG exclusion check stale');
  }

  if (!licenseArtifact) {
    appendUniqueGap(gaps, 'State license artifact missing');
  } else if (licensureStatus !== 'expired' && !licenseFresh) {
    appendUniqueGap(gaps, 'State license verification stale');
  }

  if (!pecosArtifact) {
    appendUniqueGap(gaps, 'PECOS enrollment artifact missing');
  } else if (pecosStatus !== 'ENROLLMENT_NOT_FOUND' && !pecosFresh) {
    appendUniqueGap(gaps, 'PECOS enrollment verification stale');
  }

  const readinessStatusMap: Record<TrustBand, string> = {
    L3: 'Ready to credential — all evidence verified',
    L2: 'Mostly ready — minor gaps remain',
    L1: 'Provisional — significant evidence gaps',
    L0: 'Not ready — critical issues detected',
  };

  let readinessStatus = readinessStatusMap[trustBand];
  if (blockers.includes('EXCLUDED')) readinessStatus = 'Not ready — excluded from federal healthcare programs';
  else if (blockers.includes('LICENSE_EXPIRED')) readinessStatus = 'Blocked — state license expired';
  else if (blockers.includes('ENROLLMENT_NOT_FOUND')) readinessStatus = 'Blocked — PECOS enrollment not found';
  else if (reviewRequired) readinessStatus = 'Review required — OIG/LEIE screening needs manual adjudication';

  const state: ClinicianTrustState = {
    npi,
    identityVerified,
    licensureStatus,
    exclusionClear,
    exclusionStatus,
    pecosStatus,
    credentialCount,
    reviewRequired,
    blockers,
    readiness_level: trustBand,
    readiness_status: readinessStatus,
    readiness_score: trustScore,
    gap_summary: gaps,
    methodology_version: METHODOLOGY_VERSION,
    computed_at: computedAt,
    trustBand,
    trustScore,
    facts,
    gaps,
    computedAt,
  };

  log('info', 'trust_state_computed_from_ingested_artifacts', {
    npi,
    trustBand,
    trustScore,
    identityVerified,
    licensureStatus,
    exclusionClear,
    exclusionStatus,
    pecosStatus,
    credentialCount,
    factCount: facts.length,
    gapCount: gaps.length,
    reviewRequired,
  });

  return state;
}

// ── Core computation ──────────────────────────────────────────────────────────

/**
 * Gather all evidence for a clinician and compute composite trust state.
 * Pure computation — does NOT write to DB.
 */
export async function computeClinicianTrustState(npi: string): Promise<ClinicianTrustState> {
  if (isCredentialIngestionEnabled()) {
    return computeClinicianTrustStateFromIngestedArtifacts(npi);
  }

  const computedAt = new Date().toISOString();
  const facts: CanonicalFactSummary[] = [];

  // 1. NPPES identity
  const nppes = await fetchNppes(npi);
  const identityVerified = nppes.found && nppes.status === 'A';

  if (nppes.found) {
    facts.push({
      factType: 'IdentityClaim',
      source: 'CMS NPPES',
      status: nppes.status === 'A' ? 'ACTIVE' : nppes.status,
      details: [nppes.firstName, nppes.lastName].filter(Boolean).join(' ') || `NPI ${npi}`,
    });
  }

  // 2. VerificationArtifacts from DB
  let artifacts: Array<{
    source: string;
    status: string;
    trustState: string;
    verifiedAt: Date;
    expiresAt: Date | null;
    psvWindowDeadline: Date | null;
    rawPayload: unknown;
  }> = [];
  try {
    artifacts = await prisma.verificationArtifact.findMany({
      where: { npi, source: { not: 'TRUST_STATE_ENGINE' } },
      select: {
        source: true,
        status: true,
        trustState: true,
        verifiedAt: true,
        expiresAt: true,
        psvWindowDeadline: true,
        rawPayload: true,
      },
      orderBy: { verifiedAt: 'desc' },
    });
  } catch (err) {
    log('warn', 'trust_state_engine_artifact_query_error', { npi, error: String(err) });
  }

  // Determine licensure from artifacts
  let licensureStatus: LicensureStatus = 'unknown';
  let pecosStatus: PecosStatus = 'UNKNOWN';
  let hasVerifiedArtifacts = false;

  for (const artifact of artifacts) {
    const src = artifact.source.toUpperCase();
    const sts = artifact.status.toUpperCase();

    const isLicenseSource =
      src.includes('NURSYS') ||
      src.includes('STATE') ||
      src.includes('LICENSE') ||
      src.includes('MEDICAL_BOARD') ||
      src.includes('FSMB');

    if (isLicenseSource) {
      if (sts === 'ACTIVE' || sts === 'VERIFIED') {
        licensureStatus = 'verified';
        hasVerifiedArtifacts = true;
      } else if (sts === 'EXPIRED' || sts === 'REVOKED' || sts === 'SUSPENDED') {
        if (licensureStatus !== 'verified') licensureStatus = 'expired';
      } else if (licensureStatus === 'unknown') {
        licensureStatus = 'pending';
      }
    }

    if (sts === 'ACTIVE' || sts === 'VERIFIED') hasVerifiedArtifacts = true;
    if (pecosStatus === 'UNKNOWN' && src.includes('PECOS')) {
      pecosStatus = extractPecosStatus(artifact);
    }

    // Map to fact type
    let factType = 'VerificationRecord';
    if (src.includes('NURSYS') || src.includes('LICENSE')) factType = 'License';
    else if (src.includes('DEA')) factType = 'DEARegistration';
    else if (src.includes('BOARD') || src.includes('CERT')) factType = 'Certification';
    else if (src.includes('OIG') || src.includes('LEIE') || src.includes('SANCTION')) factType = 'Sanction';
    else if (src.includes('PECOS')) factType = 'Enrollment';
    else if (src.includes('NPI') || src.includes('NPPES')) factType = 'IdentityClaim';
    else if (src.includes('MALPRACTICE') || src.includes('INSURANCE')) factType = 'MalpracticeInsurance';

    facts.push({
      factType,
      source: artifact.source,
      status: artifact.status,
      verifiedAt: artifact.verifiedAt.toISOString(),
      expiresAt: artifact.expiresAt?.toISOString(),
    });
  }

  // 3. CandidateCredentials from DB
  let candidateCredentials: Array<{
    data: unknown;
    status: string;
    createdAt: Date;
  }> = [];
  try {
    candidateCredentials = await prisma.candidateCredential.findMany({
      where: { clinicianId: npi },
      select: { data: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  } catch (err) {
    log('warn', 'trust_state_engine_credential_query_error', { npi, error: String(err) });
  }

  for (const cred of candidateCredentials) {
    const credData = (cred.data ?? {}) as Record<string, unknown>;
    const credType = String(credData.type ?? credData.credentialType ?? credData.documentType ?? 'credential').toLowerCase();

    let factType = 'UploadedCredential';
    if (credType.includes('license') || credType.includes('rn') || credType.includes('nursing')) factType = 'License';
    else if (credType.includes('board') || credType.includes('cert')) factType = 'Certification';
    else if (credType.includes('dea')) factType = 'DEARegistration';
    else if (credType.includes('malpractice') || credType.includes('insurance')) factType = 'MalpracticeInsurance';

    facts.push({
      factType,
      source: 'DocumentIntelligence',
      status: cred.status,
      verifiedAt: cred.createdAt.toISOString(),
    });

    // Uploaded verified license upgrades licensure status
    if (
      factType === 'License' &&
      (cred.status === 'VERIFIED' || cred.status === 'PENDING_VERIFICATION')
    ) {
      if (licensureStatus === 'unknown') licensureStatus = 'pending';
    }
  }

  // 4b. Freshness / expiry window checks (stale artifacts downgrade trust)
  const STALE_THRESHOLD_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
  const now = new Date();
  let hasStaleArtifact = false;
  for (const artifact of artifacts) {
    // Check expiry
    if (artifact.expiresAt && artifact.expiresAt.getTime() <= now.getTime()) {
      const src = artifact.source.toUpperCase();
      if (src.includes('LICENSE') || src.includes('NURSYS') || src.includes('FSMB') || src.includes('STATE')) {
        if (licensureStatus === 'verified') licensureStatus = 'expired';
      }
    }
    // Check freshness — artifact verified > 180 days ago without re-verification
    const age = now.getTime() - artifact.verifiedAt.getTime();
    if (age > STALE_THRESHOLD_MS && (artifact.status === 'ACTIVE' || artifact.status === 'VERIFIED')) {
      hasStaleArtifact = true;
    }
  }

  const credentialCount = candidateCredentials.length + artifacts.filter(
    (a) => a.status === 'ACTIVE' || a.status === 'VERIFIED'
  ).length;

  // 4. OIG/LEIE exclusion check
  // Only run if we have name data from NPPES to avoid false negatives
  let exclusionClear = false;
  let exclusionStatus: ExclusionStatus = 'UNCHECKED';
  if (nppes.found && nppes.firstName && nppes.lastName) {
    try {
      const primaryTaxonomy = nppes.taxonomies.find((taxonomy) => taxonomy.primary) ?? nppes.taxonomies[0];
      const exclusionResult = await checkExclusion({
        firstName: nppes.firstName,
        middleName: nppes.middleName,
        lastName: nppes.lastName,
        npi,
        state: primaryTaxonomy?.state ?? null,
        specialty: primaryTaxonomy?.desc ?? null,
      });
      switch (exclusionResult.status) {
        case 'CLEAR':
        case 'EXCLUDED':
        case 'POSSIBLE_MATCH':
        case 'UNCHECKED':
          exclusionStatus = exclusionResult.status;
          break;
        default:
          exclusionStatus = exclusionResult.excluded ? 'EXCLUDED' : 'UNCHECKED';
          break;
      }
      exclusionClear = exclusionStatus === 'CLEAR';

      facts.push({
        factType: 'Sanction',
        source: 'OIG_LEIE',
        status: exclusionStatus,
        verifiedAt: exclusionResult.checkedAt,
        details: exclusionResult.details,
      });
    } catch (err) {
      log('warn', 'trust_state_engine_oig_error', { npi, error: String(err) });
      // OIG failure is NOT a silent pass — keep status unchecked until resolved.
      exclusionClear = false;
      exclusionStatus = 'UNCHECKED';
      facts.push({
        factType: 'Sanction',
        source: 'OIG_LEIE',
        status: 'CHECK_FAILED',
        verifiedAt: computedAt,
        details: 'OIG check unavailable — manual verification required.',
      });
    }
  }

  // 5. Compute composite score & band
  const trustScore = computeScore({
    identityVerified,
    licensureStatus,
    exclusionClear,
    exclusionStatus,
    pecosStatus,
    credentialCount,
    hasVerifiedArtifacts,
  });

  let trustBand = deriveBand({
    identityVerified,
    licensureStatus,
    exclusionClear,
    exclusionStatus,
    pecosStatus,
    trustScore,
  });
  // Stale artifacts cap at L2 — cannot be L3 with outdated evidence
  if (hasStaleArtifact && trustBand === 'L3') trustBand = 'L2';
  if (
    (exclusionStatus === 'POSSIBLE_MATCH' || exclusionStatus === 'UNCHECKED')
    && (trustBand === 'L2' || trustBand === 'L3')
  ) {
    trustBand = 'L1';
  }
  if (pecosStatus === 'ENROLLMENT_NOT_FOUND' && (trustBand === 'L2' || trustBand === 'L3')) trustBand = 'L1';

  // 6. Detect gaps
  const gaps = detectGaps({
    identityVerified,
    licensureStatus,
    exclusionClear,
    exclusionStatus,
    pecosStatus,
    credentialCount,
    facts,
  });
  const blockers = [
    ...(exclusionStatus === 'EXCLUDED' ? ['EXCLUDED'] : []),
    ...(licensureStatus === 'expired' ? ['LICENSE_EXPIRED'] : []),
    ...(pecosStatus === 'ENROLLMENT_NOT_FOUND' ? ['ENROLLMENT_NOT_FOUND'] : []),
  ];
  const reviewRequired = reviewRequiredForExclusionStatus(exclusionStatus);

  // Derive human-readable readiness status
  const readinessStatusMap: Record<TrustBand, string> = {
    L3: 'Ready to credential — all evidence verified',
    L2: 'Mostly ready — minor gaps remain',
    L1: 'Provisional — significant evidence gaps',
    L0: 'Not ready — critical issues detected',
  };
  let readiness_status = readinessStatusMap[trustBand];
  if (blockers.includes('EXCLUDED')) readiness_status = 'Not ready — excluded from federal healthcare programs';
  else if (blockers.includes('LICENSE_EXPIRED')) readiness_status = 'Blocked — state license expired';
  else if (blockers.includes('ENROLLMENT_NOT_FOUND')) readiness_status = 'Blocked — PECOS enrollment not found';
  else if (reviewRequired) readiness_status = 'Review required — OIG/LEIE screening needs manual adjudication';

  const state: ClinicianTrustState = {
    npi,
    identityVerified,
    licensureStatus,
    exclusionClear,
    exclusionStatus,
    pecosStatus,
    credentialCount,
    reviewRequired,
    blockers,
    // Canonical output fields per directive
    readiness_level: trustBand,
    readiness_status,
    readiness_score: trustScore,
    gap_summary: gaps,
    methodology_version: METHODOLOGY_VERSION,
    computed_at: computedAt,
    // Backward-compat aliases
    trustBand,
    trustScore,
    facts,
    gaps,
    computedAt,
  };

  log('info', 'trust_state_computed', {
    npi,
    trustBand,
    trustScore,
    identityVerified,
    licensureStatus,
    exclusionClear,
    exclusionStatus,
    pecosStatus,
    credentialCount,
    factCount: facts.length,
    gapCount: gaps.length,
    reviewRequired,
  });

  return state;
}

// ── Refresh (compute + persist + audit) ──────────────────────────────────────

/**
 * Compute trust state and persist as a VerificationArtifact snapshot.
 * Emits an audit event.
 */
export async function refreshTrustState(npi: string): Promise<ClinicianTrustState> {
  const state = await computeClinicianTrustState(npi);
  const persistedPayload = buildPersistedTrustStatePayload(state);

  // Persist as a VerificationArtifact with source='TRUST_STATE_ENGINE'
  try {
    const checksum = Buffer.from(`${npi}:${state.computedAt}`).toString('base64');
    await prisma.verificationArtifact.create({
      data: {
        npi,
        source: 'TRUST_STATE_ENGINE',
        status: state.trustBand === 'L3' || state.trustBand === 'L2' ? 'VERIFIED' : 'ACTIVE',
        rawPayload: JSON.parse(JSON.stringify(persistedPayload)),
        checksum,
        verifiedAt: new Date(state.computedAt),
        trustState: state.trustBand,
        monitoring: false,
      },
    });
  } catch (err) {
    log('error', 'trust_state_persist_error', { npi, error: String(err) });
    throw err;
  }

  const cachedState = setTrustStateMemoryCache(npi, state);

  // Emit audit event
  try {
    await appendAuditEvent({
      category: ['TRUST_STATE_CHANGE'],
      actor: npi,
      resource: `trust-state:${npi}`,
      severity: state.trustBand === 'L0' ? 'WARNING' : 'INFO',
      requestFields: { npi },
      resultFields: {
        trustBand: state.trustBand,
        trustScore: state.trustScore,
        identityVerified: state.identityVerified,
        licensureStatus: state.licensureStatus,
        exclusionClear: state.exclusionClear,
        exclusionStatus: state.exclusionStatus,
        gapCount: state.gaps.length,
      },
    });
  } catch (err) {
    log('warn', 'trust_state_audit_error', { npi, error: String(err) });
  }

  return cachedState;
}

// ── History query ─────────────────────────────────────────────────────────────

/**
 * Retrieve past trust state snapshots for a clinician.
 */
export async function getTrustStateHistory(
  npi: string,
  limit = 10,
): Promise<ClinicianTrustState[]> {
  try {
    const artifacts = await prisma.verificationArtifact.findMany({
      where: {
        npi,
        source: 'TRUST_STATE_ENGINE',
      },
      select: { rawPayload: true, verifiedAt: true },
      orderBy: { verifiedAt: 'desc' },
      take: limit,
    });

    return artifacts
      .map((a) => extractPersistedTrustState(a.rawPayload))
      .filter((s): s is ClinicianTrustState => s !== null);
  } catch (err) {
    log('warn', 'trust_state_history_error', { npi, error: String(err) });
    return [];
  }
}

// ── Cache helper ──────────────────────────────────────────────────────────────

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Return the most recent cached trust state if it was computed within the
 * last hour; otherwise return null (caller should recompute).
 */
export async function getCachedTrustState(npi: string): Promise<ClinicianTrustState | null> {
  // Tier 1: in-process LRU (60s TTL, sub-millisecond)
  const memoryCached = getTrustStateMemoryCache(npi);
  if (memoryCached) {
    recordMemoryHit();
    return memoryCached;
  }

  // Tier 2: DB snapshot (1h TTL) — back-fills LRU on hit
  try {
    const recent = await prisma.verificationArtifact.findFirst({
      where: {
        npi,
        source: 'TRUST_STATE_ENGINE',
        verifiedAt: { gte: new Date(Date.now() - ONE_HOUR_MS) },
      },
      select: { rawPayload: true },
      orderBy: { verifiedAt: 'desc' },
    });

    if (!recent?.rawPayload) {
      recordCacheMiss();
      return null;
    }
    const payload = extractPersistedTrustState(recent.rawPayload);
    if (!payload) {
      recordCacheMiss();
      return null;
    }
    recordDbHit();
    return setTrustStateMemoryCache(npi, payload);
  } catch {
    recordCacheMiss();
    return null;
  }
}
