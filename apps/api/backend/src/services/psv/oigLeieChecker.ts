/**
 * oigLeieChecker.ts — Wave 241
 *
 * OIG/LEIE (List of Excluded Individuals/Entities) exclusion check service.
 * Anyone on this list is barred from participating in federal healthcare programs.
 * Employers MUST check this before hiring.
 *
 * Modes:
 *   - CSV mode (default): uses the monthly LEIE CSV cache
 *   - Disabled mode (OIG_LEIE_ENABLED='false'): returns UNCHECKED and requires manual review
 *
 * Source of truth:
 *   https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv
 *
 * Audit: every check emits a COMPLIANCE event.
 */

import { appendAuditEvent } from '../audit/auditLedger';
import { log } from '../../obs/logger';
import { lookupProvider } from '../identity/leieCache';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExclusionMatchType = 'EXACT' | 'STRONG_FUZZY' | 'WEAK' | 'NONE' | 'UNCHECKED';

export interface ExclusionResult {
  excluded: boolean;
  matchType: ExclusionMatchType;
  matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCERTAIN';
  status: 'CLEAR' | 'EXCLUDED' | 'POSSIBLE_MATCH' | 'UNCHECKED';
  details: string;
  checkedAt: string;
  source: 'OIG_LEIE';
  leieVersionDate: string | null;
  dataVersion: string | null;
  cacheAge: 'fresh' | 'stale' | 'unavailable';
  sourceLatency: 'MONTHLY';
  dataFreshness: 'MONTHLY';
}

export interface ExclusionCheckParams {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  npi?: string;
  state?: string | null;
  specialty?: string | null;
}

const OIG_LOOKUP_TIMEOUT_MS = 4_000;

// ── Disabled / unchecked result ──────────────────────────────────────────────

