import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * WCAG 2.2 AA 2.5.8 (Target Size, Minimum) for the global footer.
 *
 * Measured on production at a real 390×844 viewport: the six footer links were
 * 16px tall — `text-xs` gives a 16px line box — with `gap-4` (16px) between
 * them, so neither the size rule nor the spacing exception was satisfied. They
 * are standalone nav links, so the inline-in-a-sentence exception does not
 * apply either.
 *
 * The guard is source-level because jsdom does not lay out (every
 * getBoundingClientRect is 0×0), so a rendered assertion here would pass
 * against any markup and prove nothing. Real geometry is checked by the mobile
 * Playwright pass; this test's job is to stop the class from being dropped in a
 * copy or styling edit — the failure mode this repo has hit before.
 */

const FOOTER = fs.readFileSync(
  path.join(process.cwd(), 'components/layout/Footer.tsx'),
  'utf8',
);

describe('global footer — tap targets meet WCAG 2.5.8', () => {
  it('declares one shared link class rather than per-link literals', () => {
    // Divergent copies are how the 24px floor gets lost on a single link.
    expect(FOOTER).toContain('const FOOTER_LINK_CLASS');
    expect(FOOTER.match(/className=\{FOOTER_LINK_CLASS\}/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('that class guarantees a >= 24px hit area', () => {
    const decl = FOOTER.match(/const FOOTER_LINK_CLASS\s*=\s*(?:\n\s*)?'([^']+)'/);
    expect(decl, 'FOOTER_LINK_CLASS must be a single string literal').not.toBeNull();
    const cls = decl![1];

    // min-height only takes effect on a flex/block box, so both parts matter.
    expect(cls).toMatch(/min-h-\[24px\]|min-h-6/);
    expect(cls).toMatch(/inline-flex|flex/);
    expect(cls).toContain('items-center');
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
