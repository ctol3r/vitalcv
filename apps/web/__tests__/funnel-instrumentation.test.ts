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
const passport = webFile('app/passport/page.tsx');
const console_ = webFile('components/hero/LiveTrustConsole.tsx');

describe('funnel instrumentation', () => {
  it('fires the denominator from the homepage', () => {
    expect(homepage).toContain('FUNNEL_EVENTS.HOMEPAGE_VIEWED');
  });

  it('fires the conversion event when a passport is viewable', () => {
    expect(passport).toContain('FUNNEL_EVENTS.RESULTS_DISPLAYED');
    expect(passport).toContain("outcome: 'passport'");
  });

  it('distinguishes every terminal failure mode', () => {
    for (const outcome of ['no_profile', 'disconnected', 'no_anchor', 'error']) {
      expect(passport, `missing drop-off outcome ${outcome}`).toContain(`'${outcome}'`);
    }
    expect(console_).toContain("outcome: 'invalid_length'");
  });

  it('never sends an NPI value, hashed or otherwise', () => {
    // A SHA-256 of a 10-digit number is brute-forceable, so hashNpi() is not
    // anonymisation and must not be used to justify sending an NPI.
    for (const [name, src] of [
      ['HomePageClient', homepage],
      ['passport page', passport],
      ['LiveTrustConsole', console_],
    ] as const) {
      expect(src, `${name} must not hash an NPI into analytics`).not.toContain('hashNpi');
    }
    // The only NPI-derived property permitted is a digit count.
    expect(console_).toContain('npi_length: cleanNpi.length');
    expect(console_).not.toMatch(/npi:\s*cleanNpi/);
  });

  /*
   * Wave 1072C / C7 — the one real loop resolves a REAL clinician, so its
   * events run closest to identifying data. The founder boundary is explicit:
   * no NPI, clinician name, credential detail, or blocker text in a payload.
   *
   * This is an allowlist over the actual call sites rather than a scan for
   * known-bad words: a scan goes green the moment someone invents a new key.
   */
  it('the career loop sends only stage metadata — never identity or blockers', () => {
    const ALLOWED_KEYS = new Set(['count', 'kind', 'outcome']);
    const loopFiles = [
      'lib/career-loop/useCareerLoop.ts',
      'components/career-loop/CareerLoop.tsx',
      'components/apply/ApplyWithVitalCV.tsx',
    ];

    let callsChecked = 0;
    for (const rel of loopFiles) {
      const src = webFile(rel);
      // trackFunnelEvent(EVENT) or trackFunnelEvent(EVENT, { k: v, ... })
      for (const m of src.matchAll(/trackFunnelEvent\(\s*[^,)]+(?:,\s*\{([^}]*)\})?\s*\)/g)) {
        callsChecked += 1;
        const props = m[1];
        if (!props) continue;
        for (const km of props.matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g)) {
          const key = km[1];
          expect(
            ALLOWED_KEYS.has(key),
            `${rel} sends analytics property "${key}"; the loop may send only ${[...ALLOWED_KEYS].join(', ')}`,
          ).toBe(true);
        }
      }
    }

    // If the regex ever stops matching, this test would pass vacuously.
    expect(callsChecked).toBeGreaterThan(8);
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