function uncheckedResult(details: string): ExclusionResult {
  return {
    excluded: false,
    matchType: 'UNCHECKED',
    matchConfidence: 'UNCERTAIN',
    status: 'UNCHECKED',
    details,
    checkedAt: new Date().toISOString(),
    source: 'OIG_LEIE',
    leieVersionDate: null,
    dataVersion: null,
    cacheAge: 'unavailable',
    sourceLatency: 'MONTHLY',
    dataFreshness: 'MONTHLY',
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

// ── Live OIG check (CSV-backed) ───────────────────────────────────────────────

/**
 * Queries the monthly LEIE CSV cache and preserves fail-closed semantics:
 * exact NPI matches become EXCLUDED; fuzzy name matches remain POSSIBLE_MATCH;
 * cache or lookup failures become UNCHECKED rather than silent clears.
 */
async function liveOigCheck(params: ExclusionCheckParams): Promise<ExclusionResult> {
  try {
    const lookup = lookupProvider({
      npi: params.npi ?? '',
      firstName: params.firstName,
      middleName: params.middleName ?? null,
      lastName: params.lastName,
      state: params.state ?? null,
      specialty: params.specialty ?? null,
    });
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' })), OIG_LOOKUP_TIMEOUT_MS);
    });
    const result = await Promise.race([lookup, timeout]);

    if (result.cacheAge !== 'fresh') {
      return {
        excluded: false,
        matchType: 'UNCHECKED',
        matchConfidence: 'UNCERTAIN',
        status: 'UNCHECKED',
        details:
          result.cacheAge === 'stale'
            ? 'LEIE monthly CSV cache is stale. Do not treat this as current exclusion truth until it is refreshed or manually verified.'
            : 'LEIE monthly CSV could not be loaded in time. Manual verification required.',
        checkedAt: result.checkedAt,
        source: 'OIG_LEIE',
        leieVersionDate: result.leieVersionDate,
        dataVersion: result.dataVersion,
        cacheAge: result.cacheAge,
        sourceLatency: result.sourceLatency,
        dataFreshness: 'MONTHLY',
      };
    }

    if (result.verdict === 'EXCLUDED') {
      return {
        excluded: true,
        matchType: result.matchType,
        matchConfidence: result.matchConfidence,
        status: 'EXCLUDED',
        details:
          result.matchType === 'EXACT'
            ? 'Exact NPI match found in the current monthly LEIE CSV snapshot.'
            : 'LEIE exclusion record found in the current monthly CSV snapshot.',
        checkedAt: result.checkedAt,
        source: 'OIG_LEIE',
        leieVersionDate: result.leieVersionDate,
        dataVersion: result.dataVersion,
        cacheAge: result.cacheAge,
        sourceLatency: result.sourceLatency,
        dataFreshness: 'MONTHLY',
      };
    }

    if (result.verdict === 'POSSIBLE_MATCH') {
      const matchedFields = result.matchedFields.join(', ') || 'name fields';
      return {
        excluded: false,
        matchType: result.matchType,
        matchConfidence: result.matchConfidence,
        status: 'POSSIBLE_MATCH',
        details: `Possible LEIE match from the monthly CSV (${result.matchConfidence} confidence; matched ${matchedFields}). Manual review required.`,
        checkedAt: result.checkedAt,
        source: 'OIG_LEIE',
        leieVersionDate: result.leieVersionDate,
        dataVersion: result.dataVersion,
        cacheAge: result.cacheAge,
        sourceLatency: result.sourceLatency,
        dataFreshness: 'MONTHLY',
      };
    }

    if (result.verdict === 'UNCHECKED') {
      return {
        excluded: false,
        matchType: 'UNCHECKED',
        matchConfidence: 'UNCERTAIN',
        status: 'UNCHECKED',
        details: 'LEIE lookup did not complete cleanly. Manual verification required.',
        checkedAt: result.checkedAt,
        source: 'OIG_LEIE',
        leieVersionDate: result.leieVersionDate,
        dataVersion: result.dataVersion,
        cacheAge: result.cacheAge,
        sourceLatency: result.sourceLatency,
        dataFreshness: 'MONTHLY',
      };
    }

    return {
      excluded: false,
      matchType: result.matchType,
      matchConfidence: result.matchConfidence,
      status: 'CLEAR',
      details:
        'No exclusion record found in the current monthly LEIE CSV snapshot. This is monthly batch exclusion data, not a real-time clearance feed.',
      checkedAt: result.checkedAt,
      source: 'OIG_LEIE',
      leieVersionDate: result.leieVersionDate,
      dataVersion: result.dataVersion,
      cacheAge: result.cacheAge,
      sourceLatency: result.sourceLatency,
      dataFreshness: 'MONTHLY',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('warn', 'oig_leie_fetch_error', { error: message, firstName: params.firstName, lastName: params.lastName });

    if (isTimeoutError(err)) {
      return {
        excluded: false,
        matchType: 'UNCHECKED',
        matchConfidence: 'UNCERTAIN',
        status: 'UNCHECKED',
        details: `LEIE lookup timed out after ${OIG_LOOKUP_TIMEOUT_MS}ms — manual verification required.`,
        checkedAt: new Date().toISOString(),
        source: 'OIG_LEIE',
        leieVersionDate: null,
        dataVersion: null,
        cacheAge: 'unavailable',
        sourceLatency: 'MONTHLY',
        dataFreshness: 'MONTHLY',
      };
    }

    return {
      excluded: false,
      matchType: 'UNCHECKED',
      matchConfidence: 'UNCERTAIN',
      status: 'UNCHECKED',
      details: `LEIE lookup failed (${message}) — manual verification required.`,
      checkedAt: new Date().toISOString(),
      source: 'OIG_LEIE',
      leieVersionDate: null,
      dataVersion: null,
      cacheAge: 'unavailable',
      sourceLatency: 'MONTHLY',
      dataFreshness: 'MONTHLY',
    };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

const isLookupEnabled = () => process.env.OIG_LEIE_ENABLED !== 'false';

/**
 * checkExclusion — single provider check against OIG LEIE.
 *
 * In disabled mode (OIG_LEIE_ENABLED='false'): returns UNCHECKED immediately.
 * Otherwise: queries the monthly LEIE CSV cache.
 *
 * Always emits a COMPLIANCE audit event.
 */
export async function checkExclusion(params: ExclusionCheckParams): Promise<ExclusionResult> {
  log('info', 'oig_leie_check_start', {
    firstName: params.firstName,
    middleName: params.middleName,
    lastName: params.lastName,
    npi: params.npi,
    state: params.state,
    specialty: params.specialty,
    mode: isLookupEnabled() ? 'csv' : 'disabled',
  });

  const result = isLookupEnabled()
    ? await liveOigCheck(params)
    : uncheckedResult('LEIE lookup is disabled. Monthly CSV verification was not performed.');

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
        middleName: params.middleName,
        npi: params.npi,
        state: params.state,
        specialty: params.specialty,
        mode: isLookupEnabled() ? 'csv' : 'disabled',
      },
      resultFields: {
        excluded: result.excluded,
        matchType: result.matchType,
        matchConfidence: result.matchConfidence,
        status: result.status,
        details: result.details,
        checkedAt: result.checkedAt,
        leieVersionDate: result.leieVersionDate,
        dataVersion: result.dataVersion,
        cacheAge: result.cacheAge,
        sourceLatency: result.sourceLatency,
        dataFreshness: result.dataFreshness,
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
  log('info', 'oig_leie_batch_start', { count: params.length, mode: isLookupEnabled() ? 'csv' : 'disabled' });

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
