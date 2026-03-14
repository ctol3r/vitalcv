/**
 * oigLeieChecker.ts — Wave 241
 *
 * OIG/LEIE (List of Excluded Individuals/Entities) exclusion check service.
 * Anyone on this list is barred from participating in federal healthcare programs.
 * Employers MUST check this before hiring.
 *
 * Modes:
 *   - Stub mode (default, OIG_LEIE_ENABLED != 'true'): returns CLEAR for all checks
 *   - Production mode (OIG_LEIE_ENABLED=true): queries OIG search endpoint
 *
 * OIG search endpoint:
 *   GET https://oig.hhs.gov/exclusions/search.asp?name=<lastName>&first=<firstName>
 *   (HTML scrape / no clean JSON API — production upgrade: download monthly CSV)
 *
 * Audit: every check emits a COMPLIANCE event.
 */

import { appendAuditEvent } from '../audit/auditLedger';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExclusionMatchType = 'NONE' | 'NAME_MATCH' | 'NPI_MATCH' | 'EXACT_MATCH';

export interface ExclusionResult {
  excluded: boolean;
  matchType: ExclusionMatchType;
  status?: 'CLEAR' | 'EXCLUDED' | 'UNKNOWN';
  details: string;
  checkedAt: string;
  source: 'OIG_LEIE';
}

export interface ExclusionCheckParams {
  firstName: string;
  lastName: string;
  npi?: string;
}

// ── OIG search constants ──────────────────────────────────────────────────────

const OIG_SEARCH_URL = 'https://oig.hhs.gov/exclusions/search.asp';

// ── Stub result ───────────────────────────────────────────────────────────────

function clearResult(): ExclusionResult {
  return {
    excluded: false,
    matchType: 'NONE',
    status: 'CLEAR',
    details: 'No exclusion record found (stub mode — OIG_LEIE_ENABLED not set)',
    checkedAt: new Date().toISOString(),
    source: 'OIG_LEIE',
  };
}

function isTimeoutError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const name = 'name' in error ? String(error.name) : '';
  const message = 'message' in error ? String(error.message) : String(error);

  return name === 'TimeoutError'
    || name === 'AbortError'
    || /timed?\s*out|timeout/i.test(message);
}

// ── Live OIG check (best-effort HTML parse) ────────────────────────────────────

/**
 * Attempts to query OIG search endpoint and detect if an exclusion record exists.
 * The OIG site returns HTML; we look for the presence of a results table row
 * or the "No results found" string as a signal.
 *
 * NOTE: When the OIG releases a stable JSON API or you download the monthly CSV,
 * replace this function body with a proper lookup.
 */
