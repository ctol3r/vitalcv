/**
 * funnel-coverage.test.ts — no declared event may go unaccounted for.
 *
 * The failure this guards is specific and has happened twice. An event is
 * declared in FUNNEL_EVENTS, nothing ever emits it, and /api/internal/funnel-
 * metrics reports a permanent 0 that is indistinguishable from a measured zero:
 *
 *   - `signup_completed` carried the note "Never had a producer" for months.
 *   - `npi_bound` was not declared at all, so the acquisition funnel ended
 *     before its own conversion — a clinician reached the form and the funnel
 *     saw them vanish, while the backend happily wrote the audit rows.
 *
 * funnel-instrumentation.test.ts pins specific call sites. This asserts the
 * invariant those individual pins keep failing to cover: every event is either
 * counted and produced, or explicitly retired with a reason.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnel';
import {
  LIVE_FUNNEL_EVENTS,
  RETIRED_FUNNEL_EVENTS,
} from '@/lib/analytics/funnelCoverage';

const webRoot = join(__dirname, '..');

/** Reverse map: 'npi_bound' → 'NPI_BOUND', the identifier a producer writes. */
const KEY_FOR_VALUE = new Map(
  Object.entries(FUNNEL_EVENTS).map(([key, value]) => [value as string, key]),
);

/**
 * Does anything in the app emit this event?
 *
 * Searches for `FUNNEL_EVENTS.<KEY>` rather than the string literal, because
 * that is how every producer refers to it — and because the literal appears in
 * the declaration and in these lists, so a literal search would find itself.
 * Excludes __tests__ for the same reason: a test is not a producer.
 */
function hasProducer(eventValue: string): boolean {
  const key = KEY_FOR_VALUE.get(eventValue);
  if (!key) return false;

  try {
    const out = execFileSync(
      'git',
      [
        'grep',
        '-l',
        // --untracked, or a producer added in the working tree reads as absent
        // and this guard fails for a brand-new event purely because the file is
        // not staged yet. .gitignore still applies, so node_modules stays out.
        '--untracked',
        '--',
        `FUNNEL_EVENTS.${key}`,
        ':(exclude)__tests__',
        ':(exclude)lib/analytics',
        ':(exclude)app/_archive',
      ],
      { cwd: webRoot, encoding: 'utf8' },
    );
    return out.trim().length > 0;
  } catch {
    // git grep exits 1 when there are no matches.
    return false;
  }
}

describe('every declared event is accounted for', () => {
  it('classifies each FUNNEL_EVENTS value as either live or retired', () => {
    const live = new Set<string>(LIVE_FUNNEL_EVENTS);
    const retired = new Set(Object.keys(RETIRED_FUNNEL_EVENTS));

    const unaccounted = Object.values(FUNNEL_EVENTS).filter(
      (value) => !live.has(value) && !retired.has(value),
    );

    expect(unaccounted).toEqual([]);
  });

  it('never lists an event as both counted and retired', () => {
    const retired = new Set(Object.keys(RETIRED_FUNNEL_EVENTS));
    const both = LIVE_FUNNEL_EVENTS.filter((event) => retired.has(event));

    expect(both).toEqual([]);
  });

  it('gives every retired event a reason', () => {
    for (const [event, reason] of Object.entries(RETIRED_FUNNEL_EVENTS)) {
      expect(reason, `${event} needs a reason`).toBeTruthy();
      expect(reason.length, `${event}'s reason is too short to be one`).toBeGreaterThan(20);
    }
  });
});

describe('every counted event is actually produced', () => {
  it.each([...LIVE_FUNNEL_EVENTS])('%s has a producer in the app', (event) => {
    expect(hasProducer(event)).toBe(true);
  });
});

describe('the search-arrival lane', () => {
  it('declares the three steps a clinician arriving from search takes', () => {
    expect(FUNNEL_EVENTS.RECORD_VIEWED).toBe('record_viewed');
    expect(FUNNEL_EVENTS.CLAIM_CLICKED).toBe('claim_clicked');
    expect(FUNNEL_EVENTS.NPI_BOUND).toBe('npi_bound');
  });

  it('counts all three, so the lane has a computable rate', () => {
    const live = new Set<string>(LIVE_FUNNEL_EVENTS);

    expect(live.has(FUNNEL_EVENTS.RECORD_VIEWED)).toBe(true);
    expect(live.has(FUNNEL_EVENTS.CLAIM_CLICKED)).toBe(true);
    expect(live.has(FUNNEL_EVENTS.NPI_BOUND)).toBe(true);
  });

  it('emits the bind only after the bootstrap succeeded', () => {
    // Fired before the response was checked, this would count every attempt —
    // including the 409 a clinician gets when their NPI is already held by
    // another account — as a successful bind.
    const source = execFileSync('cat', ['app/get-ready/GetReadySurface.tsx'], {
      cwd: webRoot,
      encoding: 'utf8',
    });
    const bindAt = source.indexOf('FUNNEL_EVENTS.NPI_BOUND');
    const okGuardAt = source.indexOf('if (!res.ok) {');
    const shapeGuardAt = source.indexOf('if (!isNpiBootstrapResult(body)) {');

    expect(bindAt).toBeGreaterThan(-1);
    expect(bindAt).toBeGreaterThan(okGuardAt);
    expect(bindAt).toBeGreaterThan(shapeGuardAt);
  });
});
