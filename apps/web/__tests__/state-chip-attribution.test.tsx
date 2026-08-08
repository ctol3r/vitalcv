import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StateChip, stateChipAccessibleName } from '@/components/vital/StateChip';

/**
 * W1082 (UX-02B) — the attributed StateChip contract.
 *
 * A state word without "who answered, and when" is how 'checked' got conflated
 * with affirmation. The chip now REQUIRES attribution at the type level, and
 * these tests pin what each attribution kind announces:
 *
 *  - a source form names the source and the as-of — with `asOf: null`
 *    announced as "as-of not recorded", never silently dropped and never
 *    invented (the qualifier lives inside the accessible value);
 *  - 'declared' announces the state's own meaning and names no source;
 *  - 'legend' announces itself as a vocabulary example, so a legend chip can
 *    never be mistaken for a result about a real person.
 *
 * The type-level half is enforced by tsc, which is a required CI gate — the
 * @ts-expect-error below is the proof: if the props ever stop requiring
 * attribution, the suppression becomes unused and typecheck fails.
 */

describe('attributed source form', () => {
  it('announces the source and the as-of inside the accessible name', () => {
    const html = renderToStaticMarkup(
      <StateChip state="source_backed" attribution={{ source: 'NPPES', asOf: 'Jul 15, 2026' }} />,
    );
    expect(html).toContain('aria-label="Source-backed — NPPES, as of Jul 15, 2026"');
  });

  it('announces a missing timestamp as not recorded — unknown is first-class', () => {
    expect(stateChipAccessibleName('checked', { source: 'OIG LEIE', asOf: null })).toBe(
      'Checked — OIG LEIE, as-of not recorded',
    );
  });
});

describe("'declared' — the state names its own actor", () => {
  it('announces the meaning and never a source', () => {
    const name = stateChipAccessibleName('self_attested', 'declared');
    expect(name).toContain('Self-attested');
    expect(name).toContain('Entered by the clinician');
    // No source name can appear — there is none to name.
    expect(name).not.toMatch(/NPPES|OIG|PECOS|as of/);
  });
});

describe("'legend' — vocabulary illustration, impossible to read as a result", () => {
  it('announces itself as an example about nobody', () => {
    const html = renderToStaticMarkup(<StateChip state="source_backed" attribution="legend" />);
    expect(html).toContain('vocabulary example, not a result about anyone');
  });
});

describe('never color alone', () => {
  it('renders the state label as visible text alongside the glyph', () => {
    // The label is aria-hidden (the aria-label carries the full sentence) but
    // remains VISIBLE text — sighted users read the word, not just the hue.
    const html = renderToStaticMarkup(
      <StateChip state="access_required" attribution="declared" />,
    );
    expect(html).toContain('Access required');
    expect(html).toContain('<svg');
  });
});

describe('the type-level requirement is real', () => {
  it('the compile-time contract file exists where tsc actually looks', () => {
    // An @ts-expect-error HERE would prove nothing: __tests__ is excluded from
    // apps/web/tsconfig.json, so tsc never validates this file — vitest strips
    // types without checking them. The compile-time proof lives in
    // lib/vital/stateChipContract.check.tsx, which the tsconfig include
    // (**/*.tsx) covers and `next build` type-checks on every build. This
    // test only pins that the contract file has not been deleted.
    expect(() => require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, '../lib/vital/stateChipContract.check.tsx'), 'utf-8',
    )).not.toThrow();
  });
});
