/** YC MVP — behavior frozen. Do not modify without scope approval. */
import { describe, expect, it, vi } from 'vitest';
import { TrustStateResolver } from '../TrustStateResolver.ts';
import type {
  AcceptanceScopeRecord,
  CrsResult,
  PsvReceiptRecord,
  TrustStateResolverDependencies,
} from '../contracts';

const FIXED_NOW = '2026-02-06T18:00:00.000Z';
const VALID_HASH_ANCHOR = 'a'.repeat(64);
const VALID_ACCEPTANCE_PROOF = {
  type: 'Ed25519Signature2020',
  verificationMethod: 'did:key:employer#keys-1',
  proofValue: 'z-signature-proof',
} as const;

function createAcceptanceRecord(
  partial: Partial<AcceptanceScopeRecord> = {},
): AcceptanceScopeRecord {
  return {
    clinician_id: 'clin-1',
    employer_id: 'emp-default',
    facility_id: 'facility-default',
    role: 'role-rn',
    accepted_at: '2026-02-06T17:30:00.000Z',
    acceptance_id: 'acc-default',
    hash_anchor: VALID_HASH_ANCHOR,
    employer_proof: VALID_ACCEPTANCE_PROOF,
    ...partial,
  };
}

function createDependencies(overrides: Partial<TrustStateResolverDependencies> = {}) {
  const baseCrs: CrsResult = {
    clinician_id: 'clin-1',
    score: 90,
    band: 'GREEN',
    blocking_reasons: [],
    last_verified_at: FIXED_NOW,
  };

  const receipts: PsvReceiptRecord[] = [
    {
      receipt_id: 'rcpt-1',
      fetched_at: '2026-02-06T17:00:00.000Z',
      ttl_seconds: 7200,
      revoked: false,
    },
  ];

  const deps: TrustStateResolverDependencies = {
    crs: {
      computeForClinician: vi.fn().mockResolvedValue(baseCrs),
    },
    receipts: {
      listByClinician: vi.fn().mockResolvedValue(receipts),
    },
    acceptances: {
      existsForClinician: vi.fn().mockResolvedValue(true),
      listByClinician: vi.fn().mockResolvedValue([createAcceptanceRecord()]),
    },
    starts: {
      existsForClinician: vi.fn().mockResolvedValue(false),
    },
    audit: {
      append: vi.fn().mockResolvedValue({ audit_packet_id: 'audit-1' }),
    },
    now: () => new Date(FIXED_NOW),
  };

  return {
    deps: {
      ...deps,
      ...overrides,
    },
    spies: {
      crs: deps.crs.computeForClinician as ReturnType<typeof vi.fn>,
      receipts: deps.receipts.listByClinician as ReturnType<typeof vi.fn>,
      acceptances: deps.acceptances.existsForClinician as ReturnType<typeof vi.fn>,
      starts: deps.starts.existsForClinician as ReturnType<typeof vi.fn>,
      audit: deps.audit.append as ReturnType<typeof vi.fn>,
    },
  };
}

