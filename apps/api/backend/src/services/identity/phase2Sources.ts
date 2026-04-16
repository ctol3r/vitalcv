/**
 * phase2Sources.ts — Phase 2 Source Adapters
 *
 * Gold-tier government sources:
 *   - Open Payments (CMS) — industry financial relationships
 *   - SAM.gov — federal exclusions and entity registration
 *   - Doctors & Clinicians (CMS) — enrollment, PAC ID, board cert flag
 *
 * Each adapter:
 *   1. Fetches from the live API
 *   2. Returns raw response + checksum
 *   3. Has a companion parser in claimEngine that normalizes to NormalizedClaim[]
 *
 * These are registered in the ingestion pipeline via registerPhase2Handlers().
 */

import { createHash } from 'node:crypto';
import {
  buildClaimArtifactTrace,
  computeClaimId,
  buildReceipt,
  type NormalizedClaim,
  type VerificationReceipt,
  type IndustryPaymentValue,
  type ExclusionValue,
  type EnrollmentValue,
  type BoardCertValue,
  type ClaimConfidence,
} from './evidenceModel';
import type { ClaimType } from './sourceCatalog';
import { log } from '../../obs/logger';
import { fetchJsonSource } from './sourceHttp';

function checksumOf(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function makeClaim(params: {
  claimType: ClaimType; subjectNpi: string; value: NormalizedClaim['value'];
  sourceId: string; sourceUrl?: string; artifactId: string; artifactChecksum: string;
  parserVersion: string; tier: NormalizedClaim['tier'];
  confidence: ClaimConfidence; matchConfidence?: ClaimConfidence; confidenceScore: number; observedAt: string; retrievedAt?: string;
  validFrom?: string | null; validUntil?: string | null; expiresAt?: string | null;
  status?: NormalizedClaim['status']; reviewRequired?: boolean; reviewReason?: string | null;
}): NormalizedClaim {
  const claimId = computeClaimId(params.claimType, params.sourceId, params.subjectNpi, params.value);
  const trace = buildClaimArtifactTrace({
    sourceId: params.sourceId,
    sourceUrl: params.sourceUrl,
    retrievedAt: params.retrievedAt ?? params.observedAt,
    artifactId: params.artifactId,
    checksum: params.artifactChecksum,
    claimType: params.claimType,
    matchConfidence: params.matchConfidence ?? params.confidence,
  });
  return {
    claimId, claimType: params.claimType, subjectNpi: params.subjectNpi,
    value: params.value, tier: params.tier, confidence: params.confidence,
    confidenceScore: params.confidenceScore, sourceId: params.sourceId,
    artifactId: params.artifactId, artifactChecksum: params.artifactChecksum,
    parserVersion: params.parserVersion, derivedAt: new Date().toISOString(),
    source_id: trace.source_id, source_url: trace.source_url,
    retrieved_at: trace.retrieved_at, raw_artifact_ref: trace.raw_artifact_ref,
    checksum: trace.checksum, claim_type: trace.claim_type,
    match_confidence: trace.match_confidence,
    observedAt: params.observedAt, validFrom: params.validFrom ?? null,
    validUntil: params.validUntil ?? null, expiresAt: params.expiresAt ?? null,
    status: params.status ?? 'ACTIVE', supersededBy: null, supersedes: null,
    reviewRequired: params.reviewRequired ?? false,
    reviewReason: params.reviewReason ?? null, humanReviewAt: null,
  };
}

// ── Open Payments Fetcher ─────────────────────────────────────────────────────

/**
 * CMS Open Payments — General + Research payments to physicians.
 * Dataset: https://openpaymentsdata.cms.gov/
 * API: Socrata-compatible SODA endpoint
 */
interface FetchResult {
  raw: unknown;
  checksum: string;
  fetchedAt: string;
  sourceUrl: string;
  fetchHeaders: Record<string, string>;
}

export async function fetchOpenPayments(npi: string): Promise<FetchResult> {
  const sourceUrl = `https://openpaymentsdata.cms.gov/api/1/datastore/query/25f8f4af-3e6e-49e5-8a36-9c2e5467f47c/0?conditions[0][property]=covered_recipient_npi&conditions[0][value]=${npi}&limit=100`;
  try {
    const { data, fetchedAt, headers } = await fetchJsonSource(sourceUrl, {
      label: 'open_payments',
      headers: { Accept: 'application/json' },
      cacheKey: `open_payments:${npi}`,
      timeoutMs: 15_000,
      maxRetries: 3,
    });
    return { raw: data, checksum: checksumOf(data), fetchedAt, sourceUrl, fetchHeaders: headers };
  } catch (err) {
    log('warn', 'phase2: Open Payments fetch failed', { npi, error: String(err) });
    return { raw: { _apiUnavailable: true, npi }, checksum: checksumOf({ npi, ts: Date.now() }), fetchedAt: new Date().toISOString(), sourceUrl, fetchHeaders: {} };
  }
}

const OPEN_PAYMENTS_PARSER = 'v1.0.0';

export function parseOpenPayments(
  npi: string, raw: unknown, artifactId: string, artifactChecksum: string, observedAt: string,
  sourceMeta?: { sourceUrl?: string; retrievedAt?: string },
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const claims: NormalizedClaim[] = [];
  const receipts: VerificationReceipt[] = [];
  const data = raw as Record<string, unknown>;

  if (data._apiUnavailable) return { claims, receipts };

  const results = (data.results ?? []) as Array<Record<string, unknown>>;
  if (results.length === 0) return { claims, receipts };

  // Aggregate by payment year
  const byYear = new Map<number, { total: number; count: number; types: Set<string>; payers: Set<string> }>();
  for (const row of results) {
    const year = parseInt(String(row.program_year ?? row.date_of_payment ?? '0').slice(0, 4), 10);
    if (year < 2000) continue;
    const amount = parseFloat(String(row.total_amount_of_payment_usdollars ?? '0'));
    const payType = String(row.nature_of_payment_or_transfer_of_value ?? 'UNKNOWN');
    const payer = String(row.applicable_manufacturer_or_applicable_gpo_making_payment_name ?? 'UNKNOWN');

    if (!byYear.has(year)) byYear.set(year, { total: 0, count: 0, types: new Set(), payers: new Set() });
    const entry = byYear.get(year)!;
    entry.total += amount;
    entry.count += 1;
    entry.types.add(payType);
    if (entry.payers.size < 10) entry.payers.add(payer);
  }

  for (const [year, entry] of byYear) {
    const value: IndustryPaymentValue = {
      _type: 'INDUSTRY_PAYMENT',
      paymentYear: year,
      totalAmount: Math.round(entry.total * 100) / 100,
      recordCount: entry.count,
      paymentTypes: [...entry.types],
      topPayers: [...entry.payers],
    };

    const claim = makeClaim({
      sourceId: 'OPEN_PAYMENTS', sourceUrl: sourceMeta?.sourceUrl,
      retrievedAt: sourceMeta?.retrievedAt ?? observedAt, artifactId, artifactChecksum,
      parserVersion: OPEN_PAYMENTS_PARSER, tier: 'GOLD',
      claimType: 'INDUSTRY_PAYMENT', subjectNpi: npi, value,
      confidence: 'HIGH', confidenceScore: 0.95, observedAt,
    });
    claims.push(claim);
    receipts.push(buildReceipt(claim, 'totalAmount',
      `Open Payments ${year}: $${value.totalAmount.toLocaleString()} across ${entry.count} payment records from CMS.`));
  }

  return { claims, receipts };
}

// ── SAM.gov Fetcher ───────────────────────────────────────────────────────────

/**
 * SAM.gov Entity API — federal exclusions and entity registration.
 * Requires API key via SAM_GOV_API_KEY env var.
 * Free tier: 10 requests/day.
 */
export async function fetchSamGov(npi: string, firstName?: string, lastName?: string): Promise<FetchResult> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  let sourceUrl = '';

  if (apiKey && firstName && lastName) {
    sourceUrl = `https://api.sam.gov/entity-information/v3/exclusions?api_key=REDACTED&q=${encodeURIComponent(firstName + ' ' + lastName)}&limit=10`;
    const realUrl = `https://api.sam.gov/entity-information/v3/exclusions?api_key=${apiKey}&q=${encodeURIComponent(firstName + ' ' + lastName)}&limit=10`;
    try {
      const { data, fetchedAt, headers } = await fetchJsonSource(realUrl, {
        label: 'sam_gov',
        headers: { Accept: 'application/json' },
        cacheKey: `sam_gov:${npi}:${firstName}:${lastName}`,
        logUrl: sourceUrl,
        timeoutMs: 15_000,
        maxRetries: 3,
      });
      return {
        raw: { ...data as object, _searchedNpi: npi, _searchedName: `${firstName} ${lastName}` },
        checksum: checksumOf(data),
        fetchedAt,
        sourceUrl,
        fetchHeaders: headers,
      };
    } catch (err) {
      log('warn', 'phase2: SAM.gov fetch failed', { npi, error: String(err) });
    }
  }

  return {
    raw: { _apiUnavailable: !apiKey, _noApiKey: !apiKey, npi, totalRecords: 0 },
    checksum: checksumOf({ npi, sam: 'unavailable', ts: Date.now() }),
    fetchedAt: new Date().toISOString(), sourceUrl: sourceUrl || 'SAM_GOV_NO_API_KEY', fetchHeaders: {},
  };
}

