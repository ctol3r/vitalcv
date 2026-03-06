/**
 * sourceVerifier.ts — Wave 47 (updated Wave 122): Primary Source Verification Agent
 *
 * Strategy (two-tier):
 *   1. NPPES NPI Registry (https://npiregistry.cms.hhs.gov) — live, public, no API key.
 *      Verifies NPI existence, clinician name, and state of practice.
 *   2. STATE_BOARDS stub — fallback for license-number lookups while per-state
 *      adapters (services/adapters/stateBoards/) are being built.
 *
 * Production roadmap: replace STATE_BOARDS with real per-state scrapers/APIs.
 * Good third-party aggregators: Verisys, symplr, Medallion, ProCredEx.
 */

import { log } from '../../obs/logger';
import type { DocumentExtractionResult } from './documentPipeline';

// ── Types ──────────────────────────────────────────────────────────

export type BoardStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'REVOKED'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'NOT_FOUND';

export interface BoardRecord {
  npi: string;
  fullName: string;
  licenseNumber: string;
  licenseState: string;
  status: BoardStatus;
  expirationDate: string | null;
  boardName: string;
  lastVerifiedAt: string;
  rawResponse: Record<string, unknown>;
}

export interface VerificationComparison {
  fieldName: string;
  extractedValue: string;
  boardValue: string;
  matches: boolean;
}

export interface SourceVerificationResult {
  verified: boolean;
  boardRecord: BoardRecord | null;
  comparisons: VerificationComparison[];
  discrepancies: VerificationComparison[];
  overallMatch: boolean;
  verifiedAt: string;
}

// ── NPPES NPI Registry ─────────────────────────────────────────────
// Public API — no key required.
// Docs: https://npiregistry.cms.hhs.gov/api-page

const NPPES_API = 'https://npiregistry.cms.hhs.gov/api/?version=2.1';

interface NppesAddress {
  country_code: string;
  country_name: string;
  address_purpose: string;
  address_type: string;
  address_1: string;
  city: string;
  state: string;
  postal_code: string;
}

interface NppesBasic {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  name?: string;            // org
  organization_name?: string;
  status: string;           // "A" = Active
  credential?: string;
  gender?: string;
  enumeration_date?: string;
  last_updated?: string;
}

interface NppesResult {
  number: string;           // NPI
  enumeration_type: string; // NPI-1 (individual) or NPI-2 (org)
  basic: NppesBasic;
  addresses?: NppesAddress[];
  taxonomies?: Array<{ code: string; desc: string; primary: boolean; state?: string; license?: string }>;
}

interface NppesResponse {
  result_count: number;
  results: NppesResult[];
}

