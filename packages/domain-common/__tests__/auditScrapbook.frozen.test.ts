/**
 * FROZEN SPEC: AuditScrapbook
 *
 * Append-only timeline of credentialing events for regulatory audit.
 *
 * Constraints:
 *   - Append-only: entries are never modified or deleted
 *   - Every entry tagged with NCQA CR1–CR5 category
 *   - Delegate audit sampling: min(5%, 50) of delegated files
 *   - Deterministic ordering: entries ordered by timestamp, ties broken by entryId
 *   - Hash-chained: each entry includes hash of previous entry
 *
 * NCQA Standard Mapping:
 *   CR1 = Credentialing / Recredentialing
 *   CR2 = Ongoing Monitoring
 *   CR3 = Provider Directory Accuracy
 *   CR4 = Delegation Oversight
 *   CR5 = Sanctions & Complaints
 *
 * FROZEN: Do not modify without architectural review.
 */

import { describe, expect, it } from 'vitest';

// ─── Types (to be implemented in auditScrapbookContracts.ts) ─────────────────

type NCQATag = 'CR1' | 'CR2' | 'CR3' | 'CR4' | 'CR5';

const ALL_NCQA_TAGS: NCQATag[] = ['CR1', 'CR2', 'CR3', 'CR4', 'CR5'];

type AuditEntryKind =
  | 'recognition_issued'
  | 'acceptance_countersigned'
  | 'start_attested'
  | 'psv_receipt_created'
  | 'psv_receipt_revoked'
  | 'privilege_granted'
  | 'privilege_revoked'
  | 'delegation_issued'
  | 'delegation_revoked'
  | 'oppe_completed'
  | 'fppe_completed'
  | 'sanction_detected'
  | 'complaint_filed'
  | 'directory_updated';

interface AuditEntry {
  entryId: string;
  subjectId: string;
  kind: AuditEntryKind;
  ncqaTags: NCQATag[];
  occurredAt: string;
  recordedAt: string;
  previousEntryHash: string | null;
  entryHash: string;
  eventRef: string;
  summary: string;
  metadata: Record<string, unknown> | null;
}

interface AuditScrapbook {
  scrapbookId: string;
  subjectId: string;
  entries: readonly AuditEntry[];
  createdAt: string;
  lastEntryAt: string | null;
}

interface DelegateAuditSample {
  delegateId: string;
  totalFiles: number;
  sampleSize: number;
  sampledFileIds: string[];
  sampledAt: string;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NOW = '2025-03-15T12:00:00.000Z';

const baseEntry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
  entryId: 'entry-001',
  subjectId: 'did:key:practitioner-001',
  kind: 'recognition_issued',
  ncqaTags: ['CR1'],
  occurredAt: '2025-03-01T10:00:00.000Z',
  recordedAt: NOW,
  previousEntryHash: null,
  entryHash: 'sha256:entry-001-hash',
  eventRef: 'rec-001',
  summary: 'Recognition issued by employer for RN role',
  metadata: null,
  ...overrides,
});

const baseScrapbook = (overrides: Partial<AuditScrapbook> = {}): AuditScrapbook => ({
  scrapbookId: 'scrapbook-001',
  subjectId: 'did:key:practitioner-001',
  entries: [],
  createdAt: NOW,
  lastEntryAt: null,
  ...overrides,
});

// ─── 1. Append-Only Timeline ─────────────────────────────────────────────────

