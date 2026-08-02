import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Wave 6 — D6 (the boundary stays reachable) and D7 (one focus treatment).
 */
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const askHome = read('components/home/ask/AskHome.tsx');
const HOMEPAGE_CSS = ['styles/ask-home.css', 'styles/evidence-input.css', 'styles/spine-tabs.css'];

describe('D6 — the truth boundary stays reachable', () => {
  /**
   * The boundary carries the enumerated limitation ("not a completed
   * credentialing, privileging, or employer clearance decision"). It is the one
   * block on the page that may never become conditional, so it is asserted to
   * be a plain always-rendered section — not a tab panel, not a disclosure.
   */
  it('is mounted unconditionally, right after the journey', () => {
    expect(askHome).toContain('<TruthBoundary />');

    const spineAt = askHome.indexOf('<HomeSpine />');
    const boundaryAt = askHome.indexOf('<TruthBoundary />');
    expect(spineAt).toBeGreaterThan(-1);
    expect(boundaryAt).toBeGreaterThan(spineAt);

    // The section wrapping it must not be a panel or a disclosure.
    const section = askHome.slice(
      askHome.lastIndexOf('<section', boundaryAt),
      boundaryAt,
    );
    expect(section).not.toContain('role="tabpanel"');
    expect(section).not.toContain('hidden');
    expect(section).not.toContain('<details');
  });

  it('is never rendered behind a ternary', () => {
    // Anything of the shape `x ? <TruthBoundary /> : null` makes the guarantee
    // conditional on state, which is the failure this pins.
    const before = askHome.slice(Math.max(0, askHome.indexOf('<TruthBoundary />') - 220));
    expect(before.slice(0, 220)).not.toMatch(/\?\s*$/m);
  });
});

describe('D7 — one focus treatment across the homepage', () => {
  /**
   * Every homepage focus ring must name `--home-focus`. Before this, the CTA
   * and the spine tabs named `--ask-accent` / `--spine-accent` — the EDITORIAL
   * accent. All three resolve to the same indigo today, which is precisely why
   * it went unnoticed: the divergence only becomes visible when the editorial
   * accent is retoned and two of the four rings move while the others do not.
   *
   * Geometry is allowed to differ — the spine tab's ring is inset because it
   * sits flush against its neighbour — so this asserts the COLOUR only.
   */
  it('every focus-visible ring resolves through --home-focus', () => {
    const offenders: string[] = [];

    for (const file of HOMEPAGE_CSS) {
      const css = strip(read(file));
      for (const [, block] of css.matchAll(/:focus-visible[^{]*\{([^}]*)\}/g)) {
        // A ring that is DRAWN must name the focus token. Deliberately
        // removing one (`outline: none`) is a different decision, covered by
        // the next test, which requires a wrapper to draw it instead.
        if (!/outline:\s*(?!none)\S/.test(block)) continue;
        if (!block.includes('--home-focus')) {
          offenders.push(`${file}: ${block.trim().replace(/\s+/g, ' ')}`);
        }
      }
    }

    expect(offenders, `focus rings not using --home-focus:\n${offenders.join('\n')}`).toEqual([]);
  });

  /**
   * Removing the ring is only acceptable when something else takes it over —
   * the bare input drops its own outline because the field capsule around it
   * draws the ring instead. This pins that the replacement exists.
   */
  it('only removes a focus ring where a wrapper draws one instead', () => {
    const ask = strip(read('styles/ask-home.css'));
    if (/\.ask-input:focus-visible\s*\{\s*outline:\s*none/.test(ask)) {
      expect(ask, 'ask-input drops its ring, so ask-field must draw one').toMatch(
        /\.ask-field:focus-within/,
      );
    }
    const input = strip(read('styles/evidence-input.css'));
    if (/outline:\s*none/.test(input)) {
      expect(input, 'evidence input drops its ring, so the capsule must draw one').toMatch(
        /outline:\s*2px solid var\(--home-focus\)/,
      );
    }
  });
});
