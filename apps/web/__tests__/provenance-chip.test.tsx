/**
 * provenance-chip.test.tsx — W1 (Provenance Chip System v2).
 *
 * Asserts the truth-contract contract of the canonical provenance-carrying
 * chip:
 *   - every state renders without throwing and is honest (no bare "Verified",
 *     no banned CLAUDE.md phrases),
 *   - the source + timestamp render in a *visible* mono line (not sr-only) —
 *     the property that distinguishes ProvenanceChip from TruthStateChip,
 *   - `revoked` is a distinct fail-closed (red / severity-critical) register,
 *   - `selfAttested` renders in a dashed band,
 *   - the order arrays enumerate exactly the expected states,
 *   - timestamps are normalized to a compact, locale-independent UTC form.
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  ProvenanceChip,
  ProvenanceChipLegend,
  PROVENANCE_META,
  PROVENANCE_ORDER,
  PROVENANCE_CORE_ORDER,
  PROVENANCE_LEGEND_ROWS,
  formatProvenanceTimestamp,
  type ProvenanceState,
} from '@/design-system/components';

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

describe('ProvenanceChip — vocabulary & honesty', () => {
  it('renders every state without throwing and tags it', () => {
    for (const state of PROVENANCE_ORDER) {
      const html = renderToStaticMarkup(<ProvenanceChip state={state} attribution={{ legend: true }} />);
      expect(html).toContain('data-provenance-state="' + state + '"');
      expect(html).toContain(PROVENANCE_META[state].label);
    }
  });

  it('every visible label and description passes the banned-strings check', () => {
    for (const state of PROVENANCE_ORDER) {
      const meta = PROVENANCE_META[state];
      assertNotBanned(meta.label, `PROVENANCE_META[${state}].label`);
      assertNotBanned(meta.description, `PROVENANCE_META[${state}].description`);
    }
  });

  it('never emits the bare word "Verified" anywhere in the metadata', () => {
    const blob = JSON.stringify(PROVENANCE_META);
    expect(/\bverified\b/i.test(blob)).toBe(false);
  });

  it('only `checked` earns the word "Checked"', () => {
    expect(PROVENANCE_META.checked.label).toBe('Checked');
    const checkedLabels = PROVENANCE_ORDER.filter(
      (s) => PROVENANCE_META[s].label === 'Checked',
    );
    expect(checkedLabels).toEqual(['checked']);
  });
});

describe('ProvenanceChip — visible provenance line (the differentiator)', () => {
  it('renders source and timestamp VISIBLY (never sr-only)', () => {
    const html = renderToStaticMarkup(
      <ProvenanceChip state="checked" attribution={{ source: "NPPES", asOf: "2026-07-14T09:12:00Z" }} />,
    );
    // The provenance is visible chrome, not screen-reader-only.
    expect(html).toContain('NPPES');
    expect(html).toContain('2026-07-14 09:12Z');
    expect(html).not.toContain('sr-only');
  });

  it('joins source · timestamp · detail with a middot separator', () => {
    const html = renderToStaticMarkup(
      <ProvenanceChip state="checked" attribution={{ source: "OIG LEIE", asOf: "2026-07-17T14:32:00Z", detail: "no match" }} />,
    );
    expect(html).toContain('OIG LEIE');
    expect(html).toContain('no match');
    expect(html).toContain(' · ');
  });

  it('omits the provenance line entirely when there is nothing to show', () => {
    const html = renderToStaticMarkup(<ProvenanceChip state="pending" attribution={{ declared: "check in progress" }} />);
    expect(html).not.toContain('font-mono');
  });

  it('folds source + timestamp + fail-closed into the aria-label', () => {
    const html = renderToStaticMarkup(
      <ProvenanceChip state="revoked" attribution={{ source: "Issuer", asOf: "2026-06-30T00:00:00Z" }} />,
    );
    expect(html).toMatch(/aria-label="[^"]*Issuer[^"]*"/);
    expect(html).toMatch(/aria-label="[^"]*fail closed[^"]*"/);
  });
});

describe('ProvenanceChip — fail-closed & self-attested registers', () => {
  it('marks `revoked` as fail-closed and uses the reserved severity-critical red', () => {
    const html = renderToStaticMarkup(<ProvenanceChip state="revoked" attribution={{ legend: true }} />);
    expect(html).toContain('data-fail-closed="true"');
    expect(html).toContain('--vt-severity-critical');
  });

  it('reserves fail-closed for `revoked` alone', () => {
    for (const state of PROVENANCE_ORDER) {
      const isFailClosed = Boolean(PROVENANCE_META[state].failClosed);
      expect(isFailClosed).toBe(state === 'revoked');
    }
  });

  it('renders `selfAttested` in a dashed band', () => {
    const html = renderToStaticMarkup(<ProvenanceChip state="selfAttested" attribution={{ declared: "entered by holder" }} />);
    expect(html).toContain('border-dashed');
  });

  it('does not paint any non-revoked state with severity-critical red', () => {
    for (const state of PROVENANCE_ORDER) {
      if (state === 'revoked') continue;
      const html = renderToStaticMarkup(<ProvenanceChip state={state} attribution={{ legend: true }} />);
      expect(html).not.toContain('--vt-severity-critical');
    }
  });
});

describe('ProvenanceChip — order arrays', () => {
  it('PROVENANCE_ORDER enumerates all 12 states with no duplicates', () => {
    const expected: ReadonlySet<ProvenanceState> = new Set<ProvenanceState>([
      'checked', 'stale', 'pending', 'gated', 'unavailable',
      'accessRequired', 'reviewRequired', 'notDecisionGrade', 'notFound', 'previewOnly',
      'revoked', 'selfAttested',
    ]);
    expect(new Set(PROVENANCE_ORDER)).toEqual(expected);
    expect(PROVENANCE_ORDER).toHaveLength(12);
  });

  it('PROVENANCE_CORE_ORDER is the six-register set ending in the two "never a check" states', () => {
    expect(PROVENANCE_CORE_ORDER).toEqual([
      'checked', 'gated', 'stale', 'unavailable', 'revoked', 'selfAttested',
    ]);
  });
});

describe('formatProvenanceTimestamp', () => {
  it('normalizes an ISO instant to compact UTC', () => {
    expect(formatProvenanceTimestamp('2026-07-14T09:12:00Z')).toBe('2026-07-14 09:12Z');
    expect(formatProvenanceTimestamp('2026-01-04T23:59:59.123Z')).toBe('2026-01-04 23:59Z');
  });

  it('passes honest relative phrases through unchanged', () => {
    expect(formatProvenanceTimestamp('214d ago')).toBe('214d ago');
  });
});

describe('ProvenanceChipLegend', () => {
  it('core legend renders the six-register set with example provenance', () => {
    const html = renderToStaticMarkup(<ProvenanceChipLegend heading="What these mean" />);
    expect(html).toContain('What these mean');
    for (const row of PROVENANCE_LEGEND_ROWS) {
      expect(html).toContain('data-provenance-state="' + row.state + '"');
    }
    // an example provenance line is visible
    expect(html).toContain('NPPES');
  });

  it('every default legend meaning passes the banned-strings check', () => {
    for (const row of PROVENANCE_LEGEND_ROWS) {
      const meaning = row.meaning ?? PROVENANCE_META[row.state].description;
      assertNotBanned(meaning, `PROVENANCE_LEGEND_ROWS[${row.state}] meaning`);
    }
  });

  it('rows="all" renders every state', () => {
    const html = renderToStaticMarkup(<ProvenanceChipLegend rows="all" />);
    for (const state of PROVENANCE_ORDER) {
      expect(html).toContain('data-provenance-state="' + state + '"');
    }
  });
});
