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
  computeDeterministicTrustReadiness,
  defaultCoverageStateForSource,
  deriveTrustBandFromReadiness,
  resolveSourceCoverageState,
  type TrustSourceCoverage,
} from './trustCore';
import {
  buildPecosStatusLabel,
  extractPecosArtifactSnapshot,
  isPecosFresh,
  isUnresolvedPecosStatus,
  pecosBlocker,
  pecosCoverageReason,
  pecosGap,
  pecosRevalidationDaysRemaining,
  pecosReadinessStatus,
  resolvePecosCurrentStatus,
  type PecosEnrollmentStatus,
} from '../identity/pecosContract';
import {
  getSource,
  getSourceFreshnessWindowHours,
  isSourceFlagEnabled,
} from '../identity/sourceCatalog';
import { isProductionEnabledPhysicianLicensureState } from '../identity/physicianLicensureLaunchLane';
import {
  boardOrderSeverityBlocksReadiness,
  boardOrderSeverityRequiresReview,
  normalizeBoardOrderSeverity,
} from '../authority/contracts';
import { detectDivergence, type DivergenceReport } from '../identity/divergenceEngine';
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
export type PecosStatus = PecosEnrollmentStatus;

export interface CanonicalFactSummary {
  factType: string;
  source: string;
  status: string;
  verifiedAt?: string;
  expiresAt?: string;
  details?: string;
}

export interface TrustStateDivergenceSummary {
  activeCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalPenalty: number;
  summary: string;
  conflicts: Array<{
    id: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    sources: string[];
    penalty: number;
    active: boolean;
    resolution: 'OPEN' | 'RESOLVED';
  }>;
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
  nextActions?: string[];
  confidenceWeighting?: Record<'identity' | 'exclusion' | 'licensure' | 'enrollment', number>;
  sourceCoverage?: TrustSourceCoverage[];
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
  divergence?: TrustStateDivergenceSummary;
  facts: CanonicalFactSummary[];
  gaps: string[];
  computedAt: string;
}

type IngestedArtifactRecord = {
  id?: string;
  source: string;
  status: string;
  checksum?: string | null;
  sourceUrl?: string | null;
  parserVersion?: string | null;
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
  checked: boolean;
  unavailable: boolean;
  sourceUrl: string;
}

async function fetchNppes(npi: string): Promise<NppesResult> {
  const url = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      return {
        firstName: '',
        middleName: '',
        lastName: '',
        enumerationType: '',
        taxonomies: [],
        status: 'UNKNOWN',
        found: false,
        checked: false,
        unavailable: true,
        sourceUrl: url,
      };
    }
    const data = await res.json() as Record<string, unknown>;
    const result = (data?.results as Record<string, unknown>[])?.[0];
    if (!result) {
      return {
        firstName: '',
        middleName: '',
        lastName: '',
        enumerationType: '',
        taxonomies: [],
        status: 'UNKNOWN',
        found: false,
        checked: true,
        unavailable: false,
        sourceUrl: url,
      };
    }
    const basic = (result.basic ?? {}) as Record<string, string>;
    const firstName = basic.first_name ?? basic.authorized_official_first_name ?? '';
    const middleName = basic.middle_name ?? '';
    const lastName = basic.last_name ?? basic.authorized_official_last_name ?? '';
    const enumerationType = (result.enumeration_type as string) ?? '';
    const taxonomies = (result.taxonomies as Array<{ code: string; desc?: string; primary: boolean; state?: string }>) ?? [];
    const status = basic.status ?? 'UNKNOWN';
    return {
      firstName,
      middleName,
      lastName,
      enumerationType,
      taxonomies,
      status,
      found: true,
      checked: true,
      unavailable: false,
      sourceUrl: url,
    };
  } catch {
    return {
      firstName: '',
      middleName: '',
      lastName: '',
      enumerationType: '',
      taxonomies: [],
      status: 'UNKNOWN',
      found: false,
      checked: false,
      unavailable: true,
      sourceUrl: url,
    };
  }
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
    const snapshot = extractPecosArtifactSnapshot(artifact);
    const statusLabel = buildPecosStatusLabel(snapshot.status, snapshot.dataVersion);
    return statusLabel || undefined;
  }

  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isoDateValue(value: unknown): string | undefined {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : undefined;
  }

  const stringified = stringValue(value);
  if (!stringified) {
    return undefined;
  }

  const parsed = Date.parse(stringified);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function appendUniqueValue(values: string[], value: string): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function authorityScopeLabel(credential: AuthorityCredentialRecord): string {
  const metadata = asRecord(credential.metadata);
  const claimValue = asRecord(credential.claimValue);
  return (
    stringValue(metadata.sourceScope)
    ?? stringValue(claimValue.sourceScope)
    ?? stringValue(metadata.sourceId)
    ?? credential.credentialType
  );
}

function authorityJurisdiction(
  credential: AuthorityCredentialRecord,
): string | null {
  const metadata = asRecord(credential.metadata);
  const claimValue = asRecord(credential.claimValue);

  return (
    stringValue(claimValue.state)
    ?? stringValue(claimValue.jurisdiction)
    ?? stringValue(metadata.jurisdiction)
  )?.toUpperCase() ?? null;
}

function authorityScope(
  credential: AuthorityCredentialRecord,
): string | null {
  const metadata = asRecord(credential.metadata);
  const claimValue = asRecord(credential.claimValue);

  return (
    stringValue(metadata.sourceScope)
    ?? stringValue(claimValue.sourceScope)
  ) ?? null;
}

function licensureCountsTowardReadiness(
  credential: AuthorityCredentialRecord,
  authorityClaimCode: string | null,
): boolean {
  const scope = authorityScope(credential);
  if (scope === 'NURSYS_AUTHORIZED_PATH' || authorityClaimCode?.startsWith('RN_')) {
    return true;
  }

  return isProductionEnabledPhysicianLicensureState(
    authorityJurisdiction(credential),
  );
}

