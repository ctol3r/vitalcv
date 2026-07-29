/**
 * /verify/[npi] — cadence-relative lane freshness (NEW-2).
 *
 * The public verification record rendered a periodic source as a clean
 * `Source-backed` tier next to a bare absolute timestamp. For a quarterly
 * source read 17 days ago that reads as "just checked", while the replay
 * chronology on the SAME page flagged the interval as a gap — one page, two
 * stories. Same doctrine class as the "read live" overstatement (#817).
 *
 * The repair is not a new staleness threshold: the backend already owns that
 * policy (sourceCatalog.refreshSlaHours → pecosContract.isPecosFresh, which
 * flips PECOS to canonical `stale` past its 2160h window). The repair is to
 * stop discarding it — the age is shown against the source's own window, so a
 * reviewer sees 17 of 90 instead of doing the arithmetic.
 *
 * These pin:
 *   - a within-window periodic read shows age + window, never "just checked",
 *   - a past-window read is marked overdue even if the tier still says checked,
 *   - a lane with no published window reports age only (no invented cadence),
 *   - backend sourceIds (`PECOS_PUBLIC`) resolve to the lane name, not raw ids,
 *   - the passport's freshnessWindowHours survives the trip to the strip,
 *   - no bare "Verified" is introduced on the employer-facing record.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import VerifierPage from '../app/verify/[npi]/page';
import {
  ProvenanceStrip,
  describeLaneFreshness,
} from '@/components/verifier/ProvenanceStrip';
import { findLaneDefinition } from '@/components/proof/trust-types';

const NOW = Date.parse('2026-07-21T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
/** CMS PECOS refreshSlaHours = 2160 (quarterly). */
const PECOS_WINDOW_MS = 2160 * 60 * 60 * 1000;

describe('describeLaneFreshness — age against the source\'s own window', () => {
  it('treats a 17-day-old quarterly read as current, and says so relative to the window', () => {
    const result = describeLaneFreshness(NOW - 17 * DAY, PECOS_WINDOW_MS, NOW);
    expect(result.state).toBe('current');
    expect(result.label).toBe('17d ago · 90d window');
  });

  it('marks a read past its own window as overdue', () => {
    const result = describeLaneFreshness(NOW - 104 * DAY, PECOS_WINDOW_MS, NOW);
    expect(result.state).toBe('overdue');
    expect(result.label).toBe('104d ago · past 90d window');
  });

  it('reports age only when the source publishes no refresh window', () => {
    const result = describeLaneFreshness(NOW - 17 * DAY, undefined, NOW);
    expect(result.state).toBe('unknown');
    expect(result.label).toBe('17d ago');
  });

  it('says nothing about freshness when the lane was never checked', () => {
    expect(describeLaneFreshness(null, PECOS_WINDOW_MS, NOW)).toEqual({
      state: 'unknown',
      label: null,
    });
  });
});

describe('lane identity — backend sourceIds resolve to lane definitions', () => {
  it('resolves the passport catalog id and the degraded-stub spelling alike', () => {
    for (const id of ['PECOS_PUBLIC', 'pecos_public', 'pecos_enrollment']) {
      expect(findLaneDefinition(id)?.displayName).toBe('PECOS Enrollment');
    }
    expect(findLaneDefinition('NPPES_API')?.displayName).toBe('NPPES Identity');
    expect(findLaneDefinition('OIG_LEIE')?.displayName).toBe('OIG Exclusions');
    expect(findLaneDefinition('STATE_BOARD')?.displayName).toBe('State License');
  });

  it('returns null for an unknown source rather than inventing a name', () => {
    expect(findLaneDefinition('SOME_UNMAPPED_SOURCE')).toBeNull();
  });
});

describe('ProvenanceStrip — the employer-facing lane row', () => {
  it('contextualizes a 17-day-old quarterly PECOS read instead of implying it is fresh', () => {
    const html = renderToStaticMarkup(
      <ProvenanceStrip
        now={NOW}
        lanes={[{
          laneId: 'PECOS_PUBLIC',
          status: 'verified',
          checkedAt: NOW - 17 * DAY,
          receiptId: null,
          freshnessWindowMs: PECOS_WINDOW_MS,
        }]}
      />,
    );

    expect(html).toContain('17d ago · 90d window');
    expect(html).toContain('data-lane-freshness="current"');
    // the lane reads as a source, not as a raw catalog id
    expect(html).toContain('PECOS Enrollment');
    // the tier itself is unchanged — the backend owns that state
    expect(html).toContain('Source-backed');
    // and the absolute stamp is still there for the record
    expect(html).toContain('2026-07-04');
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });

  it('flags a past-window read as overdue even while the tier still reads source-backed', () => {
    const html = renderToStaticMarkup(
      <ProvenanceStrip
        now={NOW}
        lanes={[{
          laneId: 'PECOS_PUBLIC',
          status: 'verified',
          checkedAt: NOW - 104 * DAY,
          receiptId: null,
          freshnessWindowMs: PECOS_WINDOW_MS,
        }]}
      />,
    );

    expect(html).toContain('past 90d window');
    expect(html).toContain('data-lane-freshness="overdue"');
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });
});

describe('/verify/[npi] — the passport freshness window reaches the strip', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders lane age against the window the passport published', async () => {
    const checkedAt = new Date(NOW - 17 * DAY).toISOString();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/api/passport/npi/')) {
          return new Response(
            JSON.stringify({
              identity: { displayName: 'Test Clinician' },
              sourceCoverage: {
                checks: [{
                  sourceId: 'PECOS_PUBLIC',
                  state: 'checked',
                  reason: 'PECOS quarterly enrollment checked',
                  checkedAt,
                  freshnessWindowHours: 2160,
                }],
              },
            }),
            { status: 200 },
          );
        }
        return new Response('{}', { status: 404 });
      }),
    );

    const html = renderToStaticMarkup(
      (await VerifierPage({ params: Promise.resolve({ npi: '1234567890' }) })) as React.ReactElement,
    );

    // the window survived normalization → lane snapshot → strip
    expect(html).toContain('90d window');
    expect(html).toContain('PECOS Enrollment');
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });
});