describe('TrustStateResolver', () => {
  it('returns start_ready=false when acceptance is missing', async () => {
    const { deps } = createDependencies({
      acceptances: {
        existsForClinician: vi.fn().mockResolvedValue(false),
      },
    });

    const resolver = new TrustStateResolver(deps);
    const result = await resolver.resolve('clin-1');

    expect(result.start_ready).toBe(false);
    expect(result.blocking_reasons).toContain('MISSING_ACCEPTANCE');
  });

  it('returns start_ready=false when CRS is below threshold', async () => {
    const { deps } = createDependencies({
      crs: {
        computeForClinician: vi.fn().mockResolvedValue({
          clinician_id: 'clin-1',
          score: 79,
          band: 'YELLOW',
          blocking_reasons: [],
          last_verified_at: FIXED_NOW,
        } satisfies CrsResult),
      },
    });

    const resolver = new TrustStateResolver(deps);
    const result = await resolver.resolve('clin-1');

    expect(result.start_ready).toBe(false);
    expect(result.blocking_reasons).toContain('CRS_BELOW_THRESHOLD');
  });

  it('returns start_ready=false when any receipt is expired', async () => {
    const { deps } = createDependencies({
      receipts: {
        listByClinician: vi.fn().mockResolvedValue([
          {
            receipt_id: 'rcpt-expired',
            fetched_at: '2026-02-06T10:00:00.000Z',
            ttl_seconds: 1800,
            revoked: false,
          } satisfies PsvReceiptRecord,
        ]),
      },
    });

    const resolver = new TrustStateResolver(deps);
    const result = await resolver.resolve('clin-1');

    expect(result.start_ready).toBe(false);
    expect(result.band).toBe('RED');
    expect(result.score).toBeLessThan(80);
    expect(result.blocking_reasons).toContain('EXPIRED_PSV');
  });

  it('emits TRUST_STATE_DECAY when an expired receipt is detected', async () => {
    const { deps, spies } = createDependencies({
      receipts: {
        listByClinician: vi.fn().mockResolvedValue([
          {
            receipt_id: 'rcpt-expired',
            fetched_at: '2026-02-06T10:00:00.000Z',
            ttl_seconds: 1800,
            revoked: false,
          } satisfies PsvReceiptRecord,
        ]),
      },
    });

    const resolver = new TrustStateResolver(deps);
    const result = await resolver.resolve('clin-1');

    expect(result.start_ready).toBe(false);
    expect(result.band).toBe('RED');
    expect(result.blocking_reasons).toContain('EXPIRED_PSV');
    expect(spies.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'TRUST_STATE_DECAY',
        clinician_id: 'clin-1',
        metadata: expect.objectContaining({
          receipt_id: 'rcpt-expired',
          previous_band: 'GREEN',
          new_band: 'RED',
          status: 'EXPIRED',
        }),
      }),
    );
  });

  it('emits TRUST_STATE_DECAY when a revoked receipt is detected', async () => {
    const { deps, spies } = createDependencies({
      receipts: {
        listByClinician: vi.fn().mockResolvedValue([
          {
            receipt_id: 'rcpt-revoked',
            fetched_at: '2026-02-06T17:00:00.000Z',
            ttl_seconds: 7200,
            revoked: true,
          } satisfies PsvReceiptRecord,
        ]),
      },
    });

    const resolver = new TrustStateResolver(deps);
    const result = await resolver.resolve('clin-1');

    expect(result.start_ready).toBe(false);
    expect(result.band).toBe('RED');
    expect(result.blocking_reasons).toContain('REVOKED_PSV');
    expect(spies.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'TRUST_STATE_DECAY',
        clinician_id: 'clin-1',
        metadata: expect.objectContaining({
          receipt_id: 'rcpt-revoked',
          previous_band: 'GREEN',
          new_band: 'RED',
          status: 'REVOKED',
        }),
      }),
    );
  });

  it('includes complete blocking_reasons set deterministically when all blockers apply', async () => {
    const { deps } = createDependencies({
      crs: {
        computeForClinician: vi.fn().mockResolvedValue({
          clinician_id: 'clin-1',
          score: 12,
          band: 'RED',
          blocking_reasons: ['raw crs detail'],
          last_verified_at: FIXED_NOW,
        } satisfies CrsResult),
      },
      receipts: {
        listByClinician: vi.fn().mockResolvedValue([
          {
            receipt_id: 'rcpt-revoked',
            fetched_at: '2026-02-06T10:00:00.000Z',
            ttl_seconds: 1800,
            revoked: true,
          } satisfies PsvReceiptRecord,
          {
            receipt_id: 'rcpt-expired',
            fetched_at: '2026-02-06T10:00:00.000Z',
            ttl_seconds: 1800,
            revoked: false,
          } satisfies PsvReceiptRecord,
        ]),
      },
      acceptances: {
        existsForClinician: vi.fn().mockResolvedValue(false),
      },
      starts: {
        existsForClinician: vi.fn().mockResolvedValue(true),
      },
    });

    const resolver = new TrustStateResolver(deps);
    const result = await resolver.resolve('clin-1');

    expect(result.start_ready).toBe(false);
    expect(result.blocking_reasons).toEqual([
      'EXPIRED_PSV',
      'REVOKED_PSV',
      'MISSING_ACCEPTANCE',
      'CRS_BELOW_THRESHOLD',
      'START_ALREADY_ATTESTED',
    ]);
  });

  it('calls CRS engine and emits TRUST_STATE_CHECK audit event', async () => {
    const { deps, spies } = createDependencies();
    const resolver = new TrustStateResolver(deps);

    const result = await resolver.resolve('clin-1');

    expect(spies.crs).toHaveBeenCalledOnce();
    expect(spies.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'TRUST_STATE_CHECK',
        clinician_id: 'clin-1',
      }),
    );
    expect(result.audit_ref).toBe('audit-1');
  });

  it('includes verification latency metrics in response and audit metadata', async () => {
    const { deps, spies } = createDependencies();
    const resolver = new TrustStateResolver(deps);

    const result = await resolver.resolve('clin-1');

    expect(typeof result.metrics.verification_latency_ms).toBe('number');
    expect(result.metrics.verification_latency_ms).toBeGreaterThanOrEqual(0);

    expect(spies.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'TRUST_STATE_CHECK',
        clinician_id: 'clin-1',
        metadata: expect.objectContaining({
          metrics: expect.objectContaining({
            verification_latency_ms: expect.any(Number),
            crs_band: 'GREEN',
            blocking_reason_count: 0,
          }),
        }),
      }),
    );
  });

  it('keeps decision logic unchanged regardless of measured latency', async () => {
    const fast = createDependencies();
    const slow = createDependencies({
      crs: {
        computeForClinician: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return {
            clinician_id: 'clin-1',
            score: 90,
            band: 'GREEN',
            blocking_reasons: [],
            last_verified_at: FIXED_NOW,
          } satisfies CrsResult;
        }),
      },
    });

    const fastResult = await new TrustStateResolver(fast.deps).resolve('clin-1');
    const slowResult = await new TrustStateResolver(slow.deps).resolve('clin-1');

    expect(fastResult.start_ready).toBe(slowResult.start_ready);
    expect(fastResult.band).toBe(slowResult.band);
    expect(fastResult.score).toBe(slowResult.score);
    expect(fastResult.blocking_reasons).toEqual(slowResult.blocking_reasons);
    expect(fastResult.last_verified_at).toBe(slowResult.last_verified_at);

    expect(typeof fastResult.metrics.verification_latency_ms).toBe('number');
    expect(typeof slowResult.metrics.verification_latency_ms).toBe('number');
  });

  it('gates start readiness per employer scope while keeping CRS unchanged', async () => {
    const { deps, spies } = createDependencies({
      acceptances: {
        existsForClinician: vi.fn().mockResolvedValue(true),
        listByClinician: vi.fn().mockResolvedValue([
          createAcceptanceRecord({
            employer_id: 'emp-A',
            facility_id: 'facility-A',
            acceptance_id: 'acc-A',
          }),
          createAcceptanceRecord({
            employer_id: 'emp-B',
            facility_id: 'facility-B',
            accepted_at: '2026-02-06T17:35:00.000Z',
            acceptance_id: 'acc-B',
          }),
        ]),
      },
      starts: {
        existsForClinician: vi.fn().mockResolvedValue(false),
        existsForScope: vi.fn().mockResolvedValue(false),
      },
    });

    const resolver = new TrustStateResolver(deps);

    const trustA = await resolver.resolve('clin-1', {
      employer_id: 'emp-A',
      facility_id: 'facility-A',
      role: 'role-rn',
    });
    const trustB = await resolver.resolve('clin-1', {
      employer_id: 'emp-B',
      facility_id: 'facility-B',
      role: 'role-rn',
    });
    const trustMissing = await resolver.resolve('clin-1', {
      employer_id: 'emp-C',
      facility_id: 'facility-C',
      role: 'role-rn',
    });

    expect(trustA.start_ready).toBe(true);
    expect(trustB.start_ready).toBe(true);
    expect(trustMissing.start_ready).toBe(false);
    expect(trustMissing.blocking_reasons).toContain('MISSING_ACCEPTANCE');

    expect(trustA.score).toBe(trustB.score);
    expect(trustA.band).toBe(trustB.band);

    expect(spies.crs).toHaveBeenCalledTimes(3);
  });

  it('attaches bi-directional graph counts as read-only metadata only', async () => {
    const { deps } = createDependencies({
      trust_graph: {
        listEmployersForClinician: vi.fn().mockResolvedValue([
          { employer_id: 'emp-A', facility_id: 'facility-A', role: 'role-rn' },
          { employer_id: 'emp-B', facility_id: 'facility-B', role: 'role-rn' },
        ]),
        listCliniciansForEmployer: vi
          .fn()
          .mockResolvedValue(['clin-1', 'clin-2', 'clin-3']),
      },
      acceptances: {
        existsForClinician: vi.fn().mockResolvedValue(true),
        listByClinician: vi.fn().mockResolvedValue([
          createAcceptanceRecord({
            employer_id: 'emp-A',
            facility_id: 'facility-A',
            acceptance_id: 'acc-A',
          }),
        ]),
      },
    });

    const resolver = new TrustStateResolver(deps);
    const result = await resolver.resolve('clin-1', {
      employer_id: 'emp-A',
      facility_id: 'facility-A',
      role: 'role-rn',
    });

    expect(result.start_ready).toBe(true);
    expect(result.linked_employers_count).toBe(2);
    expect(result.linked_clinicians_count).toBe(3);
    expect(result.band).toBe('GREEN');
    expect(result.score).toBe(90);
  });
});
