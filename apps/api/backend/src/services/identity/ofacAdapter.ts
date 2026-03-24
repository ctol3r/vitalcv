/**
 * ofacAdapter.ts — OFAC SDN Compliance Layer
 *
 * Integrates the US Treasury OFAC Specially Designated Nationals (SDN) list
 * as a compliance overlay in the canonical trust model.
 *
 * CRITICAL DESIGN RULES:
 *   1. OFAC matching is name-based — NPI does not appear on SDN lists.
 *   2. No name-only match may become decision-grade automatically.
 *   3. confirmed_match requires name+DOB alignment.
 *   4. potential_match must always be review_required=true.
 *   5. This is NOT a healthcare-specific exclusion (that's OIG LEIE).
 *      OFAC covers financial/national security sanctions programs.
 *
 * Match classes:
 *   no_match         → CLEAR, decision-grade, confidenceScore 1.0
 *   potential_match  → POSSIBLE_MATCH, review_required, NOT decision-grade, confidenceScore ≤0.85
 *   confirmed_match  → SANCTIONED, decision-grade BLOCKER, confidenceScore >0.95
 *
 * Sources:
 *   Consolidated list: https://www.treasury.gov/ofac/downloads/consolidated/consolidated.json
 *   SDN CSV: https://www.treasury.gov/ofac/downloads/sdn.csv
 *   Updated daily.
 */

import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';

import type { OfacSanctionValue } from './evidenceModel';
import {
  buildClaimArtifactTrace,
  buildReceipt,
  computeClaimId,
  type NormalizedClaim,
  type VerificationReceipt,
} from './evidenceModel';
import { getSource, getSourceFreshnessWindowHours } from './sourceCatalog';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

const OFAC_SOURCE_ID = 'OFAC_SDN' as const;
const OFAC_PARSER_VERSION = 'v1.0.0';
const OFAC_CONSOLIDATED_URL =
  'https://www.treasury.gov/ofac/downloads/consolidated/consolidated.json';
const OFAC_SOURCE_DISCLAIMER =
  'OFAC SDN list matching is name-based, not NPI-keyed. Potential matches require human review before any action. False positives are common for common names.';

export type OfacMatchClass = OfacSanctionValue['matchClass'];

/** Minimal representation of an SDN entry used for matching. */
export interface SdnEntry {
  uid: string;
  sdnType: string;
  firstName: string | null;
  lastName: string;
  /** ISO 8601 date string or free-form OFAC date text (e.g., "01 Jan 1975"). */
  dateOfBirth: string | null;
  akas: Array<{ firstName: string | null; lastName: string }>;
  programs: string[];
}

/** Raw shape of the OFAC consolidated JSON individual SDN entry. */
interface RawSdnEntry {
  uid?: string | number;
  sdnType?: string;
  firstName?: string | null;
  lastName?: string;
  dateOfBirthList?: {
    dateOfBirthItem?: Array<{ dateOfBirth?: string }> | { dateOfBirth?: string };
  };
  akaList?: {
    aka?: Array<{ firstName?: string | null; lastName?: string }> | { firstName?: string | null; lastName?: string };
  };
  programList?: {
    program?: string[] | string;
  };
}

interface RawSdnResponse {
  sdnList?: {
    sdnEntry?: RawSdnEntry[] | RawSdnEntry;
  };
}

// ── Subject identity for matching ─────────────────────────────────────────────

export interface OfacSubjectIdentity {
  /** First (given) name — normalized before comparison. */
  firstName: string | null;
  /** Last (family) name — normalized before comparison. */
  lastName: string;
  /** ISO 8601 date (YYYY-MM-DD) or null if unknown. */
  dateOfBirth: string | null;
}

// ── Normalisation helpers ─────────────────────────────────────────────────────

