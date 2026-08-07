/** @deprecated Use identityIngestionPipeline.handlers.SAM_GOV for production ingestion. */
import type { CanonicalSourceCoverageState } from '@vitalcv/trust-state';
import { sha256ForPayload } from '../utils/deterministic';

/**
 * samGovAdapter.ts — SAM.gov Exclusions integration layer
 *
 * SAM.gov is the GSA-operated, government-wide exclusion and debarment
 * registry. It is broader than OIG LEIE: it covers debarment, suspension,
 * and proposed debarment across ALL federal programs, not just HHS.
 *
 * Authorization model:
 *   - Public Exclusions API (api.sam.gov) — requires a free api.data.gov
 *     key supplied via SAM_GOV_API_KEY; the free tier is quota-limited
 *     (~10 requests/day), so production volume needs a higher tier
 *   - SAM_GOV_ENABLED=true only when a key is configured and the quota
 *     tier fits the expected check volume
 *
 * Matching model:
 *   SAM.gov has NO NPI field — search is name-based only. Every positive
 *   hit is therefore a NAME_MATCH that requires identity review before any
 *   action is taken. A name-only hit must never auto-block a clinician.
 */

// ── Endpoint constants ───────────────────────────────────────────────────────

/**
 * Exclusions API base for the live fetcher (Exclusions API v4 per source
 * governance). NOTE: the phase-2 ingestion lane (identity/phase2Sources.ts)
 * currently calls the v3 endpoint; both remain served by api.sam.gov.
 */
export const SAM_GOV_EXCLUSIONS_API_BASE =
  'https://api.sam.gov/entity-information/v4/exclusions';

/** Human-facing source URL used for provenance on stub results. */
export const SAM_GOV_SOURCE_URL = 'https://sam.gov/';

// ── Gating (env-driven, read at call time like buildNursysContractSnapshot) ──

export function isSamGovEnabled(): boolean {
  return process.env.SAM_GOV_ENABLED === 'true';
}

export function isSamGovApiKeyConfigured(): boolean {
  return Boolean(process.env.SAM_GOV_API_KEY?.trim());
}

// ── Result types ─────────────────────────────────────────────────────────────

export type SamGovExclusionCheckStatus =
  | 'EXCLUSION_RECORDS_FOUND'
  | 'NO_EXCLUSION_RECORDS_FOUND'
  | 'EXCLUSION_CHECK_NOT_AVAILABLE'; // lane gated, key missing, or API unreachable

/** SAM.gov cannot match on NPI — a positive result is always a name match. */
export type SamGovMatchType = 'NAME_MATCH' | 'NO_MATCH' | 'NOT_ATTEMPTED';

export type SamGovConnectorState = 'configured' | 'unavailable';

/**
 * Coverage states this lane may legally emit, pinned to the canonical
 * trust-state taxonomy so a rename there breaks this build.
 *   gated          — SAM_GOV_ENABLED is false (lane switched off)
 *   accessRequired — enabled but SAM_GOV_API_KEY is not configured
 *   pending        — enabled + key present, live fetcher not wired/run yet
 *   unavailable    — a live check was attempted but did not complete
 *   checked        — a live check completed (only a real fetcher may produce this)
 *   reviewRequired — live check found records; name match needs identity review
 */
export type SamGovCoverageState = Extract<
  CanonicalSourceCoverageState,
  'gated' | 'accessRequired' | 'pending' | 'unavailable' | 'checked' | 'reviewRequired'
>;

export interface SamGovExclusionRecord {
  readonly classificationType:  string | null; // e.g. 'Individual', 'Firm'
  readonly exclusionType:       string | null; // e.g. 'Ineligible (Proceedings Completed)'
  readonly exclusionProgram:    string | null; // e.g. 'Reciprocal', 'Nonprocurement'
  readonly excludingAgencyCode: string | null; // e.g. 'HHS', 'TREAS-OFAC'
  readonly activeDate:          string | null;
  readonly terminationDate:     string | null; // null = indefinite
}

export interface SamGovExclusionQuery {
  /** Carried for subject linkage/provenance only — SAM.gov cannot search by NPI. */
  readonly npi:        string;
  readonly firstName?: string;
  readonly lastName?:  string;
}

export interface SamGovExclusionResult {
  readonly checkStatus:       SamGovExclusionCheckStatus;
  readonly matchType:         SamGovMatchType;
  readonly totalRecords:      number;
  readonly records:           readonly SamGovExclusionRecord[];
  readonly searchedNpi:       string;
  readonly searchedName:      string | null;
  readonly sourceScope:       'SAM_GOV_EXCLUSIONS_API';
  readonly sourceUrl:         string;
  readonly sourceQueriedAt:   string;
  readonly connectorState:    SamGovConnectorState;
  readonly coverageState:     SamGovCoverageState;
  readonly reviewRequired:    boolean;
  /** If checkStatus === 'EXCLUSION_CHECK_NOT_AVAILABLE', explains why */
  readonly unavailableReason?: string;
}

export type SamGovFetcher = (query: SamGovExclusionQuery) => Promise<SamGovExclusionResult>;

// ── Connector snapshot ───────────────────────────────────────────────────────

