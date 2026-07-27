/**
 * W0.5 — source-lane parity between /status and /api/status.
 *
 * `lib/trust/register.ts` records the incident this guards: /status was once a
 * hand-written table that marked OIG `partial` and omitted PECOS entirely,
 * under-reporting two lanes /api/status already published as live. Deriving
 * both surfaces from `sourceLanes.ts` fixed it, and nothing stopped it
 * recurring — a stale cache or half-deployed release reintroduces exactly the
 * same split without touching the registry.
 *
 * These test the pure comparison used by the post-deploy prober. They assert
 * the AVAILABILITY outcome, not the wording: copy is free to change, but a
 * lane may never read "available" on one surface and "not connected" on the
 * other.
 */

import { describe, expect, it } from 'vitest';

import {
  compareLaneParity,
  parseApiLanes,
  parseRenderedLanes,
  // @ts-expect-error — plain .mjs script module, no type declarations
} from '../../../scripts/lib/lane-parity.mjs';

/** The six lanes as production actually publishes them today. */
const LIVE_API = {
  source_lanes: {
    nppes_identity: { status: 'operational' },
    oig_exclusions: { status: 'operational' },
    pecos_enrollment: { status: 'operational' },
    state_license: { status: 'pending_integration' },
    employment_history: { status: 'non_production' },
    board_certification: { status: 'not_implemented' },
  },
};

const LIVE_PAGE = {
  nppes_identity: 'active',
  oig_exclusions: 'active',
  pecos_enrollment: 'active',
  state_license: 'planned',
  employment_history: 'unintegrated',
  board_certification: 'unintegrated',
};

describe('parseRenderedLanes', () => {
  it('extracts the lane key/lifecycle pairs from rendered rows', () => {
    const html = `
      <div class="x" data-lane-key="nppes_identity" data-lane-lifecycle="active">NPPES</div>
      <div class="x" data-lane-key="state_license" data-lane-lifecycle="planned">State</div>
    `;
    expect(parseRenderedLanes(html)).toEqual({
      nppes_identity: 'active',
      state_license: 'planned',
    });
  });

  it('does not depend on attribute order', () => {
    const html =
      '<div data-lane-lifecycle="active" data-lane-key="oig_exclusions">OIG</div>';
    expect(parseRenderedLanes(html)).toEqual({ oig_exclusions: 'active' });
  });

  it('ignores rows that are not source lanes', () => {
    // The page renders "Web application" and "API" rows through the same
    // component; they carry no lane attributes and must not be compared.
    const html =
      '<div class="x">Web application</div>' +
      '<div data-lane-key="pecos_enrollment" data-lane-lifecycle="active">PECOS</div>';
    expect(parseRenderedLanes(html)).toEqual({ pecos_enrollment: 'active' });
  });

  it('returns nothing for a page that lost the contract', () => {
    expect(parseRenderedLanes('<div>no lanes here</div>')).toEqual({});
  });
});

describe('parseApiLanes', () => {
  it('reads nested {status} objects — the shape production serves', () => {
    expect(parseApiLanes(LIVE_API)).toMatchObject({
      nppes_identity: 'operational',
      board_certification: 'not_implemented',
    });
  });

  it('tolerates a flat string value', () => {
    expect(parseApiLanes({ source_lanes: { oig_exclusions: 'operational' } })).toEqual({
      oig_exclusions: 'operational',
    });
  });

  it('returns nothing when the payload is unusable', () => {
    expect(parseApiLanes(null)).toEqual({});
    expect(parseApiLanes({})).toEqual({});
  });
});

describe('compareLaneParity', () => {
  it('passes on the six lanes production publishes today', () => {
    const result = compareLaneParity(LIVE_PAGE, parseApiLanes(LIVE_API));
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(6);
  });

  it('catches the historical drift: OIG live in the API, planned on the page', () => {
    const drifted = { ...LIVE_PAGE, oig_exclusions: 'planned' };
    const result = compareLaneParity(drifted, parseApiLanes(LIVE_API));
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/oig_exclusions/);
    expect(result.problems.join(' ')).toMatch(/disagrees/);
  });

  it('catches the other direction: page claims available, API says planned', () => {
    const drifted = { ...LIVE_PAGE, state_license: 'active' };
    const result = compareLaneParity(drifted, parseApiLanes(LIVE_API));
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/state_license/);
  });

  it('catches a lane dropped from the page — how PECOS went missing', () => {
    const { pecos_enrollment: _dropped, ...withoutPecos } = LIVE_PAGE;
    const result = compareLaneParity(withoutPecos, parseApiLanes(LIVE_API));
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/pecos_enrollment.*not rendered/);
  });

  it('catches a lane the page shows but the API does not publish', () => {
    const extra = { ...LIVE_PAGE, sanctions_monitor: 'active' };
    const result = compareLaneParity(extra, parseApiLanes(LIVE_API));
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/sanctions_monitor.*absent from/);
  });

  it('treats "partial" as available on both sides', () => {
    const page = { oig_exclusions: 'partial' };
    const api = { oig_exclusions: 'operational' };
    expect(compareLaneParity(page, api).ok).toBe(true);
  });

  it('fails closed on an unrecognised vocabulary rather than guessing', () => {
    expect(compareLaneParity({ a: 'active' }, { a: 'mostly_fine' }).ok).toBe(false);
    expect(compareLaneParity({ a: 'vibes' }, { a: 'operational' }).ok).toBe(false);
  });

  it('fails when a surface returns nothing at all', () => {
    // A /status page that 500s or deploys without the contract must be a
    // release blocker, not a silent pass.
    expect(compareLaneParity({}, parseApiLanes(LIVE_API)).ok).toBe(false);
    expect(compareLaneParity(LIVE_PAGE, {}).ok).toBe(false);
  });
});