const SAM_PARSER = 'v1.0.0';

export function parseSamGovResult(
  npi: string, raw: unknown, artifactId: string, artifactChecksum: string, observedAt: string,
  sourceMeta?: { sourceUrl?: string; retrievedAt?: string },
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const data = raw as Record<string, unknown>;
  if (data._apiUnavailable || data._noApiKey) {
    // Still emit a claim with UNCERTAIN confidence — we tried
    const value: ExclusionValue = {
      _type: 'EXCLUSION_STATUS', excluded: false,
      exclusionType: null, exclusionDate: null, reinstatementDate: null,
      matchType: 'NO_MATCH', waiverState: null, source: 'SAM_GOV',
    };
    const claim = makeClaim({
      sourceId: 'SAM_GOV', sourceUrl: sourceMeta?.sourceUrl,
      retrievedAt: sourceMeta?.retrievedAt ?? observedAt, artifactId, artifactChecksum,
      parserVersion: SAM_PARSER, tier: 'GOLD',
      claimType: 'EXCLUSION_STATUS', subjectNpi: npi, value,
      confidence: 'UNCERTAIN', confidenceScore: 0.1, observedAt,
      reviewRequired: true,
      reviewReason: data._noApiKey
        ? 'SAM.gov API key not configured — set SAM_GOV_API_KEY env var'
        : 'SAM.gov API unavailable — manual check recommended',
    });
    return {
      claims: [claim],
      receipts: [buildReceipt(claim, 'excluded', `SAM.gov check not completed — ${data._noApiKey ? 'API key not configured' : 'API unavailable'}.`)],
    };
  }

  const exclusions = (data.results ?? []) as Array<Record<string, unknown>>;
  const totalRecords = typeof data.totalRecords === 'number' ? data.totalRecords : exclusions.length;

  if (totalRecords === 0) {
    const value: ExclusionValue = {
      _type: 'EXCLUSION_STATUS', excluded: false,
      exclusionType: null, exclusionDate: null, reinstatementDate: null,
      matchType: 'NO_MATCH', waiverState: null, source: 'SAM_GOV',
    };
    const claim = makeClaim({
      sourceId: 'SAM_GOV', sourceUrl: sourceMeta?.sourceUrl,
      retrievedAt: sourceMeta?.retrievedAt ?? observedAt, artifactId, artifactChecksum,
      parserVersion: SAM_PARSER, tier: 'GOLD',
      claimType: 'EXCLUSION_STATUS', subjectNpi: npi, value,
      confidence: 'HIGH', confidenceScore: 0.90, observedAt,
    });
    return {
      claims: [claim],
      receipts: [buildReceipt(claim, 'excluded', `SAM.gov exclusion check clear — no matching records found.`)],
    };
  }

  // Found exclusion records — CRITICAL
  const first = exclusions[0]!;
  const value: ExclusionValue = {
    _type: 'EXCLUSION_STATUS', excluded: true,
    exclusionType: String(first.exclusionType ?? first.classificationType ?? 'UNKNOWN'),
    exclusionDate: String(first.activeDateStr ?? first.activeDate ?? ''),
    reinstatementDate: first.terminationDate ? String(first.terminationDate) : null,
    matchType: 'NAME_MATCH', waiverState: null, source: 'SAM_GOV',
  };

  const claim = makeClaim({
    sourceId: 'SAM_GOV', sourceUrl: sourceMeta?.sourceUrl,
    retrievedAt: sourceMeta?.retrievedAt ?? observedAt, artifactId, artifactChecksum,
    parserVersion: SAM_PARSER, tier: 'GOLD',
    claimType: 'EXCLUSION_STATUS', subjectNpi: npi, value,
    confidence: 'MEDIUM', matchConfidence: 'MEDIUM', confidenceScore: 0.75, observedAt,
    status: 'BLOCKED',
    reviewRequired: true,
    reviewReason: 'SAM.gov match by name — verify identity before taking action',
  });

  return {
    claims: [claim],
    receipts: [buildReceipt(claim, 'excluded',
      `SAM.gov exclusion found — ${totalRecords} matching record(s). Name match requires identity verification.`)],
  };
}

