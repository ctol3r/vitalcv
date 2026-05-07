/**
 * oig-adapter-confidence.test.ts
 *
 * W1.2 — restores semantic distinction between three OIG match outcomes
 * that the adapter previously conflated under `confidence: 'exact'`:
 *
 *   no_match       — 0 records returned. ABSENCE of records, NOT a
 *                    guarantee of clearance.
 *   possible_match — records returned BUT none with an exact NPI match
 *                    (e.g. legacy LEIE entries filed without NPI / by
 *                    name only). Surfaces as REVIEW_REQUIRED — never
 *                    auto-flips to BLOCKED_SIGNAL because false-positive
 *                    name matches are a known LEIE limitation.
 *   exact          — at least one returned record has e.npi === queriedNpi.
 *                    Severity then depends on `reinstatedDate`.
 *
 * Tests run against the adapter directly with `globalThis.fetch` mocked
 * — no network calls, no DB, no Clerk. Adapter under test is the live
 * @vitalcv/source-adapters export imported via vitest's resolver.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The adapter's sha256Sync helper uses `globalThis.crypto.createHash`
// (a known pre-existing bug — Node exposes that API on `node:crypto`,
// not on the Web Crypto global). Stub it for test isolation; W1.2 is
// about confidence semantics, not the hash util.
vi.mock('../../../packages/source-adapters/src/utils/hash', () => ({
  sha256Sync: (input: string) => `sha256:test-${input.length}`,
}));

import { OigLeieAdapter } from '../../../packages/source-adapters/src/adapters/oig';
import { SourceStatus } from '../../../packages/source-adapters/src/types';

const QUERIED_NPI = '1003000126';

function mockOigResponse(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => body,
    }),
  );
}

describe('OIG LEIE adapter — match confidence semantics (W1.2)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── no_match ──────────────────────────────────────────────────────

  it('0 records → confidence: no_match (NOT exact, NOT clearance)', async () => {
    mockOigResponse({ exclusions: [], last_updated: '2026-05-01' });

    const adapter = new OigLeieAdapter();
    const result = await adapter.fetch(QUERIED_NPI);

    expect(result.matchBasis.confidence).toBe('no_match');
    // The check completed → status remains CHECKED, but the explanation
    // must NOT imply guaranteed clearance.
    expect(result.status).toBe(SourceStatus.CHECKED);
    expect(result.matchBasis.explanation).toContain('0 records');
    expect(result.matchBasis.explanation).toMatch(/not a guarantee/i);
    // No exclusion claim should mark active exclusion present
    const hasActive = result.claims.find((c) => c.key === 'has_active_exclusion');
    expect(hasActive?.value).toBe(false);
  });

  it('no_match still surfaces oig_match_confidence as a claim', async () => {
    mockOigResponse({ exclusions: [] });

    const adapter = new OigLeieAdapter();
    const result = await adapter.fetch(QUERIED_NPI);

    const confidenceClaim = result.claims.find((c) => c.key === 'oig_match_confidence');
    expect(confidenceClaim).toBeDefined();
    expect(confidenceClaim!.value).toBe('no_match');
    expect(confidenceClaim!.present).toBe(true);
  });

  // ── exact ─────────────────────────────────────────────────────────

  it('record with exact NPI match → confidence: exact + BLOCKED_SIGNAL', async () => {
    mockOigResponse({
      exclusions: [
        {
          npi: QUERIED_NPI,
          firstname: 'Test',
          lastname: 'Subject',
          excltype: '1128(a)(1)',
          excl_date: '2024-01-15',
          reindate: null,
          excl_reason: 'Conviction of program-related crime',
        },
      ],
    });

    const adapter = new OigLeieAdapter();
    const result = await adapter.fetch(QUERIED_NPI);

    expect(result.matchBasis.confidence).toBe('exact');
    expect(result.status).toBe(SourceStatus.BLOCKED_SIGNAL);
    expect(result.matchBasis.explanation).toContain('NPI-exact');
    // Active exclusion limitation must be marked adverse
    const adverse = result.limitations.find((l) => l.code === 'OIG_EXCLUSION_ACTIVE');
    expect(adverse).toBeDefined();
    expect(adverse!.adverse).toBe(true);
  });

  it('exact match all reinstated → confidence: exact + REVIEW_REQUIRED', async () => {
    mockOigResponse({
      exclusions: [
        {
          npi: QUERIED_NPI,
          name: 'Reinstated Subject',
          excltype: '1128(a)(1)',
          excl_date: '2018-06-01',
          reindate: '2022-12-01',
          excl_reason: 'Reinstated after waiver',
        },
      ],
    });

    const adapter = new OigLeieAdapter();
    const result = await adapter.fetch(QUERIED_NPI);

    expect(result.matchBasis.confidence).toBe('exact');
    expect(result.status).toBe(SourceStatus.REVIEW_REQUIRED);
    const reinstated = result.limitations.find((l) => l.code === 'OIG_REINSTATED');
    expect(reinstated).toBeDefined();
    expect(reinstated!.adverse).toBe(false);
  });

  // ── possible_match ────────────────────────────────────────────────

  it('records returned with NULL npi → confidence: possible_match + REVIEW_REQUIRED (not BLOCKED)', async () => {
    // Legacy LEIE entry without NPI — could be a name-only false-positive.
    mockOigResponse({
      exclusions: [
        {
          npi: null,
          firstname: 'Sarah',
          lastname: 'Chen',
          excltype: '1128(b)(7)',
          excl_date: '2010-03-15',
          reindate: null,
          excl_reason: 'Healthcare-related fraud',
        },
      ],
    });

    const adapter = new OigLeieAdapter();
    const result = await adapter.fetch(QUERIED_NPI);

    expect(result.matchBasis.confidence).toBe('possible_match');
    // CRITICAL: must NOT be BLOCKED_SIGNAL — false-positive risk.
    expect(result.status).toBe(SourceStatus.REVIEW_REQUIRED);
    expect(result.matchBasis.explanation).toMatch(/no.*exact NPI match/i);
    expect(result.matchBasis.explanation).toMatch(/review required/i);

    // Limitation must be marked non-adverse so downstream scoring
    // doesn't treat name-only matches as confirmed exclusions.
    const possible = result.limitations.find((l) => l.code === 'OIG_POSSIBLE_NAME_MATCH');
    expect(possible).toBeDefined();
    expect(possible!.adverse).toBe(false);
  });

  it('records with DIFFERENT npi than queried → confidence: possible_match', async () => {
    // Adapter received records whose embedded NPI does not match the
    // queried subject. This is unusual for the NPI-keyed endpoint but
    // possible (cached / legacy / name-routed). Treat as possible_match.
    mockOigResponse({
      exclusions: [
        {
          npi: '9999999999',
          firstname: 'Different',
          lastname: 'Person',
          excltype: '1128(a)(1)',
          excl_date: '2020-01-01',
          reindate: null,
        },
      ],
    });

    const adapter = new OigLeieAdapter();
    const result = await adapter.fetch(QUERIED_NPI);

    expect(result.matchBasis.confidence).toBe('possible_match');
    expect(result.status).toBe(SourceStatus.REVIEW_REQUIRED);
  });

  // ── mixed ─────────────────────────────────────────────────────────

  it('mix of exact + name-only records → confidence: exact (NPI-exact wins)', async () => {
    mockOigResponse({
      exclusions: [
        {
          npi: QUERIED_NPI,
          name: 'Test Subject',
          excltype: '1128(a)(1)',
          excl_date: '2024-01-15',
          reindate: null,
        },
        {
          npi: null,
          name: 'Different Name',
          excltype: '1128(b)(7)',
          excl_date: '2010-01-01',
          reindate: null,
        },
      ],
    });

    const adapter = new OigLeieAdapter();
    const result = await adapter.fetch(QUERIED_NPI);

    // The NPI-exact match dominates; ambiguous record surfaces as a
    // separate limitation but doesn't downgrade the confidence.
    expect(result.matchBasis.confidence).toBe('exact');
    expect(result.status).toBe(SourceStatus.BLOCKED_SIGNAL);
    expect(result.matchBasis.explanation).toContain('1 NPI-exact record');
    expect(result.matchBasis.explanation).toContain('1 additional');

    // Both limitation codes should appear
    const codes = result.limitations.map((l) => l.code);
    expect(codes).toContain('OIG_EXCLUSION_ACTIVE');
    expect(codes).toContain('OIG_POSSIBLE_NAME_MATCH');
  });

  // ── unresolved (regression — must remain unchanged) ───────────────

  it('fetch error → confidence: unresolved + UNAVAILABLE (regression-guard)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      }),
    );

    const adapter = new OigLeieAdapter();
    const result = await adapter.fetch(QUERIED_NPI);

    expect(result.matchBasis.confidence).toBe('unresolved');
    expect(result.status).toBe(SourceStatus.UNAVAILABLE);
    expect(result.matchBasis.explanation).toMatch(/cannot confirm clearance/i);
  });
});