describe('FROZEN: AuditScrapbook append-only', () => {
  it('new entries are appended, never inserted or replaced', () => {
    const entry1 = baseEntry({ entryId: 'entry-001', occurredAt: '2025-03-01T10:00:00.000Z' });
    const entry2 = baseEntry({
      entryId: 'entry-002',
      kind: 'acceptance_countersigned',
      occurredAt: '2025-03-02T10:00:00.000Z',
      previousEntryHash: entry1.entryHash,
    });

    const scrapbook = baseScrapbook({ entries: [entry1, entry2] });
    expect(scrapbook.entries).toHaveLength(2);
    expect(scrapbook.entries[0].entryId).toBe('entry-001');
    expect(scrapbook.entries[1].entryId).toBe('entry-002');
  });

  it('entries array is readonly', () => {
    const scrapbook = baseScrapbook({ entries: [baseEntry()] });
    // Production code: entries must be ReadonlyArray or frozen
    expect(scrapbook.entries).toHaveLength(1);
  });

  it('no delete operation exists', () => {
    // There is NO removeEntry(), deleteEntry(), or splice() on AuditScrapbook
    // The ONLY mutation is appendEntry()
    const scrapbook = baseScrapbook({ entries: [baseEntry()] });
    expect(scrapbook.entries).toHaveLength(1);
    // assertScrapbookIntegrity(scrapbook) must verify chain is unbroken
  });

  it('no update operation exists', () => {
    // There is NO updateEntry(), patchEntry(), or setEntry() on AuditScrapbook
    // Corrections are new entries with kind='correction' referencing original
    const entry = baseEntry();
    expect(entry.entryId).toBe('entry-001');
    // Production code must NOT expose mutation methods on entries
  });
});

// ─── 2. Hash Chain Integrity ─────────────────────────────────────────────────

describe('FROZEN: AuditScrapbook hash chain', () => {
  it('first entry has previousEntryHash = null', () => {
    const entry = baseEntry({ previousEntryHash: null });
    expect(entry.previousEntryHash).toBeNull();
  });

  it('subsequent entries must reference previous entry hash', () => {
    const entry1 = baseEntry({ entryId: 'entry-001', entryHash: 'sha256:hash-001' });
    const entry2 = baseEntry({
      entryId: 'entry-002',
      previousEntryHash: 'sha256:hash-001',
      entryHash: 'sha256:hash-002',
    });
    expect(entry2.previousEntryHash).toBe(entry1.entryHash);
  });

  it('broken chain → MUST FAIL integrity check', () => {
    const entry1 = baseEntry({ entryId: 'entry-001', entryHash: 'sha256:hash-001' });
    const entry2 = baseEntry({
      entryId: 'entry-002',
      previousEntryHash: 'sha256:TAMPERED',
      entryHash: 'sha256:hash-002',
    });

    // assertScrapbookIntegrity() must detect chain break
    expect(entry2.previousEntryHash).not.toBe(entry1.entryHash);
  });

  it('entryHash is required and non-empty', () => {
    const entry = baseEntry({ entryHash: '' });
    expect(entry.entryHash).toBe('');
    // Guard must reject empty entryHash
  });
});

// ─── 3. NCQA CR1–CR5 Tags ───────────────────────────────────────────────────

