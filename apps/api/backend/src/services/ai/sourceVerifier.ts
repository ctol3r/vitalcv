/**
 * sourceVerifier.ts — Wave 47: Primary Source Verification Agent
 *
 * Automatically queries state medical board registries to verify
 * extracted license data against the authoritative source of truth.
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

// ── Stub Board Data ────────────────────────────────────────────────

interface StateBoardEntry {
  boardName: string;
  records: Record<string, Omit<BoardRecord, 'lastVerifiedAt' | 'rawResponse' | 'boardName'>>;
}

/**
 * TODO: Production implementation — replace these canned records with
 * real HTTP calls to state medical board APIs, web scrapers, or a
 * third-party PSV aggregator (e.g. Verisys, symplr). Each state has a
 * different API surface; the adapter pattern in services/adapters/ is the
 * right place for per-state implementations.
 */
const STATE_BOARDS: Record<string, StateBoardEntry> = {
  CA: {
    boardName: 'Medical Board of California',
    records: {
      A123456: {
        npi: '1234567890',
        fullName: 'Jane A. Smith',
        licenseNumber: 'A123456',
        licenseState: 'CA',
        status: 'ACTIVE',
        expirationDate: '2026-01-15',
      },
    },
  },
  NY: {
    boardName: 'New York State Education Department',
    records: {
      NY98765: {
        npi: '9876543210',
        fullName: 'John B. Doe',
        licenseNumber: 'NY98765',
        licenseState: 'NY',
        status: 'ACTIVE',
        expirationDate: '2025-08-30',
      },
    },
  },
  TX: {
    boardName: 'Texas Medical Board',
    records: {
      TX55555: {
        npi: '5555555555',
        fullName: 'Maria C. Garcia',
        licenseNumber: 'TX55555',
        licenseState: 'TX',
        status: 'ACTIVE',
        expirationDate: '2027-03-01',
      },
    },
  },
  FL: {
    boardName: 'Florida Department of Health',
    records: {
      FL77777: {
        npi: '7777777777',
        fullName: 'Robert D. Chen',
        licenseNumber: 'FL77777',
        licenseState: 'FL',
        status: 'EXPIRED',
        expirationDate: '2024-06-15',
      },
    },
  },
};

// ── Board Query ────────────────────────────────────────────────────

async function queryStateBoard(
  licenseNumber: string,
  state: string,
): Promise<BoardRecord> {
  log('info', 'source_verifier_board_query', { licenseNumber, state });

  const stateBoard = STATE_BOARDS[state.toUpperCase()];
  if (!stateBoard) {
    log('warn', 'source_verifier_unknown_state', { state });
    return {
      npi: '',
      fullName: '',
      licenseNumber,
      licenseState: state,
      status: 'NOT_FOUND',
      expirationDate: null,
      boardName: `Unknown Board (${state})`,
      lastVerifiedAt: new Date().toISOString(),
      rawResponse: { error: 'state_not_supported', state },
    };
  }

  const record = stateBoard.records[licenseNumber];
  if (!record) {
    log('warn', 'source_verifier_license_not_found', { licenseNumber, state });
    return {
      npi: '',
      fullName: '',
      licenseNumber,
      licenseState: state,
      status: 'NOT_FOUND',
      expirationDate: null,
      boardName: stateBoard.boardName,
      lastVerifiedAt: new Date().toISOString(),
      rawResponse: { error: 'license_not_found', licenseNumber, board: stateBoard.boardName },
    };
  }

  const boardRecord: BoardRecord = {
    ...record,
    boardName: stateBoard.boardName,
    lastVerifiedAt: new Date().toISOString(),
    rawResponse: {
      source: 'stub',
      board: stateBoard.boardName,
      queriedAt: new Date().toISOString(),
      ...record,
    },
  };

  log('info', 'source_verifier_board_record_found', {
    licenseNumber,
    state,
    status: boardRecord.status,
  });

  return boardRecord;
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

  const comparisons: VerificationComparison[] = [];

  const pairsToCompare: Array<{ fieldName: string; extracted: string; board: string }> = [
    { fieldName: 'fullName', extracted: fieldMap['fullName'] ?? '', board: boardRecord.fullName },
    { fieldName: 'licenseNumber', extracted: fieldMap['licenseNumber'] ?? '', board: boardRecord.licenseNumber },
    { fieldName: 'licenseState', extracted: fieldMap['licenseState'] ?? '', board: boardRecord.licenseState },
    { fieldName: 'expirationDate', extracted: fieldMap['expirationDate'] ?? '', board: boardRecord.expirationDate ?? '' },
  ];

  for (const pair of pairsToCompare) {
    const matches =
      pair.extracted !== '' &&
      pair.board !== '' &&
      normalizeForComparison(pair.extracted) === normalizeForComparison(pair.board);

    comparisons.push({
      fieldName: pair.fieldName,
      extractedValue: pair.extracted,
      boardValue: pair.board,
      matches,
    });
  }

  return comparisons;
}

// ── Orchestrated Verification ──────────────────────────────────────

async function verifyDocument(
  extraction: DocumentExtractionResult,
): Promise<SourceVerificationResult> {
  const fieldMap: Record<string, string> = {};
  for (const ef of extraction.extractedFields) {
    if (ef.value) fieldMap[ef.field] = ef.value;
  }

  const licenseNumber = fieldMap['licenseNumber'] ?? '';
  const licenseState = fieldMap['licenseState'] ?? '';

  if (!licenseNumber || !licenseState) {
    log('warn', 'source_verifier_missing_fields', {
      documentId: extraction.documentId,
      hasLicenseNumber: Boolean(licenseNumber),
      hasLicenseState: Boolean(licenseState),
    });

    return {
      verified: false,
      boardRecord: null,
      comparisons: [],
      discrepancies: [],
      overallMatch: false,
      verifiedAt: new Date().toISOString(),
    };
  }

  const boardRecord = await queryStateBoard(licenseNumber, licenseState);

  if (boardRecord.status === 'NOT_FOUND') {
    return {
      verified: false,
      boardRecord,
      comparisons: [],
      discrepancies: [],
      overallMatch: false,
      verifiedAt: new Date().toISOString(),
    };
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

  return {
    verified: overallMatch,
    boardRecord,
    comparisons,
    discrepancies,
    overallMatch,
    verifiedAt: new Date().toISOString(),
  };
}

export const sourceVerifier = { queryStateBoard, compareWithExtraction, verifyDocument };
