/** YC MVP — behavior frozen. Do not modify without scope approval. */
import { describe, expect, it } from 'vitest';
import {
  CRS_LICENSURE_UNVERIFIED_CEILING,
  CrsEngine,
  type CrsLicensureCheck,
  type CrsLicensureSourceState,
} from '../CrsEngine';

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

  // ───────────────────────────────────────────────────────────────────────
  // Licensure cap (W1.1) — opt-in dependency. When supplied AND
  // hasVerifiedLicensure is false, the score is capped at
  // CRS_LICENSURE_UNVERIFIED_CEILING (45) and LICENSURE_UNVERIFIED is
  // surfaced. When NOT supplied, behavior is unchanged from the YC-MVP
  // frozen baseline (the four tests above cover the unchanged paths).
  // ───────────────────────────────────────────────────────────────────────

  function freshHappyReceipt() {
    return {
      receipt_id: 'rcpt-fresh',
      fetched_at: '2026-02-06T10:00:00.000Z',
      ttl_seconds: 7200,
      revoked: false,
    };
  }

  function buildLicensureDep(check: CrsLicensureCheck) {
    return {
      getForClinician: async () => check,
    };
  }

  it('caps score at L1 ceiling for an NPPES-only provider (no verified licensure)', async () => {
    // Simulates: NPPES says identity exists; no licensure source returned verified.
    const engine = new CrsEngine({
      receipts: { listByClinician: async () => [freshHappyReceipt()] },
      acceptances: { existsForClinician: async () => true },
      licensure: buildLicensureDep({
        hasVerifiedLicensure: false,
        source_states: ['unchecked'] satisfies readonly CrsLicensureSourceState[],
      }),
    });

    const result = await engine.computeForClinician({
      clinician_id: 'clin-nppes-only',
      as_of: '2026-02-06T10:30:00.000Z',
    });

    // Without the cap this would be 95/GREEN. With the cap it's 45/YELLOW.
    expect(result.score).toBe(CRS_LICENSURE_UNVERIFIED_CEILING);
    expect(result.score).toBe(45);
    expect(result.band).toBe('YELLOW');
    expect(result.blocking_reasons).toContain('LICENSURE_UNVERIFIED');
  });

  it('caps score when every licensure source is missing for the jurisdiction', async () => {
    const engine = new CrsEngine({
      receipts: { listByClinician: async () => [freshHappyReceipt()] },
      acceptances: { existsForClinician: async () => true },
      licensure: buildLicensureDep({
        hasVerifiedLicensure: false,
        source_states: ['missing'] satisfies readonly CrsLicensureSourceState[],
      }),
    });

    const result = await engine.computeForClinician({
      clinician_id: 'clin-no-jurisdiction',
      as_of: '2026-02-06T10:30:00.000Z',
    });

    expect(result.score).toBeLessThanOrEqual(CRS_LICENSURE_UNVERIFIED_CEILING);
    expect(result.band).not.toBe('GREEN');
    expect(result.blocking_reasons).toContain('LICENSURE_UNVERIFIED');
  });

  it('caps score when licensure source is access_required (Nursys / FSMB onboarding pending)', async () => {
    const engine = new CrsEngine({
      receipts: { listByClinician: async () => [freshHappyReceipt()] },
      acceptances: { existsForClinician: async () => true },
      licensure: buildLicensureDep({
        hasVerifiedLicensure: false,
        source_states: ['access_required'] satisfies readonly CrsLicensureSourceState[],
      }),
    });

    const result = await engine.computeForClinician({
      clinician_id: 'clin-gated',
      as_of: '2026-02-06T10:30:00.000Z',
    });

    expect(result.score).toBeLessThanOrEqual(CRS_LICENSURE_UNVERIFIED_CEILING);
    expect(result.band).toBe('YELLOW');
    expect(result.blocking_reasons).toContain('LICENSURE_UNVERIFIED');
  });

  it('does not cap when at least one licensure source returns verified', async () => {
    const engine = new CrsEngine({
      receipts: { listByClinician: async () => [freshHappyReceipt()] },
      acceptances: { existsForClinician: async () => true },
      licensure: buildLicensureDep({
        hasVerifiedLicensure: true,
        source_states: ['verified', 'access_required'] satisfies readonly CrsLicensureSourceState[],
      }),
    });

    const result = await engine.computeForClinician({
      clinician_id: 'clin-verified',
      as_of: '2026-02-06T10:30:00.000Z',
    });

    // Cap does not fire — the unmodified happy path stands.
    expect(result.score).toBeGreaterThan(CRS_LICENSURE_UNVERIFIED_CEILING);
    expect(result.band).toBe('GREEN');
    expect(result.blocking_reasons).not.toContain('LICENSURE_UNVERIFIED');
  });

  it('preserves legacy behavior when licensure dependency is not supplied (frozen-baseline opt-out)', async () => {
    // Backward-compatibility guard — existing callers that have not yet
    // integrated licensure-source state see the original scoring.
    const engine = new CrsEngine({
      receipts: { listByClinician: async () => [freshHappyReceipt()] },
      acceptances: { existsForClinician: async () => true },
    });

    const result = await engine.computeForClinician({
      clinician_id: 'clin-legacy',
      as_of: '2026-02-06T10:30:00.000Z',
    });

    expect(result.score).toBe(95);
    expect(result.band).toBe('GREEN');
    expect(result.blocking_reasons).not.toContain('LICENSURE_UNVERIFIED');
  });

  it('cap never raises a record — RED records stay RED even with licensure unverified', async () => {
    // Compose with another red gate: ensure cap clamps, never lifts.
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
      acceptances: { existsForClinician: async () => true },
      licensure: buildLicensureDep({
        hasVerifiedLicensure: false,
        source_states: ['unsupported'] satisfies readonly CrsLicensureSourceState[],
      }),
    });

    const result = await engine.computeForClinician({
      clinician_id: 'clin-revoked-and-unverified',
      as_of: '2026-02-06T09:30:00.000Z',
    });

    // RED from REVOKED_PSV must persist; cap does not soften RED to YELLOW.
    expect(result.band).toBe('RED');
    expect(result.score).toBeLessThanOrEqual(CRS_LICENSURE_UNVERIFIED_CEILING);
    expect(result.blocking_reasons).toContain('REVOKED_PSV');
    expect(result.blocking_reasons).toContain('LICENSURE_UNVERIFIED');
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