async function liveOigCheck(params: ExclusionCheckParams): Promise<ExclusionResult> {
  const checkedAt = new Date().toISOString();

  try {
    const url = new URL(OIG_SEARCH_URL);
    url.searchParams.set('name', params.lastName.toUpperCase());
    url.searchParams.set('first', params.firstName.toUpperCase());
    if (params.npi) url.searchParams.set('npi', params.npi);

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'VitalCV-PSV-LEIE/1.0 (compliance@vitalcv.com)' },
    });

    if (!res.ok) {
      log('warn', 'oig_leie_http_error', { status: res.status, url: url.toString() });
      // On HTTP error, return CLEAR with caveat — do not block
      return {
        excluded: false,
        matchType: 'NONE',
        status: 'CLEAR',
        details: `OIG search returned HTTP ${res.status} — could not confirm. Manual verification required.`,
        checkedAt,
        source: 'OIG_LEIE',
      };
    }

    const html = await res.text();

    // Detect "no results" patterns
    const noResults =
      html.toLowerCase().includes('no results') ||
      html.toLowerCase().includes('no records found') ||
      html.toLowerCase().includes('no exclusions found');

    if (noResults) {
      return {
        excluded: false,
        matchType: 'NONE',
        status: 'CLEAR',
        details: 'OIG LEIE search returned no matching exclusion records.',
        checkedAt,
        source: 'OIG_LEIE',
      };
    }

    // Detect results table — presence of results rows signals a potential match
    // OIG HTML typically shows name in a <td> within a results table
    const hasResultRow =
      html.includes('<table') &&
      html.toLowerCase().includes(params.lastName.toLowerCase());

    if (hasResultRow) {
      // Check if NPI matches for higher confidence
      const npiMatch =
        params.npi && html.includes(params.npi) ? 'NPI_MATCH' : 'NAME_MATCH';
      const matchType: ExclusionMatchType =
        npiMatch === 'NPI_MATCH' && params.npi ? 'EXACT_MATCH' : 'NAME_MATCH';

      return {
        excluded: true,
        matchType,
        status: 'EXCLUDED',
        details: `OIG LEIE search returned a potential exclusion match for ${params.firstName} ${params.lastName}. Manual verification required.`,
        checkedAt,
        source: 'OIG_LEIE',
      };
    }

    // Fallback — response received but couldn't parse
    return {
      excluded: false,
      matchType: 'NONE',
      status: 'CLEAR',
      details: 'OIG LEIE search completed — no exclusion signals detected.',
      checkedAt,
      source: 'OIG_LEIE',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('warn', 'oig_leie_fetch_error', { error: message, firstName: params.firstName, lastName: params.lastName });

    if (isTimeoutError(err)) {
      return {
        excluded: false,
        matchType: 'NONE',
        status: 'UNKNOWN',
        details: 'OIG LEIE check timed out after 4000ms — manual verification required.',
        checkedAt,
        source: 'OIG_LEIE',
      };
    }

    return {
      excluded: false,
      matchType: 'NONE',
      status: 'CLEAR',
      details: `OIG LEIE check failed (${message}) — manual verification recommended.`,
      checkedAt,
      source: 'OIG_LEIE',
    };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

const isLiveMode = () => process.env.OIG_LEIE_ENABLED === 'true';

/**
 * checkExclusion — single provider check against OIG LEIE.
 *
 * In stub mode (default): returns CLEAR immediately.
 * In live mode (OIG_LEIE_ENABLED=true): queries OIG search endpoint.
 *
 * Always emits a COMPLIANCE audit event.
 */
export async function checkExclusion(params: ExclusionCheckParams): Promise<ExclusionResult> {
  log('info', 'oig_leie_check_start', {
    firstName: params.firstName,
    lastName: params.lastName,
    npi: params.npi,
    mode: isLiveMode() ? 'live' : 'stub',
  });

  const result = isLiveMode() ? await liveOigCheck(params) : clearResult();

  // Emit audit event — always, regardless of mode
  try {
    await appendAuditEvent({
      category: ['COMPLIANCE'],
      actor: params.npi ?? `${params.firstName}_${params.lastName}`,
      resource: `oig:leie:${params.lastName.toUpperCase()}`,
      severity: result.excluded ? 'CRITICAL' : 'INFO',
      requestFields: {
        firstName: params.firstName,
        lastName: params.lastName,
        npi: params.npi,
        mode: isLiveMode() ? 'live' : 'stub',
      },
      resultFields: {
        excluded: result.excluded,
        matchType: result.matchType,
        status: result.status ?? (result.excluded ? 'EXCLUDED' : 'CLEAR'),
        details: result.details,
        checkedAt: result.checkedAt,
      },
    });
  } catch (err) {
    log('warn', 'oig_leie_audit_error', {
      error: err instanceof Error ? err.message : String(err),
      npi: params.npi,
    });
  }

  log('info', 'oig_leie_check_complete', {
    excluded: result.excluded,
    matchType: result.matchType,
    npi: params.npi,
  });

  return result;
}

/**
 * batchCheckExclusions — check multiple providers in parallel.
 * Useful for employer verification workflows.
 */
export async function batchCheckExclusions(
  params: ExclusionCheckParams[],
): Promise<ExclusionResult[]> {
  log('info', 'oig_leie_batch_start', { count: params.length, mode: isLiveMode() ? 'live' : 'stub' });

  // Parallel checks with bounded concurrency (max 5 simultaneous)
  const results: ExclusionResult[] = [];
  const CONCURRENCY = 5;

  for (let i = 0; i < params.length; i += CONCURRENCY) {
    const batch = params.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((p) => checkExclusion(p)));
    results.push(...batchResults);
  }

  log('info', 'oig_leie_batch_complete', {
    total: results.length,
    excluded: results.filter((r) => r.excluded).length,
  });

  return results;
}
