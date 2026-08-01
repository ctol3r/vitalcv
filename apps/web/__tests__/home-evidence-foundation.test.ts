import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Home Evidence Experience v2 — foundation guards (Wave 1D).
 *
 * These assert the OUTCOMES the surface + motion contract exists to protect,
 * not the mechanism that currently delivers them: a tone must resolve through
 * a token, motion must be finite and reversible, and content must never depend
 * on JavaScript to become visible. A better implementation of any of those
 * should keep these green.
 *
 * Contract: docs/design/home-evidence-experience-v2.md
 */

const STYLES = join(__dirname, '..', 'styles');
const read = (name: string) => readFileSync(join(STYLES, name), 'utf8');

const homeSurfaces = read('home-surfaces.css');
const motion = read('motion.css');
const askHome = read('ask-home.css');
const cinematic = read('cinematic-home.css');
const spineTabs = read('spine-tabs.css');

/** Every stylesheet the homepage actually loads (app/page.tsx imports). */
const HOMEPAGE_CSS: ReadonlyArray<[string, string]> = [
  ['home-surfaces.css', homeSurfaces],
  ['motion.css', motion],
  ['ask-home.css', askHome],
  ['cinematic-home.css', cinematic],
  ['spine-tabs.css', spineTabs],
];

const TONES = ['paper', 'mist', 'trust', 'ink'] as const;

const TONE_VARIABLES = [
  '--home-surface',
  '--home-surface-raised',
  '--home-text',
  '--home-text-muted',
  '--home-border',
  '--home-accent',
  '--home-focus',
  '--home-error',
] as const;

/** The declaration block for one `[data-home-tone='x']` selector. */
function toneBlock(tone: string): string {
  const marker = `[data-home-tone='${tone}']`;
  const start = homeSurfaces.indexOf(marker);
  expect(start, `tone "${tone}" is not declared`).toBeGreaterThan(-1);
  const open = homeSurfaces.indexOf('{', start);
  const close = homeSurfaces.indexOf('}', open);
  return homeSurfaces.slice(open + 1, close);
}

