/**
 * The homepage's one conversion action must actually be visible.
 *
 * Measured on production 2026-08-10: `.ezh-rv-keep` ("Keep this record", the
 * single CTA of the NPI recognition moment) painted #F2F1ED on #F6F5F1 — a
 * contrast ratio of **1.04**. Invisible, for every clinician who ever entered
 * an NPI.
 *
 * Nothing was wrong with the tokens. `--ezh-cta-text` resolved to #151412 the
 * whole time. The declaration lost the CASCADE: the control is a Next `<Link>`
 * so it renders as an `<a>`, and
 *
 *     .ezh a        { color: inherit }        (0,1,1)
 *     .ezh-rv-keep  { color: var(...) }       (0,1,0)
 *
 * meant the generic anchor rule won and the button inherited the dark-scene
 * ink onto its own paper fill. Its `<button>` sibling `.ezh-rv-again` was
 * never affected — which is exactly why the secondary action stayed readable
 * and the primary one did not, and why nothing looked obviously broken.
 *
 * So this asserts the SPECIFICITY relationship, not a colour string. A future
 * edit that drops the `.ezh ` scope re-breaks it invisibly, and a token change
 * cannot fix it. Contrast of the resolved pair is asserted separately by the
 * token-contract test; this pins that the pair is the one that actually paints.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(join(__dirname, '..', 'styles', 'easy-home.css'), 'utf8');

/** CSS specificity as [ids, classes, types] for the simple selectors we use. */
function specificity(selector: string): [number, number, number] {
  const ids = (selector.match(/#[\w-]+/g) ?? []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length;
  const types = (selector.match(/(^|[\s>+~])[a-z][\w-]*/g) ?? []).length;
  return [ids, classes, types];
}

function beats(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

/** Every selector in the file that sets `color` and matches the keep CTA. */
function keepSelectors(): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) {
    const sel = m[1].trim();
    const body = m[2];
    if (!/(^|[\s,])[^,]*ezh-rv-keep/.test(sel)) continue;
    if (!/(^|;)\s*color\s*:/.test(body)) continue;
    out.push(...sel.split(',').map((s) => s.trim()).filter((s) => s.includes('ezh-rv-keep')));
  }
  return out;
}

describe('homepage primary CTA is not invisible', () => {
  it('still has the generic anchor rule that caused the defect', () => {
    // If this ever goes away the scoping below is harmless; if it is still
    // here, the scoping is load-bearing. Either way the test should say which.
    expect(CSS).toMatch(/\.ezh a\s*\{[^}]*color:\s*inherit/);
  });

  it('scopes the keep CTA above `.ezh a`, or the anchor rule wins', () => {
    const anchor = specificity('.ezh a');
    const selectors = keepSelectors();

    expect(selectors.length).toBeGreaterThan(0);
    for (const sel of selectors) {
      expect(
        beats(specificity(sel), anchor),
        `"${sel}" (${specificity(sel).join(',')}) must outrank ".ezh a" (${anchor.join(',')}) ` +
          'or "Keep this record" inherits the dark-scene ink onto its own paper fill (1.04:1)',
      ).toBe(true);
    }
  });

  it('paints the paper-ink token, not an inherited colour', () => {
    // The pair is --ezh-cta-bg / --ezh-cta-text, documented 16.88:1 on paper.
    const rule = CSS.match(/\.ezh\s+\.ezh-rv-keep\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toMatch(/background:\s*var\(--ezh-cta-bg\)/);
    expect(rule).toMatch(/color:\s*var\(--ezh-cta-text\)/);
  });
});