async function queryNppes(npi: string): Promise<NppesResult | null> {
  const url = `${NPPES_API}&number=${encodeURIComponent(npi)}`;

  log('info', 'nppes_lookup_start', { npi, url });

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'VitalCV/1.0 (vitalcv.com)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      log('warn', 'nppes_http_error', { npi, status: response.status });
      return null;
    }

    const data = (await response.json()) as NppesResponse;

    if (data.result_count === 0 || !data.results?.length) {
      log('info', 'nppes_not_found', { npi });
      return null;
    }

    log('info', 'nppes_lookup_success', { npi, resultCount: data.result_count });
    return data.results[0];
  } catch (err) {
    log('warn', 'nppes_lookup_failed', {
      npi,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function nppesResultToBoardRecord(result: NppesResult, licenseNumber: string, licenseState: string): BoardRecord {
  const { basic, addresses = [], taxonomies = [] } = result;

  // Build full name
  let fullName = '';
  if (basic.first_name) {
    fullName = [basic.first_name, basic.middle_name, basic.last_name]
      .filter(Boolean)
      .join(' ');
  } else if (basic.name || basic.organization_name) {
    fullName = basic.name ?? basic.organization_name ?? '';
  }

  // Primary practice state from LOCATION address
  const locationAddr = addresses.find((a) => a.address_purpose === 'LOCATION') ?? addresses[0];
  const practiceState = locationAddr?.state ?? licenseState;

  // Derive license info from taxonomy (first primary with state match, else first primary)
  const primaryTaxonomy =
    taxonomies.find((t) => t.primary && t.state === licenseState) ??
    taxonomies.find((t) => t.primary) ??
    taxonomies[0];

  const derivedLicense = primaryTaxonomy?.license ?? licenseNumber;
  const derivedState = primaryTaxonomy?.state ?? practiceState;

  // NPPES status: "A" = Active
  const status: BoardStatus = basic.status === 'A' ? 'ACTIVE' : 'INACTIVE';

  return {
    npi: result.number,
    fullName,
    licenseNumber: derivedLicense || licenseNumber,
    licenseState: derivedState || licenseState,
    status,
    expirationDate: null, // NPPES doesn't expose expiration; state board adapters will fill this
    boardName: `NPPES NPI Registry (NPI-${result.enumeration_type === 'NPI-1' ? '1 Individual' : '2 Organization'})`,
    lastVerifiedAt: new Date().toISOString(),
    rawResponse: result as unknown as Record<string, unknown>,
  };
}

// ── Fallback State Board Stubs ─────────────────────────────────────
// Used when: NPI lookup unavailable or license-level details needed.
// Replace individual entries with real per-state HTTP adapters as you build them.

interface StateBoardEntry {
  boardName: string;
  records: Record<string, Omit<BoardRecord, 'lastVerifiedAt' | 'rawResponse' | 'boardName'>>;
}

const STATE_BOARDS: Record<string, StateBoardEntry> = {
  CA: {
    boardName: 'Medical Board of California',
    records: {
      A123456: { npi: '1234567890', fullName: 'Jane A. Smith', licenseNumber: 'A123456', licenseState: 'CA', status: 'ACTIVE', expirationDate: '2026-01-15' },
    },
  },
  NY: {
    boardName: 'New York State Education Department',
    records: {
      NY98765: { npi: '9876543210', fullName: 'John B. Doe', licenseNumber: 'NY98765', licenseState: 'NY', status: 'ACTIVE', expirationDate: '2025-08-30' },
    },
  },
  TX: {
    boardName: 'Texas Medical Board',
    records: {
      TX55555: { npi: '5555555555', fullName: 'Maria C. Garcia', licenseNumber: 'TX55555', licenseState: 'TX', status: 'ACTIVE', expirationDate: '2027-03-01' },
    },
  },
  FL: {
    boardName: 'Florida Department of Health',
    records: {
      FL77777: { npi: '7777777777', fullName: 'Robert D. Chen', licenseNumber: 'FL77777', licenseState: 'FL', status: 'EXPIRED', expirationDate: '2024-06-15' },
    },
  },
};

async function queryStateBoard(licenseNumber: string, state: string): Promise<BoardRecord> {
  const stateBoard = STATE_BOARDS[state.toUpperCase()];
  if (!stateBoard) {
    log('warn', 'state_board_unknown', { state });
    return {
      npi: '', fullName: '', licenseNumber, licenseState: state,
      status: 'NOT_FOUND', expirationDate: null,
      boardName: `Unknown Board (${state})`,
      lastVerifiedAt: new Date().toISOString(),
      rawResponse: { error: 'state_not_supported', state },
    };
  }

  const record = stateBoard.records[licenseNumber];
  if (!record) {
    log('warn', 'state_board_license_not_found', { licenseNumber, state });
    return {
      npi: '', fullName: '', licenseNumber, licenseState: state,
      status: 'NOT_FOUND', expirationDate: null,
      boardName: stateBoard.boardName,
      lastVerifiedAt: new Date().toISOString(),
      rawResponse: { error: 'license_not_found', licenseNumber },
    };
  }

  return {
    ...record,
    boardName: stateBoard.boardName,
    lastVerifiedAt: new Date().toISOString(),
    rawResponse: { source: 'stub', board: stateBoard.boardName, queriedAt: new Date().toISOString(), ...record },
  };
}

// ── Comparison ─────────────────────────────────────────────────────

function normalizeForComparison(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function compareWithExtraction(
  extraction: DocumentExtractionResult,
  boardRecord: BoardRecord,
): VerificationComparison[] {
  const fieldMap: Record<string, string> = {};
  for (const ef of extraction.extractedFields) {
    if (ef.value) fieldMap[ef.field] = ef.value;
  }

  return [
    { fieldName: 'fullName', extracted: fieldMap['fullName'] ?? '', board: boardRecord.fullName },
    { fieldName: 'licenseNumber', extracted: fieldMap['licenseNumber'] ?? '', board: boardRecord.licenseNumber },
    { fieldName: 'licenseState', extracted: fieldMap['licenseState'] ?? '', board: boardRecord.licenseState },
    { fieldName: 'expirationDate', extracted: fieldMap['expirationDate'] ?? '', board: boardRecord.expirationDate ?? '' },
  ].map(({ fieldName, extracted, board }) => ({
    fieldName,
    extractedValue: extracted,
    boardValue: board,
    matches: extracted !== '' && board !== '' && normalizeForComparison(extracted) === normalizeForComparison(board),
  }));
}

// ── Orchestrated Verification ──────────────────────────────────────
// Priority: NPPES NPI (live) → state board stub (fallback)

async function verifyDocument(extraction: DocumentExtractionResult): Promise<SourceVerificationResult> {
  const fieldMap: Record<string, string> = {};
  for (const ef of extraction.extractedFields) {
    if (ef.value) fieldMap[ef.field] = ef.value;
  }

  const npi = fieldMap['npi'] ?? '';
  const licenseNumber = fieldMap['licenseNumber'] ?? '';
  const licenseState = fieldMap['licenseState'] ?? '';

  if (!licenseNumber || !licenseState) {
    log('warn', 'source_verifier_missing_fields', {
      documentId: extraction.documentId,
      hasNpi: Boolean(npi),
      hasLicenseNumber: Boolean(licenseNumber),
      hasLicenseState: Boolean(licenseState),
    });
    return { verified: false, boardRecord: null, comparisons: [], discrepancies: [], overallMatch: false, verifiedAt: new Date().toISOString() };
  }

  // Tier 1: NPPES NPI Registry (live)
  let boardRecord: BoardRecord | null = null;
  if (npi) {
    const nppes = await queryNppes(npi);
    if (nppes) {
      boardRecord = nppesResultToBoardRecord(nppes, licenseNumber, licenseState);
      log('info', 'source_verifier_nppes_used', { npi, status: boardRecord.status });
    }
  }

  // Tier 2: State board stub fallback
  if (!boardRecord) {
    log('info', 'source_verifier_fallback_to_stub', { licenseNumber, licenseState });
    boardRecord = await queryStateBoard(licenseNumber, licenseState);
  }

  if (boardRecord.status === 'NOT_FOUND') {
    return { verified: false, boardRecord, comparisons: [], discrepancies: [], overallMatch: false, verifiedAt: new Date().toISOString() };
  }

  const comparisons = compareWithExtraction(extraction, boardRecord);
  const discrepancies = comparisons.filter((c) => !c.matches);
  const overallMatch = discrepancies.length === 0 && boardRecord.status === 'ACTIVE';

  log('info', 'source_verifier_result', {
    documentId: extraction.documentId,
    licenseNumber,
    boardStatus: boardRecord.status,
    matchCount: comparisons.filter((c) => c.matches).length,
    discrepancyCount: discrepancies.length,
    overallMatch,
  });

  return { verified: overallMatch, boardRecord, comparisons, discrepancies, overallMatch, verifiedAt: new Date().toISOString() };
}

export const sourceVerifier = { queryStateBoard, queryNppes, compareWithExtraction, verifyDocument };