function normalizeName(name: string | null | undefined): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/[^a-zA-Z0-9\s]/g, '')   // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseSdnDob(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // OFAC uses various formats: "01 Jan 1975", "1975-01-01", "circa 1970"
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (isoMatch) return isoMatch[1];
  const longMatch = raw.match(/^(\d{2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (longMatch) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const m = months[longMatch[2].toLowerCase()];
    if (m) return `${longMatch[3]}-${m}-${longMatch[1].padStart(2, '0')}`;
  }
  return null; // "circa" dates and other ambiguous formats cannot be used for DOB matching
}

function toArray<T>(val: T | T[] | undefined | null): T[] {
  if (val === null || val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

// ── SDN list parsing ──────────────────────────────────────────────────────────

export function parseSdnResponse(raw: unknown): SdnEntry[] {
  const response = raw as RawSdnResponse;
  const rawEntries = toArray(response?.sdnList?.sdnEntry);
  const entries: SdnEntry[] = [];

  for (const entry of rawEntries) {
    if (!entry?.lastName) continue;

    const dobs = toArray(entry.dateOfBirthList?.dateOfBirthItem)
      .map(d => parseSdnDob(d.dateOfBirth ?? null))
      .filter((d): d is string => d !== null);

    const akas = toArray(entry.akaList?.aka).map(a => ({
      firstName: a.firstName ?? null,
      lastName: a.lastName ?? '',
    })).filter(a => a.lastName.length > 0);

    const programs = toArray(entry.programList?.program).filter((p): p is string => typeof p === 'string');

    entries.push({
      uid: String(entry.uid ?? randomUUID()),
      sdnType: entry.sdnType ?? 'individual',
      firstName: entry.firstName ?? null,
      lastName: entry.lastName,
      dateOfBirth: dobs[0] ?? null,
      akas,
      programs,
    });
  }

  return entries;
}

// ── Matching engine ───────────────────────────────────────────────────────────

export interface SdnMatchResult {
  matchClass: OfacMatchClass;
  matchedUids: string[];
  matchedFields: Array<'name' | 'dob' | 'address'>;
  matchScore: number;
  sanctionPrograms: string[];
}

/**
 * Score a single SDN entry against a subject identity.
 * Returns a score 0–1:
 *   - 0.0  → no match
 *   - 0.5  → name match only (potential; requires review)
 *   - 0.95 → name + DOB match (confirmed)
 */
function scoreEntryMatch(entry: SdnEntry, subject: OfacSubjectIdentity): number {
  const subjectLast = normalizeName(subject.lastName);
  const subjectFirst = normalizeName(subject.firstName);

  // Build candidate name pairs from primary + aliases
  const candidates: Array<{ first: string | null; last: string }> = [
    { first: entry.firstName, last: entry.lastName },
    ...entry.akas,
  ];

  let bestNameScore = 0;
  for (const candidate of candidates) {
    const candidateLast = normalizeName(candidate.last);
    const candidateFirst = normalizeName(candidate.first);

    if (!candidateLast || !subjectLast) continue;
    if (candidateLast !== subjectLast) continue;

    // Last name matches — score first name
    if (!subjectFirst || !candidateFirst) {
      bestNameScore = Math.max(bestNameScore, 0.4); // last-only → weak
    } else if (subjectFirst === candidateFirst) {
      bestNameScore = Math.max(bestNameScore, 0.5); // full name match
    } else if (subjectFirst.startsWith(candidateFirst[0]) || candidateFirst.startsWith(subjectFirst[0])) {
      bestNameScore = Math.max(bestNameScore, 0.3); // initial match → too weak
    }
  }

  if (bestNameScore < 0.5) return bestNameScore;

  // Full name matched — try DOB
  if (subject.dateOfBirth && entry.dateOfBirth) {
    const subjectDob = parseSdnDob(subject.dateOfBirth) ?? subject.dateOfBirth;
    const entryDob = entry.dateOfBirth;
    if (subjectDob === entryDob) {
      return 0.97; // name + DOB: confirmed
    }
    // DOB mismatch with name match — slightly above potential
    return 0.52;
  }

  // Name match, no DOB comparison possible
  return 0.5;
}

export function matchAgainstSdn(
  subject: OfacSubjectIdentity,
  entries: SdnEntry[],
): SdnMatchResult {
  const CONFIRMED_THRESHOLD = 0.90;
  const POTENTIAL_THRESHOLD = 0.45; // 0.4 (last-only) is too weak — skip it

  const matchedEntries: Array<{ entry: SdnEntry; score: number }> = [];

  for (const entry of entries) {
    // Only match against individuals — not vessels, aircraft, or entities
    if (entry.sdnType.toLowerCase() !== 'individual') continue;
    const score = scoreEntryMatch(entry, subject);
    if (score >= POTENTIAL_THRESHOLD) {
      matchedEntries.push({ entry, score });
    }
  }

  if (matchedEntries.length === 0) {
    return {
      matchClass: 'no_match',
      matchedUids: [],
      matchedFields: [],
      matchScore: 0,
      sanctionPrograms: [],
    };
  }

  // Sort best-first
  matchedEntries.sort((a, b) => b.score - a.score);
  const best = matchedEntries[0];

  const matchedUids = matchedEntries.map(m => m.entry.uid);
  const sanctionPrograms = [...new Set(matchedEntries.flatMap(m => m.entry.programs))];
  const matchedFields: Array<'name' | 'dob' | 'address'> = ['name'];
  if (best.score >= CONFIRMED_THRESHOLD) {
    matchedFields.push('dob');
  }

  return {
    matchClass: best.score >= CONFIRMED_THRESHOLD ? 'confirmed_match' : 'potential_match',
    matchedUids,
    matchedFields,
    matchScore: best.score,
    sanctionPrograms,
  };
}

// ── Claim builder ─────────────────────────────────────────────────────────────

function ofacLabel(matchClass: OfacMatchClass): string {
  switch (matchClass) {
    case 'no_match':
      return 'No OFAC SDN match found — clear';
    case 'potential_match':
      return 'Potential OFAC SDN name match — requires human review before any action';
    case 'confirmed_match':
      return 'Confirmed OFAC SDN match (name + date of birth) — hard compliance blocker';
  }
}

export function buildOfacClaim(
  npi: string,
  subject: OfacSubjectIdentity,
  match: SdnMatchResult,
  artifactId: string,
  artifactChecksum: string,
  observedAt: string,
  dataVersion: string | null,
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const label = ofacLabel(match.matchClass);
  const sanctioned = match.matchClass === 'confirmed_match';

  // potential_match → review_required, NOT decision-grade
  // confirmed_match → decision-grade BLOCKER
  // no_match        → decision-grade CLEAR
  const reviewRequired = match.matchClass === 'potential_match';
  const confidence =
    match.matchClass === 'no_match'
      ? 'HIGH'
      : match.matchClass === 'confirmed_match'
        ? 'HIGH'
        : 'MEDIUM';
  const confidenceScore = match.matchScore > 0 ? match.matchScore : 1.0;

  const value: OfacSanctionValue = {
    _type: 'OFAC_SANCTION',
    matchClass: match.matchClass,
    sanctioned,
    matchedUids: match.matchedUids.length > 0 ? match.matchedUids : null,
    sanctionPrograms: match.sanctionPrograms.length > 0 ? match.sanctionPrograms : null,
    matchedFields: match.matchedFields,
    matchScore: match.matchScore,
    source: 'OFAC_SDN',
    observedAt,
    dataVersion,
    label,
    sourceDisclaimer: OFAC_SOURCE_DISCLAIMER,
  };

  const source = getSource(OFAC_SOURCE_ID);
  const freshnessWindowHours = getSourceFreshnessWindowHours(OFAC_SOURCE_ID);
  const expiresAt = new Date(
    Date.parse(observedAt) + freshnessWindowHours * 3600 * 1000,
  ).toISOString();

  const trace = buildClaimArtifactTrace({
    sourceId: OFAC_SOURCE_ID,
    sourceUrl: source?.baseUrl ?? OFAC_CONSOLIDATED_URL,
    retrievedAt: observedAt,
    artifactId,
    checksum: artifactChecksum,
    claimType: 'SANCTION_RECORD',
    matchConfidence: confidence,
  });

  const claim: NormalizedClaim = {
    claimId: computeClaimId('SANCTION_RECORD', OFAC_SOURCE_ID, npi, value),
    claimType: 'SANCTION_RECORD',
    subjectNpi: npi,
    value,
    tier: 'GOLD',
    confidence,
    confidenceScore,
    sourceId: OFAC_SOURCE_ID,
    artifactId,
    artifactChecksum,
    parserVersion: OFAC_PARSER_VERSION,
    derivedAt: new Date().toISOString(),
    ...trace,
    observedAt,
    validFrom: observedAt,
    validUntil: null,
    expiresAt,
    status: sanctioned ? 'ACTIVE' : 'ACTIVE',
    supersededBy: null,
    supersedes: null,
    reviewRequired,
    reviewReason: reviewRequired
      ? `OFAC name match requires human review: ${match.matchedUids.join(', ')} — do not auto-block on name-only hit`
      : null,
    humanReviewAt: null,
  };

  const explanation =
    match.matchClass === 'no_match'
      ? 'Clinician name and identity compared against OFAC SDN consolidated list — no match found. CLEAR.'
      : match.matchClass === 'potential_match'
        ? `OFAC name match found (score ${match.matchScore.toFixed(2)}) against SDN entry UIDs [${match.matchedUids.join(', ')}]. Programs: ${match.sanctionPrograms.join(', ') || 'unknown'}. Human review required — do not auto-block.`
        : `Confirmed OFAC SDN match (name + DOB, score ${match.matchScore.toFixed(2)}) against entry UIDs [${match.matchedUids.join(', ')}]. Programs: ${match.sanctionPrograms.join(', ') || 'unknown'}. Hard blocker.`;

  return {
    claims: [claim],
    receipts: [buildReceipt(claim, match.matchClass, explanation)],
  };
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

export interface OfacFetchResult {
  entries: SdnEntry[];
  checksum: string;
  fetchedAt: string;
  dataVersion: string;
  artifactId: string;
  sourceUrl: string;
}

/**
 * Fetch and parse the OFAC consolidated SDN JSON list.
 * Returns raw SdnEntry array for matching.
 * Throws on network/parse failure — caller should handle gracefully.
 */
export async function fetchOfacSdnList(timeoutMs = 30_000): Promise<OfacFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(OFAC_CONSOLIDATED_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!resp.ok) {
      throw new Error(`OFAC SDN fetch failed: HTTP ${resp.status}`);
    }

    const raw = await resp.json() as unknown;
    const fetchedAt = new Date().toISOString();
    const payload = JSON.stringify(raw);
    const checksum = sha256(payload);
    const entries = parseSdnResponse(raw);

    log('info', 'ofac_sdn_fetched', {
      event: 'ofac_sdn_fetched',
      entryCount: entries.length,
      checksum,
    });

    return {
      entries,
      checksum,
      fetchedAt,
      dataVersion: fetchedAt.slice(0, 10), // YYYY-MM-DD
      artifactId: randomUUID(),
      sourceUrl: OFAC_CONSOLIDATED_URL,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── High-level check (for ingestion pipeline use) ─────────────────────────────

/**
 * Run an OFAC check for a single clinician against a pre-fetched SDN list.
 * Returns canonical claims + receipts to merge into the ingestion result.
 *
 * When `sdnEntries` is null/empty (e.g., disabled or fetch failed), returns
 * a single UNCHECKED claim so the passport honestly reflects OFAC status.
 */
export function runOfacCheck(
  npi: string,
  subject: OfacSubjectIdentity,
  sdnEntries: SdnEntry[] | null,
  artifactId: string,
  checksum: string,
  observedAt: string,
  dataVersion: string | null,
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  if (!sdnEntries || sdnEntries.length === 0) {
    log('warn', 'ofac_check_skipped', {
      event: 'ofac_check_skipped',
      npi,
      reason: 'SDN list unavailable or empty',
    });
    // Return an UNCHECKED claim — reviewRequired so it doesn't silently clear
    const value: OfacSanctionValue = {
      _type: 'OFAC_SANCTION',
      matchClass: 'no_match',
      sanctioned: false,
      matchedUids: null,
      sanctionPrograms: null,
      matchedFields: [],
      matchScore: 0,
      source: 'OFAC_SDN',
      observedAt,
      dataVersion,
      label: 'OFAC SDN check not completed — list unavailable',
      sourceDisclaimer: OFAC_SOURCE_DISCLAIMER,
    };

    const source = getSource(OFAC_SOURCE_ID);
    const trace = buildClaimArtifactTrace({
      sourceId: OFAC_SOURCE_ID,
      sourceUrl: source?.baseUrl ?? OFAC_CONSOLIDATED_URL,
      retrievedAt: observedAt,
      artifactId,
      checksum,
      claimType: 'SANCTION_RECORD',
      matchConfidence: 'UNCERTAIN',
    });

    const claim: NormalizedClaim = {
      claimId: computeClaimId('SANCTION_RECORD', OFAC_SOURCE_ID, npi, value),
      claimType: 'SANCTION_RECORD',
      subjectNpi: npi,
      value,
      tier: 'GOLD',
      confidence: 'UNCERTAIN',
      confidenceScore: 0,
      sourceId: OFAC_SOURCE_ID,
      artifactId,
      artifactChecksum: checksum,
      parserVersion: OFAC_PARSER_VERSION,
      derivedAt: new Date().toISOString(),
      ...trace,
      observedAt,
      validFrom: observedAt,
      validUntil: null,
      expiresAt: null,
      status: 'UNVERIFIED',
      supersededBy: null,
      supersedes: null,
      reviewRequired: true,
      reviewReason: 'OFAC SDN list was unavailable at check time — result is incomplete',
      humanReviewAt: null,
    };

    return { claims: [claim], receipts: [buildReceipt(claim, 'unchecked', claim.reviewReason ?? '')] };
  }

  const match = matchAgainstSdn(subject, sdnEntries);
  return buildOfacClaim(npi, subject, match, artifactId, checksum, observedAt, dataVersion);
}
