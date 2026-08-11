/**
 * /pricing — the 10px uppercase mono labels must clear the AA floor.
 *
 * Measured against the rendered production page 2026-08-11. `textFaint` was
 * `#8a8780`, which paints 'Pricing foundation' and the tier eyebrows
 * ('clinician', 'verifier', 'enterprise') at:
 *
 *     white  3.58:1     panel #f4f2ec  3.20:1     card #f6f5f1  3.29:1
 *
 * all below the 4.5:1 AA minimum. The trap is the large-text exemption: these
 * labels are `fontWeight: 700`, and 700 reads as "bold", but WCAG's 3:1
 * allowance needs >= 18.66px bold or >= 24px. At 10px they get no relief, so
 * bold is a red herring — it makes them look emphatic while failing.
 *
 * This pins the CONSTANT against the surfaces it actually lands on, so a future
 * "soften the label" edit fails here instead of shipping. Backgrounds are the
 * ones observed in the DOM, not assumed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', 'app', 'pricing', 'page.tsx');

/** WCAG relative luminance. */
function lum([r, g, b]: number[]): number {
  const s = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * s(r) + 0.7152 * s(g) + 0.0722 * s(b);
}

function ratio(fg: number[], bg: number[]): number {
  const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

function hexToRgb(hex: string): number[] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Read the live constant rather than duplicating it — a copy would drift. */
function constant(name: string): string {
  const src = readFileSync(SRC, 'utf8');
  const m = src.match(new RegExp(`const ${name} = '(#[0-9a-fA-F]{6})'`));
  if (!m) throw new Error(`${name} not found in pricing/page.tsx`);
  return m[1];
}

/** Every surface these labels were observed sitting on, in the rendered page. */
const SURFACES: Record<string, number[]> = {
  white: [255, 255, 255],
  panel: [244, 242, 236],
  card: [246, 245, 241],
};

describe('/pricing label contrast', () => {
  it('textFaint clears AA 4.5:1 on every surface it lands on', () => {
    const fg = hexToRgb(constant('textFaint'));
    for (const [name, bg] of Object.entries(SURFACES)) {
      expect(
        ratio(fg, bg),
        `textFaint on ${name} — 10px labels get no large-text allowance`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('textSecondary clears AA on the same surfaces', () => {
    const fg = hexToRgb(constant('textSecondary'));
    for (const [name, bg] of Object.entries(SURFACES)) {
      expect(ratio(fg, bg), `textSecondary on ${name}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('rejects the value that shipped — the guard must be load-bearing', () => {
    // If this ever passes, the threshold or the maths has been loosened.
    const shipped = hexToRgb('#8a8780');
    expect(ratio(shipped, SURFACES.panel)).toBeLessThan(4.5);
  });

  it('keeps real headroom, not a hairline pass', () => {
    // #706e68 also technically passes (4.55 on panel) but leaves 0.05 of margin,
    // which any background tweak erases. Require a margin that survives one.
    const fg = hexToRgb(constant('textFaint'));
    const worst = Math.min(...Object.values(SURFACES).map((bg) => ratio(fg, bg)));
    expect(worst).toBeGreaterThanOrEqual(4.8);
  });
});
