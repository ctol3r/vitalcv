/** YC MVP — behavior frozen. Do not modify without scope approval. */
import { describe, expect, it } from 'vitest';
import { CrsEngine } from '../CrsEngine';

describe('CrsEngine', () => {
  it('returns RED when any PSV receipt is expired', async () => {
    const engine = new CrsEngine({
      receipts: {
        listByClinician: async () => [
          {
            receipt_id: 'rcpt-expired',
            fetched_at: '2026-02-06T09:00:00.000Z',
            ttl_seconds: 60,
            revoked: false,
          },
        ],
      },
      acceptances: {
        existsForClinician: async () => true,
      },
    });

    const result = await engine.computeForClinician({
      clinician_id: 'clin-1',
      as_of: '2026-02-06T09:05:00.000Z',
    });

    expect(result.band).toBe('RED');
    expect(result.score).toBeLessThan(80);
    expect(result.blocking_reasons).toContain('EXPIRED_PSV');
  });

  it('returns RED when any PSV receipt is revoked', async () => {
    const engine = new CrsEngine({
      receipts: {
        listByClinician: async () => [
          {
            receipt_id: 'rcpt-revoked',
            fetched_at: '2026-02-06T09:00:00.000Z',
            ttl_seconds: 7200,
            revoked: true,
          },
        ],
      },
      acceptances: {
        existsForClinician: async () => true,
      },
    });

    const result = await engine.computeForClinician({
      clinician_id: 'clin-1',
      as_of: '2026-02-06T09:30:00.000Z',
    });

    expect(result.band).toBe('RED');
    expect(result.score).toBeLessThan(80);
    expect(result.blocking_reasons).toContain('REVOKED_PSV');
  });

  it('recomputes dynamically when receipt TTL expires', async () => {
    const receipt = {
      receipt_id: 'rcpt-dynamic',
      fetched_at: '2026-02-06T10:00:00.000Z',
      ttl_seconds: 1,
      revoked: false,
    };

    const engine = new CrsEngine({
      receipts: {
        listByClinician: async () => [receipt],
      },
      acceptances: {
        existsForClinician: async () => true,
      },
    });

    const beforeExpiry = await engine.computeForClinician({
      clinician_id: 'clin-1',
      as_of: '2026-02-06T10:00:00.500Z',
    });
    expect(beforeExpiry.band).toBe('GREEN');

    const afterExpiry = await engine.computeForClinician({
      clinician_id: 'clin-1',
      as_of: '2026-02-06T10:00:03.000Z',
    });
    expect(afterExpiry.band).toBe('RED');
    expect(afterExpiry.blocking_reasons).toContain('EXPIRED_PSV');
  });

  it('applies divergence penalties and blocks GREEN when a high-severity divergence is active', async () => {
    const engine = new CrsEngine({
      receipts: {
        listByClinician: async () => [
          {
            receipt_id: 'rcpt-ok',
            fetched_at: '2026-02-06T10:00:00.000Z',
            ttl_seconds: 7200,
            revoked: false,
          },
        ],
      },
      acceptances: {
        existsForClinician: async () => true,
      },
      divergence: {
        getForClinician: async () => ({
          penalty: 15,
          hasBlocking: true,
        }),
      },
    });

    const result = await engine.computeForClinician({
      clinician_id: 'clin-1',
      as_of: '2026-02-06T10:05:00.000Z',
    });

    expect(result.score).toBe(79);
    expect(result.band).toBe('YELLOW');
    expect(result.blocking_reasons).toContain('ACTIVE_DIVERGENCE');
  });
});
