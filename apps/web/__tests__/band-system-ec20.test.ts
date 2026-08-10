import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * EC-20 conformance gate for the band system stylesheet.
 *
 * `apps/web/styles/band-system.css` adapts structural patterns from
 * reference R2 (Palantir) — see
 * docs/design/palantir-r2-element-adoption-2026-08-09.md. Several EC-20
 * rows that R2 violates are LOCKED, which makes them rejection law
 * (EC-21). The conformance was measured by hand in the browser once; this
 * test is what stops it regressing on the next edit.
 *
 * Locked rows enforced here:
 *   - Glass treatment: None            → no backdrop-filter, no blur()
 *   - Gradient treatment: None         → no gradient() of any kind
 *   - Card grammar                     → no box-shadow
 *   - Corner radius / pills retired    → every radius <= 3px
 *   - EC-5 accessibility floor         → no `outline: none`; focus-visible
 *                                        present; 44px target floor declared
 *   - EC-4 motion is optional          → prefers-reduced-motion block present
 *
 * IMPORTANT — comments are stripped before scanning. The stylesheet's own
 * header documents the REJECTED R2 values verbatim (`border-radius: 10px`,
 * `box-shadow: 0 2px 10px rgba(0,0,0,.1)`, "backdrop blur"). A scan that
 * reads comments would fail on its own rationale — the same false-positive
 * class as the golden-namespace sweep. We assert on declarations only.
 *
 * What this does NOT do: it does not prove rendered geometry. The 44px floor
 * is verified by measuring painted controls in a browser; the assertion here
 * is a tripwire that the floor declaration still exists, not a proof that it
 * computes to 44px. Deleting the declaration fails this test; changing the
 * line box so it computes to 43px does not.
 */

const CSS_PATH = path.join(__dirname, '..', 'styles', 'band-system.css');

/** Strip /* … *​/ comments so documented counter-examples aren't scanned. */
function declarationsOnly(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('band-system.css — EC-20 conformance', () => {
  const raw = fs.readFileSync(CSS_PATH, 'utf8');
  const css = declarationsOnly(raw);

  it('strips comments before scanning (guards the guard)', () => {
    // The header documents rejected R2 values; they must exist in the raw
    // file and be absent from what we actually scan.
    expect(raw).toMatch(/border-radius: 10px/);
    expect(css).not.toMatch(/border-radius: 10px/);
  });

  it('ships no gradients (EC-20 Gradient treatment: None)', () => {
    expect(css).not.toMatch(/gradient\s*\(/i);
  });

  it('ships no glass (EC-20 Glass treatment: None)', () => {
    expect(css).not.toMatch(/backdrop-filter\s*:/i);
    expect(css).not.toMatch(/filter\s*:\s*[^;}]*blur\s*\(/i);
  });

  it('ships no shadows (EC-20 Card grammar)', () => {
    const shadows = [...css.matchAll(/box-shadow\s*:\s*([^;}]+)/gi)]
      .map((m) => m[1].trim())
      .filter((v) => v !== 'none');
    expect(shadows).toEqual([]);
  });

  it('keeps every corner radius within 0–3px (EC-20, pills retired)', () => {
    const offenders = [...css.matchAll(/border-radius\s*:\s*([^;}]+)/gi)]
      .map((m) => m[1].trim())
      .filter((value) =>
        // every component of the value must be 0 or <= 3px
        value
          .split(/[\s/]+/)
          .some((token) => !/^0(px)?$/.test(token) && !/^[0-3](\.\d+)?px$/.test(token)),
      );
    expect(offenders).toEqual([]);
  });

  it('never removes the focus indicator, and styles focus-visible (EC-5)', () => {
    expect(css).not.toMatch(/outline\s*:\s*(none|0)\b/i);
    expect(css.match(/:focus-visible/g)?.length ?? 0).toBeGreaterThan(0);
  });

  it('declares the 44px target floor for interactive primitives (EC-5)', () => {
    // .bs-cta carries an explicit floor; .bs-link derives its padding from it.
    expect(css).toMatch(/min-block-size:\s*44px/);
    expect(css).toMatch(/--bs-link-pad:[^;]*44px/);
  });

  it('keeps motion optional (EC-4 / EC-5)', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  /**
   * R3 (Zoox) derives column spans from `100svw`. Viewport units count the
   * scrollbar, so every span sits wider than the grid it claims to align to
   * — measured on their own page, a 4-column span paints 4.99px proud
   * (scrollbar 15px x 4/12), and the error grows with the span.
   *
   * `100cqw` is the container's content box, which has the scrollbar removed
   * already. This is the assertion that keeps someone from "simplifying" it
   * back to a viewport unit, where the bug is invisible on macOS overlay
   * scrollbars and only appears on Windows.
   */
  it('derives the grid track from the container, not the viewport', () => {
    const track = css.match(/--bs-track:\s*([^;]+)/)?.[1] ?? '';
    expect(track).toContain('100cqw');
    expect(track).not.toMatch(/\d+(svw|vw|dvw|lvw)/);
    // A container query unit is meaningless without a query container.
    expect(css).toMatch(/container-type:\s*inline-size/);
  });

  it('carries a responsive rhythm scale on tokens, not per-component', () => {
    for (const step of ['xs', 'sm', 'md', 'lg']) {
      // Each step is declared twice: base (mobile) and the >=60em override.
      const declared = css.match(new RegExp(`--bs-rhythm-${step}:`, 'g'))?.length ?? 0;
      expect(declared, `--bs-rhythm-${step} needs a mobile and a desktop value`).toBe(2);
    }
  });
});
