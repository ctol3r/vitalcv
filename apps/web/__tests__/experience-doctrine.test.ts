import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Experience doctrine gate — the founder cinematic rulings (2026-08-02).
 *
 * Authority:
 *   docs/design/founder-rulings-2026-08.md        FR-1 … FR-5
 *   docs/design/VITALCV_EXPERIENCE_SYSTEM_2026.md XS-1 … XS-10
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM check-design-lint.ts
 *
 * The lint script matches text within a file. Three of the rulings are not
 * textual properties of any single file:
 *
 *   - "exactly ONE page-level scroll owner" is a property of the whole tree.
 *     A regex sees one `addEventListener('scroll')` and cannot tell whether it
 *     is the first or the second.
 *   - "an allowed media rail must NOT fail the retired-carousel rule" is a
 *     statement ABOUT a gate, so it has to execute that gate.
 *   - "reduced motion renders a complete linear composition" is behavioural.
 *
 * Each test below states the ruling it enforces. A test that no longer matches
 * its ruling is a bug in the test, not licence to weaken the ruling — amend the
 * doctrine first (CD-19), then this file.
 */

const web = join(__dirname, '..');
const designDocs = join(web, '..', '..', 'docs', 'design');

const SKIP_DIRS = new Set([
  'node_modules', '.next', '.turbo', 'dist', 'build', 'coverage', '_archive', '__tests__', 'tests',
]);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Strip comments so a prose mention of a banned mechanism is not a violation. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const SOURCE_FILES = [...walk(join(web, 'app')), ...walk(join(web, 'components')), ...walk(join(web, 'lib'))];

/**
 * Modules transitively reachable from the homepage entry.
 *
 * XS-1 governs a PAGE-level scroll owner, so the set it constrains is what the
 * page actually mounts — not every file in the tree.
 *
 * This distinction is load-bearing. A whole-tree scan finds SIX modules that
 * subscribe to scroll and drive progression (ScrollMotion, ScrollScrubHeading,
 * HorizontalStoryRail, ChapterProgress, w1501/shared, useFilmProgress), none of
 * which `app/page.tsx` can reach — they are retired film/rail/w1501 trees kept
 * alive only by importing each other. Failing this gate on them would block
 * every future homepage PR on dead code that PR did not create, which is how a
 * gate ends up being weakened for the wrong reason.
 *
 * They are real debt and are reported for the CSS/design convergence wave. They
 * are not a page-level scroll owner, because they are not on the page.
 */