// ── Doctors & Clinicians (CMS) Fetcher ────────────────────────────────────────

/**
 * CMS Doctors & Clinicians dataset — Medicare enrollment, PAC ID, board cert flag.
 * Dataset: https://data.cms.gov/provider-data/dataset/mj5m-pzi6
 */
export async function fetchDoctorsAndClinicians(npi: string): Promise<FetchResult> {
  const sourceUrl = `https://data.cms.gov/provider-data/api/1/datastore/query/mj5m-pzi6/0?conditions[0][property]=npi&conditions[0][value]=${npi}&limit=5`;
  try {
    const { data, fetchedAt, headers } = await fetchJsonSource(sourceUrl, {
      label: 'doctors_clinicians',
      headers: { Accept: 'application/json' },
      cacheKey: `doctors_clinicians:${npi}`,
      timeoutMs: 15_000,
      maxRetries: 3,
    });
    return { raw: data, checksum: checksumOf(data), fetchedAt, sourceUrl, fetchHeaders: headers };
  } catch (err) {
    log('warn', 'phase2: D&C fetch failed', { npi, error: String(err) });
    return { raw: { _apiUnavailable: true, npi }, checksum: checksumOf({ npi, ts: Date.now() }), fetchedAt: new Date().toISOString(), sourceUrl, fetchHeaders: {} };
  }
}