export interface SamGovConnectorSnapshot {
  readonly source:           'SAM_GOV';
  readonly enabled:          boolean;
  readonly apiKeyConfigured: boolean;
  readonly state:            SamGovConnectorState;
  /** Stub-side coverage — a live fetcher result supersedes this. */
  readonly coverageState:    Extract<SamGovCoverageState, 'gated' | 'accessRequired' | 'pending'>;
}

export function buildSamGovConnectorSnapshot(): SamGovConnectorSnapshot {
  const enabled = isSamGovEnabled();
  const apiKeyConfigured = isSamGovApiKeyConfigured();

  return {
    source: 'SAM_GOV',
    enabled,
    apiKeyConfigured,
    state: enabled && apiKeyConfigured ? 'configured' : 'unavailable',
    coverageState: !enabled ? 'gated' : !apiKeyConfigured ? 'accessRequired' : 'pending',
  };
}

// ── Stub (returns unavailable — do not fabricate an exclusion outcome) ──────

function searchedNameOf(query: SamGovExclusionQuery): string | null {
  const name = [query.firstName, query.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return name.length > 0 ? name : null;
}

/**
 * Stub implementation: returns EXCLUSION_CHECK_NOT_AVAILABLE — never
 * fabricates a clear or excluded outcome.
 *
 * IMPORTANT: Do not replace this with fake-but-realistic data. A fabricated
 * "no exclusion records" result would be materially misleading — an exclusion
 * check that did not run must never read as clear.
 */
function unavailableStub(query: SamGovExclusionQuery): SamGovExclusionResult {
  const snapshot = buildSamGovConnectorSnapshot();

  const unavailableReason = !snapshot.enabled
    ? 'SAM.gov exclusions lane is disabled. Set SAM_GOV_ENABLED=true with a configured SAM_GOV_API_KEY to allow live checks.'
    : !snapshot.apiKeyConfigured
      ? 'SAM.gov API key not configured. Set SAM_GOV_API_KEY (free api.data.gov key; free tier is quota-limited).'
      : 'SAM.gov live fetcher not wired. The exclusion check was not performed.';

  return {
    checkStatus:      'EXCLUSION_CHECK_NOT_AVAILABLE',
    matchType:        'NOT_ATTEMPTED',
    totalRecords:     0,
    records:          [],
    searchedNpi:      query.npi,
    searchedName:     searchedNameOf(query),
    sourceScope:      'SAM_GOV_EXCLUSIONS_API',
    sourceUrl:        SAM_GOV_SOURCE_URL,
    sourceQueriedAt:  new Date().toISOString(),
    connectorState:   snapshot.state,
    coverageState:    snapshot.coverageState,
    reviewRequired:   false,
    unavailableReason,
  };
}

// ── Fail-closed normalization ────────────────────────────────────────────────

/**
 * Enforce fail-closed invariants on a live fetcher result:
 *   1. Any exclusion records found → reviewRequired=true and
 *      coverageState='reviewRequired' (name matches must never auto-clear
 *      nor silently pass).
 *   2. A check that did not complete may never present as 'checked' or
 *      'reviewRequired' — it is downgraded to 'unavailable'.
 *   3. A no-records result must not carry a NAME_MATCH.
 */
export function normalizeSamGovResult(result: SamGovExclusionResult): SamGovExclusionResult {
  const recordsFound =
    result.checkStatus === 'EXCLUSION_RECORDS_FOUND'
    || result.totalRecords > 0
    || result.records.length > 0;

  if (recordsFound) {
    return {
      ...result,
      checkStatus:    'EXCLUSION_RECORDS_FOUND',
      matchType:      'NAME_MATCH',
      totalRecords:   Math.max(result.totalRecords, result.records.length),
      coverageState:  'reviewRequired',
      reviewRequired: true,
    };
  }

  if (result.checkStatus === 'EXCLUSION_CHECK_NOT_AVAILABLE') {
    const coverageState =
      result.coverageState === 'checked' || result.coverageState === 'reviewRequired'
        ? 'unavailable'
        : result.coverageState;
    return { ...result, matchType: 'NOT_ATTEMPTED', coverageState };
  }

  return { ...result, matchType: 'NO_MATCH' };
}

/**
 * Query SAM.gov exclusions for a clinician.
 *
 * When SAM_GOV_ENABLED=false (default): returns the unavailable stub.
 * When enabled + SAM_GOV_API_KEY configured + fetcher provided: uses the
 * fetcher (real Exclusions API client) and enforces fail-closed invariants.
 * A fetcher without the flag and key never runs — the lane stays honest
 * about its gated/accessRequired coverage until access is real.
 */
export async function querySamGovExclusions(
  query: SamGovExclusionQuery,
  fetcher?: SamGovFetcher,
): Promise<SamGovExclusionResult> {
  if (isSamGovEnabled() && isSamGovApiKeyConfigured() && fetcher) {
    return normalizeSamGovResult(await fetcher(query));
  }
  // No live access — return honest unavailable state
  return unavailableStub(query);
}

/**
 * Compute a SHA-256 checksum for a serialized payload.
 * Uses deterministic JSON key ordering for reproducibility.
 */
export function computeSamGovArtifactChecksum(payload: unknown): string {
  return sha256ForPayload(payload);
}
