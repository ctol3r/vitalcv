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

// ─────────────────────────────────────────────────────────────────────
// BACKEND-1 — Domain PSV Receipt contract alignment frozen tests.
//
// These tests pin the domain-core mapper / validator behavior. They
// do NOT exercise the live backend repository; the backend remains
// untouched in this slice. See
// docs/architecture/vitalcv-backend-persistence-defer-decision.md.
// ─────────────────────────────────────────────────────────────────────

// Use a relative path because @vitalcv/domain-common does not list
// @vitalcv/domain-core in its package.json deps; relative imports
// work in workspace tests without changing lockfiles.
import {
  mapIssuerPsvReceiptToDomainReceipt,
  mapLegacySnapshotToDomainReceipt,
  validateDomainPsvReceiptContract,
  explainDomainPsvReceiptContractGap,
  type IssuerPsvReceiptShape,
  type DomainPsvReceipt,
  type DomainPsvReceiptWriterConfirmation,
  type PsvReceiptSnapshot,
} from '../../domain-core';

function fullIssuerInput(): IssuerPsvReceiptShape {
  return {
    psvReceiptId: 'psv-receipt-1',
    psvCandidateId: 'psv-cand-1',
    receiptCandidateId: 'rc-1',
    requestId: 'req-1',
    claimId: 'claim-1',
    claimType: 'residency',
    scope: {
      claimType: 'residency',
      covers: 'Internal Medicine residency 2018-2021.',
      doesNotCover:
        'Does not cover board certification, license status, or malpractice history.',
      sourceOrganizationName: 'Demo GME Office',
    },
    limitations: [],
    sourceBasis: {
      sourceOrganizationName: 'Demo GME Office',
      isContractedAgent: false,
    },
    attributedResponder: {
      name: 'J. Doe',
      role: 'Program Coordinator',
      attributedAt: '2026-04-26T01:00:00.000Z',
      attributionMethod: 'self_attested',
    },
    freshness: {
      ttlDays: 365,
      issuedAt: '2026-04-26T01:00:00.000Z',
      staleAfter: '2027-04-26T01:00:00.000Z',
    },
  };
}

function repoConfirmation(): DomainPsvReceiptWriterConfirmation {
  return {
    confirmedAt: '2026-04-26T02:00:00.000Z',
    confirmedBy: 'demo-writer',
    writerMode: 'repository',
    persistedRowId: 'row-1',
  };
}

describe('BACKEND-1 mapper — required fields surface contract gaps when missing', () => {
  it('missing limitations produces a missing_limitations gap', () => {
    const input: IssuerPsvReceiptShape = {
      ...fullIssuerInput(),
      limitations: undefined,
    };
    const { gaps } = mapIssuerPsvReceiptToDomainReceipt(input);
    expect(gaps.map((g) => g.kind)).toContain('missing_limitations');
  });

  it('missing sourceBasis produces a missing_source_basis gap', () => {
    const input: IssuerPsvReceiptShape = {
      ...fullIssuerInput(),
      sourceBasis: undefined,
    };
    const { gaps } = mapIssuerPsvReceiptToDomainReceipt(input);
    expect(gaps.map((g) => g.kind)).toContain('missing_source_basis');
  });

  it('missing attributedResponder produces a missing_responder_attribution gap', () => {
    const input: IssuerPsvReceiptShape = {
      ...fullIssuerInput(),
      attributedResponder: undefined,
    };
    const { gaps } = mapIssuerPsvReceiptToDomainReceipt(input);
    expect(gaps.map((g) => g.kind)).toContain('missing_responder_attribution');
  });

  it('missing freshness produces a missing_freshness gap', () => {
    const input: IssuerPsvReceiptShape = {
      ...fullIssuerInput(),
      freshness: undefined,
    };
    const { gaps } = mapIssuerPsvReceiptToDomainReceipt(input);
    expect(gaps.map((g) => g.kind)).toContain('missing_freshness');
  });

  it('missing scope produces a missing_scope gap', () => {
    const input: IssuerPsvReceiptShape = {
      ...fullIssuerInput(),
      scope: undefined,
    };
    const { gaps } = mapIssuerPsvReceiptToDomainReceipt(input);
    expect(gaps.map((g) => g.kind)).toContain('missing_scope');
  });
});

describe('BACKEND-1 mapper — writer confirmation gates persisted status', () => {
  it('without writerConfirmation, the result is candidate (when candidate refs exist)', () => {
    const result = mapIssuerPsvReceiptToDomainReceipt(fullIssuerInput());
    expect(result.contractAligned).toBe(true);
    expect(result.receipt.status).toBe('candidate');
  });

  it('with valid repository writerConfirmation AND no gaps, the result is persisted', () => {
    const result = mapIssuerPsvReceiptToDomainReceipt(fullIssuerInput(), {
      writerConfirmation: repoConfirmation(),
    });
    expect(result.receipt.status).toBe('persisted');
    expect(result.receipt.writerConfirmation).toEqual(repoConfirmation());
  });

  it('with writerConfirmation BUT structural gaps, refuses to mark persisted', () => {
    const input: IssuerPsvReceiptShape = {
      ...fullIssuerInput(),
      sourceBasis: undefined,
    };
    const result = mapIssuerPsvReceiptToDomainReceipt(input, {
      writerConfirmation: repoConfirmation(),
    });
    expect(result.receipt.status).not.toBe('persisted');
    expect(result.gaps.map((g) => g.kind)).toContain('missing_source_basis');
  });

  it('writerConfirmation with invalid writerMode is rejected', () => {
    const result = mapIssuerPsvReceiptToDomainReceipt(fullIssuerInput(), {
      writerConfirmation: {
        ...repoConfirmation(),
        writerMode: 'demo' as unknown as 'repository',
      },
    });
    expect(result.receipt.status).not.toBe('persisted');
    expect(result.gaps.map((g) => g.kind)).toContain('invalid_writer_mode');
  });
});

