/**
 * California State Board License Adapter — wave-119
 *
 * Checks the California DCA BREEZE system for active license status.
 * Endpoint: https://search.dca.ca.gov/results
 *
 * This is a REAL source adapter — no simulated data.
 * The DCA search is publicly accessible (no API key required).
 *
 * Coverage: Medical Board of California (MBC), Board of Registered Nursing (BRN),
 * Board of Behavioral Sciences (BBS), and other DCA-regulated boards.
 */

import { SourceStatus } from '../../trust-contract/src/index';

// ─── Types ────────────────────────────────────────────────────────

export interface CaBoardLookupInput {
  firstName: string;
  lastName: string;
  licenseType?: string; // e.g. 'physician', 'rn', 'bbs'
}

export interface CaBoardLicenseResult {
  status: SourceStatus;
  raw: unknown;
  licenses: CaBoardLicense[];
  checkedAt: number;
  source: 'ca-dca-breeze';
  error?: string;
}

export interface CaBoardLicense {
  licenseNumber: string;
  licenseType: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DELINQUENT' | 'CANCELLED' | 'SURRENDERED' | 'REVOKED' | 'UNKNOWN';
  issueDate: string | null;
  expirationDate: string | null;
  board: string;
  name: string;
  city: string | null;
  state: string | null;
}

// ─── DCA Search URL ────────────────────────────────────────────────

const DCA_SEARCH_URL = 'https://search.dca.ca.gov/results';

// ─── Adapter ──────────────────────────────────────────────────────

export async function fetchCaBoardLicense(
  input: CaBoardLookupInput,
  timeoutMs = 10000
): Promise<CaBoardLicenseResult> {
  const checkedAt = Date.now();

  try {
    // DCA BREEZE uses form-encoded POST for search
    const formData = new URLSearchParams();
    formData.append('boardCode', '0'); // 0 = all boards
    formData.append('licenseType', '0');
    formData.append('licenseNumber', '');
    formData.append('firstName', input.firstName);
    formData.append('lastName', input.lastName);
    formData.append('registryNumber', '');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(DCA_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'VitalCV/1.0 (credentialing-readiness-check)',
      },
      body: formData.toString(),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      return {
        status: SourceStatus.UNAVAILABLE,
        raw: { httpStatus: response.status },
        licenses: [],
        checkedAt,
        source: 'ca-dca-breeze',
        error: `DCA responded with HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const licenses = parseBreezeLicenses(html, input);

    if (licenses.length === 0) {
      return {
        status: SourceStatus.CHECKED,
        raw: { resultCount: 0, htmlLength: html.length },
        licenses: [],
        checkedAt,
        source: 'ca-dca-breeze',
      };
    }

    // Check for adverse signals
    const hasRevoked = licenses.some(l =>
      l.status === 'REVOKED' || l.status === 'SURRENDERED' || l.status === 'CANCELLED'
    );

    return {
      status: hasRevoked ? SourceStatus.BLOCKED_SIGNAL : SourceStatus.CHECKED,
      raw: { resultCount: licenses.length, htmlLength: html.length },
      licenses,
      checkedAt,
      source: 'ca-dca-breeze',
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        status: SourceStatus.UNAVAILABLE,
        raw: null,
        licenses: [],
        checkedAt,
        source: 'ca-dca-breeze',
        error: 'DCA BREEZE request timed out',
      };
    }

    return {
      status: SourceStatus.UNAVAILABLE,
      raw: null,
      licenses: [],
      checkedAt,
      source: 'ca-dca-breeze',
      error: err.message ?? 'Unknown error',
    };
  }
}

// ─── HTML Parser (BREEZE returns HTML, not JSON) ──────────────────

function parseBreezeLicenses(html: string, input: CaBoardLookupInput): CaBoardLicense[] {
  const licenses: CaBoardLicense[] = [];

  // BREEZE results are in a table with class "searchResults"
  // Each row has: Name, License Number, License Type, Status, City, State, Expiration Date
  // Parse using regex — no DOM parser available in server-side Node without extra deps.

  // Match result rows: <tr class="SearchResults"> ... </tr>
  const rowPattern = /<tr[^>]*class="[^"]*[Ss]earch[Rr]esult[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let rowMatch;
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowHtml)) !== null) {
      cells.push(stripHtml(cellMatch[1]).trim());
    }
    // Reset cellPattern lastIndex for next row
    cellPattern.lastIndex = 0;

    if (cells.length >= 5) {
      const name = cells[0];
      const licenseNumber = cells[1];
      const licenseType = cells[2];
      const statusRaw = cells[3];
      const cityState = cells[4] || '';
      const expDate = cells[5] || null;

      // Only include if name matches input (fuzzy)
      if (nameMatches(name, input.firstName, input.lastName)) {
        licenses.push({
          licenseNumber,
          licenseType,
          status: normalizeStatus(statusRaw),
          issueDate: null, // Not in search results table
          expirationDate: expDate || null,
          board: extractBoard(licenseType),
          name,
          city: cityState.split(',')[0]?.trim() || null,
          state: cityState.split(',')[1]?.trim() || 'CA',
        });
      }
    }
  }

  return licenses;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
}

function nameMatches(resultName: string, firstName: string, lastName: string): boolean {
  const norm = resultName.toUpperCase();
  return norm.includes(firstName.toUpperCase()) && norm.includes(lastName.toUpperCase());
}

function normalizeStatus(raw: string): CaBoardLicense['status'] {
  const upper = raw.toUpperCase().trim();
  if (upper.includes('ACTIVE') && !upper.includes('INACTIVE')) return 'ACTIVE';
  if (upper.includes('INACTIVE') || upper.includes('DELINQUENT')) return 'DELINQUENT';
  if (upper.includes('CANCEL')) return 'CANCELLED';
  if (upper.includes('SURRENDER')) return 'SURRENDERED';
  if (upper.includes('REVOK')) return 'REVOKED';
  return 'UNKNOWN';
}

function extractBoard(licenseType: string): string {
  const upper = licenseType.toUpperCase();
  if (upper.includes('MD') || upper.includes('PHYSICIAN') || upper.includes('DO')) return 'Medical Board of California';
  if (upper.includes('RN') || upper.includes('NURS')) return 'Board of Registered Nursing';
  if (upper.includes('LVN')) return 'Board of Vocational Nursing';
  if (upper.includes('PA') || upper.includes('PHYSICIAN ASSISTANT')) return 'Physician Assistant Board';
  if (upper.includes('BBS') || upper.includes('LCSW') || upper.includes('MFT') || upper.includes('LPCC')) return 'Board of Behavioral Sciences';
  return 'California DCA';
}
