import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  EvidenceProvenanceChip,
  EVIDENCE_TO_PROVENANCE,
} from '@/lib/vital/evidenceStateToProvenance';
import { EVIDENCE_STATE, type EvidenceState } from '@/lib/vital/evidenceState';

/**
 * W1082 — the attributed evidence chip contract.
 *
 * Successor to `state-chip-attribution.test.tsx`. `components/vital/StateChip`
 * was deleted in UX-02 Step 4 and its surfaces now render ProvenanceChip
 * through `EVIDENCE_TO_PROVENANCE`. Every guarantee the old file pinned is
 * re-pinned here against the new mechanism — the accessible-name *format*
 * changed (ProvenanceChip joins with commas; StateChip used an em dash), the
 * *guarantees* did not:
 *
 *  - a source form names the source and the as-of — with `asOf: null`
 *    announced as "as-of not recorded", never silently dropped, never invented;
 *  - `declared` names an actor and no source;
 *  - `legend` announces itself as a vocabulary example, so it can never be
 *    mistaken for a result about a real person;
 *  - the state word is visible text, never colour alone.
 *
 * The type-level half lives in `design-system/provenanceChipContract.check.tsx`
 * — outside __tests__, because this directory is excluded from the tsconfig and
 * a @ts-expect-error here would be validated by nothing.
 */

const STATES = Object.keys(EVIDENCE_STATE) as EvidenceState[];

describe('attributed source form', () => {
  it('announces the source and the as-of inside the accessible name', () => {
    const html = renderToStaticMarkup(
      <EvidenceProvenanceChip
        state="source_backed"
        attribution={{ source: 'NPPES', asOf: 'Jul 15, 2026' }}
      />,
    );
    expect(html).toMatch(/aria-label="[^"]*Source-backed[^"]*"/);
    expect(html).toMatch(/aria-label="[^"]*NPPES[^"]*"/);
    expect(html).toMatch(/aria-label="[^"]*Jul 15, 2026[^"]*"/);
  });

  it('announces a missing timestamp as not recorded — unknown is first-class', () => {
    const html = renderToStaticMarkup(
      <EvidenceProvenanceChip state="checked" attribution={{ source: 'OIG LEIE', asOf: null }} />,
    );
    expect(html).toMatch(/aria-label="[^"]*as-of not recorded[^"]*"/);
    // Never invented, never silently dropped.
    expect(html).not.toMatch(/aria-label="[^"]*just now[^"]*"/i);
  });

  it('keeps <time datetime> machine-readable when the as-of is human prose', () => {
    const html = renderToStaticMarkup(
      <EvidenceProvenanceChip
        state="source_backed"
        attribution={{ source: 'NPPES', asOf: 'Jul 15, 2026', asOfISO: '2026-07-15T00:00:00Z' }}
      />,
    );
    // The provenance LINE is hidden on these surfaces (the row paints it), so
    // the ISO must at least survive the props round-trip without throwing and
    // without leaking a bogus datetime into the markup.
    expect(html).not.toContain('datetime="Jul 15, 2026"');
  });
});

describe("'declared' — the state names its own actor", () => {
  it('announces an actor and never a source', () => {
    const html = renderToStaticMarkup(
      <EvidenceProvenanceChip state="self_attested" attribution="declared" />,
    );
    expect(html).toContain('data-attribution="declared"');
    expect(html).toMatch(/aria-label="[^"]*self-attested[^"]*"/i);
    expect(html).not.toMatch(/NPPES|OIG|PECOS/);
  });
});

describe("'legend' — vocabulary illustration, impossible to read as a result", () => {
  it('announces itself as an example about nobody', () => {
    const html = renderToStaticMarkup(
      <EvidenceProvenanceChip state="source_backed" attribution="legend" />,
    );
    expect(html).toContain('vocabulary example, not a result about anyone');
    expect(html).toContain('data-attribution="legend"');
  });
});

describe('never colour alone', () => {
  it.each(STATES)('%s renders its state word as visible text', (state) => {
    const html = renderToStaticMarkup(
      <EvidenceProvenanceChip state={state} attribution="legend" />,
    );
    expect(html).toContain(EVIDENCE_TO_PROVENANCE[state].label);
  });
});

/**
 * The mapping itself is the artifact EC-3 says UX-02 owes ("reconciled via one
 * mapping table"). These guard the two properties that make it safe.
 */
describe('EVIDENCE_TO_PROVENANCE — the mapping table', () => {
  it('is total: every EvidenceState maps somewhere', () => {
    for (const state of STATES) {
      expect(EVIDENCE_TO_PROVENANCE[state]).toBeDefined();
    }
    expect(Object.keys(EVIDENCE_TO_PROVENANCE).sort()).toEqual([...STATES].sort());
  });

  it('preserves every visible word — the migration changes no customer-facing copy', () => {
    // This is the whole reason each mapping carries an explicit label. If a
    // future edit drops one, the surface silently starts saying ProvenanceChip's
    // default word instead ("Checked" for "Source-backed"), which is a copy
    // change smuggled inside a component swap.
    for (const state of STATES) {
      expect(EVIDENCE_TO_PROVENANCE[state].label).toBe(EVIDENCE_STATE[state].label);
    }
  });

  it('never maps a non-affirmative evidence state onto the affirmative chip state', () => {
    for (const state of STATES) {
      if (!EVIDENCE_STATE[state].affirmative) {
        expect(EVIDENCE_TO_PROVENANCE[state].state).not.toBe('checked');
      }
    }
  });
});

describe('the type-level requirement is real', () => {
  it('the compile-time contract file exists where tsc actually looks', () => {
    // An @ts-expect-error HERE would prove nothing: __tests__ is excluded from
    // apps/web/tsconfig.json, so tsc never validates this file — vitest strips
    // types without checking them. The compile-time proof lives in
    // design-system/provenanceChipContract.check.tsx, which the tsconfig
    // include covers and `next build` type-checks on every build. This test
    // only pins that the contract file has not been deleted.
    expect(() =>
      require('node:fs').readFileSync(
        require('node:path').resolve(__dirname, '../design-system/provenanceChipContract.check.tsx'),
        'utf-8',
      ),
    ).not.toThrow();
  });
});