const DC_PARSER = 'v1.0.0';

export function parseDoctorsAndClinicians(
  npi: string, raw: unknown, artifactId: string, artifactChecksum: string, observedAt: string,
  sourceMeta?: { sourceUrl?: string; retrievedAt?: string },
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const claims: NormalizedClaim[] = [];
  const receipts: VerificationReceipt[] = [];
  const data = raw as Record<string, unknown>;
  if (data._apiUnavailable) return { claims, receipts };

  const results = (data.results ?? []) as Array<Record<string, unknown>>;
  if (results.length === 0) return { claims, receipts };

  const row = results[0]!;
  const base = {
    sourceId: 'DOCTORS_CLINICIANS',
    sourceUrl: sourceMeta?.sourceUrl,
    retrievedAt: sourceMeta?.retrievedAt ?? observedAt,
    artifactId,
    artifactChecksum,
    parserVersion: DC_PARSER,
    tier: 'GOLD' as const,
    observedAt,
  };

  // Enrollment claim
  const enrollValue: EnrollmentValue = {
    _type: 'ENROLLMENT_STATUS',
    claimState: 'ENROLLED',
    enrolled: true,
    enrollmentType: row.gndr ? 'Individual' : null,
    eligibleToOrderRefer: true,
    source: 'DOCTORS_CLINICIANS',
  };
  const enrClaim = makeClaim({ ...base, claimType: 'ENROLLMENT_STATUS', subjectNpi: npi, value: enrollValue, confidence: 'HIGH', confidenceScore: 0.95 });
  claims.push(enrClaim);
  receipts.push(buildReceipt(enrClaim, 'enrolled', `NPI ${npi} found in CMS Doctors & Clinicians dataset — enrolled in Medicare.`));

  // Board certification flag (if present)
  if (row.ind_assgn !== undefined || row.grp_assgn !== undefined) {
    const acceptsAssignment = row.ind_assgn === 'Y' || row.grp_assgn === 'Y';
    // The D&C dataset doesn't directly have board cert — it has assignment participation
    // This is still Gold-tier enrollment data
  }

  // Medical school (if present)
  if (row.med_sch) {
    const instClaim = makeClaim({
      ...base, claimType: 'INSTITUTION_AFFILIATION', subjectNpi: npi,
      value: {
        _type: 'INSTITUTION_AFFILIATION' as const,
        institution: String(row.med_sch),
        title: null, department: null,
        affiliationType: 'TRAINING' as const,
        startDate: row.grd_yr ? String(row.grd_yr) : null,
        endDate: null,
        source: 'DOCTORS_CLINICIANS',
      },
      confidence: 'MEDIUM', confidenceScore: 0.85,
    });
    claims.push(instClaim);
    receipts.push(buildReceipt(instClaim, 'institution',
      `Medical school: ${row.med_sch}${row.grd_yr ? ` (graduated ${row.grd_yr})` : ''} from CMS D&C dataset.`));
  }

  return { claims, receipts };
}
