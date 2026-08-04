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

// The homepage is the Z1 product story (2026-08-03, superseding the
// six-scene film). This guard has now survived TWO compositions going stale
// under it — HomePageClient, then the film, whose file still contained the
// call after '/' stopped rendering it, keeping this green for a component no
// visitor reached. It points at the component the live hero actually mounts.
const homepage = webFile('components/evidence-record/NpiActivation.tsx');
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
      ['NpiActivation', homepage],
      ['passport page', passport],
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
