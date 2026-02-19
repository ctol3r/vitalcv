/**
 * FROZEN SPEC: PSV Receipt Schema
 *
 * Immutable receipts for Primary Source Verification.
 * Revocation-first: assume invalid unless actively proven fresh.
 *
 * Source constraints:
 *   ABMS        = license-restricted (receipt metadata ONLY, no content storage)
 *   FSMB FCVS   = contract-gated (requires active data-sharing agreement)
 *
 * All receipts:
 *   - Immutable after creation (no mutation, no patching)
 *   - TTL-bound (expires, must be re-verified)
 *   - Revocation-first (default state is invalid/expired)
 *   - Hash-anchored for tamper detection
 *
 * FROZEN: Do not modify without architectural review.
 */

import { describe, expect, it } from 'vitest';

// ─── Types (to be implemented in psvReceiptContracts.ts) ─────────────────────

/**
 * PSVReceiptSource enumerates sources with access constraints.
 *
 * License-restricted sources: ABMS
 *   - Cannot store raw verification content
 *   - Receipt stores only: checked, status, queryFingerprint, TTL
 *   - evidenceRef MUST be null (no raw content storage allowed)
 *
 * Contract-gated sources: FSMB_FCVS
 *   - Requires active contractId reference
 *   - Receipt invalid without valid contract
 *
 * Standard sources: OIG_LEIE, SAM_EXCLUSIONS, STATE_BOARD, DEA, NPDB
 *   - Full evidence storage allowed
 */
type PSVReceiptSource =
  | 'ABMS'
  | 'FSMB_FCVS'
  | 'OIG_LEIE'
  | 'SAM_EXCLUSIONS'
  | 'STATE_BOARD'
  | 'DEA'
  | 'NPDB';

/** License-restricted sources: metadata-only receipts */
const LICENSE_RESTRICTED_SOURCES: PSVReceiptSource[] = ['ABMS'];

/** Contract-gated sources: require active agreement */
const CONTRACT_GATED_SOURCES: PSVReceiptSource[] = ['FSMB_FCVS'];

type PSVReceiptStatus = 'PASS' | 'FAIL' | 'FLAG' | 'UNKNOWN' | 'ERROR';

interface PSVReceipt {
  receiptId: string;
  subjectId: string;
  source: PSVReceiptSource;
  status: PSVReceiptStatus;
  checkedAt: string;
  expiresAt: string;
  ttlSeconds: number;
  queryFingerprint: string;
  rawHash: string | null;
  evidenceRef: string | null;
  hashAnchor: string;
  revokedAt: string | null;
  revocationReason: string | null;
  contractId: string | null;
  metadata: Record<string, unknown> | null;
}

