/**
 * caBreezeLiveLookup.ts — live CA DCA BreEZe lookup for the physician
 * licensure launch lane.
 *
 * SHIPS DARK. This module is only reachable when STATE_BOARD_MODE=live,
 * which stays unset/sandbox until (a) the DCA public-search usage decision
 * is approved and (b) the parser has been validated against a real BreEZe
 * response. Until then every caller sees the connector's sandbox/gated
 * behavior, unchanged.
 *
 * Fail-closed contract:
 *   - The DCA search is name-based. The provider's legal name comes from
 *     the NPPES record for the NPI; if no individual name resolves, the
 *     lookup degrades (IDENTITY_UNRESOLVED) instead of guessing.
 *   - A response that does not look like a BreEZe results page (no results
 *     table, no no-results marker) degrades as PARSER_FAILURE. A WAF
 *     interstitial or a page redesign must never read as "no license".
 *   - A name search that finds nothing, or that matches conflicting
 *     records, returns NOT_AVAILABLE with no degradation reason so the
 *     launch lane cascades to FSMB / manual review. Absence from a fuzzy
 *     name search is never treated as proof of absence.
 *   - An unrecognized board status string degrades as PARSER_FAILURE.
 *   - Only an unambiguous Medical Board of California row produces a
 *     definitive status, and the board-reported status text is preserved
 *     verbatim in the source disclaimer for audit.
 */

import { log } from '../../../obs/logger';
import { fetchNppesProviderRecord } from '../../identity/nppesApi';
import type { StateBoardResult } from './stateBoardConnector';

export const CA_BREEZE_SEARCH_URL = 'https://search.dca.ca.gov/results';
const CA_BOARD_NAME = 'Medical Board of California';

/** Markers proving the HTML is a genuine BreEZe results page. */
const RESULTS_TABLE_MARKER = /searchresult/i;
const NO_RESULTS_MARKER = /no\s+(?:results|records)\s+(?:found|matched)/i;

const ROW_PATTERN = /<tr[^>]*class="[^"]*[Ss]earch[Rr]esult[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
const CELL_PATTERN = /<td[^>]*>([\s\S]*?)<\/td>/gi;

type BreezeRowStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'DELINQUENT'
  | 'CANCELLED'
  | 'SURRENDERED'
  | 'REVOKED'
  | 'UNRECOGNIZED';

interface BreezeRow {
  name: string;
  licenseNumber: string;
  licenseType: string;
  statusRaw: string;
  status: BreezeRowStatus;
  expirationDate: string | null;
}

export interface ProviderNameRecord {
  firstName: string;
  lastName: string;
}

export interface CaBreezeLookupDeps {
  fetchImpl?: typeof fetch;
  resolveProviderName?: (npi: string) => Promise<ProviderNameRecord | null>;
  timeoutMs?: number;
  now?: () => Date;
}

async function resolveProviderNameFromNppes(npi: string): Promise<ProviderNameRecord | null> {
  const record = await fetchNppesProviderRecord(npi);
  if (record.providerType !== 'INDIVIDUAL') return null;
  const firstName = record.firstName?.trim();
  const lastName = record.lastName?.trim();
  if (!firstName || !lastName) return null;
  return { firstName, lastName };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

function normalizeRowStatus(raw: string): BreezeRowStatus {
  const upper = raw.toUpperCase().trim();
  if (upper.includes('ACTIVE') && !upper.includes('INACTIVE')) return 'ACTIVE';
  if (upper.includes('INACTIVE')) return 'INACTIVE';
  if (upper.includes('DELINQUENT')) return 'DELINQUENT';
  if (upper.includes('CANCEL')) return 'CANCELLED';
  if (upper.includes('SURRENDER')) return 'SURRENDERED';
  if (upper.includes('REVOK')) return 'REVOKED';
  return 'UNRECOGNIZED';
}

/**
 * Map a board-reported row status to the connector's result status.
 * Adverse and lapsed states never widen toward ACTIVE:
 *   DELINQUENT / CANCELLED → EXPIRED (lapsed, not disciplinary)
 *   SURRENDERED / REVOKED → REVOKED (fails closed downstream)
 */
function toStateBoardStatus(
  status: Exclude<BreezeRowStatus, 'UNRECOGNIZED'>,
): StateBoardResult['licenseStatus'] {
  switch (status) {
    case 'ACTIVE':
      return 'ACTIVE';
    case 'INACTIVE':
      return 'INACTIVE';
    case 'DELINQUENT':
    case 'CANCELLED':
      return 'EXPIRED';
    case 'SURRENDERED':
    case 'REVOKED':
      return 'REVOKED';
  }
}

function isPhysicianLicenseType(licenseType: string): boolean {
  const upper = licenseType.toUpperCase();
  return (
    upper.includes('PHYSICIAN') ||
    upper.includes(' MD') ||
    upper.startsWith('MD') ||
    upper.includes(' DO') ||
    upper.startsWith('DO') ||
    upper.includes('OSTEOPATH')
  );
}

function nameMatches(resultName: string, name: ProviderNameRecord): boolean {
  const normalized = resultName.toUpperCase();
  return (
    normalized.includes(name.firstName.toUpperCase()) &&
    normalized.includes(name.lastName.toUpperCase())
  );
}

function parseBreezeRows(html: string, name: ProviderNameRecord): BreezeRow[] {
  const rows: BreezeRow[] = [];
  const rowPattern = new RegExp(ROW_PATTERN.source, 'gi');

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cellPattern = new RegExp(CELL_PATTERN.source, 'gi');
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      cells.push(stripHtml(cellMatch[1]).trim());
    }

    if (cells.length < 5) continue;

    const [rowName, licenseNumber, licenseType, statusRaw] = cells;
    const expirationDate = cells[5]?.trim() || null;
    if (!nameMatches(rowName, name)) continue;

    rows.push({
      name: rowName,
      licenseNumber,
      licenseType,
      statusRaw,
      status: normalizeRowStatus(statusRaw),
      expirationDate,
    });
  }

  return rows;
}