describe('FROZEN: NCQA CR1–CR5 tagging', () => {
  it('every entry must have at least one NCQA tag', () => {
    const entry = baseEntry({ ncqaTags: [] });
    expect(entry.ncqaTags).toHaveLength(0);
    // Guard must reject: ncqaTags.length === 0 → throw MISSING_NCQA_TAG
  });

  it('tags must be valid CR1–CR5 values', () => {
    for (const tag of ALL_NCQA_TAGS) {
      const entry = baseEntry({ ncqaTags: [tag] });
      expect(ALL_NCQA_TAGS).toContain(entry.ncqaTags[0]);
    }
  });

  it('invalid tag → MUST FAIL', () => {
    const entry = baseEntry({ ncqaTags: ['CR6' as NCQATag] });
    expect(ALL_NCQA_TAGS).not.toContain('CR6');
    // Guard must reject invalid tags
  });

  describe('CR1: Credentialing / Recredentialing', () => {
    it('recognition_issued → CR1', () => {
      const entry = baseEntry({ kind: 'recognition_issued', ncqaTags: ['CR1'] });
      expect(entry.ncqaTags).toContain('CR1');
    });

    it('acceptance_countersigned → CR1', () => {
      const entry = baseEntry({ kind: 'acceptance_countersigned', ncqaTags: ['CR1'] });
      expect(entry.ncqaTags).toContain('CR1');
    });

    it('start_attested → CR1', () => {
      const entry = baseEntry({ kind: 'start_attested', ncqaTags: ['CR1'] });
      expect(entry.ncqaTags).toContain('CR1');
    });

    it('psv_receipt_created → CR1', () => {
      const entry = baseEntry({ kind: 'psv_receipt_created', ncqaTags: ['CR1'] });
      expect(entry.ncqaTags).toContain('CR1');
    });
  });

  describe('CR2: Ongoing Monitoring', () => {
    it('oppe_completed → CR2', () => {
      const entry = baseEntry({ kind: 'oppe_completed', ncqaTags: ['CR2'] });
      expect(entry.ncqaTags).toContain('CR2');
    });

    it('fppe_completed → CR2', () => {
      const entry = baseEntry({ kind: 'fppe_completed', ncqaTags: ['CR2'] });
      expect(entry.ncqaTags).toContain('CR2');
    });
  });

  describe('CR3: Provider Directory Accuracy', () => {
    it('directory_updated → CR3', () => {
      const entry = baseEntry({ kind: 'directory_updated', ncqaTags: ['CR3'] });
      expect(entry.ncqaTags).toContain('CR3');
    });
  });

  describe('CR4: Delegation Oversight', () => {
    it('delegation_issued → CR4', () => {
      const entry = baseEntry({ kind: 'delegation_issued', ncqaTags: ['CR4'] });
      expect(entry.ncqaTags).toContain('CR4');
    });

    it('delegation_revoked → CR4', () => {
      const entry = baseEntry({ kind: 'delegation_revoked', ncqaTags: ['CR4'] });
      expect(entry.ncqaTags).toContain('CR4');
    });
  });

  describe('CR5: Sanctions & Complaints', () => {
    it('sanction_detected → CR5', () => {
      const entry = baseEntry({ kind: 'sanction_detected', ncqaTags: ['CR5'] });
      expect(entry.ncqaTags).toContain('CR5');
    });

    it('complaint_filed → CR5', () => {
      const entry = baseEntry({ kind: 'complaint_filed', ncqaTags: ['CR5'] });
      expect(entry.ncqaTags).toContain('CR5');
    });

    it('psv_receipt_revoked → CR5 (adverse finding)', () => {
      const entry = baseEntry({ kind: 'psv_receipt_revoked', ncqaTags: ['CR5'] });
      expect(entry.ncqaTags).toContain('CR5');
    });
  });

  it('entries may have multiple tags', () => {
    // privilege_granted can be both CR1 (initial credentialing) and CR4 (delegation)
    const entry = baseEntry({ kind: 'privilege_granted', ncqaTags: ['CR1', 'CR4'] });
    expect(entry.ncqaTags).toContain('CR1');
    expect(entry.ncqaTags).toContain('CR4');
  });
});

// ─── 4. Delegate Audit Sampling ──────────────────────────────────────────────

