/**
 * The pilot page may not out-claim the source-lane registry.
 *
 * The 2026-07-26 YC audit found this page publishing, in one view:
 *   "Automated source lanes: 4 — NPPES · OIG LEIE · PECOS public ·
 *    state-board adapter"
 * while forty lines lower listing "Configured state-board PSV adapters" under
 * what remains PARTIAL, and while /api/status, /status and /status/technical
 * all published `state_license` as `pending_integration`. The buyer-facing
 * headline counted a lane the rest of the product calls unavailable.
 *
 * It also said `JSON · ZIP · PDF` in the metric strip and "(JSON and ZIP)" in
 * the live-capability list — a self-contradiction in a single screenshot.
 *
 * The deploy-time parity prober covers /status and /status/technical. It does
 * NOT cover /pilot, so this is the guard for the acquisition surface: the
 * claim is derived from SOURCE_LANE_OPS, and these assertions fail if anyone
 * re-hardcodes it or if a lane's registry status changes without the page
 * following.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

const SOURCE = readFileSync(
  join(__dirname, '..', 'app/pilot/page.tsx'),
  'utf8',
);

/** Comment blocks document the removed strings on purpose — strip them. */
const RENDERED = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('pilot page — automated-lane claim', () => {
  it('counts only lanes the registry calls operational', () => {
    const operational = SOURCE_LANE_OPS.filter(
      (l) => l.statusApiStatus === 'operational',
    );
    // Today that is NPPES, OIG and PECOS. If a lane genuinely goes live the
    // page follows automatically; this pins the derivation, not the number.
    expect(operational.length).toBe(3);
    expect(operational.map((l) => l.laneId).sort()).toEqual(
      ['nppes_identity', 'oig_exclusions', 'pecos_enrollment'].sort(),
    );
  });

  it('does not hard-code a lane count', () => {
    // The literal that caused the overclaim.
    expect(RENDERED).not.toMatch(/value:\s*['"]4['"]/);
    expect(RENDERED).toContain('AUTOMATED_LANES.length');
  });

  it('never names a non-operational lane as automated', () => {
    const nonOperational = SOURCE_LANE_OPS.filter(
      (l) => l.statusApiStatus !== 'operational',
    ).map((l) => l.laneId);
    // state_license / employment_history / board_cert must not appear in the
    // automated-lanes note. `state-board adapter` was the exact regression.
    expect(nonOperational.length).toBeGreaterThan(0);
    expect(RENDERED).not.toMatch(/state-board adapter/i);
  });
});

describe('pilot page — export-format claim', () => {
  it('states the formats from one constant, not twice by hand', () => {
    expect(RENDERED).toContain('EXPORT_FORMATS_LABEL');
    expect(RENDERED).toContain('EXPORT_FORMATS_PROSE');
  });

  it('no longer contradicts itself about PDF', () => {
    // The stale half said exports were "(JSON and ZIP)" while the metric strip
    // said JSON · ZIP · PDF. PDF is real — /api/export/packet renders one and
    // returns application/pdf — so the prose was the understatement.
    expect(RENDERED).not.toContain('(JSON and ZIP)');
  });
});

describe('pilot page — no implementation vocabulary on a buyer page', () => {
  it.each([['mock'], ['scaffold'], ['provider-pluggable']])(
    'does not say "%s"',
    (word) => {
      expect(RENDERED.toLowerCase()).not.toContain(word);
    },
  );

  it('still discloses that the pilot issues no production credentials', () => {
    // Removing dev vocabulary must not remove the limitation it carried.
    expect(RENDERED).toMatch(/does not issue production credentials/i);
  });
});
