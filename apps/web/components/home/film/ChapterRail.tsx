'use client';

import * as React from 'react';

/**
 * The chapter rail — Concept A's sliding chapter menu, grafted into the
 * approved direction (#1060).
 *
 * ONE continuous mono track inside a clipped window. The active chapter is ink
 * and slightly larger; its neighbours stay legible at the edges, so a reader
 * always knows where they are and what is adjacent — which is the whole job of
 * a chapter menu on a composition this long.
 *
 * WHY THIS CANNOT BECOME A SECOND SCROLL OWNER. Every item is an ordinary
 * in-page anchor. There is no wheel handler, no scroll listener, no
 * `scrollIntoView` call, and no rAF: clicking navigates the way a link
 * navigates, Tab reaches every chapter, and with JS off the rail is a plain
 * `<nav>` list that still works. `activeIndex` is READ from the one driver in
 * `useFilmProgress`; the rail never measures anything itself.
 *
 * `check-design-lint` R8 is error-mode over this directory precisely to keep
 * that true.
 */

export interface Chapter {
  /** The in-page anchor id, which is also the chapter section's `id`. */
  readonly id: string;
  /** The rail label. */
  readonly label: string;
}

/**
 * The founder-approved chapter vocabulary. These are also the section
 * `aria-label`s, so a screen reader navigating by region hears the same four
 * names a sighted reader sees in the rail.
 */
export const CHAPTERS: ReadonlyArray<Chapter> = Object.freeze([
  Object.freeze({ id: 'your-number', label: 'Your number' }),
  Object.freeze({ id: 'source-responses', label: 'Source responses' }),
  Object.freeze({ id: 'your-permission', label: 'Your permission' }),
  Object.freeze({ id: 'human-review', label: 'Human review' }),
  Object.freeze({ id: 'closing', label: 'What happens next' }),
]);

/**
 * @param activeIndex which chapter owns the frame, or `null` in the vertical
 *   composition — where nothing is "active" because every chapter is simply on
 *   the page, and pretending otherwise would put a state on screen that the
 *   reader cannot act on.
 */
export function ChapterRail({ activeIndex }: { activeIndex: number | null }) {
  /*
    The track slides so the active label sits at the reading edge. This is a
    transform on a list of links — not a scroll container — so it cannot trap a
    gesture, and it is capped so the last chapters do not slide past the window.
  */
  const offset = activeIndex === null ? 0 : Math.min(activeIndex, CHAPTERS.length - 2);

  return (
    <nav className="film-rail" aria-label="Chapters">
      <span className="film-rail-label film-summon-eyebrow">Chapters</span>
      <div className="film-rail-window">
        <ul
          className="film-rail-track"
          style={{ transform: `translate3d(calc(${offset} * -9.5rem), 0, 0)` }}
        >
          {CHAPTERS.map((chapter, i) => (
            <li
              key={chapter.id}
              className="film-rail-item"
              data-active={activeIndex === i ? '' : undefined}
            >
              <a
                className="film-rail-link"
                href={`#${chapter.id}`}
                aria-current={activeIndex === i ? 'true' : undefined}
              >
                {chapter.label}
                {/*
                  Position is announced, never printed.

                  A visible `01`–`05` is the numbered-step grammar CD-13 retires,
                  and `doctrine-visual` enforces that on the rendered page — it
                  caught this exact rail. Ordering is carried visually by the
                  active label's weight, its ink, and the hairline beneath it;
                  a screen-reader user gets the count in words instead, which is
                  the one audience a purely visual indicator would fail.
                */}
                <span className="sr-only">
                  {` — chapter ${i + 1} of ${CHAPTERS.length}`}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