function reachableFromHomepage(): string[] {
  const entry = join(web, 'app', 'page.tsx');
  const seen = new Set<string>();
  const queue = [entry];

  const resolve = (spec: string): string | null => {
    if (!spec.startsWith('@/')) return null;
    const base = join(web, spec.slice(2));
    for (const cand of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
      try {
        if (statSync(cand).isFile()) return cand;
      } catch {
        /* not this candidate */
      }
    }
    return null;
  };

  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    let src: string;
    try {
      src = code(file);
    } catch {
      continue;
    }
    for (const m of src.matchAll(/from\s+['"](@\/[^'"]+)['"]/g)) {
      const next = resolve(m[1]);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return [...seen];
}

const HOMEPAGE_REACHABLE = reachableFromHomepage();

describe('XS-1 — one page-level scroll owner', () => {
  /**
   * The ruling is a COUNT, so this test counts. It deliberately does not assert
   * *which* component owns scroll: naming the owner would make a legitimate
   * rename fail, and "assert the outcome, not the mechanism" is why R8 had to be
   * renamed in the first place.
   */
  it('at most one module reachable from the homepage drives scroll progression', () => {
    const owners = HOMEPAGE_REACHABLE.filter((f) => {
      const src = code(f);
      // A page-level driver both subscribes to scroll AND converts it into
      // continuous progress via rAF / useScroll. A component that merely reads
      // a published progress value is a consumer, not an owner.
      const subscribes =
        /addEventListener\(\s*["']scroll["']/.test(src) || /\buseScroll\s*\(/.test(src);
      const drives = /requestAnimationFrame\s*\(/.test(src) || /\buseScroll\s*\(/.test(src);
      return subscribes && drives;
    }).map((f) => f.replace(web, 'apps/web'));

    // Asserted as the actual list, not a count: when this fails the message
    // names the offending modules instead of printing "expected 2 to be 1".
    expect(
      owners.length <= 1 ? [] : owners,
      'XS-1 permits exactly one page-level scroll owner. Every other surface must READ published progress rather than subscribing itself.',
    ).toEqual([]);
  });

  it('no module intercepts wheel or touchmove', () => {
    const offenders = SOURCE_FILES.filter((f) => {
      const src = code(f);
      return (
        /(?:wheel|touchmove)[\s\S]{0,200}?preventDefault/.test(src) ||
        /preventDefault[\s\S]{0,200}?(?:wheel|touchmove)/.test(src) ||
        /passive\s*:\s*false/.test(src)
      );
    });
    expect(offenders.map((f) => f.replace(web, 'apps/web'))).toEqual([]);
  });

  it('no third-party scroll or 3D engine is imported', () => {
    const banned = /from\s+['"](?:lenis|@studio-freight\/lenis|locomotive-scroll|gsap(?:\/[^'"]*)?|swiper(?:\/[^'"]*)?|three(?:\/[^'"]*)?)['"]/;
    const offenders = SOURCE_FILES.filter((f) => banned.test(code(f)));
    expect(offenders.map((f) => f.replace(web, 'apps/web'))).toEqual([]);
  });
});

describe('CD-13 amendment — the rail is allowed, the carousel is not', () => {
  /**
   * This is the test the directive asks for by name: "an allowed media rail does
   * not fail the retired-carousel rule". It executes the real R2 pattern rather
   * than restating it, so the two cannot drift apart.
   */
  const R2 = /\bRolodex\b|\bCarousel\b|scroll-snap-type|\bJourneyCard\b/i;

  it('permits the founder-approved rail vocabulary', () => {
    for (const allowed of ['ScrollMediaTrack', 'HorizontalStoryRail', 'EvidenceRail', 'ScrollSceneStage']) {
      expect(R2.test(allowed), `${allowed} must not trip the retired-carousel rule (FR-2)`).toBe(false);
    }
  });

  it('still rejects the retired formats', () => {
    for (const retired of ['Carousel', 'Rolodex', 'JourneyCard', 'scroll-snap-type: y mandatory']) {
      expect(R2.test(retired), `${retired} is retired by CD-13 and FR-2 preserves that`).toBe(true);
    }
  });
});

describe('the doctrine is committed and self-consistent', () => {
  const rulings = readFileSync(join(designDocs, 'founder-rulings-2026-08.md'), 'utf8');
  const system = readFileSync(join(designDocs, 'VITALCV_EXPERIENCE_SYSTEM_2026.md'), 'utf8');
  const cd = readFileSync(join(designDocs, 'VITALCV_CREATIVE_DIRECTION.md'), 'utf8');

  it('CD-11, CD-13 and CD-6 each carry the dated amendment CD-19 requires', () => {
    // CD-19: paper, ink, type, states, motion timing and the kill list change
    // only by editing this file WITH A DATED RATIONALE.
    const amendments = cd.match(/\*\*Amendment 2026-08-02 \(per CD-19\)/g) ?? [];
    expect(amendments.length, 'CD-11, CD-13 and CD-6 must each carry a dated amendment').toBe(3);
  });

  it('preserves every prohibition the rulings did not relax', () => {
    for (const survives of [
      'preventDefault',
      'scroll trap',
      'autoplay',
      'infinite animation',
      'stock clinician imagery',
      'glass on evidence',
      'generic node graph',
      'metric theatre',
      'automatic employer decision',
    ]) {
      expect(rulings.toLowerCase()).toContain(survives.toLowerCase());
    }
  });

  it('states the reduced-motion floor as a deliverable, not a fallback', () => {
    expect(system).toMatch(/required deliverable/i);
    expect(rulings).toMatch(/FR-4/);
  });

  /**
   * Markdown hard-wraps at ~80 columns, so any phrase worth asserting spans a
   * newline whose position is an artefact of formatting. Strip blockquote
   * markers first, THEN collapse whitespace — otherwise a `>` continuation
   * lands in the middle of the phrase and the match fails for a reason that has
   * nothing to do with what the doctrine says.
   *
   * The assertion is about the words. Reflowing a paragraph must not read as a
   * doctrine change.
   */
  const flat = (s: string) => s.replace(/^\s*>\s?/gm, '').replace(/\s+/g, ' ');

  it('keeps the NPI field outranking the journey (XS-10)', () => {
    expect(system).toMatch(/XS-10/);
    expect(flat(system)).toMatch(/\*\*usable immediately\*\*/i);
  });

  it('permits at most one public Ink chapter and forbids dark cards', () => {
    expect(flat(cd)).toMatch(/One — and only one — full-bleed warm-graphite chapter/);
    expect(flat(cd)).toMatch(/not permission for dark dashboard cards/i);
  });
});