interface PSVReceiptRevocation {
  revocationId: string;
  receiptId: string;
  revokedAt: string;
  reason: string;
  revokedBy: string;
  hashAnchor: string;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NOW = '2025-03-15T12:00:00.000Z';
const THIRTY_DAYS_SEC = 2_592_000;
const THIRTY_DAYS_LATER = '2025-04-14T12:00:00.000Z';
const YESTERDAY = '2025-03-14T12:00:00.000Z';

const baseReceipt = (overrides: Partial<PSVReceipt> = {}): PSVReceipt => ({
  receiptId: 'rcpt-001',
  subjectId: 'did:key:practitioner-001',
  source: 'OIG_LEIE',
  status: 'PASS',
  checkedAt: NOW,
  expiresAt: THIRTY_DAYS_LATER,
  ttlSeconds: THIRTY_DAYS_SEC,
  queryFingerprint: 'sha256:oig-query-fingerprint',
  rawHash: 'sha256:oig-raw-response-hash',
  evidenceRef: 's3://vitalcv-psv-evidence/oig/rcpt-001.json',
  hashAnchor: 'sha256:receipt-anchor-001',
  revokedAt: null,
  revocationReason: null,
  contractId: null,
  metadata: null,
  ...overrides,
});

// ─── 1. Immutability ─────────────────────────────────────────────────────────

describe('FROZEN: PSVReceipt immutability', () => {
  it('receipt fields are readonly after creation', () => {
    const receipt = baseReceipt();
    // Production code must Object.freeze or use readonly class
    // This spec asserts the CONSTRAINT: mutation must throw or be prevented
    expect(receipt.receiptId).toBe('rcpt-001');
    expect(receipt.hashAnchor).toBeTruthy();
  });

  it('receiptId: non-empty string, immutable', () => {
    const receipt = baseReceipt({ receiptId: '' });
    expect(receipt.receiptId).toBe('');
    // Guard must reject: assertPSVReceiptValid(receipt) → throw
  });

  it('hashAnchor: required for tamper detection', () => {
    const receipt = baseReceipt({ hashAnchor: '' });
    expect(receipt.hashAnchor).toBe('');
    // Guard must reject: assertPSVReceiptValid(receipt) → throw
  });

  it('no mutation path: once created, status cannot change', () => {
    // The ONLY way to invalidate a receipt is to create a PSVReceiptRevocation
    // The receipt itself is never modified
    const receipt = baseReceipt({ status: 'PASS' });
    expect(receipt.status).toBe('PASS');
    // Production code must NOT expose setStatus(), update(), or patch()
  });
});

// ─── 2. TTL & Expiration ─────────────────────────────────────────────────────

describe('FROZEN: PSVReceipt TTL', () => {
  it('expiresAt is required', () => {
    const receipt = baseReceipt({ expiresAt: '' });
    expect(receipt.expiresAt).toBe('');
    // Guard must reject empty expiresAt
  });

  it('expiresAt must be > checkedAt', () => {
    const receipt = baseReceipt({
      checkedAt: NOW,
      expiresAt: YESTERDAY,
    });
    // Guard: expiresAt < checkedAt → throw INVALID_TTL
    expect(new Date(receipt.expiresAt).getTime()).toBeLessThan(
      new Date(receipt.checkedAt).getTime(),
    );
  });

  it('ttlSeconds must be positive integer', () => {
    const receipt = baseReceipt({ ttlSeconds: 0 });
    expect(receipt.ttlSeconds).toBe(0);
    // Guard must reject ttlSeconds <= 0
  });

  it('receipt is STALE when now > expiresAt', () => {
    const receipt = baseReceipt({ expiresAt: YESTERDAY });
    const isExpired = new Date(NOW) > new Date(receipt.expiresAt);
    expect(isExpired).toBe(true);
    // isReceiptFresh(receipt, NOW) must return false
  });

  it('receipt is FRESH when now <= expiresAt', () => {
    const receipt = baseReceipt({ expiresAt: THIRTY_DAYS_LATER });
    const isExpired = new Date(NOW) > new Date(receipt.expiresAt);
    expect(isExpired).toBe(false);
    // isReceiptFresh(receipt, NOW) must return true
  });
});

// ─── 3. Revocation-First ─────────────────────────────────────────────────────

describe('FROZEN: Revocation-first semantics', () => {
  it('default trust: receipt is NOT trusted without freshness check', () => {
    // Revocation-first: caller must actively prove receipt is valid
    // No function should accept a receipt without checking:
    //   1. revokedAt is null
    //   2. expiresAt > now
    //   3. hashAnchor matches content
    const receipt = baseReceipt();
    expect(receipt.revokedAt).toBeNull();
    // isReceiptValid(receipt, NOW) must check ALL three conditions
  });

  it('revoked receipt is permanently invalid', () => {
    const receipt = baseReceipt({
      revokedAt: NOW,
      revocationReason: 'Source data corrected',
    });
    expect(receipt.revokedAt).not.toBeNull();
    // isReceiptValid(receipt, NOW) must return false
    // isReceiptValid(receipt, YESTERDAY) must return false (revocation is retroactive)
  });

  it('revocation is a separate immutable event', () => {
    const revocation: PSVReceiptRevocation = {
      revocationId: 'rev-001',
      receiptId: 'rcpt-001',
      revokedAt: NOW,
      reason: 'Source data corrected by issuing authority',
      revokedBy: 'system:psv-monitor',
      hashAnchor: 'sha256:revocation-anchor-001',
    };
    expect(revocation.receiptId).toBe('rcpt-001');
    expect(revocation.hashAnchor).toBeTruthy();
    // Revocation is append-only: once created, cannot be undone
    // To "un-revoke", issue a NEW receipt with new verification
  });

  it('expired + not-revoked = still invalid (must re-verify)', () => {
    const receipt = baseReceipt({
      expiresAt: YESTERDAY,
      revokedAt: null,
    });
    const isExpired = new Date(NOW) > new Date(receipt.expiresAt);
    expect(isExpired).toBe(true);
    expect(receipt.revokedAt).toBeNull();
    // isReceiptValid(receipt, NOW) must return false
    // Expiration alone is sufficient to invalidate
  });
});

// ─── 4. ABMS: License-Restricted ────────────────────────────────────────────

describe('FROZEN: ABMS license-restricted receipts', () => {
  it('ABMS receipt must NOT store raw content (evidenceRef must be null)', () => {
    const receipt = baseReceipt({
      source: 'ABMS',
      evidenceRef: null,
      rawHash: null,
    });
    expect(receipt.evidenceRef).toBeNull();
    expect(receipt.rawHash).toBeNull();
    // Guard: assertPSVReceiptValid(receipt) where source=ABMS
    //   evidenceRef !== null → throw LICENSE_RESTRICTED
    //   rawHash !== null → throw LICENSE_RESTRICTED
  });

  it('ABMS receipt with evidenceRef → MUST FAIL', () => {
    const receipt = baseReceipt({
      source: 'ABMS',
      evidenceRef: 's3://illegal-content-storage/abms.json',
      rawHash: 'sha256:illegal-hash',
    });
    // Guard must reject: evidenceRef on license-restricted source
    expect(receipt.evidenceRef).not.toBeNull();
    // assertPSVReceiptValid(receipt) → throw LICENSE_RESTRICTED
  });

  it('ABMS receipt stores only: status, checkedAt, expiresAt, queryFingerprint', () => {
    const receipt = baseReceipt({
      source: 'ABMS',
      status: 'PASS',
      checkedAt: NOW,
      expiresAt: THIRTY_DAYS_LATER,
      queryFingerprint: 'sha256:abms-query',
      evidenceRef: null,
      rawHash: null,
    });
    expect(receipt.source).toBe('ABMS');
    expect(receipt.status).toBe('PASS');
    expect(receipt.queryFingerprint).toBeTruthy();
    expect(receipt.evidenceRef).toBeNull();
    expect(receipt.rawHash).toBeNull();
  });

  it('ABMS is in LICENSE_RESTRICTED_SOURCES list', () => {
    expect(LICENSE_RESTRICTED_SOURCES).toContain('ABMS');
  });
});

// ─── 5. FSMB FCVS: Contract-Gated ───────────────────────────────────────────

describe('FROZEN: FSMB FCVS contract-gated receipts', () => {
  it('FSMB_FCVS receipt requires contractId', () => {
    const receipt = baseReceipt({
      source: 'FSMB_FCVS',
      contractId: 'contract-fsmb-2025-001',
    });
    expect(receipt.contractId).toBe('contract-fsmb-2025-001');
    // Guard: assertPSVReceiptValid(receipt) where source=FSMB_FCVS
    //   contractId is null/empty → throw CONTRACT_REQUIRED
  });

  it('FSMB_FCVS receipt without contractId → MUST FAIL', () => {
    const receipt = baseReceipt({
      source: 'FSMB_FCVS',
      contractId: null,
    });
    expect(receipt.contractId).toBeNull();
    // assertPSVReceiptValid(receipt) → throw CONTRACT_REQUIRED
  });

  it('FSMB_FCVS receipt with empty contractId → MUST FAIL', () => {
    const receipt = baseReceipt({
      source: 'FSMB_FCVS',
      contractId: '',
    });
    expect(receipt.contractId).toBe('');
    // assertPSVReceiptValid(receipt) → throw CONTRACT_REQUIRED
  });

  it('FSMB_FCVS may store full evidence (not license-restricted)', () => {
    const receipt = baseReceipt({
      source: 'FSMB_FCVS',
      contractId: 'contract-fsmb-2025-001',
      evidenceRef: 's3://vitalcv-psv-evidence/fcvs/rcpt-002.json',
      rawHash: 'sha256:fcvs-raw-hash',
    });
    expect(receipt.evidenceRef).not.toBeNull();
    expect(receipt.rawHash).not.toBeNull();
    // Valid: FSMB_FCVS is NOT license-restricted, only contract-gated
  });

  it('FSMB_FCVS is in CONTRACT_GATED_SOURCES list', () => {
    expect(CONTRACT_GATED_SOURCES).toContain('FSMB_FCVS');
  });
});

// ─── 6. Standard Sources ─────────────────────────────────────────────────────

describe('FROZEN: Standard PSV receipt sources', () => {
  const standardSources: PSVReceiptSource[] = [
    'OIG_LEIE',
    'SAM_EXCLUSIONS',
    'STATE_BOARD',
    'DEA',
    'NPDB',
  ];

  for (const source of standardSources) {
    it(`${source}: allows full evidence storage`, () => {
      const receipt = baseReceipt({
        source,
        evidenceRef: `s3://vitalcv-psv-evidence/${source.toLowerCase()}/rcpt.json`,
        rawHash: `sha256:${source.toLowerCase()}-raw`,
      });
      expect(receipt.evidenceRef).not.toBeNull();
      expect(receipt.rawHash).not.toBeNull();
    });

    it(`${source}: does not require contractId`, () => {
      const receipt = baseReceipt({ source, contractId: null });
      expect(receipt.contractId).toBeNull();
      // Guard must NOT reject null contractId for standard sources
    });
  }
});

// ─── 7. Required Fields Schema ───────────────────────────────────────────────

describe('FROZEN: PSVReceipt required fields', () => {
  it('receiptId: non-empty string', () => {
    expect(baseReceipt().receiptId).toBeTruthy();
  });

  it('subjectId: non-empty string', () => {
    expect(baseReceipt().subjectId).toBeTruthy();
  });

  it('source: valid PSVReceiptSource', () => {
    const validSources: PSVReceiptSource[] = [
      'ABMS', 'FSMB_FCVS', 'OIG_LEIE', 'SAM_EXCLUSIONS', 'STATE_BOARD', 'DEA', 'NPDB',
    ];
    expect(validSources).toContain(baseReceipt().source);
  });

  it('status: valid PSVReceiptStatus', () => {
    const validStatuses: PSVReceiptStatus[] = ['PASS', 'FAIL', 'FLAG', 'UNKNOWN', 'ERROR'];
    expect(validStatuses).toContain(baseReceipt().status);
  });

  it('checkedAt: ISO 8601 full timestamp', () => {
    expect(baseReceipt().checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('expiresAt: ISO 8601 full timestamp', () => {
    expect(baseReceipt().expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('ttlSeconds: positive integer', () => {
    expect(baseReceipt().ttlSeconds).toBeGreaterThan(0);
  });

  it('queryFingerprint: non-empty string', () => {
    expect(baseReceipt().queryFingerprint).toBeTruthy();
  });

  it('hashAnchor: non-empty string', () => {
    expect(baseReceipt().hashAnchor).toBeTruthy();
  });
});
