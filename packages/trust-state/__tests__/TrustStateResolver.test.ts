import { describe, expect, it, vi } from 'vitest';
import { TrustStateResolver } from '../TrustStateResolver';
import type { CrsResult, PsvReceiptRecord, TrustStateResolverDependencies } from '../contracts';

const FIXED_NOW = '2026-02-06T18:00:00.000Z';

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
    expect(result.blocking_reasons).toContain('EXPIRED_PSV');
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
            receipt_id: 'rcpt-bad',
            fetched_at: '2026-02-06T10:00:00.000Z',
            ttl_seconds: 1800,
            revoked: true,
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
});