describe('semantic surface tones', () => {
  it('declares all four tones', () => {
    for (const tone of TONES) {
      expect(homeSurfaces).toContain(`[data-home-tone='${tone}']`);
    }
  });

  it('gives every tone the complete variable set, so no consumer can fall through', () => {
    for (const tone of TONES) {
      const block = toneBlock(tone);
      for (const variable of TONE_VARIABLES) {
        expect(block, `${tone} is missing ${variable}`).toContain(`${variable}:`);
      }
    }
  });

  it('resolves every tone value through a token, never a raw colour', () => {
    for (const tone of TONES) {
      for (const line of toneBlock(tone).split('\n')) {
        const declaration = line.trim();
        if (!declaration.startsWith('--home-')) continue;
        // A hex, oklch(), rgb() or hsl() literal here would also trip
        // check-design-lint LINT-01 — this says WHY it matters.
        expect(declaration, `${tone}: raw colour in "${declaration}"`).not.toMatch(
          /#[0-9a-fA-F]{3,8}\b|\b(?:oklch|rgba?|hsla?)\(/,
        );
        expect(declaration, `${tone}: "${declaration}" does not use a token`).toMatch(/var\(--vt-/);
      }
    }
  });

  it('scopes itself to the homepage — it is not a global theme', () => {
    // A `:root` block here would repaint every route in the application.
    expect(homeSurfaces).not.toMatch(/(^|\})\s*:root\s*\{/);
    expect(homeSurfaces).not.toMatch(/(^|\})\s*html\s*\{/);
    expect(homeSurfaces).not.toMatch(/(^|\})\s*body\s*\{/);
  });

  it('borrows no ops-only token on a public route (LINT-04)', () => {
    for (const [name, css] of HOMEPAGE_CSS) {
      expect(css, `${name} reaches for ops chrome`).not.toMatch(
        /var\(--(?:ops|vital-ops)-|--vt-surface-inverse|data-theme=["']ops["']/,
      );
    }
  });
});

describe('motion contract', () => {
  it('keeps every @keyframes in the house motion file', () => {
    for (const [name, css] of HOMEPAGE_CSS) {
      if (name === 'motion.css') continue;
      expect(css, `${name} declares its own keyframes`).not.toMatch(/@keyframes\b/);
    }
  });

  it('declares one product easing token and repeats the curve nowhere else', () => {
    expect(homeSurfaces).toContain('--home-ease-product: cubic-bezier(0.2, 0, 0, 1)');
    // The curve is a decision, not a literal to paste. Exactly one definition.
    const literals = HOMEPAGE_CSS.flatMap(([, css]) =>
      css.match(/cubic-bezier\(\s*0?\.2\s*,\s*0\s*,\s*0\s*,\s*1\s*\)/g) ?? [],
    );
    expect(literals).toHaveLength(1);
  });

  it('runs no infinite animation anywhere on the homepage', () => {
    for (const [name, css] of HOMEPAGE_CSS) {
      expect(css, `${name} loops`).not.toMatch(/animation[^;]*\binfinite\b/);
      expect(css, `${name} loops`).not.toMatch(/animation-iteration-count\s*:\s*infinite/);
    }
  });

  it('gates enhancement on reduced motion AND gives every path a static end state', () => {
    expect(homeSurfaces).toContain('@media (prefers-reduced-motion: no-preference)');
    expect(homeSurfaces).toContain('@media (prefers-reduced-motion: reduce)');

    const reduce = homeSurfaces.split('@media (prefers-reduced-motion: reduce)')[1] ?? '';
    expect(reduce).toContain('animation: none !important');
    // Reduced motion must land on the FINAL state, not a hidden one.
    expect(reduce).toContain('opacity: 1 !important');

    // Every animated class is named in the reduce block too.
    const animated = [...homeSurfaces.matchAll(/\.(home-[a-z-]+)\s*\{\s*animation:/g)].map((m) => m[1]);
    expect(animated.length).toBeGreaterThan(0);
    for (const cls of animated) {
      expect(reduce, `.${cls} has no reduced-motion equivalent`).toContain(`.${cls}`);
    }
  });

  it('animates only composited properties — no layout property in any keyframe', () => {
    const blocks = [...motion.matchAll(/@keyframes\s+[\w-]+\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).not.toMatch(
        /^\s*(?:width|height|top|left|right|bottom|margin|padding|font-size)\s*:/m,
      );
    }
  });

  it('hides nothing behind JavaScript — no page-level opacity-zero trap', () => {
    for (const [name, css] of HOMEPAGE_CSS) {
      // A blanket `opacity: 0` on a page/section container with JS responsible
      // for revealing it is the failure mode this forbids.
      expect(css, `${name} hides a page container`).not.toMatch(
        /(?:^|\})\s*(?:\.page|\.ask|body|html|main)\s*\{[^}]*opacity\s*:\s*0\s*[;}]/,
      );
    }
  });

  it('never takes over scrolling', () => {
    for (const [name, css] of HOMEPAGE_CSS) {
      expect(css, `${name} snaps scroll`).not.toContain('scroll-snap-type');
      expect(css, `${name} snaps scroll`).not.toContain('scroll-snap-align');
    }
  });
});

describe('token discipline in new homepage CSS', () => {
  it('introduces no literal z-index', () => {
    expect(homeSurfaces).not.toMatch(/z-index\s*:\s*-?\d/);
  });

  it('introduces no raw box-shadow', () => {
    const shadows = homeSurfaces.match(/box-shadow\s*:\s*[^;]+/g) ?? [];
    for (const shadow of shadows) {
      expect(shadow).toMatch(/box-shadow\s*:\s*(?:none|var\()/);
    }
  });

  it('introduces no literal font stack', () => {
    const fonts = homeSurfaces.match(/font-family\s*:\s*[^;]+/g) ?? [];
    for (const font of fonts) {
      expect(font).toMatch(/font-family\s*:\s*var\(/);
    }
  });
});

describe('inspiration provenance', () => {
  /**
   * The program translated general interaction PATTERNS from the Zoox design
   * system and copied no implementation. These assert the absence of the
   * things that would make that claim false — a borrowed class namespace, a
   * borrowed custom-property namespace, or a font served from their domain.
   */
  it('carries no borrowed class or custom-property namespace', () => {
    for (const [name, css] of HOMEPAGE_CSS) {
      expect(css.toLowerCase(), `${name} carries a borrowed namespace`).not.toMatch(
        /\bzoox\b|--zx-|\.zx-|\bzx__/,
      );
    }
  });

  it('loads no external font or stylesheet', () => {
    for (const [name, css] of HOMEPAGE_CSS) {
      expect(css, `${name} pulls a remote asset`).not.toMatch(/@import\s+url\(|src\s*:\s*url\(\s*['"]?https?:/);
      expect(css, `${name} pulls a remote asset`).not.toMatch(/url\(\s*['"]?https?:\/\//);
    }
  });
});