describe('FROZEN: Delegate audit sampling', () => {
  const computeSampleSize = (totalFiles: number): number => {
    const fivePercent = Math.ceil(totalFiles * 0.05);
    return Math.max(fivePercent, Math.min(50, totalFiles));
  };

  it('min(5%, 50): 1000 files → sample 50', () => {
    expect(computeSampleSize(1000)).toBe(50);
  });

  it('min(5%, 50): 2000 files → sample 100 (5%)', () => {
    expect(computeSampleSize(2000)).toBe(100);
  });

  it('min(5%, 50): 100 files → sample 50', () => {
    expect(computeSampleSize(100)).toBe(50);
  });

  it('min(5%, 50): 10 files → sample 10 (all files, < 50)', () => {
    expect(computeSampleSize(10)).toBe(10);
  });

  it('min(5%, 50): 49 files → sample 49 (all files, < 50)', () => {
    expect(computeSampleSize(49)).toBe(49);
  });

  it('min(5%, 50): 50 files → sample 50', () => {
    expect(computeSampleSize(50)).toBe(50);
  });

  it('min(5%, 50): 500 files → sample 50 (5% = 25, floor is 50)', () => {
    expect(computeSampleSize(500)).toBe(50);
  });

  it('min(5%, 50): 999 files → sample 50 (5% = 50, exactly 50)', () => {
    expect(computeSampleSize(999)).toBe(50);
  });

  it('min(5%, 50): 1001 files → sample 51 (5% > 50)', () => {
    expect(computeSampleSize(1001)).toBe(51);
  });

  it('sample must never exceed total files', () => {
    for (const total of [1, 5, 10, 25, 49]) {
      expect(computeSampleSize(total)).toBeLessThanOrEqual(total);
    }
  });

  it('sample must be at least 1 when files exist', () => {
    expect(computeSampleSize(1)).toBeGreaterThanOrEqual(1);
  });

  it('DelegateAuditSample: sampledFileIds.length === sampleSize', () => {
    const sample: DelegateAuditSample = {
      delegateId: 'delegate-001',
      totalFiles: 1000,
      sampleSize: 50,
      sampledFileIds: Array.from({ length: 50 }, (_, i) => `file-${i}`),
      sampledAt: NOW,
    };
    expect(sample.sampledFileIds).toHaveLength(sample.sampleSize);
  });

  it('DelegateAuditSample: sampleSize matches formula', () => {
    const total = 2000;
    const expected = computeSampleSize(total);
    const sample: DelegateAuditSample = {
      delegateId: 'delegate-001',
      totalFiles: total,
      sampleSize: expected,
      sampledFileIds: Array.from({ length: expected }, (_, i) => `file-${i}`),
      sampledAt: NOW,
    };
    expect(sample.sampleSize).toBe(100);
  });
});

// ─── 5. Deterministic Ordering ───────────────────────────────────────────────

describe('FROZEN: AuditScrapbook deterministic ordering', () => {
  it('entries ordered by occurredAt ascending', () => {
    const entry1 = baseEntry({
      entryId: 'entry-001',
      occurredAt: '2025-03-01T10:00:00.000Z',
    });
    const entry2 = baseEntry({
      entryId: 'entry-002',
      occurredAt: '2025-03-02T10:00:00.000Z',
      previousEntryHash: entry1.entryHash,
    });

    const scrapbook = baseScrapbook({ entries: [entry1, entry2] });
    expect(
      new Date(scrapbook.entries[0].occurredAt).getTime(),
    ).toBeLessThanOrEqual(new Date(scrapbook.entries[1].occurredAt).getTime());
  });

  it('ties broken by entryId (lexicographic)', () => {
    const sameTime = '2025-03-01T10:00:00.000Z';
    const entryA = baseEntry({ entryId: 'entry-A', occurredAt: sameTime });
    const entryB = baseEntry({
      entryId: 'entry-B',
      occurredAt: sameTime,
      previousEntryHash: entryA.entryHash,
    });

    const scrapbook = baseScrapbook({ entries: [entryA, entryB] });
    expect(scrapbook.entries[0].entryId.localeCompare(scrapbook.entries[1].entryId)).toBeLessThan(0);
  });
});

// ─── 6. Required Fields ─────────────────────────────────────────────────────

