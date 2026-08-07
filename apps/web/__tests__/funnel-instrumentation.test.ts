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
const console_ = webFile('components/hero/LiveTrustConsole.tsx');

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
    expect(console_).toContain("outcome: 'invalid_length'");
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
      ['LiveTrustConsole', console_],
    ] as const) {
      expect(src, `${name} must not hash an NPI into analytics`).not.toContain('hashNpi');
    }
    // The only NPI-derived property permitted is a digit count.
    expect(console_).toContain('npi_length: cleanNpi.length');
    expect(console_).not.toMatch(/npi:\s*cleanNpi/);
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