function baseResult(
  npi: string,
  now: Date,
  overrides: Partial<StateBoardResult>,
): StateBoardResult {
  return {
    npi,
    state: 'CA',
    licenseNumber: null,
    licenseStatus: 'NOT_AVAILABLE',
    licensee: null,
    expirationDate: null,
    boardName: CA_BOARD_NAME,
    lastVerifiedAt: now.toISOString(),
    sourceUrl: CA_BREEZE_SEARCH_URL,
    sourceMode: 'live',
    decisionGrade: false,
    degradationReason: null,
    sourceDisclaimer: null,
    ...overrides,
  };
}

export function createCaBreezeLiveLookup(deps: CaBreezeLookupDeps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const resolveProviderName = deps.resolveProviderName ?? resolveProviderNameFromNppes;
  const timeoutMs = deps.timeoutMs ?? 10_000;
  const now = deps.now ?? (() => new Date());

  return async function caBreezeLiveLookup(
    npi: string,
    licenseNumber?: string,
  ): Promise<StateBoardResult> {
    const checkedAt = now();

    let name: ProviderNameRecord | null = null;
    try {
      name = await resolveProviderName(npi);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return baseResult(npi, checkedAt, {
        degradationReason: 'IDENTITY_UNRESOLVED',
        sourceDisclaimer: `NPPES name resolution failed before the board search could run (${message}). Manual verification required.`,
      });
    }

    if (!name) {
      return baseResult(npi, checkedAt, {
        degradationReason: 'IDENTITY_UNRESOLVED',
        sourceDisclaimer:
          'No individual provider name could be resolved from NPPES for this NPI, so the name-based DCA BreEZe search cannot run. Manual verification required.',
      });
    }

    const formData = new URLSearchParams();
    formData.append('boardCode', '0');
    formData.append('licenseType', '0');
    formData.append('licenseNumber', licenseNumber ?? '');
    formData.append('firstName', name.firstName);
    formData.append('lastName', name.lastName);
    formData.append('registryNumber', '');

    let response: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      response = await fetchImpl(CA_BREEZE_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'VitalCV/1.0 (credentialing-readiness-check)',
        },
        body: formData.toString(),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      return baseResult(npi, checkedAt, {
        degradationReason: 'OUTAGE',
        sourceDisclaimer: isAbort
          ? 'DCA BreEZe search timed out. Manual verification required until the source recovers.'
          : `DCA BreEZe search failed (${error instanceof Error ? error.message : String(error)}). Manual verification required until the source recovers.`,
      });
    }

    if (!response.ok) {
      return baseResult(npi, checkedAt, {
        degradationReason: 'OUTAGE',
        sourceDisclaimer: `DCA BreEZe responded with HTTP ${response.status}. Manual verification required until the source recovers.`,
      });
    }

    const html = await response.text();
    const looksLikeResultsPage = RESULTS_TABLE_MARKER.test(html);
    const looksLikeNoResultsPage = NO_RESULTS_MARKER.test(html);

    if (!looksLikeResultsPage && !looksLikeNoResultsPage) {
      log('warn', 'ca_breeze: unrecognized response page shape', {
        npi,
        htmlLength: html.length,
      });
      return baseResult(npi, checkedAt, {
        degradationReason: 'PARSER_FAILURE',
        sourceDisclaimer:
          'DCA BreEZe returned a page the parser does not recognize (possible redesign or bot interstitial). Refusing to interpret it. Manual verification required.',
      });
    }

    const matchedRows = looksLikeResultsPage ? parseBreezeRows(html, name) : [];
    const requestedLicense = licenseNumber?.trim();
    const scopedRows = requestedLicense
      ? matchedRows.filter((row) => row.licenseNumber === requestedLicense)
      : matchedRows;
    const physicianRows = scopedRows.filter((row) => isPhysicianLicenseType(row.licenseType));

    if (physicianRows.length === 0) {
      return baseResult(npi, checkedAt, {
        // No degradation reason: the launch lane treats plain NOT_AVAILABLE
        // as "this lane could not resolve it" and cascades to FSMB/manual.
        sourceDisclaimer:
          'Name-based DCA BreEZe search found no unambiguous Medical Board of California record for this provider. Absence from a name search is not proof of absence — manual or FSMB verification required.',
      });
    }

    const distinctLicenseNumbers = new Set(physicianRows.map((row) => row.licenseNumber));
    if (distinctLicenseNumbers.size > 1) {
      return baseResult(npi, checkedAt, {
        sourceDisclaimer:
          'Multiple distinct Medical Board of California records match this provider name. A name search cannot disambiguate them. Manual verification required.',
      });
    }

    const row = physicianRows[0];
    if (row.status === 'UNRECOGNIZED') {
      return baseResult(npi, checkedAt, {
        degradationReason: 'PARSER_FAILURE',
        sourceDisclaimer: `DCA BreEZe reported a license status the parser does not recognize ("${row.statusRaw}"). Refusing to interpret it. Manual verification required.`,
      });
    }

    return baseResult(npi, checkedAt, {
      licenseNumber: row.licenseNumber,
      licenseStatus: toStateBoardStatus(row.status),
      licensee: row.name,
      expirationDate: row.expirationDate,
      decisionGrade: true,
      sourceDisclaimer: `Live DCA BreEZe public search, name-matched to the NPPES record. Board-reported status: "${row.statusRaw}".`,
    });
  };
}
