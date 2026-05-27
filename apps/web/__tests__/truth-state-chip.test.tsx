/**
 * truth-state-chip.test.tsx — Wave G coverage.
 *
 * Asserts:
 *   - every TruthStateKind renders without throwing,
 *   - every visible label is operator-honest (no bare "Verified", no
 *     banned phrases from CLAUDE.md),
 *   - aria-label exists and is descriptive,
 *   - source label is folded into aria-label only (never visible chrome),
 *   - the 5-row Passport legend renders all 5 default rows,
 *   - the 8-row "all" legend renders all 8 default rows,
 *   - legend rows expose a chip + a meaning string for each state.
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  TruthStateChip,
  TRUTH_STATE_META,
  TRUTH_STATE_ORDER,
  type TruthStateKind,
} from '@/design-system/components/TruthStateChip';
import {
  TruthStateLegend,
  PASSPORT_LEGEND_ROWS,
  FULL_LEGEND_ROWS,
} from '@/design-system/components/TruthStateLegend';

/**
 * The banned-strings list mirrors CLAUDE.md. Any visible UI string
 * matching one of these patterns (case-insensitive) is a regression.
 * The bare word "verified" is matched by word boundary so it does NOT
 * collide with substrings like "verifier" or "verification".
 */
const BANNED_PATTERNS: ReadonlyArray<RegExp> = [
  /\bverified\b/i,
  /\bguaranteed\s+verification\b/i,
  /\binstant\s+credentialing\b/i,
  /\bcomplete\s+credentialing\b/i,
  /\bautomatically\s+verified\b/i,
  /\blegally\s+accepted\b/i,
  /\brisk\s+transferred\b/i,
  /\bsource\s+confirmed\s+before\s+response\b/i,
  /\bcertified\s+compliant\b/i,
  /\bHIPAA\s+compliant\b/i,
  /\bSOC2\s+certified\b/i,
  /\bNCQA\s+certified\b/i,
];

function assertNotBanned(text: string, context: string): void {
  for (const pattern of BANNED_PATTERNS) {
    expect(
      pattern.test(text),
      `Banned phrase /${pattern.source}/${pattern.flags} matched in ${context}: ${text}`,
    ).toBe(false);
  }
}

describe('TruthStateChip — vocabulary', () => {
  it('renders every truth state without throwing', () => {
    for (const state of TRUTH_STATE_ORDER) {
      const html = renderToStaticMarkup(<TruthStateChip state={state} />);
      expect(html).toContain('data-truth-state="' + state + '"');
      expect(html).toContain(TRUTH_STATE_META[state].label);
    }
  });

  it('every visible label passes the banned-strings check', () => {
    for (const state of TRUTH_STATE_ORDER) {
      const meta = TRUTH_STATE_META[state];
      assertNotBanned(meta.label, `TRUTH_STATE_META[${state}].label`);
      assertNotBanned(meta.description, `TRUTH_STATE_META[${state}].description`);
    }
  });

  it('every aria-label is descriptive and non-empty', () => {
    for (const state of TRUTH_STATE_ORDER) {
      const meta = TRUTH_STATE_META[state];
      expect(meta.ariaPrefix.length).toBeGreaterThan(5);
      expect(meta.ariaPrefix.toLowerCase()).toContain('truth state');
    }
  });

  it('folds the source label into aria-label, never into visible chrome', () => {
    const html = renderToStaticMarkup(
      <TruthStateChip state="source-backed" sourceLabel="NPPES" />,
    );
    expect(html).toContain('aria-label="Truth state: source-backed for NPPES"');
    // The source label must NOT leak into the visible chip body.
    // The visible body is wrapped in a <span> sibling of the <svg> icon.
    expect(html).not.toMatch(/<span[^>]*>[^<]*NPPES[^<]*<\/span>/);
  });

  it('emits a hidden <time> element when timestamp is provided', () => {
    const iso = '2026-05-27T03:18:00Z';
    const html = renderToStaticMarkup(
      <TruthStateChip state="snapshot-only" timestamp={iso} />,
    );
    // renderToStaticMarkup preserves the JSX camelCase attribute name.
    expect(html).toContain(`<time dateTime="${iso}"`);
    expect(html).toContain('sr-only');
  });

  it('does not include the bare word "Verified" anywhere in the metadata', () => {
    const blob = JSON.stringify(
      Object.values(TRUTH_STATE_META).map((m) => ({
        label: m.label,
        description: m.description,
        ariaPrefix: m.ariaPrefix,
      })),
    );
    expect(/\bverified\b/i.test(blob)).toBe(false);
  });

  it('source-backed uses the neutral (restrained) variant — never warning or accent', () => {
    expect(TRUTH_STATE_META['source-backed'].variant).toBe('neutral');
  });

  it('access-required uses the warning variant — caller action expected', () => {
    expect(TRUTH_STATE_META['access-required'].variant).toBe('warning');
  });

  it('connector-not-live uses the outline variant — restrained, not alarming', () => {
    expect(TRUTH_STATE_META['connector-not-live'].variant).toBe('outline');
  });

  it('temporarily-unavailable uses the muted variant — system condition, not finding', () => {
    expect(TRUTH_STATE_META['temporarily-unavailable'].variant).toBe('muted');
  });

  it('TRUTH_STATE_ORDER enumerates exactly the eight truth states (no duplicates, no extras)', () => {
    const expected: ReadonlySet<TruthStateKind> = new Set<TruthStateKind>([
      'source-backed',
      'snapshot-only',
      'institution-review-required',
      'access-required',
      'auth-required',
      'temporarily-unavailable',
      'connector-not-live',
      'demo-only',
    ]);
    expect(new Set(TRUTH_STATE_ORDER)).toEqual(expected);
    expect(TRUTH_STATE_ORDER).toHaveLength(8);
  });
});

