/**
 * phase3Sources.ts — Phase 3 Source Adapters (Licensure Verification)
 *
 * Gold-tier licensure sources:
 *   - Nursys (NCSBN) — national nurse licensure verification + discipline
 *   - State Medical Boards — physician license verification by state
 *
 * Nursys: The only national nurse license database. In production, requires
 * NURSYS_API_KEY + NURSYS_BASE_URL env vars. Without credentials, falls back
 * to existing NursysENotifyAdapter stub behavior but still emits structured
 * claims with UNCERTAIN confidence.
 *
 * State boards: Scraped/API per state. Phase 3 starts with the 10 largest
 * physician-population states. Board-specific adapters route via state code.
 */

import { createHash } from 'node:crypto';
import {
  buildClaimArtifactTrace,
  computeClaimId,
  buildReceipt,
  type NormalizedClaim,
  type VerificationReceipt,
  type LicenseValue,
  type ClaimConfidence,
} from './evidenceModel';
import type { ClaimType } from './sourceCatalog';
import { log } from '../../obs/logger';

// ── Shared utilities ──────────────────────────────────────────────────────────

interface FetchResult {
  raw: unknown;
  checksum: string;
  fetchedAt: string;
  sourceUrl: string;
  fetchHeaders: Record<string, string>;
}