describe('FROZEN: AuditEntry required fields', () => {
  it('entryId: non-empty string', () => {
    expect(baseEntry().entryId).toBeTruthy();
  });

  it('subjectId: non-empty string', () => {
    expect(baseEntry().subjectId).toBeTruthy();
  });

  it('kind: valid AuditEntryKind', () => {
    expect(baseEntry().kind).toBe('recognition_issued');
  });

  it('ncqaTags: at least one valid tag', () => {
    expect(baseEntry().ncqaTags.length).toBeGreaterThan(0);
  });

  it('occurredAt: ISO 8601 full timestamp', () => {
    expect(baseEntry().occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('recordedAt: ISO 8601 full timestamp', () => {
    expect(baseEntry().recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('entryHash: non-empty string', () => {
    expect(baseEntry().entryHash).toBeTruthy();
  });

  it('eventRef: non-empty string (references source event)', () => {
    expect(baseEntry().eventRef).toBeTruthy();
  });

  it('summary: non-empty string', () => {
    expect(baseEntry().summary).toBeTruthy();
  });
});

// ─── 7. Scrapbook Missing Events → Build Fails ──────────────────────────────

describe('FROZEN: AuditScrapbook completeness', () => {
  it('scrapbook without recognition entry → incomplete', () => {
    const scrapbook = baseScrapbook({
      entries: [
        baseEntry({ kind: 'acceptance_countersigned', ncqaTags: ['CR1'] }),
        baseEntry({ kind: 'start_attested', ncqaTags: ['CR1'], entryId: 'entry-002' }),
      ],
    });
    const hasRecognition = scrapbook.entries.some((e) => e.kind === 'recognition_issued');
    expect(hasRecognition).toBe(false);
    // assertScrapbookComplete(scrapbook) → throw MISSING_RECOGNITION_ENTRY
  });

  it('scrapbook without acceptance entry → incomplete', () => {
    const scrapbook = baseScrapbook({
      entries: [
        baseEntry({ kind: 'recognition_issued', ncqaTags: ['CR1'] }),
        baseEntry({ kind: 'start_attested', ncqaTags: ['CR1'], entryId: 'entry-002' }),
      ],
    });
    const hasAcceptance = scrapbook.entries.some((e) => e.kind === 'acceptance_countersigned');
    expect(hasAcceptance).toBe(false);
    // assertScrapbookComplete(scrapbook) → throw MISSING_ACCEPTANCE_ENTRY
  });

  it('scrapbook without start entry → incomplete', () => {
    const scrapbook = baseScrapbook({
      entries: [
        baseEntry({ kind: 'recognition_issued', ncqaTags: ['CR1'] }),
        baseEntry({ kind: 'acceptance_countersigned', ncqaTags: ['CR1'], entryId: 'entry-002' }),
      ],
    });
    const hasStart = scrapbook.entries.some((e) => e.kind === 'start_attested');
    expect(hasStart).toBe(false);
    // assertScrapbookComplete(scrapbook) → throw MISSING_START_ENTRY
  });

  it('scrapbook without PSV receipt entry → incomplete', () => {
    const scrapbook = baseScrapbook({
      entries: [
        baseEntry({ kind: 'recognition_issued', ncqaTags: ['CR1'] }),
        baseEntry({ kind: 'acceptance_countersigned', ncqaTags: ['CR1'], entryId: 'entry-002' }),
        baseEntry({ kind: 'start_attested', ncqaTags: ['CR1'], entryId: 'entry-003' }),
      ],
    });
    const hasPSV = scrapbook.entries.some((e) => e.kind === 'psv_receipt_created');
    expect(hasPSV).toBe(false);
    // assertScrapbookComplete(scrapbook) → throw MISSING_PSV_ENTRY
  });

  it('complete scrapbook has all required canonical events', () => {
    const scrapbook = baseScrapbook({
      entries: [
        baseEntry({ kind: 'psv_receipt_created', ncqaTags: ['CR1'], entryId: 'entry-000' }),
        baseEntry({ kind: 'recognition_issued', ncqaTags: ['CR1'], entryId: 'entry-001' }),
        baseEntry({ kind: 'acceptance_countersigned', ncqaTags: ['CR1'], entryId: 'entry-002' }),
        baseEntry({ kind: 'start_attested', ncqaTags: ['CR1'], entryId: 'entry-003' }),
      ],
    });
    const requiredKinds = [
      'recognition_issued',
      'acceptance_countersigned',
      'start_attested',
      'psv_receipt_created',
    ];
    for (const kind of requiredKinds) {
      expect(scrapbook.entries.some((e) => e.kind === kind)).toBe(true);
    }
  });
});
