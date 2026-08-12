/**
 * NUM-1.6 — the acquisition funnel is computable.
 *
 * `homepage_viewed` (the denominator) and `results_displayed` (the conversion)
 * were declared in FUNNEL_EVENTS but fired from nowhere, so no rate in the
 * funnel could be calculated and a run that died was indistinguishable from one
 * that succeeded. These tests pin the call sites so the funnel cannot silently
 * lose an end again, and pin the PII rule.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { FUNNEL_EVENTS } from '@/lib/analytics/funnel';
import {
  LIVE_FUNNEL_EVENTS,
  RETIRED_FUNNEL_EVENTS,
} from '@/lib/analytics/funnelCoverage';

const webFile = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');

// The homepage is the six-scene film (#859). This pointed at
// `app/HomePageClient.tsx` until 2026-07-26 and kept passing after the switch —
// asserting the denominator fired from a component no visitor reaches. The
// funnel was in fact intact, but this guard could not have told us either way.
const homepage = webFile('components/home/film/HorizontalCareerFilm.tsx');
// /passport retired 2026-08-07 — the anonymous acquisition funnel's terminal
// states live in /onboarding's guest lane now (GetReadySurface.resolveGuest),
// which took over as the only producer of RESULTS_DISPLAYED.
const guestLane = webFile('app/get-ready/GetReadySurface.tsx');
// The internal metrics endpoint must derive steps from events that still have
// producers — it kept counting npi_input_focused after the hero console died
// with the /passport retirement, rendering a permanent 0 as a measurement.
const metricsRoute = webFile('app/api/internal/funnel-metrics/route.ts');

describe('funnel instrumentation', () => {
  it('fires the denominator from the homepage', () => {
    expect(homepage).toContain('FUNNEL_EVENTS.HOMEPAGE_VIEWED');
  });

  it('fires the conversion event when the anonymous record is displayed', () => {
    expect(guestLane).toContain('FUNNEL_EVENTS.RESULTS_DISPLAYED');
    expect(guestLane).toContain("outcome: 'guest_record'");
  });

  it('marks the funnel start when a guest submits an NPI', () => {
    expect(guestLane).toContain('FUNNEL_EVENTS.NPI_SUBMITTED');
  });

  it('distinguishes every terminal failure mode', () => {
    for (const outcome of ['organization', 'unavailable']) {
      expect(guestLane, `missing drop-off outcome ${outcome}`).toContain(`outcome: '${outcome}'`);
    }
  });

  it('keeps the pilot-ops passport_viewed KPI producing', () => {
    // passport_viewed is a named pilot funnel step (pilotFunnelService) whose
    // only producer was the retired /passport page. The guest lane re-emits
    // it at the honest equivalent moment so the KPI never silently zeroes.
    expect(guestLane).toContain('UX_EVENTS.PASSPORT_VIEWED');
  });

  it('never sends an NPI value, hashed or otherwise', () => {
    // A SHA-256 of a 10-digit number is brute-forceable, so hashNpi() is not
    // anonymisation and must not be used to justify sending an NPI.
    for (const [name, src] of [
      ['HomePageClient', homepage],
      ['guest lane', guestLane],
    ] as const) {
      expect(src, `${name} must not hash an NPI into analytics`).not.toContain('hashNpi');
    }
  });

  it('derives internal funnel metrics from events that still have producers', () => {
    // Reads the exported list rather than regexing `const LIVE_FUNNEL_EVENTS`
    // out of the route source. The regex version asserted where the array was
    // declared, not what it held: moving the list into
    // lib/analytics/funnelCoverage.ts — without changing a single event —
    // failed this test, while emptying the array in its old location would
    // have passed it.
    const live = new Set<string>(LIVE_FUNNEL_EVENTS);

    for (const event of [
      FUNNEL_EVENTS.HOMEPAGE_VIEWED,
      FUNNEL_EVENTS.NPI_INPUT_STARTED,
      FUNNEL_EVENTS.NPI_SUBMITTED,
      FUNNEL_EVENTS.RESULTS_DISPLAYED,
      FUNNEL_EVENTS.DROPOFF_DETECTED,
    ]) {
      expect(live.has(event), `live funnel lost ${event}`).toBe(true);
    }
    expect(
      live.has(FUNNEL_EVENTS.NPI_INPUT_FOCUSED),
      'npi_input_focused lost its only producer on 2026-08-07 (#1099) — it may appear only as a labelled retired event',
    ).toBe(false);
    expect(
      Object.keys(RETIRED_FUNNEL_EVENTS),
      'retired steps must stay labelled, not silently dropped',
    ).toContain(FUNNEL_EVENTS.NPI_INPUT_FOCUSED);
    expect(
      metricsRoute,
      'the route must still consume both lists',
    ).toContain('funnelCoverage');
  });

  it('keeps the documented event names in sync with the schema doc', () => {
    const doc = readFileSync(
      path.join(__dirname, '..', '..', '..', 'docs', 'ops', 'metrics-analytics.md'),
      'utf8',
    );
    for (const event of [
      FUNNEL_EVENTS.HOMEPAGE_VIEWED,
      FUNNEL_EVENTS.NPI_INPUT_FOCUSED,
      FUNNEL_EVENTS.NPI_SUBMITTED,
      FUNNEL_EVENTS.RESULTS_DISPLAYED,
      FUNNEL_EVENTS.DROPOFF_DETECTED,
    ]) {
      expect(doc, `event ${event} is undocumented`).toContain(event);
    }
  });
});
