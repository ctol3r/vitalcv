/**
 * design-kernel-source.test.ts — Wave 1081 (UX-02A), source half.
 *
 * The e2e spec (tests/e2e/design-kernel.spec.ts) measures the kernel in a
 * browser. This pins the source-level halves a browser measurement cannot
 * distinguish: WHY the font loaded (self-hosted, never Google), and the exact
 * shape of the global rules whose deletion the e2e would attribute to the
 * wrong cause. Together they replace nothing — before W1081 neither half was
 * guarded at all.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WEB = resolve(__dirname, '..');
const layout = readFileSync(resolve(WEB, 'app/layout.tsx'), 'utf-8');
const globals = readFileSync(resolve(WEB, 'app/globals.css'), 'utf-8');

describe('fonts are self-hosted', () => {
  it('layout loads fonts through next/font/local and never next/font/google', () => {
    // The build reaching out to Google Fonts is what broke an earlier attempt
    // and left the site rendering the system serif. EC-20 locks delivery:
    // self-hosted variable woff2 via next/font/local.
    expect(layout).toContain("from 'next/font/local'");
    // Match the IMPORT, not the string — the file's own doc comment says
    // "never next/font/google", and a comment is not a violation.
    expect(layout).not.toMatch(/from\s+['"]next\/font\/google['"]/);
  });

  it('every declared font file exists in app/fonts', () => {
    // localFont() with a missing file fails the build loudly — but only the
    // paths the build touches. This sweeps all of them, including any a
    // refactor left declared-but-unreferenced.
    const declared = [...layout.matchAll(/path:\s*'(\.\/fonts\/[^']+)'/g)].map((m) => m[1]);
    const single = [...layout.matchAll(/src:\s*'(\.\/fonts\/[^']+)'/g)].map((m) => m[1]);
    const all = [...declared, ...single];
    expect(all.length).toBeGreaterThanOrEqual(3);
    for (const rel of all) {
      expect(existsSync(resolve(WEB, 'app', rel)), `${rel} declared in layout.tsx but missing`).toBe(true);
    }
  });

  it('legacy era variables alias onto the kernel stacks', () => {
    // Parked-era CSS still consumes --font-inter / --font-plus-jakarta /
    // --font-jetbrains. layout.tsx points them at the kernel stacks so a
    // parked stylesheet cannot resurrect a retired face. The e2e asserts the
    // resolved value; this pins the aliasing so a refactor cannot drop a line
    // and leave the variable undefined (which computes as ''—and every
    // consumer silently falls back to the UA default).
    for (const alias of ['--font-plus-jakarta', '--font-inter', '--font-jetbrains', '--font-geist']) {
      expect(layout, `${alias} is no longer assigned in layout.tsx`).toContain(`'${alias}'`);
    }
  });
});

describe('the global focus rule holds its shape', () => {
  it('globals.css keeps *:focus-visible with a real outline', () => {
    // The e2e proves an indicator is visible on two routes; this proves the
    // GLOBAL rule still exists, so the visibility does not silently become an
    // accident of whichever island stylesheet happens to style the elements
    // those two routes put first in tab order.
    const rule = globals.match(/\*:focus-visible\s*\{([^}]+)\}/);
    expect(rule, 'globals.css lost the *:focus-visible rule').not.toBeNull();
    expect(rule![1]).toMatch(/outline:\s*2px\s+solid/);
    expect(rule![1]).toContain('var(--ring)');
  });

  it('--ring resolves to the semantic focus token', () => {
    expect(globals).toMatch(/--ring:\s*var\(--vt-focus-ring\)/);
  });
});

describe('the reduced-motion kill switch holds its shape', () => {
  it('globals.css clamps animation and transition durations under reduce', () => {
    const block = globals.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/);
    expect(block, 'globals.css lost the prefers-reduced-motion kill switch').not.toBeNull();
    const body = block![1];
    expect(body).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(body).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(body).toMatch(/animation-iteration-count:\s*1\s*!important/);
  });
});