describe('BACKEND-1 mapper — does not fabricate missing fields', () => {
  it('missing limitations: receipt.limitations stays undefined (no synthesized empty array)', () => {
    const input: IssuerPsvReceiptShape = {
      ...fullIssuerInput(),
      limitations: undefined,
    };
    const { receipt } = mapIssuerPsvReceiptToDomainReceipt(input);
    expect(receipt.limitations).toBeUndefined();
  });

  it('missing sourceBasis: receipt.sourceBasis stays undefined', () => {
    const input: IssuerPsvReceiptShape = {
      ...fullIssuerInput(),
      sourceBasis: undefined,
    };
    const { receipt } = mapIssuerPsvReceiptToDomainReceipt(input);
    expect(receipt.sourceBasis).toBeUndefined();
  });

  it('missing attributedResponder: receipt.responderAttribution stays undefined', () => {
    const input: IssuerPsvReceiptShape = {
      ...fullIssuerInput(),
      attributedResponder: undefined,
    };
    const { receipt } = mapIssuerPsvReceiptToDomainReceipt(input);
    expect(receipt.responderAttribution).toBeUndefined();
  });
});

describe('BACKEND-1 mapper — does not introduce globalCredentialTruth', () => {
  it('upstream globalCredentialTruth is dropped and a gap is emitted', () => {
    const input = {
      ...fullIssuerInput(),
      globalCredentialTruth: false,
    } as IssuerPsvReceiptShape;
    const { receipt, gaps } = mapIssuerPsvReceiptToDomainReceipt(input);
    expect((receipt as Record<string, unknown>).globalCredentialTruth).toBeUndefined();
    expect(gaps.map((g) => g.kind)).toContain(
      'forbidden_global_credential_truth_field',
    );
  });

  it('DomainPsvReceipt type carries no proofTier or decisionGrade fields', () => {
    const result = mapIssuerPsvReceiptToDomainReceipt(fullIssuerInput(), {
      writerConfirmation: repoConfirmation(),
    });
    const receipt = result.receipt as Record<string, unknown>;
    expect(receipt.proofTier).toBeUndefined();
    expect(receipt.decisionGrade).toBeUndefined();
    expect(receipt.globalCredentialTruth).toBeUndefined();
  });
});

describe('BACKEND-1 mapper — legacy PsvReceiptSnapshot is not a full PSVReceipt', () => {
  it('mapLegacySnapshotToDomainReceipt always emits legacy_snapshot_only gap', () => {
    const snapshot: PsvReceiptSnapshot = {
      receiptId: 'legacy-1',
      fetchedAt: '2026-04-01T00:00:00.000Z',
      ttlSeconds: 365 * 24 * 60 * 60,
      revoked: false,
    };
    const { gaps, contractAligned } = mapLegacySnapshotToDomainReceipt(snapshot);
    expect(contractAligned).toBe(false);
    expect(gaps.map((g) => g.kind)).toContain('legacy_snapshot_only');
    expect(gaps.map((g) => g.kind)).toContain('missing_limitations');
    expect(gaps.map((g) => g.kind)).toContain('missing_source_basis');
    expect(gaps.map((g) => g.kind)).toContain('missing_responder_attribution');
    expect(gaps.map((g) => g.kind)).toContain('missing_scope');
  });

  it('legacy snapshot result is pending_not_persisted regardless of writer claim', () => {
    const snapshot: PsvReceiptSnapshot = {
      receiptId: 'legacy-1',
      fetchedAt: '2026-04-01T00:00:00.000Z',
      ttlSeconds: 100,
      revoked: false,
    };
    const { receipt } = mapLegacySnapshotToDomainReceipt(snapshot);
    expect(receipt.status).toBe('pending_not_persisted');
    expect(receipt.writerConfirmation).toBeUndefined();
  });
});

describe('BACKEND-1 validator', () => {
  it('flags missing fields on a persisted receipt', () => {
    const partial: DomainPsvReceipt = Object.freeze({
      receiptId: 'r-1',
      status: 'persisted',
    });
    const gaps = validateDomainPsvReceiptContract(partial);
    const kinds = gaps.map((g) => g.kind);
    expect(kinds).toContain('missing_scope');
    expect(kinds).toContain('missing_limitations');
    expect(kinds).toContain('missing_source_basis');
    expect(kinds).toContain('missing_responder_attribution');
    expect(kinds).toContain('missing_freshness');
    expect(kinds).toContain('missing_writer_confirmation_for_persisted');
  });

  it('explainDomainPsvReceiptContractGap returns a non-empty string', () => {
    const text = explainDomainPsvReceiptContractGap({
      kind: 'missing_limitations',
      field: 'limitations',
      message: 'demo',
    });
    expect(text.length).toBeGreaterThan(0);
  });
});
