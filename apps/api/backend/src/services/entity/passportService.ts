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
import { FRESHNESS_WINDOWS_DAYS, isCredentialStale, daysUntilExpiry } from '../../domain/entity/contracts';
import { log } from '../../obs/logger';

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
  jurisdiction?:     string;
  issuedAt?:         string;
  expiresAt?:        string;
  verifiedAt?:       string;
  daysUntilExpiry?:  number;
  stale:             boolean;
  issuerName?:       string;
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
  exclusionStatus:  'CLEAR' | 'EXCLUDED' | 'UNKNOWN';
  licensureStatus:  'verified' | 'pending' | 'expired' | 'unknown';
  deaStatus:        'registered' | 'none' | 'unknown';
  pecosStatus:      'enrolled' | 'not_enrolled' | 'unknown';
  negativeFindings: string[];
}

export interface PassportReadiness {
  status:             'READY' | 'PARTIAL' | 'BLOCKED';
  score:              number;    // 0–100
  level:              string;    // L0–L3
  blockers:           string[];
  gaps:               string[];
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

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Build a full TrustPassport for a given entity ID.
 * For NPI-based lookup, resolve entity first then call this.
 */
export async function buildPassport(entityId: string): Promise<TrustPassport | null> {
  const record = await getEntityById(entityId);
  if (!record) return null;

  const { entity, credentials, roles } = record;
  const npi = entity.npi ?? undefined;

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
  const credList: PassportCredential[] = credentials.map(c => {
    const stale   = isCredentialStale({ domain: c.domain, verifiedAt: c.verifiedAt });
    const expiry  = daysUntilExpiry(c.expiresAt);
    return {
      id:                c.id,
      domain:            c.domain,
      type:              c.credentialType,
      status:            c.status,
      verificationLevel: c.verificationLevel,
      jurisdiction:      c.jurisdiction ?? undefined,
      issuedAt:          c.issuedAt?.toISOString(),
      expiresAt:         c.expiresAt?.toISOString(),
      verifiedAt:        c.verifiedAt?.toISOString(),
      daysUntilExpiry:   expiry ?? undefined,
      stale,
    };
  });

  const activeDomains  = new Set(credentials.filter(c => c.status === 'ACTIVE').map(c => c.domain));
  const missingBlocking = BLOCKING_DOMAINS.filter(d => !activeDomains.has(d as import('@prisma/client').VcvCredentialDomain));

  const authority: PassportAuthority = {
    credentials: credList,
    summary: {
      active:  credList.filter(c => c.status === 'ACTIVE').length,
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
  const exclusionCred  = credentials.find(c => c.domain === 'EXCLUSION_CHECK');
  const licensureCred  = credentials.find(c => c.domain === 'LICENSURE');
  const deaCred        = credentials.find(c => c.domain === 'DEA_REGISTRATION');
  const pecosCred      = credentials.find(c => c.domain === 'MEDICARE_ENROLLMENT');

  const exclusionClear = trustState?.exclusionClear
    ?? (exclusionCred?.status === 'ACTIVE' ? true : undefined)
    ?? false;

  const negativeFindings: string[] = [];
  if (trustState) {
    if (!trustState.exclusionClear)            negativeFindings.push('OIG/LEIE exclusion flag');
    if (trustState.licensureStatus === 'expired') negativeFindings.push('License expired');
  }

  const standing: PassportStanding = {
    exclusionClear,
    exclusionStatus: trustState?.exclusionStatus ?? (exclusionCred ? 'CLEAR' : 'UNKNOWN'),
    licensureStatus: trustState?.licensureStatus ?? (licensureCred?.status === 'ACTIVE' ? 'verified' : 'unknown'),
    deaStatus:  deaCred?.status === 'ACTIVE'  ? 'registered' : deaCred ? 'none' : 'unknown',
    pecosStatus: pecosCred?.status === 'ACTIVE' ? 'enrolled' : pecosCred ? 'not_enrolled' : 'unknown',
    negativeFindings,
  };

  // ── Readiness ─────────────────────────────────────────────────────────────
  const blockers: string[] = [
    ...negativeFindings,
    ...missingBlocking.map(d => `Missing: ${d}`),
  ];
  if (credList.some(c => c.status === 'EXPIRED')) blockers.push('Expired credentials');

  const gaps: string[] = [
    ...(trustState?.gap_summary ?? []),
    ...credList.filter(c => c.stale && c.status === 'ACTIVE').map(c => `Stale: ${c.domain}`),
  ];

  let readinessStatus: 'READY' | 'PARTIAL' | 'BLOCKED' = 'READY';
  if (blockers.length > 0)             readinessStatus = 'BLOCKED';
  else if (gaps.length > 0)            readinessStatus = 'PARTIAL';
  else if (missingBlocking.length > 0) readinessStatus = 'BLOCKED';

  const readiness: PassportReadiness = {
    status:             readinessStatus,
    score:              trustState?.readiness_score ?? (readinessStatus === 'READY' ? 80 : readinessStatus === 'PARTIAL' ? 50 : 20),
    level:              trustState?.readiness_level ?? 'L1',
    blockers,
    gaps,
    estimatedStartDays: readinessStatus === 'BLOCKED' ? null : ESTIMATED_START_DAYS[readinessStatus],
  };

  // ── Sources ───────────────────────────────────────────────────────────────
  const sources: PassportSources = {
    checked:   entity.sourceIds,
    lastFetch: entity.verifiedAt
      ? Object.fromEntries(entity.sourceIds.map(s => [s, entity.verifiedAt!.toISOString()]))
      : {},
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