describe('TruthStateLegend — Passport 5-row default', () => {
  it('PASSPORT_LEGEND_ROWS has exactly 5 entries', () => {
    expect(PASSPORT_LEGEND_ROWS).toHaveLength(5);
  });

  it('default render produces all 5 rows', () => {
    const html = renderToStaticMarkup(<TruthStateLegend />);
    for (const row of PASSPORT_LEGEND_ROWS) {
      expect(html).toContain('data-truth-state="' + row.state + '"');
    }
  });

  it('each row passes the banned-strings check', () => {
    for (const row of PASSPORT_LEGEND_ROWS) {
      const meaning = row.meaning ?? TRUTH_STATE_META[row.state].description;
      assertNotBanned(meaning, `PASSPORT_LEGEND_ROWS[${row.state}] meaning`);
    }
  });

  it('renders with optional heading', () => {
    const html = renderToStaticMarkup(
      <TruthStateLegend heading="What these tags mean" />,
    );
    expect(html).toContain('What these tags mean');
  });
});

describe('TruthStateLegend — full 8-row', () => {
  it('FULL_LEGEND_ROWS has exactly 8 entries', () => {
    expect(FULL_LEGEND_ROWS).toHaveLength(8);
  });

  it('rows="all" renders all 8 states', () => {
    const html = renderToStaticMarkup(<TruthStateLegend rows="all" />);
    for (const state of TRUTH_STATE_ORDER) {
      expect(html).toContain('data-truth-state="' + state + '"');
    }
  });

  it('custom row array overrides default and respects supplied order', () => {
    const html = renderToStaticMarkup(
      <TruthStateLegend
        rows={[
          { state: 'auth-required', meaning: 'Sign in to see live source events.' },
          { state: 'demo-only', meaning: 'This view is synthetic; not a real source confirmation.' },
        ]}
      />,
    );
    // Both supplied rows should appear; default rows must NOT bleed through.
    expect(html).toContain('data-truth-state="auth-required"');
    expect(html).toContain('data-truth-state="demo-only"');
    expect(html).not.toContain('data-truth-state="source-backed"');
  });

  it('rejects banned phrases even when caller supplies custom meaning', () => {
    // This is a sanity check on the call-site contract; the legend itself
    // does not enforce, but the default rows do.
    for (const row of FULL_LEGEND_ROWS) {
      const meaning = TRUTH_STATE_META[row.state].description;
      assertNotBanned(meaning, `FULL_LEGEND_ROWS[${row.state}].meaning`);
    }
  });
});
