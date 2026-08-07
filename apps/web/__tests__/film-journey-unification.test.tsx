/**
 * Film ↔ journey vocabulary unification (founder follow-up, 2026-08-07).
 *
 * The shared header's journey rail (#1083) and the film rollback's ChapterRail
 * used to carry two vocabularies for one story: `sources` vs
 * `source-responses`, "Review" vs "Human review". The concrete failure was
 * anchor honesty — the header rail's `/#sources` links no-op'd whenever the
 * film variant was serving `/`, because no film section carried that id.
 *
 * These tests pin the unification at its three layers:
 *   1. the ChapterRail vocabulary DERIVES from JOURNEY_STAGES (one source of
 *      truth, not a coincidentally-equal copy);
 *   2. the rendered film markup carries the unified ids, the header scene
 *      contract, and matching region names;
 *   3. the film stylesheet keeps anchored chapters clear of the sticky bar,
 *      the same discipline `.clh-room[id]` applies on the career loop.
 */
import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { CHAPTERS } from '@/components/home/film/ChapterRail';
import { HorizontalCareerFilm } from '@/components/home/film/HorizontalCareerFilm';
import { JOURNEY_STAGES, isJourneyStageId } from '@/components/layout/journeyStages';

describe('ChapterRail vocabulary derives from journeyStages', () => {
  it('carries the four journey stages first, under the same ids and labels', () => {
    expect(CHAPTERS.slice(0, JOURNEY_STAGES.length).map((c) => ({ id: c.id, label: c.label }))).toEqual(
      JOURNEY_STAGES.map((s) => ({ id: s.id, label: s.label })),
    );
  });

  it('keeps the closing epilogue as the only film-specific chapter', () => {
    expect(CHAPTERS.length).toBe(JOURNEY_STAGES.length + 1);
    expect(CHAPTERS[CHAPTERS.length - 1]).toMatchObject({ id: 'closing', label: 'What happens next' });
  });

  it('has no duplicate chapter ids', () => {
    const ids = CHAPTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('film markup under the unified vocabulary', () => {
  const html = renderToStaticMarkup(<HorizontalCareerFilm />);

  /** Every `<section …>` open tag, keyed by its id. */
  function sectionTags(): Map<string, string> {
    const tags = new Map<string, string>();
    for (const match of html.matchAll(/<section\b[^>]*>/g)) {
      const id = match[0].match(/\bid="([^"]+)"/)?.[1];
      if (id) tags.set(id, match[0]);
    }
    return tags;
  }

  it('renders every chapter as a section with the unified id, in rail order', () => {
    const order = [...sectionTags().keys()].filter((id) => CHAPTERS.some((c) => c.id === id));
    expect(order).toEqual(CHAPTERS.map((c) => c.id));
  });

  it('resolves every header-rail home anchor to a film section', () => {
    // THE defect this wave fixes: under the film rollback the header rail's
    // anchors must land, not no-op.
    const ids = sectionTags();
    for (const stage of JOURNEY_STAGES) {
      const fragment = stage.homeAnchor.replace('/#', '');
      expect(ids.has(fragment), `header anchor ${stage.homeAnchor} has no film section`).toBe(true);
    }
  });

  it('declares a valid header scene on every chapter, ending on review', () => {
    const ids = sectionTags();
    for (const chapter of CHAPTERS) {
      const tag = ids.get(chapter.id)!;
      const stage = tag.match(/\bdata-header-stage="([^"]+)"/)?.[1];
      const theme = tag.match(/\bdata-header-theme="([^"]+)"/)?.[1];
      expect(isJourneyStageId(stage), `${chapter.id} declares invalid stage ${stage}`).toBe(true);
      // The film is a paper composition end to end — a dark declaration here
      // would flip the header to a treatment the scene cannot honor.
      expect(theme, `${chapter.id} theme`).toBe('light');
    }
    // The epilogue rides `review` deliberately: an undeclared final section
    // would empty the observation band and snap the header back to the route
    // default mid-page.
    expect(ids.get('closing')).toMatch(/\bdata-header-stage="review"/);
  });

  it('names each region with its rail label', () => {
    const ids = sectionTags();
    for (const chapter of CHAPTERS) {
      expect(ids.get(chapter.id), `aria-label for ${chapter.id}`).toMatch(
        new RegExp(`\\baria-label="${chapter.label}"`),
      );
    }
  });

  it('leaves no section carrying a retired chapter id', () => {
    for (const retired of ['source-responses', 'your-permission', 'human-review']) {
      expect(html).not.toContain(`id="${retired}"`);
    }
  });
});

describe('film anchor offset', () => {
  it('keeps anchored chapters clear of the sticky header', () => {
    const css = readFileSync(path.join(__dirname, '..', 'styles', 'home.css'), 'utf8');
    expect(css).toMatch(/\.film-chapter\[id\]\s*\{\s*scroll-margin-top/);
  });
});
