import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { KNOWN_LANES } from '@/components/proof/trust-types';

/**
 * `freshnessWindowLabel` must agree with the backend catalog it claims to mirror.
 *
 * `computeLaneFreshness` (ProvenanceStrip) derives the operative window from
 * `sourceCatalog.refreshSlaHours`, carried on the passport as
 * `freshnessWindowHours` — but falls back to `freshnessWindowLabel` whenever the
 * passport omits it. So the label is not decoration: on the fallback path it is
 * what a verifier reads on /verify/[npi].
 *
 * It shipped transposed. NPPES was labelled `24 hours` (catalog: 168h/WEEKLY)
 * and OIG `7 days` (catalog: 24h/DAILY) — each lane wearing the other's window,
 * telling a verifier that a daily exclusion sweep refreshes weekly on the
 * employer-facing record. A copy error, invisible to review because both values
 * look individually plausible. Only cross-checking against the catalog catches
 * it, so that cross-check lives here.
 *
 * Reading the backend file over `fs` is deliberate: importing across the app
 * boundary would drag Prisma and the server runtime into a web unit test. The
 * regex is self-checked below so it fails loudly rather than silently matching
 * nothing if the catalog's formatting changes.
 */

const CATALOG_PATH = path.resolve(
  process.cwd(),
  '../api/backend/src/services/identity/sourceCatalog.ts',
);

/** sourceId → refreshSlaHours, parsed from the backend catalog. */
function catalogRefreshSlaHours(): Map<string, number> {
  const source = fs.readFileSync(CATALOG_PATH, 'utf8');
  const entries = new Map<string, number>();
  const re = /id:\s*'([A-Z0-9_]+)'[\s\S]{0,400}?refreshSlaHours:\s*(\d+)/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    if (!entries.has(m[1])) entries.set(m[1], Number(m[2]));
  }
  return entries;
}

function hoursToLabel(hours: number): string {
  // Sub-two-day windows read as hours, matching how the labels are written:
  // OIG's 24h is `24 hours`, not `1 days`. Check this before the `% 24` branch,
  // which would otherwise swallow it.
  if (hours < 48) return `${hours} hours`;
  if (hours % 8760 === 0) return hours === 8760 ? '1 year' : `${hours / 8760} years`;
  if (hours % 24 === 0) return `${hours / 24} days`;
  return `${hours} hours`;
}

const labelFor = (laneId: string) =>
  KNOWN_LANES.find((lane) => lane.laneId === laneId)?.freshnessWindowLabel;

/**
 * The lanes that return real source data today, and therefore the lanes whose
 * label can render beside an actual check age. Each maps to its catalog id.
 */
const LIVE_LANES: ReadonlyArray<{ laneId: string; sourceId: string }> = [
  { laneId: 'nppes_identity', sourceId: 'NPPES_API' },
  { laneId: 'oig_exclusions', sourceId: 'OIG_LEIE' },
  { laneId: 'pecos_enrollment', sourceId: 'PECOS_PUBLIC' },
];

describe('lane freshness labels agree with the backend source catalog', () => {
  const catalog = catalogRefreshSlaHours();

  it('parses the catalog (guard cannot silently pass on an empty map)', () => {
    expect(catalog.size).toBeGreaterThan(5);
    // Pin the two that shipped transposed, as raw hours.
    expect(catalog.get('NPPES_API')).toBe(168);
    expect(catalog.get('OIG_LEIE')).toBe(24);
  });

  it.each(LIVE_LANES)(
    '$laneId label matches $sourceId refreshSlaHours',
    ({ laneId, sourceId }) => {
      const hours = catalog.get(sourceId);
      expect(hours, `${sourceId} missing from the catalog`).toBeDefined();
      expect(labelFor(laneId)).toBe(hoursToLabel(hours as number));
    },
  );

  it('renders hours the way the labels are written', () => {
    expect(hoursToLabel(24)).toBe('24 hours');
    expect(hoursToLabel(168)).toBe('7 days');
    expect(hoursToLabel(2160)).toBe('90 days');
    expect(hoursToLabel(8760)).toBe('1 year');
  });

  /**
   * SETTLED 2026-07-26 (founder ruling): `state_license` stays at `30 days`.
   *
   * The divergence is real and intentional. The label is `30 days` while the
   * catalog sources it maps to (STATE_BOARD, NURSYS) both sit at 168h. Unlike
   * the NPPES/OIG swap corrected in #830 this is not a transposition: it is a
   * deliberate policy tolerance — how stale a board check may be before it is
   * re-pulled — not a claim about how often the upstream publishes.
   *
   * Two facts keep it safe. The lane is access-gated, so it returns no data and
   * the label never renders beside a real check age. And a tolerance that is
   * LONGER than the source's own refresh interval cannot overstate freshness;
   * it can only be conservative.
   *
   * So this test now pins a decision, not an open question. Do NOT "reconcile"
   * it with the catalog — reconciling would silently convert a product policy
   * into an observed interval, which is the exact confusion the readCadence
   * split (#817) exists to prevent. Changing it needs a new founder ruling.
   */
  it('keeps the ruled state_license window at 30 days, diverging from catalog by design', () => {
    expect(labelFor('state_license')).toBe('30 days');
    expect(catalog.get('STATE_BOARD')).toBe(168);
  });

  /**
   * `employment_history` (THE_WORK_NUMBER) and `board_cert` (ABMS) have no
   * catalog entry at all, so their labels — `90 days` and `1 year` — are
   * unverifiable against any source of truth. Both lanes are unintegrated, so
   * nothing renders today. Asserted so that wiring either lane trips this test
   * and forces a real window to be established first.
   */
  it('flags lanes whose window has no catalog backing', () => {
    expect(catalog.has('THE_WORK_NUMBER')).toBe(false);
    expect(catalog.has('ABMS')).toBe(false);
    expect(labelFor('employment_history')).toBe('90 days');
    expect(labelFor('board_cert')).toBe('1 year');
  });
});