function checksumOf(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function headersToObject(h: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  h.forEach((v, k) => { obj[k] = v; });
  return obj;
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

// ── Nursys Fetcher ────────────────────────────────────────────────────────────

/**
 * Nursys e-Notify — national nurse licensure verification.
 *
 * Production: NURSYS_API_KEY + NURSYS_BASE_URL env vars.
 * Without credentials: returns structured UNCERTAIN result.
 *
 * Nursys provides:
 *   - License status (ACTIVE, EXPIRED, SUSPENDED, REVOKED)
 *   - Multi-state compact privilege
 *   - Discipline actions
 *   - Real-time e-Notify alerts
 */
export async function fetchNursys(npi: string): Promise<FetchResult> {
  const apiKey  = process.env.NURSYS_API_KEY?.trim();
  const baseUrl = process.env.NURSYS_BASE_URL?.trim();

  if (apiKey && baseUrl) {
    // Live Nursys API
    const sourceUrl = `${baseUrl}/api/v1/license-status?npi=${encodeURIComponent(npi)}`;
    try {
      const resp = await fetch(sourceUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) throw new Error(`Nursys API ${resp.status}`);
      const data = await resp.json();
      return { raw: data, checksum: checksumOf(data), fetchedAt: new Date().toISOString(), sourceUrl, fetchHeaders: headersToObject(resp.headers) };
    } catch (err) {
      log('warn', 'phase3: Nursys live fetch failed', { npi, error: String(err) });
      return {
        raw: { _apiError: true, npi, error: String(err) },
        checksum: checksumOf({ npi, ts: Date.now() }),
        fetchedAt: new Date().toISOString(), sourceUrl, fetchHeaders: {},
      };
    }
  }

  // Fallback: try Nursys public search (scrape-style)
  const sourceUrl = `https://www.nursys.com/NLV/NLVSearch.aspx?id=${npi}`;
  try {
    const resp = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'VitalCV/1.0', 'Accept': 'text/html,application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error(`Nursys public ${resp.status}`);
    const text = await resp.text();

    // Try JSON parse first, fall back to HTML scraping indicators
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch {
      // HTML response — extract what we can
      const hasLicense = text.includes('License Number') || text.includes('license-number');
      const hasActive  = text.includes('Active') || text.includes('ACTIVE');
      const hasExpired = text.includes('Expired') || text.includes('EXPIRED');

      parsed = {
        _scraped: true, npi,
        hasLicenseIndicator: hasLicense,
        statusIndicator: hasActive ? 'ACTIVE' : hasExpired ? 'EXPIRED' : 'UNKNOWN',
        responseLength: text.length,
      };
    }

    return { raw: parsed, checksum: checksumOf(parsed), fetchedAt: new Date().toISOString(), sourceUrl, fetchHeaders: headersToObject(resp.headers) };
  } catch (err) {
    log('warn', 'phase3: Nursys public fetch failed', { npi, error: String(err) });
    return {
      raw: { _noCredentials: true, _fetchFailed: true, npi },
      checksum: checksumOf({ npi, nursys: 'unavailable', ts: Date.now() }),
      fetchedAt: new Date().toISOString(), sourceUrl, fetchHeaders: {},
    };
  }
}

const NURSYS_PARSER = 'v1.0.0';

export function parseNursysResult(
  npi: string, raw: unknown, artifactId: string, artifactChecksum: string, observedAt: string,
  sourceMeta?: { sourceUrl?: string; retrievedAt?: string },
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const claims: NormalizedClaim[] = [];
  const receipts: VerificationReceipt[] = [];
  const data = raw as Record<string, unknown>;
  const base = {
    sourceId: 'NURSYS',
    sourceUrl: sourceMeta?.sourceUrl,
    retrievedAt: sourceMeta?.retrievedAt ?? observedAt,
    artifactId,
    artifactChecksum,
    parserVersion: NURSYS_PARSER,
    tier: 'GOLD' as const,
    observedAt,
  };

  // No credentials / fetch failed
  if (data._noCredentials || data._fetchFailed) {
    const value: LicenseValue = {
      _type: 'LICENSE', state: 'NATIONAL', licenseNumber: null,
      issueDate: null, expiryDate: null, licenseStatus: 'UNKNOWN',
      disciplinaryActions: [], source: 'NURSYS',
    };
    const claim = makeClaim({
      ...base, claimType: 'NURSING_LICENSE', subjectNpi: npi, value,
      confidence: 'UNCERTAIN', confidenceScore: 0.1,
      reviewRequired: true, reviewReason: 'Nursys API credentials not configured — set NURSYS_API_KEY and NURSYS_BASE_URL',
    });
    claims.push(claim);
    receipts.push(buildReceipt(claim, 'licenseStatus', 'Nursys license check not completed — API credentials not configured.'));
    return { claims, receipts };
  }

  // API error
  if (data._apiError) {
    const value: LicenseValue = {
      _type: 'LICENSE', state: 'NATIONAL', licenseNumber: null,
      issueDate: null, expiryDate: null, licenseStatus: 'UNKNOWN',
      disciplinaryActions: [], source: 'NURSYS',
    };
    const claim = makeClaim({
      ...base, claimType: 'NURSING_LICENSE', subjectNpi: npi, value,
      confidence: 'UNCERTAIN', confidenceScore: 0.2,
      reviewRequired: true, reviewReason: `Nursys API error: ${data.error}`,
    });
    claims.push(claim);
    receipts.push(buildReceipt(claim, 'licenseStatus', `Nursys license check failed — ${data.error}. Manual verification required.`));
    return { claims, receipts };
  }

  // Scraped HTML response
  if (data._scraped) {
    const statusInd = String(data.statusIndicator ?? 'UNKNOWN');
    const licStatus = statusInd === 'ACTIVE' ? 'ACTIVE' : statusInd === 'EXPIRED' ? 'EXPIRED' : 'UNKNOWN';
    const value: LicenseValue = {
      _type: 'LICENSE', state: 'NATIONAL', licenseNumber: null,
      issueDate: null, expiryDate: null, licenseStatus: licStatus,
      disciplinaryActions: [], source: 'NURSYS_SCRAPE',
    };
    const claim = makeClaim({
      ...base, claimType: 'NURSING_LICENSE', subjectNpi: npi, value,
      confidence: licStatus !== 'UNKNOWN' ? 'LOW' : 'UNCERTAIN',
      confidenceScore: licStatus !== 'UNKNOWN' ? 0.4 : 0.15,
      reviewRequired: true,
      reviewReason: 'Nursys public page scraped (no API credentials) — low confidence, verify manually',
    });
    claims.push(claim);
    receipts.push(buildReceipt(claim, 'licenseStatus',
      `Nursys public page scraped for NPI ${npi}: status indicator ${licStatus}. Low confidence — API access recommended.`));
    return { claims, receipts };
  }

  // Live API response — structured event data
  const events = (data.events ?? []) as Array<Record<string, unknown>>;

  if (events.length === 0) {
    // NPI found but no events — may not be a nurse
    const value: LicenseValue = {
      _type: 'LICENSE', state: 'NATIONAL', licenseNumber: null,
      issueDate: null, expiryDate: null, licenseStatus: 'UNKNOWN',
      disciplinaryActions: [], source: 'NURSYS',
    };
    const claim = makeClaim({
      ...base, claimType: 'NURSING_LICENSE', subjectNpi: npi, value,
      confidence: 'MEDIUM', confidenceScore: 0.6,
    });
    claims.push(claim);
    receipts.push(buildReceipt(claim, 'licenseStatus', `Nursys API returned no license events for NPI ${npi} — may not be a nursing professional.`));
    return { claims, receipts };
  }

  // Parse each license event
  for (const event of events) {
    const state       = String(event.state ?? event.jurisdiction ?? '');
    const licNum      = String(event.licenseNumber ?? event.license_number ?? '');
    const eventType   = String(event.eventType ?? event.event_type ?? '');
    const expiry      = event.expirationDate ?? event.expires_at ?? event.expiration_date;

    const isDiscipline = eventType.toLowerCase().includes('discipline') ||
                         eventType.toLowerCase().includes('action') ||
                         eventType.toLowerCase().includes('revoke') ||
                         eventType.toLowerCase().includes('suspend');

    if (isDiscipline) {
      // Discipline claim
      const disciplineValue: LicenseValue = {
        _type: 'LICENSE', state, licenseNumber: licNum,
        issueDate: null,
        expiryDate: expiry ? String(expiry) : null,
        licenseStatus: eventType.toLowerCase().includes('revoke') ? 'REVOKED'
          : eventType.toLowerCase().includes('suspend') ? 'SUSPENDED' : 'ACTIVE',
        disciplinaryActions: [eventType],
        source: 'NURSYS',
      };
      const dClaim = makeClaim({
        ...base, claimType: 'NURSING_DISCIPLINE', subjectNpi: npi, value: disciplineValue,
        confidence: 'HIGH', confidenceScore: 0.95,
        status: 'BLOCKED',
      });
      claims.push(dClaim);
      receipts.push(buildReceipt(dClaim, 'licenseStatus',
        `Nursys discipline event for NPI ${npi} in ${state}: ${eventType}. License ${licNum}.`));
    } else {
      // License status claim
      const statusStr = String(event.status ?? event.licenseStatus ?? 'ACTIVE').toUpperCase();
      const licStatus: LicenseValue['licenseStatus'] =
        statusStr.includes('ACTIVE') ? 'ACTIVE' :
        statusStr.includes('EXPIRED') ? 'EXPIRED' :
        statusStr.includes('REVOKED') ? 'REVOKED' :
        statusStr.includes('SUSPENDED') ? 'SUSPENDED' : 'UNKNOWN';

      const value: LicenseValue = {
        _type: 'LICENSE', state, licenseNumber: licNum,
        issueDate: event.issueDate ? String(event.issueDate) : null,
        expiryDate: expiry ? String(expiry) : null,
        licenseStatus: licStatus,
        disciplinaryActions: [],
        source: 'NURSYS',
      };
      const claim = makeClaim({
        ...base, claimType: 'NURSING_LICENSE', subjectNpi: npi, value,
        confidence: 'HIGH', confidenceScore: 0.95,
        expiresAt: expiry ? String(expiry) : null,
      });
      claims.push(claim);
      receipts.push(buildReceipt(claim, 'licenseStatus',
        `Nursys: ${state} nursing license ${licNum} — status ${licStatus}${expiry ? `, expires ${expiry}` : ''}.`));
    }
  }

  return { claims, receipts };
}

// ── State Medical Board Fetcher ───────────────────────────────────────────────

/**
 * State medical board license verification.
 *
 * Strategy: Use existing NPPES taxonomy data to identify the clinician's
 * state(s) of practice, then query each state's verification system.
 *
 * Phase 3 covers the 10 largest physician states:
 *   CA, TX, FL, NY, PA, IL, OH, GA, NC, MI
 *
 * Each state has a different verification portal. We start with
 * the common FSMB (Federation of State Medical Boards) DocInfo API
 * and fall back to individual state board scrapers.
 */

// State board verification endpoints (known public lookup URLs)
const STATE_BOARD_URLS: Record<string, string> = {
  CA: 'https://mbc.ca.gov/breeze/brz_search_result.aspx',
  TX: 'https://profile.tmb.state.tx.us/Search.aspx',
  FL: 'https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders',
  NY: 'https://www.nysed.gov/professions/verification-search',
  PA: 'https://www.pals.pa.gov/#/page/search',
  IL: 'https://online-dfpr.micropact.com/lookup/licenselookup.aspx',
  OH: 'https://elicense.ohio.gov/oh_verifylicense',
  GA: 'https://gcmb.mylicense.com/verification/',
  NC: 'https://portal.ncmedboard.org/verification/',
  MI: 'https://aca-prod.accela.com/MILARA/',
};

export async function fetchStateBoardLicense(npi: string, state: string, lastName?: string): Promise<FetchResult> {
  const stateUpper = state.toUpperCase();
  const boardUrl = STATE_BOARD_URLS[stateUpper];
  const sourceUrl = boardUrl ?? `https://www.fsmb.org/docinfo/?npi=${npi}`;

  // Attempt FSMB DocInfo API first (if available)
  const fsmb = process.env.FSMB_API_KEY?.trim();
  if (fsmb) {
    const fsmbUrl = `https://docinfo-api.fsmb.org/v1/physicians/${npi}`;
    try {
      const resp = await fetch(fsmbUrl, {
        headers: { 'Authorization': `Bearer ${fsmb}`, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const data = await resp.json();
        return { raw: { ...data as object, _source: 'FSMB', _state: stateUpper }, checksum: checksumOf(data), fetchedAt: new Date().toISOString(), sourceUrl: fsmbUrl, fetchHeaders: headersToObject(resp.headers) };
      }
    } catch (err) {
      log('warn', 'phase3: FSMB fetch failed', { npi, state, error: String(err) });
    }
  }

  // Fall back to state board scrape attempt
  if (boardUrl) {
    try {
      const resp = await fetch(boardUrl, {
        headers: { 'User-Agent': 'VitalCV/1.0', 'Accept': 'text/html,application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const text = await resp.text();
        // Extract license status indicators from HTML
        const hasActive   = /\bactive\b/i.test(text);
        const hasExpired  = /\bexpired\b/i.test(text);
        const hasRevoked  = /\brevoked\b/i.test(text);
        const hasSuspended = /\bsuspended\b/i.test(text);

        const parsed = {
          _scraped: true, _state: stateUpper, npi,
          hasActiveIndicator: hasActive,
          statusIndicator: hasRevoked ? 'REVOKED' : hasSuspended ? 'SUSPENDED' : hasExpired ? 'EXPIRED' : hasActive ? 'ACTIVE' : 'UNKNOWN',
          boardUrl, responseLength: text.length,
        };

        return { raw: parsed, checksum: checksumOf(parsed), fetchedAt: new Date().toISOString(), sourceUrl: boardUrl, fetchHeaders: headersToObject(resp.headers) };
      }
    } catch (err) {
      log('warn', 'phase3: state board scrape failed', { npi, state, error: String(err) });
    }
  }

  // Cannot reach any board source
  return {
    raw: { _unavailable: true, npi, state: stateUpper, boardUrl: boardUrl ?? null },
    checksum: checksumOf({ npi, state: stateUpper, ts: Date.now() }),
    fetchedAt: new Date().toISOString(), sourceUrl, fetchHeaders: {},
  };
}

const STATE_BOARD_PARSER = 'v1.0.0';

export function parseStateBoardResult(
  npi: string, state: string, raw: unknown, artifactId: string, artifactChecksum: string, observedAt: string,
  sourceMeta?: { sourceUrl?: string; retrievedAt?: string },
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const data = raw as Record<string, unknown>;
  const base = {
    sourceId: 'STATE_BOARD',
    sourceUrl: sourceMeta?.sourceUrl,
    retrievedAt: sourceMeta?.retrievedAt ?? observedAt,
    artifactId,
    artifactChecksum,
    parserVersion: STATE_BOARD_PARSER,
    tier: 'GOLD' as const,
    observedAt,
  };
  const stateUpper = state.toUpperCase();

  // Unavailable
  if (data._unavailable) {
    const value: LicenseValue = {
      _type: 'LICENSE', state: stateUpper, licenseNumber: null,
      issueDate: null, expiryDate: null, licenseStatus: 'UNKNOWN',
      disciplinaryActions: [], source: `STATE_BOARD_${stateUpper}`,
    };
    const claim = makeClaim({
      ...base, claimType: 'LICENSE', subjectNpi: npi, value,
      confidence: 'UNCERTAIN', confidenceScore: 0.1,
      reviewRequired: true,
      reviewReason: `${stateUpper} medical board verification unavailable — manual check at ${data.boardUrl ?? 'state board website'} recommended`,
    });
    return {
      claims: [claim],
      receipts: [buildReceipt(claim, 'licenseStatus', `${stateUpper} board verification unavailable. Manual check required.`)],
    };
  }

  // FSMB API response (structured)
  if (data._source === 'FSMB') {
    const licenses = (data.licenses ?? data.medicalLicenses ?? []) as Array<Record<string, unknown>>;

    if (licenses.length === 0) {
      const value: LicenseValue = {
        _type: 'LICENSE', state: stateUpper, licenseNumber: null,
        issueDate: null, expiryDate: null, licenseStatus: 'UNKNOWN',
        disciplinaryActions: [], source: 'FSMB',
      };
      const claim = makeClaim({
        ...base, claimType: 'LICENSE', subjectNpi: npi, value,
        confidence: 'HIGH', confidenceScore: 0.90,
      });
      return {
        claims: [claim],
        receipts: [buildReceipt(claim, 'licenseStatus', `FSMB DocInfo: no ${stateUpper} license records found for NPI ${npi}.`)],
      };
    }

    const claims: NormalizedClaim[] = [];
    const receipts: VerificationReceipt[] = [];

    for (const lic of licenses) {
      const licState = String(lic.state ?? lic.jurisdiction ?? stateUpper).toUpperCase();
      const statusStr = String(lic.status ?? lic.licenseStatus ?? '').toUpperCase();
      const licStatus: LicenseValue['licenseStatus'] =
        statusStr.includes('ACTIVE') ? 'ACTIVE' :
        statusStr.includes('EXPIRED') ? 'EXPIRED' :
        statusStr.includes('REVOKED') ? 'REVOKED' :
        statusStr.includes('SUSPENDED') ? 'SUSPENDED' : 'UNKNOWN';

      const disciplinary = (lic.disciplinaryActions ?? lic.actions ?? []) as string[];

      const value: LicenseValue = {
        _type: 'LICENSE', state: licState,
        licenseNumber: lic.licenseNumber ? String(lic.licenseNumber) : null,
        issueDate: lic.issueDate ? String(lic.issueDate) : null,
        expiryDate: lic.expirationDate ? String(lic.expirationDate) : null,
        licenseStatus: licStatus,
        disciplinaryActions: disciplinary.map(String),
        source: 'FSMB',
      };
      const claim = makeClaim({
        ...base, claimType: 'LICENSE', subjectNpi: npi, value,
        confidence: 'HIGH', confidenceScore: 0.95,
        expiresAt: lic.expirationDate ? String(lic.expirationDate) : null,
        status: licStatus === 'REVOKED' || licStatus === 'SUSPENDED' ? 'BLOCKED' : 'ACTIVE',
      });
      claims.push(claim);
      receipts.push(buildReceipt(claim, 'licenseStatus',
        `FSMB: ${licState} medical license ${lic.licenseNumber ?? 'N/A'} — ${licStatus}${lic.expirationDate ? `, expires ${lic.expirationDate}` : ''}.`));

      // Discipline claims
      for (const action of disciplinary) {
        const dValue: LicenseValue = {
          _type: 'LICENSE', state: licState,
          licenseNumber: lic.licenseNumber ? String(lic.licenseNumber) : null,
          issueDate: null, expiryDate: null,
          licenseStatus: 'ACTIVE',
          disciplinaryActions: [action],
          source: 'FSMB',
        };
        const dClaim = makeClaim({
          ...base, claimType: 'LICENSE_DISCIPLINE', subjectNpi: npi, value: dValue,
          confidence: 'HIGH', confidenceScore: 0.95,
        });
        claims.push(dClaim);
        receipts.push(buildReceipt(dClaim, 'disciplinaryActions',
          `FSMB: ${licState} disciplinary action on license ${lic.licenseNumber ?? 'N/A'}: ${action}`));
      }
    }

    return { claims, receipts };
  }

  // Scraped HTML response
  if (data._scraped) {
    const statusInd = String(data.statusIndicator ?? 'UNKNOWN');
    const licStatus: LicenseValue['licenseStatus'] =
      statusInd === 'REVOKED' ? 'REVOKED' :
      statusInd === 'SUSPENDED' ? 'SUSPENDED' :
      statusInd === 'EXPIRED' ? 'EXPIRED' :
      statusInd === 'ACTIVE' ? 'ACTIVE' : 'UNKNOWN';

    const value: LicenseValue = {
      _type: 'LICENSE', state: stateUpper, licenseNumber: null,
      issueDate: null, expiryDate: null, licenseStatus: licStatus,
      disciplinaryActions: [],
      source: `STATE_BOARD_${stateUpper}_SCRAPE`,
    };
    const confidence: ClaimConfidence = licStatus !== 'UNKNOWN' ? 'LOW' : 'UNCERTAIN';
    const claim = makeClaim({
      ...base, claimType: 'LICENSE', subjectNpi: npi, value,
      confidence, confidenceScore: confidence === 'LOW' ? 0.35 : 0.1,
      reviewRequired: true,
      reviewReason: `${stateUpper} board page scraped — low confidence, verify directly at ${data.boardUrl}`,
      status: licStatus === 'REVOKED' || licStatus === 'SUSPENDED' ? 'BLOCKED' : 'ACTIVE',
    });

    return {
      claims: [claim],
      receipts: [buildReceipt(claim, 'licenseStatus',
        `${stateUpper} medical board page scraped: status indicator ${licStatus}. Low confidence — direct verification recommended.`)],
    };
  }

  return { claims: [], receipts: [] };
}

// ── Helper: Get practice states from existing claims ──────────────────────────

export function extractPracticeStates(claims: NormalizedClaim[]): string[] {
  const states = new Set<string>();

  // From NPPES specialty taxonomy claims (which include state)
  for (const claim of claims) {
    if (claim.claimType === 'SPECIALTY') {
      const val = claim.value as Record<string, unknown>;
      if (val.state && typeof val.state === 'string') states.add(val.state.toUpperCase());
    }
    if (claim.claimType === 'PRACTICE_LOCATION') {
      const val = claim.value as Record<string, unknown>;
      if (val.state && typeof val.state === 'string') states.add(val.state.toUpperCase());
    }
  }

  return [...states];
}
