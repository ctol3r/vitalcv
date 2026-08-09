import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * EC-5's 44px touch floor for the global footer.
 *
 * Measured on production at a real 390×844 viewport: the six footer links were
 * 16px tall — `text-xs` gives a 16px line box — with `gap-4` (16px) between
 * them, so neither the size rule nor the spacing exception was satisfied. They
 * are standalone nav links, so the inline-in-a-sentence exception does not
 * apply either.
 *
 * This guard originally asserted **24px**, reasoning from WCAG 2.2 AA 2.5.8
 * (Target Size, Minimum). That is the external legal minimum, not the house
 * floor: EC-5 says "44px minimum touch targets" and EC-20's locked
 * button-grammar row repeats it. So the guard was pinning a number the
 * constitution had already superseded, and holding it there — exactly the
 * `guards_can_enforce_retired_doctrine` failure. Raised to 44 with the
 * component.
 *
 * 2.5.8's 24px is still the floor we must never fall through; it is simply not
 * the bar we aim at, and a guard should encode the bar.
 *
 * The guard is source-level because jsdom does not lay out (every
 * getBoundingClientRect is 0×0), so a rendered assertion here would pass
 * against any markup and prove nothing. Real geometry is checked by the mobile
 * Playwright pass in tests/e2e/a11y-public-routes.spec.ts; this test's job is
 * to stop the class from being dropped in a copy or styling edit — the failure
 * mode this repo has hit before.
 */

const FOOTER = fs.readFileSync(
  path.join(process.cwd(), 'components/layout/Footer.tsx'),
  'utf8',
);

describe('global footer — tap targets meet WCAG 2.5.8', () => {
  it('declares one shared link class rather than per-link literals', () => {
    // Divergent copies are how the 24px floor gets lost on a single link.
    expect(FOOTER).toContain('const FOOTER_LINK_CLASS');

    // Every <Link> in the footer must carry the shared class. This was a
    // "there are at least 2 uses" count, which read the old shape — a mapped
    // list plus a hand-written Contact link — as the invariant. W1079 folded
    // Contact into FOOTER_NAV, leaving one render site, which satisfies the
    // intent (no divergent copies) strictly better than two did. Comparing the
    // two counts says what the guard actually means and holds at any number of
    // render sites.
    const links = FOOTER.match(/<Link\b/g)?.length ?? 0;
    const styled = FOOTER.match(/className=\{FOOTER_LINK_CLASS\}/g)?.length ?? 0;
    expect(links).toBeGreaterThan(0);
    expect(styled, 'every footer <Link> must use FOOTER_LINK_CLASS').toBe(links);
  });

  it('that class guarantees a >= 44px hit area (EC-5, not 2.5.8)', () => {
    const decl = FOOTER.match(/const FOOTER_LINK_CLASS\s*=\s*(?:\n\s*)?'([^']+)'/);
    expect(decl, 'FOOTER_LINK_CLASS must be a single string literal').not.toBeNull();
    const cls = decl![1];

    // min-height only takes effect on a flex/block box, so both parts matter.
    expect(cls).toMatch(/min-h-\[44px\]|min-h-11/);
    expect(cls).toMatch(/inline-flex|flex/);
    expect(cls).toContain('items-center');

    // EC-5 is a floor on BOTH dimensions. Only the height was guarded once,
    // and "DPA" sat at 23px wide on production the whole time — a short label
    // is all it takes. Measured at 390×844.
    expect(cls, 'width floor: a short label like "DPA" falls under the floor without it')
      .toMatch(/min-w-\[44px\]|min-w-11/);
  });

  it('no footer link carries a bare text-xs class without the hit-area wrapper', () => {
    // Catches a new <Link> added with the old literal instead of the constant.
    const linkClassNames = [...FOOTER.matchAll(/className="([^"]*text-xs[^"]*)"/g)].map((m) => m[1]);
    const offenders = linkClassNames.filter((c) => !/min-h-/.test(c) && /hover:text-foreground/.test(c));
    expect(
      offenders,
      `Footer link(s) styled with bare text-xs — 16px tall, under the 24px floor:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * Sub-24px type used on real controls elsewhere on the public surface.
 *
 * These carry a transparent `::before` overlay instead of padding, because each
 * sits in a baseline-aligned or tightly-laid-out row where padding would move
 * neighbouring content. The overlay is invisible and affects no layout.
 *
 * Browser-verified: the /trust/attribution back-link measured a 12px box with a
 * 24px hit area at 390×844. The two /verify controls use the identical utility
 * string but could not be exercised locally — /verify renders empty without
 * backend data — so this guard is what holds them.
 */
const OVERLAY = [
  {
    file: 'components/trust/CopyableDID.tsx',
    what: 'DID [copy] button (33×9 on production)',
  },
  {
    file: 'components/verifier/IssuerContinuityPanel.tsx',
    what: 'JWKS "verify →" link (43×14 on production)',
  },
  // app/trust/attribution's "← vitalcv.com" back-link was removed with the
  // page's duplicate header (the global chrome provides both) — no sub-24px
  // control remains there to guard.
] as const;

describe('sub-24px controls keep an expanded hit area', () => {
  for (const { file, what } of OVERLAY) {
    it(`${what} — ${file}`, () => {
      const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');

      // The control still uses small type (design intent preserved)...
      expect(src).toMatch(/text-\[(9|10)px\]/);

      // ...so it must carry the overlay. `relative` is load-bearing: without it
      // the absolutely-positioned ::before escapes to the nearest positioned
      // ancestor and stops covering the control.
      expect(src, 'missing before:absolute overlay').toContain('before:absolute');
      expect(src, 'overlay must be >= 24px tall').toMatch(/before:h-6|before:h-\[24px\]/);
      expect(src, "overlay needs before:content-[''] to render").toMatch(/before:content-\[/);
      expect(src, 'overlay needs a positioned ancestor').toMatch(/\brelative\b/);
    });
  }
});
