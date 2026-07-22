/**
 * H3 — the chapter registry and the anchor CSS must agree.
 *
 * `CHAPTER_DOM_IDS` is what the scroll driver discovers; the `scroll-margin-top`
 * rule in homepage-motion.css is what keeps an anchored chapter clear of the
 * fixed header. Nothing asserted that the two lists matched, and they had
 * already drifted: the rail shipped a `start` chapter while `#start` was absent
 * from the CSS, so deep-linking to the final chapter landed it under the header.
 *
 * This is a text assertion against the stylesheet on purpose — the bug lives in
 * CSS, which no component test renders.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { CHAPTER_DOM_IDS } from '@/components/home/scene/ChapterProgress';
import { JOURNEY_CHAPTERS } from '@/components/home/journey';

const css = readFileSync(path.join(__dirname, '..', 'styles', 'homepage-motion.css'), 'utf8');

/** The selector group carrying the header offset, as a set of bare ids. */
function anchorRuleIds(): Set<string> {
  const match = css.match(/((?:#[a-z-]+,\s*)+#[a-z-]+)\s*\{\s*scroll-margin-top/);
  if (!match) throw new Error('no scroll-margin-top anchor rule found in homepage-motion.css');
  return new Set(match[1].split(',').map((s) => s.trim().replace(/^#/, '')));
}

describe('chapter anchor contract', () => {
  it('gives every CHAPTER_DOM_IDS entry a scroll-margin-top', () => {
    const ruled = anchorRuleIds();
    const missing = CHAPTER_DOM_IDS.filter((id) => !ruled.has(id));
    expect(missing, `ids in CHAPTER_DOM_IDS with no header offset: ${missing.join(', ')}`).toEqual(
      [],
    );
  });

  it('covers every live journey chapter id', () => {
    const ruled = anchorRuleIds();
    const missing = JOURNEY_CHAPTERS.map((c) => c.id).filter((id) => !ruled.has(id));
    expect(missing, `journey chapters with no header offset: ${missing.join(', ')}`).toEqual([]);
  });

  it('keeps every journey chapter discoverable by the scroll driver', () => {
    const known = new Set<string>(CHAPTER_DOM_IDS);
    const missing = JOURNEY_CHAPTERS.map((c) => c.id).filter((id) => !known.has(id));
    expect(missing, `journey chapters absent from CHAPTER_DOM_IDS: ${missing.join(', ')}`).toEqual(
      [],
    );
  });

  it('leaves no rule for the retired pre-W2 scroll model', () => {
    // StickyProductStory and the floating section rail were deleted from the
    // tree in #800; their CSS outlived them. Selectors only — the explanatory
    // comments naming what was removed are deliberately allowed.
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const dead of [
      '.sticky-product-story',
      '.story-observer',
      '.story-stage',
      '.story-intro',
      '.story-progress-rail',
      '.story-progress-step',
      '.story-cards',
      '.story-footnote',
    ]) {
      expect(withoutComments, `${dead} styles a component that no longer exists`).not.toContain(
        dead,
      );
    }
  });

  it('keeps the classes the shipped rail actually renders', () => {
    // The counterpart guard: this cleanup must stay surgical. JourneyCard and
    // HorizontalStoryRail render these, so they are load-bearing.
    for (const live of [
      '.story-card-shell',
      '.story-card-copy',
      '.story-card-eyebrow',
      '.story-state',
      '.story-product-ui',
      '.story-rail-track',
    ]) {
      expect(css, `${live} is rendered by the rail and must keep its styles`).toContain(live);
    }
  });
});