function collectAuthoritySignals(
  credentials: readonly AuthorityCredentialRecord[],
  now: Date,
): AuthoritySignalSummary {
  const facts: CanonicalFactSummary[] = [];
  const gaps: string[] = [];
  const blockers: string[] = [];
  const activeCredentialIds = new Set<string>();
  let licensureVerified = false;
  let expiredLicense = false;
  let disciplinedLicense = false;
  let boardOrderRequiresReview = false;
  let boardOrderBlocks = false;
  let authorityUnavailableLicensure = false;

  for (const credential of credentials) {
    const metadata = asRecord(credential.metadata);
    const claimValue = asRecord(credential.claimValue);
    const authorityClaimCode =
      stringValue(metadata.authorityClaimCode)
      ?? stringValue(claimValue.authorityClaimCode);
    const boardOrderSeverity = normalizeBoardOrderSeverity(
      stringValue(metadata.boardOrderSeverity)
      ?? stringValue(claimValue.boardOrderSeverity),
    );
    const sourceScope = authorityScopeLabel(credential);
    const sourceId =
      stringValue(metadata.sourceId)
      ?? stringValue(claimValue.source)
      ?? 'AUTHORITY';
    const factType =
      credential.domain === 'BOARD_CERTIFICATION'
        ? 'Certification'
        : credential.domain === 'TRAINING'
          ? 'Training'
          : 'License';
    const details = [
      sourceScope,
      boardOrderSeverity !== 'NONE' ? `severity=${boardOrderSeverity}` : null,
      authorityClaimCode ? `claim=${authorityClaimCode}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    if (authorityClaimCode || credential.domain === 'TRAINING') {
      facts.push({
        factType,
        source: sourceId,
        status: credential.status,
        verifiedAt:
          credential.verifiedAt?.toISOString()
          ?? isoDateValue(metadata.verifiedAt)
          ?? isoDateValue(claimValue.verifiedAt),
        expiresAt:
          credential.expiresAt?.toISOString()
          ?? isoDateValue(metadata.expiresAt)
          ?? isoDateValue(claimValue.expiresAt)
          ?? isoDateValue(claimValue.expiryDate),
        details: details || undefined,
      });
    }

    const normalizedStatus = credential.status.trim().toUpperCase();
    const expiresAtIso =
      credential.expiresAt?.toISOString()
      ?? isoDateValue(metadata.expiresAt)
      ?? isoDateValue(claimValue.expiresAt)
      ?? isoDateValue(claimValue.expiryDate);
    const expiresAt = expiresAtIso ? new Date(expiresAtIso) : null;
    const expiredByDate =
      Boolean(expiresAt)
      && Number.isFinite(expiresAt!.getTime())
      && expiresAt!.getTime() <= now.getTime();

    if (credential.domain === 'LICENSURE') {
      if (!licensureCountsTowardReadiness(credential, authorityClaimCode ?? null)) {
        continue;
      }

      if (authorityClaimCode === 'AUTHORITY_UNAVAILABLE') {
        authorityUnavailableLicensure = true;
        appendUniqueGap(
          gaps,
          `Authority source unavailable: ${sourceScope} licensure unresolved`,
        );
      }

      if (
        authorityClaimCode === 'RN_LICENSE_DISCIPLINED'
        || normalizedStatus === 'SUSPENDED'
        || normalizedStatus === 'REVOKED'
      ) {
        disciplinedLicense = true;
        appendUniqueValue(blockers, 'LICENSE_DISCIPLINED');
      }

      if (authorityClaimCode === 'BOARD_ORDER_PRESENT') {
        if (boardOrderSeverityBlocksReadiness(boardOrderSeverity)) {
          boardOrderBlocks = true;
          appendUniqueValue(blockers, 'BOARD_ORDER_BLOCK');
        } else {
          boardOrderRequiresReview = true;
          appendUniqueValue(blockers, 'BOARD_ORDER_REVIEW');
        }
      }

      if (
        authorityClaimCode === 'RN_LICENSE_EXPIRED'
        || normalizedStatus === 'EXPIRED'
        || expiredByDate
      ) {
        expiredLicense = true;
        appendUniqueValue(blockers, 'LICENSE_EXPIRED');
      }

      if (
        authorityClaimCode === 'PHYSICIAN_LICENSE_ACTIVE'
        || authorityClaimCode === 'RN_LICENSE_ACTIVE'
        || normalizedStatus === 'ACTIVE'
      ) {
        licensureVerified = true;
        activeCredentialIds.add(credential.id);
      }
    }

    if (credential.domain === 'BOARD_CERTIFICATION') {
      if (authorityClaimCode === 'AUTHORITY_UNAVAILABLE') {
        appendUniqueGap(
          gaps,
          `Authority source unavailable: ${sourceScope} board certification unresolved`,
        );
      } else if (normalizedStatus === 'ACTIVE') {
        activeCredentialIds.add(credential.id);
      }
    }

    if (credential.domain === 'TRAINING') {
      if (authorityClaimCode === 'AUTHORITY_UNAVAILABLE') {
        appendUniqueGap(
          gaps,
          `Authority source unavailable: ${sourceScope} training unresolved`,
        );
      } else if (normalizedStatus === 'ACTIVE') {
        activeCredentialIds.add(credential.id);
      }
    }
  }

  return {
    facts,
    gaps,
    blockers,
    credentialCount: activeCredentialIds.size,
    licensureVerified,
    expiredLicense,
    disciplinedLicense,
    boardOrderRequiresReview,
    boardOrderBlocks,
    authorityUnavailableLicensure,
  };
}

function unresolvedPecosStatus(status: PecosStatus): boolean {
  return isUnresolvedPecosStatus(status);
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

function confidenceScoreForLabel(label: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCERTAIN'): number {
  if (label === 'HIGH') return 0.95;
  if (label === 'MEDIUM') return 0.75;
  if (label === 'LOW') return 0.55;
  return 0.25;
}

function exclusionSourceUnavailable(details: string | undefined): boolean {
  const normalized = (details ?? '').trim().toLowerCase();
  return normalized.includes('disabled')
    || normalized.includes('timed out')
    || normalized.includes('timeout')
    || normalized.includes('failed')
    || normalized.includes('could not be loaded')
    || normalized.includes('did not complete cleanly');
}

function payloadLooksMock(rawPayload: unknown): boolean {
  const payload = asRecord(rawPayload);
  const source = stringValue(payload.source)?.toLowerCase();
  const method = stringValue(payload.method)?.toLowerCase();

  return Boolean(
    source && (source.includes('mock') || source.includes('simulated'))
      || method && (method.includes('mock') || method.includes('simulation') || method.includes('prefix')),
  );
}

function artifactLooksMock(
  artifact: Pick<IngestedArtifactRecord, 'rawPayload'> | undefined,
): boolean {
  return Boolean(artifact && payloadLooksMock(artifact.rawPayload));
}

/**
 * States that mean "nothing reached this source". A lane in one of these has
 * no check, so it must carry no check TIME and no source link — see the note
 * in artifactCoverage for what shipped when it did.
 */
export function isUnreachedState(state: string): boolean {
  return state === 'gated' || state === 'accessRequired' || state === 'unavailable';
}

export function artifactCoverage(
  sourceId: string,
  artifact: IngestedArtifactRecord | undefined,
  options: {
    fresh: boolean;
    unavailable?: boolean;
    humanRequired?: boolean;
    gated?: boolean;
    mock?: boolean;
    partial?: boolean;
    /**
     * The artifact records a definitive negative — the source answered and had
     * no record backing this subject. An artifact ROW existing only means we
     * stored an answer; it says nothing about what that answer was, so callers
     * that can read the outcome must pass it here or a not-found result gets
     * reported as 'checked'.
     */
    notFound?: boolean;
    reason: string;
  },
): TrustSourceCoverage {
  const state = resolveSourceCoverageState({
    sourceId,
    checked: Boolean(artifact),
    fresh: options.fresh,
    unavailable: options.unavailable,
    gated: options.gated,
    humanRequired: options.humanRequired,
    mock: options.mock,
    partial: options.partial,
    notFound: options.notFound,
  });
  return {
    sourceId,
    state,
    reason: options.reason,
    // A lane nothing can reach has no check, so it has no check TIME and no
    // source link. Without this the placeholder artifact a gated fetch stores
    // still supplied `verifiedAt` and `sourceUrl`, and /verify aged that date
    // through a freshness window and rendered **Stale** — which tells a reader
    // the source WAS consulted and merely went out of date. Never-checked and
    // checked-then-aged are different facts. `artifactId`/`rawArtifactRef` stay
    // so the placeholder is still traceable in support.
    checkedAt: isUnreachedState(state) ? null : artifact?.verifiedAt?.toISOString() ?? null,
    artifactId: artifact?.id ?? null,
    sourceUrl: isUnreachedState(state) ? null : artifact?.sourceUrl ?? null,
    rawArtifactRef: artifact?.id ?? null,
    checksum: artifact?.checksum ?? null,
    parserVersion: artifact?.parserVersion ?? null,
    freshnessWindowHours: getSourceFreshnessWindowHours(sourceId),
  };
}

function buildEnrollmentAssessment(input: {
  pecosStatus: PecosStatus;
  checked: boolean;
  fresh: boolean;
  daysRemaining: number | null;
  coverage: TrustSourceCoverage;
}) {
  return {
    dimension: 'enrollment' as const,
    status:
      input.pecosStatus === 'ENROLLED'
        ? 'MET' as const
        : input.pecosStatus === 'NOT_FOUND'
          ? 'BLOCKED' as const
          : 'UNMET' as const,
    confidence:
      unresolvedPecosStatus(input.pecosStatus)
        ? confidenceScoreForLabel('UNCERTAIN')
        : confidenceScoreForLabel('HIGH'),
    blocker: pecosBlocker(input.pecosStatus),
    gap: pecosGap({
      status: input.pecosStatus,
      checked: input.checked,
      fresh: input.fresh,
      daysRemaining: input.daysRemaining,
    }),
    sourceCoverage: [input.coverage],
  };
}

function capTrustScore(input: {
  baseScore: number;
  licensureBlocked: boolean;
  reviewRequired: boolean;
  divergenceBlocking?: boolean;
  unresolvedAuthorityLicensure?: boolean;
  pecosStatus: PecosStatus;
}): number {
  if (input.licensureBlocked) {
    return Math.min(input.baseScore, 10);
  }

  if (
    input.reviewRequired
    || Boolean(input.divergenceBlocking)
    || Boolean(input.unresolvedAuthorityLicensure)
    || input.pecosStatus !== 'ENROLLED'
  ) {
    return Math.min(input.baseScore, 59);
  }

  return input.baseScore;
}

function buildReadinessStatusHeadline(input: {
  trustBand: TrustBand;
  blockers: readonly string[];
  reviewRequired: boolean;
  divergenceBlocking?: boolean;
  unresolvedAuthorityLicensure?: boolean;
  pecosStatus: PecosStatus;
}): string {
  const readinessStatusMap: Record<TrustBand, string> = {
    L3: 'Ready to credential — all evidence verified',
    L2: 'Mostly ready — minor gaps remain',
    L1: 'Provisional — significant evidence gaps',
    L0: 'Not ready — critical issues detected',
  };

  const pecosReadinessHeadline = pecosReadinessStatus(input.pecosStatus);
  if (input.blockers.some((blocker) => /exclusion confirmed|excluded/i.test(blocker))) {
    return 'Not ready — excluded from federal healthcare programs';
  }
  if (input.blockers.some((blocker) => /discipline/i.test(blocker))) {
    return 'Blocked — license discipline requires resolution';
  }
  if (input.blockers.some((blocker) => /board order severity blocks/i.test(blocker))) {
    return 'Blocked — board order severity requires manual resolution';
  }
  if (input.divergenceBlocking || input.blockers.some((blocker) => /cross-source divergence/i.test(blocker))) {
    return 'Review required — resolve cross-source divergence';
  }
  if (input.blockers.some((blocker) => /license expired/i.test(blocker))) {
    return 'Blocked — state license expired';
  }
  if (pecosReadinessHeadline) {
    return pecosReadinessHeadline;
  }
  if (input.blockers.some((blocker) => /board order requires manual review/i.test(blocker))) {
    return 'Review required — board order requires adjudication';
  }
  if (input.unresolvedAuthorityLicensure) {
    return 'Unresolved — authority source unavailable for licensure';
  }
  if (input.reviewRequired) {
    return 'Review required — OIG/LEIE screening needs manual adjudication';
  }

  return readinessStatusMap[input.trustBand];
}

function buildTrustStateDivergenceSummary(report: DivergenceReport): TrustStateDivergenceSummary {
  const active = report.conflicts.filter((conflict) => conflict.active);

  return {
    activeCount: active.length,
    highCount: active.filter((conflict) => conflict.severity === 'HIGH').length,
    mediumCount: active.filter((conflict) => conflict.severity === 'MEDIUM').length,
    lowCount: active.filter((conflict) => conflict.severity === 'LOW').length,
    totalPenalty: report.totalPenalty,
    summary: report.summary,
    conflicts: report.conflicts.slice(0, 5).map((conflict) => ({
      id: conflict.id,
      severity: conflict.severity,
      description: conflict.description,
      sources: conflict.sources,
      penalty: conflict.penalty,
      active: conflict.active,
      resolution: conflict.resolution,
    })),
  };
}

async function safeDetectDivergence(npi: string): Promise<DivergenceReport | null> {
  try {
    return await detectDivergence(npi);
  } catch (error) {
    log('warn', 'trust_state_divergence_detection_failed', {
      npi,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
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

  const [artifacts, entity] = await Promise.all([
    prisma.verificationArtifact.findMany({
      where: {
        npi,
        source: { in: ['NPPES', 'NPPES_API', 'OIG', 'OIG_LEIE', 'STATE_BOARD', 'PECOS_PUBLIC'] },
      },
      select: {
        id: true,
        source: true,
        status: true,
        checksum: true,
        sourceUrl: true,
        parserVersion: true,
        verifiedAt: true,
        expiresAt: true,
        psvWindowDeadline: true,
        rawPayload: true,
      },
      orderBy: [
        { verifiedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    }),
    prisma.vcvEntity.findFirst({
      where: { npi },
      select: { id: true },
    }),
  ]);
  const authorityCredentials: AuthorityCredentialRecord[] = entity
    ? await prisma.vcvCredential.findMany({
        where: {
          subjectId: entity.id,
          status: { not: 'SUPERSEDED' },
          domain: { in: ['LICENSURE', 'BOARD_CERTIFICATION', 'TRAINING'] },
        },
        select: {
          id: true,
          domain: true,
          status: true,
          credentialType: true,
          verifiedAt: true,
          expiresAt: true,
          observedAt: true,
          metadata: true,
          claimValue: true,
        },
        orderBy: [
          { observedAt: 'desc' },
          { verifiedAt: 'desc' },
          { createdAt: 'desc' },
        ],
      })
    : [];

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

  const authoritySignals = collectAuthoritySignals(authorityCredentials, now);
  facts.push(...authoritySignals.facts);

  const nppesArtifact = latestBySource.get('NPPES_API') ?? latestBySource.get('NPPES');
  const oigArtifact = latestBySource.get('OIG_LEIE') ?? latestBySource.get('OIG');
  const licenseArtifact = latestBySource.get('STATE_BOARD');
  const pecosArtifact = latestBySource.get('PECOS_PUBLIC');
  const pecosSnapshot = extractPecosArtifactSnapshot(pecosArtifact);

  const nppesFresh = isSourceArtifactFresh(nppesArtifact, now);
  const oigFresh = isSourceArtifactFresh(oigArtifact, now);
  const licenseFresh = isSourceArtifactFresh(licenseArtifact, now);
  const pecosFresh = isPecosFresh({
    status: pecosSnapshot.status,
    revalidationDue: pecosSnapshot.revalidationDue,
    observedAt: pecosSnapshot.observedAt,
  }, now);
  const pecosDaysRemaining = pecosRevalidationDaysRemaining(
    pecosSnapshot.revalidationDue,
    now,
  );
  const nppesMock = artifactLooksMock(nppesArtifact);
  const oigMock = artifactLooksMock(oigArtifact);
  const licenseMock = artifactLooksMock(licenseArtifact);
  const pecosMock = artifactLooksMock(pecosArtifact);

  const identityVerified = Boolean(
    nppesArtifact &&
    (nppesArtifact.status === 'ACTIVE' || nppesArtifact.status === 'VERIFIED') &&
    nppesFresh,
  );
  /**
   * We stored an NPPES answer and it does not affirm this NPI (NOT_FOUND, or a
   * record the registry lists as deactivated). Deliberately independent of
   * freshness: a stale-but-affirming artifact is 'stale', while a fresh
   * not-found one is 'notFound'.
   */
  const nppesIdentityNotFound = Boolean(
    nppesArtifact &&
    nppesArtifact.status !== 'ACTIVE' &&
    nppesArtifact.status !== 'VERIFIED',
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

  if (authoritySignals.expiredLicense) {
    licensureStatus = 'expired';
  } else if (authoritySignals.licensureVerified) {
    licensureStatus = 'verified';
  }

  const exclusionStatus = normalizeExclusionStatus(oigArtifact, oigFresh);
  const exclusionClear = exclusionStatus === 'CLEAR';
  const pecosStatus: PecosStatus = resolvePecosCurrentStatus({
    checked: pecosSnapshot.checked,
    status: pecosSnapshot.status,
    fresh: pecosFresh,
  });

  const credentialCount = [nppesArtifact, oigArtifact, licenseArtifact, pecosArtifact].filter((artifact) => {
    if (!artifact) {
      return false;
    }
    const fresh = isSourceArtifactFresh(artifact, now);
    const active = artifact.status === 'ACTIVE' || artifact.status === 'VERIFIED' || artifact.status === 'CLEAR';
    const unexpired = !artifact.expiresAt || artifact.expiresAt.getTime() > now.getTime();
    return fresh && active && unexpired;
  }).length + authoritySignals.credentialCount;
  const unresolvedAuthorityLicensure =
    authoritySignals.authorityUnavailableLicensure
    && licensureStatus !== 'verified';
  const licensureAuthorityCredential = authorityCredentials.find((credential) => credential.domain === 'LICENSURE');
  const licensureAuthorityMetadata = asRecord(licensureAuthorityCredential?.metadata);
  const licensureAuthorityValue = asRecord(licensureAuthorityCredential?.claimValue);
  const licensureSourceId =
    stringValue(licensureAuthorityMetadata.sourceId)
    ?? stringValue(licensureAuthorityValue.sourceId)
    ?? stringValue(licensureAuthorityValue.source)
    ?? 'STATE_BOARD';
  const licensureGated =
    unresolvedAuthorityLicensure
    && defaultCoverageStateForSource(licensureSourceId) === 'gated';

  const identityCoverage = artifactCoverage('NPPES_API', nppesArtifact, {
    fresh: nppesFresh,
    reason:
      nppesMock
        ? 'NPPES identity evidence is mock and excluded from decision-grade trust'
        : !nppesArtifact
        ? 'NPPES identity source not yet checked'
        : nppesIdentityNotFound
          ? 'NPPES checked but did not return an active identity record'
        : !nppesFresh
          ? 'NPPES identity evidence is stale and must be refreshed'
          : 'NPPES identity checked',
    // A stored artifact whose status is not ACTIVE/VERIFIED is the registry
    // declining to affirm this NPI, not evidence for it.
    notFound: nppesIdentityNotFound,
    mock: nppesMock,
  });
  const exclusionCoverage = artifactCoverage('OIG_LEIE', oigArtifact, {
    fresh: oigFresh,
    humanRequired: exclusionStatus === 'POSSIBLE_MATCH',
    reason:
      oigMock
        ? 'OIG LEIE evidence is mock and excluded from decision-grade trust'
        : !oigArtifact
        ? 'OIG LEIE source not yet checked'
        : exclusionStatus === 'POSSIBLE_MATCH'
          ? 'OIG LEIE returned a possible match and requires human adjudication'
          : !oigFresh
            ? 'OIG LEIE evidence is stale and must be re-run'
            : exclusionStatus === 'EXCLUDED'
              ? 'OIG LEIE exclusion confirmed'
              : 'OIG LEIE check clear',
    mock: oigMock,
  });
  const licensureCoverage: TrustSourceCoverage = {
    sourceId: licensureSourceId,
    state: resolveSourceCoverageState({
      sourceId: licensureSourceId,
      checked:
        Boolean(licenseArtifact)
        || authoritySignals.licensureVerified
        || authoritySignals.expiredLicense
        || authoritySignals.disciplinedLicense
        || authoritySignals.boardOrderBlocks
        || authoritySignals.boardOrderRequiresReview,
      fresh: licenseArtifact ? licenseFresh : true,
      unavailable: unresolvedAuthorityLicensure && !licensureGated,
      gated: licensureGated,
      humanRequired: authoritySignals.boardOrderRequiresReview,
      mock: licenseMock,
    }),
    reason:
      licenseMock
        ? 'Licensure evidence is mock and excluded from decision-grade trust'
        : authoritySignals.disciplinedLicense
        ? 'Licensure source returned a disciplinary action'
        : authoritySignals.boardOrderBlocks
          ? 'Licensure source returned a board order that blocks readiness'
          : authoritySignals.boardOrderRequiresReview
            ? 'Licensure source returned a board order that requires review'
            : unresolvedAuthorityLicensure
              ? 'Licensure source is unavailable or gated and requires a manual path'
              : !licenseArtifact && !authoritySignals.licensureVerified
                ? 'Licensure source not yet checked'
                : licenseArtifact && !licenseFresh
                  ? 'Licensure evidence is stale and must be refreshed'
                  : 'Licensure checked',
    checkedAt:
      licenseArtifact?.verifiedAt?.toISOString()
      ?? licensureAuthorityCredential?.verifiedAt?.toISOString()
      ?? licensureAuthorityCredential?.observedAt?.toISOString()
      ?? null,
    artifactId: licenseArtifact?.id ?? null,
    sourceUrl: licenseArtifact?.sourceUrl ?? null,
    rawArtifactRef: licenseArtifact?.id ?? null,
    checksum: licenseArtifact?.checksum ?? null,
  };
  const enrollmentCoverage = artifactCoverage('PECOS_PUBLIC', pecosArtifact, {
    fresh: pecosFresh,
    reason:
      pecosMock
        ? 'PECOS evidence is mock and excluded from decision-grade trust'
        : pecosCoverageReason({
          status: pecosStatus,
          checked: pecosSnapshot.checked,
          fresh: pecosFresh,
          daysRemaining: pecosDaysRemaining,
        }),
    // NOT_FOUND means the quarterly release carries no enrollment row for this
    // NPI. That is an answer, not a confirmation — it must not render as
    // source-backed alongside a genuinely ENROLLED provider.
    notFound: pecosStatus === 'NOT_FOUND',
    mock: pecosMock,
  });

  const identityAssessment = {
    dimension: 'identity' as const,
    status: identityVerified ? 'MET' as const : 'UNMET' as const,
    confidence: identityVerified ? 0.99 : confidenceScoreForLabel('UNCERTAIN'),
    blocker: identityVerified ? null : 'Identity not verified',
    gap:
      identityVerified
        ? null
        : !nppesArtifact
          ? 'NPPES identity artifact missing'
          : 'NPPES identity verification stale',
    sourceCoverage: [identityCoverage],
  };
  const exclusionAssessment = {
    dimension: 'exclusion' as const,
    status:
      exclusionStatus === 'EXCLUDED'
        ? 'BLOCKED' as const
        : !oigArtifact
          ? 'UNMET' as const
          : reviewRequiredForExclusionStatus(exclusionStatus)
            ? 'REVIEW_REQUIRED' as const
            : 'MET' as const,
    confidence:
      exclusionStatus === 'CLEAR' || exclusionStatus === 'EXCLUDED'
        ? confidenceScoreForLabel('HIGH')
        : exclusionStatus === 'POSSIBLE_MATCH'
          ? confidenceScoreForLabel('MEDIUM')
          : confidenceScoreForLabel('UNCERTAIN'),
    blocker:
      exclusionStatus === 'EXCLUDED'
        ? 'OIG/LEIE exclusion confirmed'
        : exclusionStatus === 'POSSIBLE_MATCH'
          ? 'OIG/LEIE possible match requires review'
          : exclusionStatus === 'UNCHECKED' && oigArtifact
            ? 'OIG/LEIE check could not be confirmed'
            : null,
    gap:
      !oigArtifact
        ? 'OIG exclusion artifact missing'
        : !oigFresh
          ? 'OIG exclusion check stale'
          : null,
    sourceCoverage: [exclusionCoverage],
  };
  const licensureAssessment = {
    dimension: 'licensure' as const,
    status:
      authoritySignals.disciplinedLicense || authoritySignals.boardOrderBlocks || licensureStatus === 'expired'
        ? 'BLOCKED' as const
        : authoritySignals.boardOrderRequiresReview || unresolvedAuthorityLicensure
          ? 'REVIEW_REQUIRED' as const
          : licensureStatus === 'verified'
            ? 'MET' as const
            : 'UNMET' as const,
    confidence:
      licensureStatus === 'verified' || authoritySignals.disciplinedLicense || licensureStatus === 'expired'
        ? confidenceScoreForLabel('HIGH')
        : authoritySignals.boardOrderRequiresReview || unresolvedAuthorityLicensure
          ? confidenceScoreForLabel('MEDIUM')
          : confidenceScoreForLabel('LOW'),
    blocker:
      authoritySignals.disciplinedLicense
        ? 'License discipline requires resolution'
        : authoritySignals.boardOrderBlocks
          ? 'Board order severity blocks readiness'
          : licensureStatus === 'expired'
            ? 'State license expired'
            : authoritySignals.boardOrderRequiresReview
              ? 'Board order requires manual review'
              : unresolvedAuthorityLicensure
                ? 'Authority source unavailable for licensure'
                : null,
    gap:
      licensureStatus === 'verified'
        ? null
        : licensureStatus === 'expired'
          ? 'State license expired'
          : !licenseArtifact && !authoritySignals.licensureVerified && !authoritySignals.authorityUnavailableLicensure
            ? 'State license artifact missing'
          : licenseArtifact && !licenseFresh
            ? 'State license verification stale'
            : null,
    sourceCoverage: [licensureCoverage],
  };
  const enrollmentAssessment = buildEnrollmentAssessment({
    pecosStatus,
    checked: pecosSnapshot.checked,
    fresh: pecosFresh,
    daysRemaining: pecosDaysRemaining,
    coverage: enrollmentCoverage,
  });

  const readinessBase = computeDeterministicTrustReadiness({
    identity: identityAssessment,
    exclusion: exclusionAssessment,
    licensure: licensureAssessment,
    enrollment: enrollmentAssessment,
  });
  const divergenceReport = await safeDetectDivergence(npi);
  const divergenceBlocking = divergenceReport?.hasBlocking ?? false;
  const divergenceGaps = divergenceReport
    ? divergenceReport.conflicts
      .filter((conflict) => conflict.active)
      .map((conflict) => `Divergence: ${conflict.description}`)
    : [];

  const reviewRequired =
    exclusionAssessment.status === 'REVIEW_REQUIRED'
    || licensureAssessment.status === 'REVIEW_REQUIRED';

  const cappedTrustScore = capTrustScore({
    baseScore: readinessBase.readinessScore,
    licensureBlocked:
      authoritySignals.disciplinedLicense
      || authoritySignals.boardOrderBlocks
      || licensureStatus === 'expired',
    reviewRequired: reviewRequired || divergenceBlocking,
    divergenceBlocking,
    unresolvedAuthorityLicensure,
    pecosStatus,
  });

  const blockers = Array.from(new Set([
    ...readinessBase.blockers,
    ...authoritySignals.blockers,
    ...(divergenceBlocking ? ['Cross-source divergence requires resolution'] : []),
  ]));
  const gaps = Array.from(new Set([
    ...readinessBase.gaps,
    ...authoritySignals.gaps,
    ...divergenceGaps,
  ]));
  const readiness = {
    ...readinessBase,
    readinessScore: Math.max(0, cappedTrustScore - (divergenceReport?.totalPenalty ?? 0)),
    readiness_score: Math.max(0, cappedTrustScore - (divergenceReport?.totalPenalty ?? 0)),
    blockers,
    gaps,
  };

  const trustBand = deriveTrustBandFromReadiness({
    readiness,
    identityMet: identityAssessment.status === 'MET',
    reviewRequired: reviewRequired || divergenceBlocking,
  });

  const readinessStatus = buildReadinessStatusHeadline({
    trustBand,
    blockers,
    reviewRequired: reviewRequired || divergenceBlocking,
    divergenceBlocking,
    unresolvedAuthorityLicensure,
    pecosStatus,
  });

  const state: ClinicianTrustState = {
    npi,
    identityVerified,
    licensureStatus,
    exclusionClear,
    exclusionStatus,
    pecosStatus,
    credentialCount,
    reviewRequired: reviewRequired || divergenceBlocking,
    blockers: readiness.blockers,
    nextActions: readiness.nextActions,
    confidenceWeighting: readiness.confidenceWeighting,
    sourceCoverage: readiness.sourceCoverage,
    readiness_level: trustBand,
    readiness_status: readinessStatus,
    readiness_score: readiness.readinessScore,
    gap_summary: readiness.gaps,
    methodology_version: METHODOLOGY_VERSION,
    computed_at: computedAt,
    trustBand,
    trustScore: readiness.readinessScore,
    divergence: divergenceReport ? buildTrustStateDivergenceSummary(divergenceReport) : undefined,
    facts,
    gaps: readiness.gaps,
    computedAt,
  };

  log('info', 'trust_state_computed_from_ingested_artifacts', {
    npi,
    trustBand,
    trustScore: readiness.readinessScore,
    identityVerified,
    licensureStatus,
    exclusionClear,
    exclusionStatus,
    pecosStatus,
    credentialCount,
    factCount: facts.length,
    gapCount: gaps.length,
    reviewRequired: reviewRequired || divergenceBlocking,
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
  const now = new Date();
  const facts: CanonicalFactSummary[] = [];

  // 1. NPPES identity
  const nppes = await fetchNppes(npi);
  const identityVerified = nppes.found && nppes.status === 'A';

  if (nppes.found || nppes.checked || nppes.unavailable) {
    facts.push({
      factType: 'IdentityClaim',
      source: 'NPPES_API',
      status:
        nppes.unavailable
          ? 'UNAVAILABLE'
          : nppes.status === 'A'
            ? 'ACTIVE'
            : nppes.checked
              ? 'NOT_FOUND_OR_INACTIVE'
              : nppes.status,
      verifiedAt: computedAt,
      details:
        nppes.unavailable
          ? `NPPES lookup unavailable for NPI ${npi}`
          : [nppes.firstName, nppes.lastName].filter(Boolean).join(' ') || `NPI ${npi}`,
    });
  }

  // 2. VerificationArtifacts from DB
  let artifacts: IngestedArtifactRecord[] = [];
  try {
    artifacts = await prisma.verificationArtifact.findMany({
      where: { npi, source: { not: 'TRUST_STATE_ENGINE' } },
      select: {
        id: true,
        source: true,
        status: true,
        checksum: true,
        sourceUrl: true,
        parserVersion: true,
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

  for (const artifact of artifacts) {
    const src = artifact.source.toUpperCase();
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
      // No verifiedAt. This fact is minted from a self-attested
      // CandidateCredential (status UNVERIFIED / PENDING_VERIFICATION) that has
      // never been checked against a source. `cred.createdAt` is when the row
      // was written, not when anything was verified — stamping it into
      // `verifiedAt` presented an upload time as an observation/verification
      // time (the wallet renders this field as "Observed {date}"). Leave it
      // undefined until a real verification event exists.
    });
  }

  const licenseArtifact = artifacts.find((artifact) => {
    const src = artifact.source.toUpperCase();
    return src.includes('NURSYS')
      || src.includes('STATE')
      || src.includes('LICENSE')
      || src.includes('MEDICAL_BOARD')
      || src.includes('FSMB');
  });
  const pecosArtifact = artifacts.find((artifact) => artifact.source.toUpperCase().includes('PECOS'));
  const pecosSnapshot = extractPecosArtifactSnapshot(pecosArtifact);
  const licenseFresh = isSourceArtifactFresh(licenseArtifact, now);
  const pecosFresh = isPecosFresh({
    status: pecosSnapshot.status,
    revalidationDue: pecosSnapshot.revalidationDue,
    observedAt: pecosSnapshot.observedAt,
  }, now);
  const pecosDaysRemaining = pecosRevalidationDaysRemaining(
    pecosSnapshot.revalidationDue,
    now,
  );
  const licenseMock = artifactLooksMock(licenseArtifact);
  const pecosMock = artifactLooksMock(pecosArtifact);

  let licensureStatus: LicensureStatus = 'unknown';
  if (licenseArtifact) {
    const normalizedStatus = licenseArtifact.status.toUpperCase();
    const expiredByStatus =
      normalizedStatus === 'EXPIRED'
      || normalizedStatus === 'REVOKED'
      || normalizedStatus === 'SUSPENDED';
    const expiredByDate =
      Boolean(licenseArtifact.expiresAt)
      && licenseArtifact.expiresAt!.getTime() <= now.getTime();

    if (expiredByStatus || expiredByDate) {
      licensureStatus = 'expired';
    } else if (
      (normalizedStatus === 'ACTIVE' || normalizedStatus === 'VERIFIED')
      && licenseFresh
    ) {
      licensureStatus = 'verified';
    }
  }

  const pecosStatus: PecosStatus = resolvePecosCurrentStatus({
    checked: pecosSnapshot.checked,
    status: pecosSnapshot.status,
    fresh: pecosFresh,
  });
  const credentialCount = candidateCredentials.length + artifacts.filter((artifact) => {
    const normalizedStatus = artifact.status.toUpperCase();
    const unexpired = !artifact.expiresAt || artifact.expiresAt.getTime() > now.getTime();
    return (normalizedStatus === 'ACTIVE' || normalizedStatus === 'VERIFIED' || normalizedStatus === 'CLEAR') && unexpired;
  }).length;

  // 4. OIG/LEIE exclusion check
  let exclusionChecked = false;
  let exclusionStatus: ExclusionStatus = 'UNCHECKED';
  let exclusionDetails: string | undefined;
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
      exclusionChecked = true;
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
      exclusionDetails = exclusionResult.details;

      facts.push({
        factType: 'Sanction',
        source: 'OIG_LEIE',
        status: exclusionStatus,
        verifiedAt: exclusionResult.checkedAt,
        details: exclusionResult.details,
      });
    } catch (err) {
      log('warn', 'trust_state_engine_oig_error', { npi, error: String(err) });
      exclusionStatus = 'UNCHECKED';
      exclusionDetails = 'OIG check unavailable — manual verification required.';
      facts.push({
        factType: 'Sanction',
        source: 'OIG_LEIE',
        status: 'CHECK_FAILED',
        verifiedAt: computedAt,
        details: exclusionDetails,
      });
    }
  }
  const exclusionClear = exclusionStatus === 'CLEAR';

  const identityCoverage: TrustSourceCoverage = {
    sourceId: 'NPPES_API',
    state: resolveSourceCoverageState({
      sourceId: 'NPPES_API',
      checked: nppes.checked,
      fresh: nppes.checked,
      unavailable: nppes.unavailable,
      // Running the query is not the same claim as the registry affirming this
      // provider. Without this, an NPI the registry does not list still landed
      // on 'checked' and rendered "Source-backed" to employers — the reason
      // line below already said otherwise.
      notFound: nppes.checked && !nppes.unavailable && !identityVerified,
    }),
    reason:
      nppes.unavailable
        ? 'NPPES lookup unavailable'
        : identityVerified
          ? 'NPPES identity checked'
          : nppes.checked
            ? 'NPPES checked but did not return an active identity record'
            : 'NPPES identity source not yet checked',
    checkedAt: nppes.checked || nppes.unavailable ? computedAt : null,
    artifactId: null,
    sourceUrl: nppes.sourceUrl,
    rawArtifactRef: null,
    checksum: null,
  };
  const exclusionCoverage: TrustSourceCoverage = {
    sourceId: 'OIG_LEIE',
    state: resolveSourceCoverageState({
      sourceId: 'OIG_LEIE',
      checked: exclusionChecked && exclusionStatus !== 'UNCHECKED',
      fresh: exclusionChecked,
      unavailable: exclusionStatus === 'UNCHECKED' && exclusionSourceUnavailable(exclusionDetails),
      humanRequired: exclusionStatus === 'POSSIBLE_MATCH',
    }),
    reason:
      !nppes.found
        ? 'OIG LEIE check is gated on an active NPPES identity match'
        : exclusionStatus === 'POSSIBLE_MATCH'
          ? 'OIG LEIE returned a possible match and requires human adjudication'
          : exclusionStatus === 'EXCLUDED'
            ? 'OIG LEIE exclusion confirmed'
          : exclusionStatus === 'CLEAR'
              ? 'OIG LEIE check clear'
              : exclusionDetails ?? 'OIG LEIE check unresolved',
    checkedAt:
      exclusionChecked || (nppes.found && Boolean(exclusionDetails))
        ? computedAt
        : null,
    artifactId: null,
    sourceUrl: 'https://oig.hhs.gov/exclusions/exclusions_list.asp',
    rawArtifactRef: null,
    checksum: null,
  };
  /**
   * Can a state board actually be reached? Derived from the source catalog,
   * never from whether a licence artifact happens to exist.
   *
   * STATE_BOARD ships `liveAvailable: false` behind `STATE_BOARD_ENABLED`
   * (unset in production, alongside FSMB_API_KEY), and FSMB DocInfo is a paid
   * aggregator the cost policy rules out — so nothing queries a board. The
   * artifact that made this lane look checked is a placeholder a gated fetch
   * stores, with `sourceUrl: 'GATED_NURSYS_CONFIG_REQUIRED'`.
   *
   * `resolveSourceCoverageState` already self-gates a lane whose governance
   * marks it inaccessible — but only `&& !checked`, and the placeholder
   * satisfies `checked`. STATE_BOARD's governance also records
   * `accessBoundary: 'public'`, which describes the PORTAL (a member of the
   * public may look a licence up by hand) and not VitalCV's automated access.
   * Both routes to the honest state were therefore closed. This states it
   * outright.
   */
  const stateBoardSource = getSource('STATE_BOARD');
  const stateBoardReachable = Boolean(
    stateBoardSource
      && (stateBoardSource.liveAvailable || isSourceFlagEnabled(stateBoardSource)),
  );
  const licensureCoverage = artifactCoverage('STATE_BOARD', licenseArtifact, {
    fresh: licenseFresh,
    gated: !stateBoardReachable,
    reason: !stateBoardReachable
      ? 'State board verification requires access VitalCV does not have yet. Any licence number shown is self-reported to NPPES by the provider and has not been confirmed with a board.'
      : licenseMock
        ? 'Licensure evidence is mock and excluded from decision-grade trust'
        : !licenseArtifact
        ? 'Licensure source not yet checked'
        : licensureStatus === 'expired'
          ? 'Licensure source reports an expired or inactive credential'
          : !licenseFresh
            ? 'Licensure evidence is stale and must be refreshed'
            : 'Licensure checked',
    mock: licenseMock,
  });
  const enrollmentCoverage = artifactCoverage('PECOS_PUBLIC', pecosArtifact, {
    fresh: pecosFresh,
    reason:
      pecosMock
        ? 'PECOS evidence is mock and excluded from decision-grade trust'
        : pecosCoverageReason({
          status: pecosStatus,
          checked: pecosSnapshot.checked,
          fresh: pecosFresh,
          daysRemaining: pecosDaysRemaining,
        }),
    // NOT_FOUND means the quarterly release carries no enrollment row for this
    // NPI. That is an answer, not a confirmation — it must not render as
    // source-backed alongside a genuinely ENROLLED provider.
    notFound: pecosStatus === 'NOT_FOUND',
    mock: pecosMock,
  });

  const identityAssessment = {
    dimension: 'identity' as const,
    status: identityVerified ? 'MET' as const : 'UNMET' as const,
    confidence: identityVerified ? 0.99 : confidenceScoreForLabel('UNCERTAIN'),
    blocker: identityVerified ? null : 'Identity not verified',
    gap:
      identityVerified
        ? null
        : nppes.unavailable
          ? 'NPPES identity lookup unavailable'
          : nppes.checked
            ? 'NPPES identity not found or inactive'
            : 'NPPES identity artifact missing',
    sourceCoverage: [identityCoverage],
  };
  const exclusionAssessment = {
    dimension: 'exclusion' as const,
    status:
      !nppes.found || !nppes.firstName || !nppes.lastName
        ? 'UNMET' as const
        : exclusionStatus === 'EXCLUDED'
        ? 'BLOCKED' as const
        : exclusionStatus === 'CLEAR'
          ? 'MET' as const
          : exclusionStatus === 'POSSIBLE_MATCH' || exclusionStatus === 'UNCHECKED'
            ? 'REVIEW_REQUIRED' as const
            : 'UNMET' as const,
    confidence:
      !nppes.found || !nppes.firstName || !nppes.lastName
        ? confidenceScoreForLabel('UNCERTAIN')
        : exclusionStatus === 'CLEAR' || exclusionStatus === 'EXCLUDED'
        ? confidenceScoreForLabel('HIGH')
        : exclusionStatus === 'POSSIBLE_MATCH'
          ? confidenceScoreForLabel('MEDIUM')
          : confidenceScoreForLabel('UNCERTAIN'),
    blocker:
      !nppes.found || !nppes.firstName || !nppes.lastName
        ? null
        : exclusionStatus === 'EXCLUDED'
        ? 'OIG/LEIE exclusion confirmed'
        : exclusionStatus === 'POSSIBLE_MATCH'
          ? 'OIG/LEIE possible match requires review'
          : exclusionStatus === 'UNCHECKED'
            ? 'OIG/LEIE check could not be confirmed'
            : null,
    gap:
      exclusionStatus === 'CLEAR' || exclusionStatus === 'EXCLUDED'
        ? null
        : !nppes.found
          ? 'OIG exclusion check pending identity verification'
          : 'OIG/LEIE exclusion check unchecked',
    sourceCoverage: [exclusionCoverage],
  };
  const licensureAssessment = {
    dimension: 'licensure' as const,
    status:
      licensureStatus === 'expired'
        ? 'BLOCKED' as const
        : licensureStatus === 'verified'
          ? 'MET' as const
          : 'UNMET' as const,
    confidence:
      licensureStatus === 'verified' || licensureStatus === 'expired'
        ? confidenceScoreForLabel('HIGH')
        : confidenceScoreForLabel('LOW'),
    blocker:
      licensureStatus === 'expired'
        ? 'State license expired'
        : null,
    gap:
      licensureStatus === 'verified'
        ? null
        : !licenseArtifact
          ? 'State license artifact missing'
          : !licenseFresh
            ? 'State license verification stale'
            : 'State licensure not verified',
    sourceCoverage: [licensureCoverage],
  };
  const enrollmentAssessment = buildEnrollmentAssessment({
    pecosStatus,
    checked: pecosSnapshot.checked,
    fresh: pecosFresh,
    daysRemaining: pecosDaysRemaining,
    coverage: enrollmentCoverage,
  });

  const readinessBase = computeDeterministicTrustReadiness({
    identity: identityAssessment,
    exclusion: exclusionAssessment,
    licensure: licensureAssessment,
    enrollment: enrollmentAssessment,
  });
  const divergenceReport = await safeDetectDivergence(npi);
  const divergenceBlocking = divergenceReport?.hasBlocking ?? false;
  const divergenceGaps = divergenceReport
    ? divergenceReport.conflicts
      .filter((conflict) => conflict.active)
      .map((conflict) => `Divergence: ${conflict.description}`)
    : [];
  const reviewRequired = exclusionAssessment.status === 'REVIEW_REQUIRED';
  const trustScore = capTrustScore({
    baseScore: readinessBase.readinessScore,
    licensureBlocked: licensureStatus === 'expired',
    reviewRequired: reviewRequired || divergenceBlocking,
    divergenceBlocking,
    pecosStatus,
  });
  const readiness = {
    ...readinessBase,
    readinessScore: Math.max(0, trustScore - (divergenceReport?.totalPenalty ?? 0)),
    readiness_score: Math.max(0, trustScore - (divergenceReport?.totalPenalty ?? 0)),
    gaps: Array.from(new Set([...readinessBase.gaps, ...divergenceGaps])),
  };
  const trustBand = deriveTrustBandFromReadiness({
    readiness,
    identityMet: identityAssessment.status === 'MET',
    reviewRequired: reviewRequired || divergenceBlocking,
  });

  const readiness_status = buildReadinessStatusHeadline({
    trustBand,
    blockers: divergenceBlocking
      ? [...readiness.blockers, 'Cross-source divergence requires resolution']
      : readiness.blockers,
    reviewRequired: reviewRequired || divergenceBlocking,
    divergenceBlocking,
    pecosStatus,
  });

  const state: ClinicianTrustState = {
    npi,
    identityVerified,
    licensureStatus,
    exclusionClear,
    exclusionStatus,
    pecosStatus,
    credentialCount,
    reviewRequired: reviewRequired || divergenceBlocking,
    blockers: divergenceBlocking
      ? [...readiness.blockers, 'Cross-source divergence requires resolution']
      : readiness.blockers,
    nextActions: readiness.nextActions,
    confidenceWeighting: readiness.confidenceWeighting,
    sourceCoverage: readiness.sourceCoverage,
    readiness_level: trustBand,
    readiness_status,
    readiness_score: readiness.readinessScore,
    gap_summary: readiness.gaps,
    methodology_version: METHODOLOGY_VERSION,
    computed_at: computedAt,
    trustBand,
    trustScore: readiness.readinessScore,
    divergence: divergenceReport ? buildTrustStateDivergenceSummary(divergenceReport) : undefined,
    facts,
    gaps: readiness.gaps,
    computedAt,
  };

  log('info', 'trust_state_computed', {
    npi,
    trustBand,
    trustScore: readiness.readinessScore,
    identityVerified,
    licensureStatus,
    exclusionClear,
    exclusionStatus,
    pecosStatus,
    credentialCount,
    factCount: facts.length,
    gapCount: readiness.gaps.length,
    reviewRequired: reviewRequired || divergenceBlocking,
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

  // Update LRU cache immediately — decouple from DB write so a transient DB failure
  // does not discard a freshly computed trust state. Passport will hit LRU on next call.
  const cachedState = setTrustStateMemoryCache(npi, state);

  // Persist as a VerificationArtifact with source='TRUST_STATE_ENGINE'
  // Non-fatal: if DB write fails, LRU is already primed for the next 60s.
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
    // Do not re-throw: LRU is updated above, passport can still serve fresh state for 60s.
  }

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
