import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FilmSpike } from '@/components/home/film/FilmSpike';
import {
  DEFAULT_FRAGMENT_COUNT,
  coreLight,
  createFragments,
  fragmentPose,
} from '@/components/home/film/atmosphere';
import { FILM_SCENES, sceneAt } from '@/components/home/film/scenes';
import {
  FILM_MIN_HEIGHT,
  FILM_MIN_WIDTH,
  progressFromRect,
} from '@/components/home/film/useFilmProgress';

/**
 * COMPETE-2 spike contract.
 *
 * These tests pin the parts of the spike that COMPETE-1 will inherit: the
 * no-graph discipline, the SSR-complete linear fallback, the single-driver
 * math, and the copy ceiling. They are the reason the spike can be trusted as
 * a reference rather than a demo.
 */

const FILM_DIR = resolve(process.cwd(), 'components/home/film');
const read = (file: string) => readFileSync(resolve(FILM_DIR, file), 'utf8');

describe('evidence atmosphere — the model', () => {
  it('is deterministic, so the poster and the canvas never disagree', () => {
    const a = createFragments();
    const b = createFragments();
    expect(a).toHaveLength(DEFAULT_FRAGMENT_COUNT);
    expect(b.map((f) => [f.fromX, f.toY, f.lane])).toEqual(a.map((f) => [f.fromX, f.toY, f.lane]));
  });

  it('settles fragments from scattered to aligned as progress advances', () => {
    const fragments = createFragments();
    const first = fragments[0]!;
    const scattered = fragmentPose(first, 0, 0, fragments.length, 0);
    const settled = fragmentPose(first, 1, 0, fragments.length, 0);

    // Arrival is dim; Recognition is legible.
    expect(settled.opacity).toBeGreaterThan(scattered.opacity);
    // The field travels leftward into the core.
    expect(settled.x).toBeLessThan(scattered.x);
    // Atmosphere stays behind copy — it never goes fully opaque.
    expect(settled.opacity).toBeLessThan(0.6);
  });

  it('keeps every fragment inside the stage at both ends of the film', () => {
    const fragments = createFragments();
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      fragments.forEach((fragment, i) => {
        const pose = fragmentPose(fragment, p, i, fragments.length, 0);
        expect(pose.x).toBeGreaterThanOrEqual(-0.02);
        expect(pose.x).toBeLessThanOrEqual(1.02);
        expect(pose.y).toBeGreaterThanOrEqual(-0.02);
        expect(pose.y).toBeLessThanOrEqual(1.02);
      });
    }
  });

  it('lights the career core without ever leaving it dark', () => {
    // An unlit core still reads as composed; a zero core is a hole.
    expect(coreLight(0)).toBeGreaterThan(0);
    expect(coreLight(1)).toBeGreaterThan(coreLight(0));
    expect(coreLight(1)).toBeLessThanOrEqual(1);
  });

  /**
   * The mandate's retired mechanism R1. This is the guard that stops the
   * atmosphere from drifting back into a graph — the exact thing PR #834 did
   * and the reason it cannot be promoted to `/`.
   */
  it('draws no edges, nodes, or connections between fragments (R1)', () => {
    const source = read('atmosphere.ts') + read('EvidenceAtmosphere.tsx');
    // Canvas path-drawing between points is how an edge would be built.
    expect(source).not.toMatch(/\.lineTo\(/);
    expect(source).not.toMatch(/\.moveTo\(/);
    expect(source).not.toMatch(/\.stroke\(/);
    expect(source).not.toMatch(/<line\b/);
    expect(source).not.toMatch(/<path\b/);
    // And no graph vocabulary in the model.
    for (const word of ['node', 'edge', 'link', 'constellation', 'force', 'simulation']) {
      expect(source.toLowerCase()).not.toContain(`${word}s:`);
    }
  });
});

describe('film driver — the one scroll owner', () => {
  it('maps a runway rect onto 0–1 and clamps outside it', () => {
    // 300vh runway in a 1000px viewport → 2000px of travel.
    expect(progressFromRect(0, 3000, 1000)).toBe(0);
    expect(progressFromRect(-1000, 3000, 1000)).toBeCloseTo(0.5, 5);
    expect(progressFromRect(-2000, 3000, 1000)).toBe(1);
    // Past either end it holds, so scrolling through stays continuous.
    expect(progressFromRect(500, 3000, 1000)).toBe(0);
    expect(progressFromRect(-9999, 3000, 1000)).toBe(1);
  });

  it('never divides by zero when the runway cannot travel', () => {
    expect(progressFromRect(0, 800, 1000)).toBe(0);
    expect(progressFromRect(-50, 1000, 1000)).toBe(0);
  });

  it('attaches exactly one scroll listener and one rAF loop', () => {
    const source = read('useFilmProgress.ts');
    expect(source.match(/addEventListener\('scroll'/g) ?? []).toHaveLength(1);
    expect(source.match(/requestAnimationFrame\(/g) ?? []).toHaveLength(1);
    // Removing the listener is not optional — a leaked driver is a second owner.
    expect(source).toContain("removeEventListener('scroll'");
  });

  it('never hijacks the vertical axis', () => {
    const source = read('useFilmProgress.ts') + read('FilmSpike.tsx');
    expect(source).not.toMatch(/addEventListener\('wheel'/);
    expect(source).not.toMatch(/preventDefault\(\)/);
    // The listener must be passive, which is what makes hijacking impossible.
    expect(read('useFilmProgress.ts')).toContain('passive: true');
  });

  it('keeps the film off touch, reduced motion, and small viewports', () => {
    const source = read('useFilmProgress.ts');
    expect(source).toContain('prefers-reduced-motion: reduce');
    expect(source).toContain('pointer: coarse');
    expect(FILM_MIN_WIDTH).toBeGreaterThanOrEqual(1024);
    expect(FILM_MIN_HEIGHT).toBeGreaterThanOrEqual(560);
  });
});

describe('scenes', () => {
  it('assigns each progress value to exactly one scene span', () => {
    expect(sceneAt(0)).toEqual({ index: 0, local: 0 });
    expect(sceneAt(0.5).index).toBe(0);
    expect(sceneAt(0.5).local).toBeCloseTo(0.5, 5);
    // At the end the LAST scene owns the frame with nothing left to travel.
    // FilmSpike reads that as `1 - local` = fully seated.
    expect(sceneAt(1)).toEqual({ index: FILM_SCENES.length - 1, local: 0 });
  });

  it('clamps out-of-range progress into a real scene index', () => {
    // Overscroll, rubber-banding, and a stale rect must never index past the
    // scene list — that would blank the stage.
    for (const p of [-99, -5, -0.001, 1.001, 5, 99]) {
      const { index, local } = sceneAt(p);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(FILM_SCENES.length - 1);
      expect(local).toBeGreaterThanOrEqual(0);
      expect(local).toBeLessThanOrEqual(1);
    }
    expect(sceneAt(-5).index).toBe(0);
    expect(sceneAt(99).index).toBe(FILM_SCENES.length - 1);
  });

  it('holds the copy ceiling: one short phrase per scene', () => {
    for (const scene of FILM_SCENES) {
      expect(scene.phrase.split(' ').length).toBeLessThanOrEqual(6);
      if (scene.support) expect(scene.support.split(' ').length).toBeLessThanOrEqual(8);
    }
  });

  it('never renders a scene name as a visible header (R6)', () => {
    const html = renderToStaticMarkup(<FilmSpike />);
    for (const scene of FILM_SCENES) {
      // The internal id may appear as a data hook, never as visible text.
      expect(html).not.toContain(`>${scene.id}<`);
    }
    // No section taxonomy eyebrows.
    expect(html).not.toMatch(/How it works/i);
  });
});

describe('SSR fallback — the linear document', () => {
  const html = renderToStaticMarkup(<FilmSpike />);

  it('renders vertical before hydration, never a pinned film', () => {
    expect(html).toContain('data-film-mode="vertical"');
    expect(html).not.toContain('data-film-mode="film"');
    // The TRACK carries no transform server-side — that is the horizontal
    // travel, and committing it before eligibility is known would render the
    // second scene off-screen for a no-JS reader. (Kinetic words do carry an
    // inline transform; theirs is the identity at rest.)
    expect(html).not.toMatch(/class="film-track" style/);
  });

  it('renders every scene, in order, with its phrase readable', () => {
    const positions = FILM_SCENES.map((scene) => html.indexOf(`data-film-scene="${scene.id}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const scene of FILM_SCENES) {
      expect(html).toContain(scene.phrase);
    }
  });

  it('renders the atmosphere as real geometry, not a blank hole', () => {
    // The static poster must carry actual fragment rects server-side.
    expect(html).toContain('film-atmosphere-poster');
    expect((html.match(/<rect/g) ?? []).length).toBeGreaterThan(DEFAULT_FRAGMENT_COUNT);
    // The canvas is NOT rendered at the static tier.
    expect(html).not.toContain('film-atmosphere-canvas');
  });

  it('gives the NPI control a real label and no dead submit button', () => {
    expect(html).toContain('id="film-npi-input"');
    expect(html).toContain('for="film-npi-input"');
    expect(html).not.toContain('type="submit"');
  });

  it('discloses that the spike performs no lookup', () => {
    expect(html).toContain('does not look anything up');
    expect(html).toContain('Nothing personal is shown until a real lookup returns');
  });
});

describe('truth contract', () => {
  const html = renderToStaticMarkup(<FilmSpike />);
  const source = read('FilmSpike.tsx') + read('scenes.ts');

  it('carries no banned public claim', () => {
    const banned = [
      'automatically verified', 'guaranteed verification', 'complete credentialing',
      'instant credentialing', 'legally accepted', 'risk transferred',
      'final verification without review', 'source confirmed before response',
      'certified compliant', 'HIPAA compliant', 'SOC2 certified',
    ];
    for (const phrase of banned) {
      expect(html.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it('never uses the bare word Verified as a status label', () => {
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });

  it('renders no clinician-specific or fabricated state before a lookup', () => {
    // Assert on VISIBLE TEXT, not raw markup: the SVG gradient legitimately
    // carries geometry percentages (cx="14%"), which are not a claim.
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

    // No readiness percentage or counter — retired mechanism R4. This is the
    // exact class of thing PR #834's hero "72%" ring did.
    expect(text).not.toMatch(/\d+\s*%/);
    // No fabricated clinician.
    expect(text).not.toMatch(/Dr\.\s/);
    expect(text).not.toMatch(/\bMD\b|\bRN\b/);
    // Nondeterminism would mean the poster and canvas could disagree, and
    // would also be the easiest way to fake "live" data.
    expect(source).not.toMatch(/Math\.random/);
  });

  it('carries no retired legacy copy (R7)', () => {
    expect(html).not.toContain('Find the opportunity');
    expect(html).not.toContain('VitalCV recognizes');
  });
});

describe('style isolation', () => {
  const css = readFileSync(resolve(process.cwd(), 'styles/compete-film.css'), 'utf8');

  it('publishes nothing to :root, html, or body', () => {
    expect(css).not.toMatch(/^\s*:root\s*\{/m);
    expect(css).not.toMatch(/^\s*html\s*\{/m);
    expect(css).not.toMatch(/^\s*body\s*\{/m);
  });

  it('scopes every rule under .film', () => {
    const selectors = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .map((block) => block.split('{')[0]?.trim())
      .filter((s): s is string => Boolean(s) && !s.startsWith('@') && s.length > 0);

    for (const selector of selectors) {
      for (const part of selector.split(',')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        expect(trimmed.startsWith('.film')).toBe(true);
      }
    }
  });

  it('stills the film entirely under reduced motion', () => {
    const block = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)$/)?.[1] ?? '';
    expect(block).toContain('transform: none !important');
    expect(block).toContain('height: auto');
    expect(block).toContain('.film-readinglight');
  });
});
