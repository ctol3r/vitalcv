import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Wave 4 / D3 — the tone sequence has to reach the page.
 *
 * Wave 1 defined `paper · mist · trust · ink` and every `--home-*` variable
 * under them. Nothing read those variables, so the contract was inert: four
 * tones, zero pixels. A test asserting "the tones exist" would have passed
 * against that, which is why these assert that something SPENDS them.
 */
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const askCss = strip(read('styles/ask-home.css'));
const surfacesCss = strip(read('styles/home-surfaces.css'));
const askHome = read('components/home/ask/AskHome.tsx');

describe('the home tone sequence', () => {
  it('declares all four tones', () => {
    for (const tone of ['paper', 'mist', 'trust', 'ink']) {
      expect(surfacesCss).toContain(`[data-home-tone='${tone}']`);
    }
  });

  /**
   * The one that matters. Declaring a tone paints nothing; this fails if the
   * sequence goes back to being decoration-in-name-only.
   */
  it('spends the tone variables somewhere real', () => {
    expect(askCss, 'no rule reads --home-surface').toMatch(
      /background-color:\s*var\(--home-surface\)/,
    );
    expect(askCss, 'no rule reads --home-border').toMatch(/var\(--home-border\)/);
  });

  it('walks paper → mist → trust across the page in order', () => {
    // The hero root carries paper; the journey and boundary take over from it.
    expect(askHome).toMatch(/data-home-tone="paper"/);
    expect(askHome).toMatch(/data-home-spine=""\s+data-home-tone="mist"/);
    expect(askHome).toMatch(/className="ask-boundary"\s+data-home-tone="trust"/);

    const spineAt = askHome.indexOf('data-home-tone="mist"');
    const boundaryAt = askHome.indexOf('data-home-tone="trust"');
    expect(spineAt).toBeGreaterThan(-1);
    expect(boundaryAt).toBeGreaterThan(spineAt);
  });

  /**
   * A tone may restyle a surface; it may never introduce a second palette.
   * Every value has to resolve through an existing `--vt-*` token (contract
   * §4), so the homepage cannot drift away from the rest of the app.
   */
  it('resolves every tone value through an existing vt token', () => {
    const toneBlocks = surfacesCss.match(/\[data-home-tone='[a-z]+'\]\s*\{[^}]*\}/g) ?? [];
    expect(toneBlocks.length).toBe(4);

    for (const block of toneBlocks) {
      for (const [, value] of block.matchAll(/--home-[a-z-]+:\s*([^;]+);/g)) {
        expect(
          value.includes('var(--vt-'),
          `tone value "${value.trim()}" is a raw colour, not a --vt-* token`,
        ).toBe(true);
      }
    }
  });
});
