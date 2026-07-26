'use client';

/**
 * HorizontalStoryRail (SHD-3.1, extended for deep-audit W2) — the pinned
 * desktop chapter rail.
 *
 * Contract:
 *  - ELIGIBLE desktop only (fine pointer, ≥ minWidth, no reduced motion, JS on):
 *    a bounded vertical scroll runway pins a sticky viewport and translates the
 *    chapters horizontally left→right — a spatial career journey.
 *  - EVERYWHERE ELSE (mobile, narrow, coarse pointer, reduced motion, no-JS,
 *    SSR): the EXACT same chapters render in normal vertical DOM order. Same
 *    markup, same ids, same order — the fallback is the default, the pin is the
 *    enhancement.
 *  - Never traps scroll: translation is a pure function of native scrollY
 *    (geometry.ts), so wheel/trackpad, Page Up/Down, arrows, browser
 *    back/forward, and Tab all behave normally. A focused control inside an
 *    off-screen chapter scrolls its chapter into the pin.
 *  - Deep links: `#<chapterId>` scrolls to that chapter's rest position.
 *  - A keyboard-visible "Skip product story" control jumps past the runway.
 *  - Footer / legal live OUTSIDE the rail in normal vertical flow (caller).
 *
 * W2 extensions:
 *  - Rolodex leaf pose (W2.2): every rAF, each chapter element receives its
 *    `--leaf-*` custom properties from the pure railLeafTransform curves —
 *    the card INSIDE the chapter turns through the rotary-file fan while the
 *    track translates. One driver, zero extra listeners, zero React renders
 *    per frame.
 *  - Chapter navigation (W2.3): the ONE page-level in-page navigator
 *    (`data-story-rail-nav`), rendered only while pinned — labels + progress
 *    state, click/keyboard to a chapter's rest position. In the vertical
 *    fallback, DOM order IS the navigation and no navigator renders.
 *  - `onProgress` / `onPinnedChange`: continuous progress out to the
 *    chapter-driver bridge so the ambient scene follows the SAME single
 *    model (audit rule: one motion driver per story).
 *
 * SSR renders the vertical fallback; eligibility is decided post-mount, so
 * there is never a pinned blank frame and no-JS gets the full document.
 */

import * as React from 'react';

import { useScene } from '@/components/home/scene/SceneProvider';
import { railLeafTransform } from '@/lib/home/rolodex';
import { railRunwayHeight, resolveRail, scrollForChapter } from './geometry';

export interface RailChapter {
  id: string;
  label: string;
  node: React.ReactNode;
}

interface HorizontalStoryRailProps {
  chapters: RailChapter[];
  /** Minimum viewport width (px) for the pinned mode. */
  minWidth?: number;
  /** Viewport-heights of scroll each transition dwells. */
  dwellVh?: number;
  /** Called with the active chapter index as the runway scrubs. */
  onActiveChange?: (index: number) => void;
  /** Continuous 0→1 runway progress, per animation frame (pinned mode only). */
  onProgress?: (progress01: number, activeIndex: number) => void;
  /** Called when the pin engages/releases (for driver handoff). */
  onPinnedChange?: (pinned: boolean) => void;
  /** id of the element to land on when "Skip product story" is used. */
  skipTargetId?: string;
}

export function HorizontalStoryRail({
  chapters,
  minWidth = 1024,
  dwellVh = 1,
  onActiveChange,
  onProgress,
  onPinnedChange,
  skipTargetId,
}: HorizontalStoryRailProps) {
  const { capabilities, ready } = useScene();
  const [wideEnough, setWideEnough] = React.useState(false);
  const [navActive, setNavActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const runwayRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const activeRef = React.useRef(0);

  // Post-mount width check (SSR-safe): the pin is a desktop enhancement.
  React.useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const update = () => setWideEnough(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, [minWidth]);

  const pinned =
    ready && wideEnough && !capabilities.reducedMotion && !capabilities.coarsePointer;

  React.useEffect(() => {
    onPinnedChange?.(pinned);
  }, [pinned, onPinnedChange]);

  // The native-scroll driver: one rAF-throttled scroll listener maps scrollY to
  // a horizontal transform + the rolodex leaf poses. Active only while pinned.
  React.useEffect(() => {
    if (!pinned) {
      if (trackRef.current) trackRef.current.style.transform = '';
      if (runwayRef.current) runwayRef.current.style.height = '';
      // Clear leaf poses so the vertical fallback renders untransformed.
      rootRef.current
        ?.querySelectorAll<HTMLElement>('[data-rail-chapter]')
        .forEach((el) => el.removeAttribute('style'));
      return;
    }
    const runway = runwayRef.current;
    const track = trackRef.current;
    if (!runway || !track) return;

    let raf = 0;
    let runwayTop = 0;
    let runwayHeight = 0;
    let chapterEls: HTMLElement[] = [];

    const measure = () => {
      runwayHeight = railRunwayHeight(chapters.length, window.innerHeight, dwellVh);
      runway.style.height = `${runwayHeight}px`;
      runwayTop = runway.getBoundingClientRect().top + window.scrollY;
      chapterEls = Array.from(track.querySelectorAll<HTMLElement>('[data-rail-chapter]'));
    };

    const apply = () => {
      raf = 0;
      const geo = resolveRail(
        window.scrollY,
        runwayTop,
        runwayHeight,
        window.innerHeight,
        chapters.length,
      );
      track.style.transform = `translate3d(-${geo.translatePercent}vw, 0, 0)`;

      // Rolodex leaf poses (W2.2): pure curves over offset = index − journey.
      const journey = geo.progress * (chapters.length - 1);
      chapterEls.forEach((el, i) => {
        const pose = railLeafTransform(i - journey);
        el.style.setProperty('--leaf-rx', `${pose.rotateX.toFixed(2)}deg`);
        el.style.setProperty('--leaf-ty', `${pose.y.toFixed(1)}px`);
        el.style.setProperty('--leaf-tz', `${pose.z.toFixed(1)}px`);
        el.style.setProperty('--leaf-s', pose.scale.toFixed(3));
        el.style.setProperty('--leaf-o', pose.opacity.toFixed(3));
        el.style.zIndex = String(pose.zIndex);
      });

      // Publish geometry to the DOM directly (no React round-trip) so scroll →
      // active state is deterministic for tests and consumers.
      if (rootRef.current) {
        rootRef.current.dataset.railActive = String(geo.activeIndex);
        rootRef.current.dataset.railProgress = geo.progress.toFixed(3);
      }
      onProgress?.(geo.progress, geo.activeIndex);
      if (geo.activeIndex !== activeRef.current) {
        activeRef.current = geo.activeIndex;
        setNavActive(geo.activeIndex);
        onActiveChange?.(geo.activeIndex);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onResize = () => {
      measure();
      apply();
    };

    measure();
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    // Late content changes chapter heights → remeasure.
    const ro = new ResizeObserver(onResize);
    ro.observe(runway);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
    };
  }, [pinned, chapters.length, dwellVh, onActiveChange, onProgress]);

  const scrollToChapter = React.useCallback(
    (index: number) => {
      const runway = runwayRef.current;
      if (!pinned || !runway) {
        document.getElementById(chapters[index]?.id ?? '')?.scrollIntoView({ block: 'start' });
        return;
      }
      const runwayTop = runway.getBoundingClientRect().top + window.scrollY;
      const runwayHeight = railRunwayHeight(chapters.length, window.innerHeight, dwellVh);
      const y = scrollForChapter(index, runwayTop, runwayHeight, window.innerHeight, chapters.length);
      window.scrollTo({ top: y, behavior: 'smooth' });
    },
    [pinned, chapters, dwellVh],
  );

  // Deep-link + in-page hash → the matching chapter's rest position.
  React.useEffect(() => {
    if (!pinned) return;
    const jump = () => {
      const id = window.location.hash.replace('#', '');
      const idx = chapters.findIndex((c) => c.id === id);
      if (idx >= 0) requestAnimationFrame(() => scrollToChapter(idx));
    };
    jump();
    window.addEventListener('hashchange', jump);
    return () => window.removeEventListener('hashchange', jump);
  }, [pinned, chapters, scrollToChapter]);

  // When focus enters an off-screen chapter (keyboard Tab), bring it into the
  // pin so a focused control is never stranded outside the viewport.
  const onFocusCapture = React.useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (!pinned) return;
      const chapterEl = (e.target as HTMLElement).closest('[data-rail-chapter]');
      if (!chapterEl) return;
      const idx = chapters.findIndex((c) => c.id === chapterEl.getAttribute('data-rail-chapter-id'));
      if (idx >= 0 && idx !== activeRef.current) scrollToChapter(idx);
    },
    [pinned, chapters, scrollToChapter],
  );

  return (
    <div ref={rootRef} data-story-rail="" data-rail-pinned={pinned ? 'true' : 'false'} data-rail-active="0">
      {/* Skip control: always in the tab order, visible on focus. */}
      {skipTargetId ? (
        <a href={`#${skipTargetId}`} className="story-rail-skip" data-rail-skip="">
          Skip product story
        </a>
      ) : null}

      <div ref={runwayRef} className={pinned ? 'story-rail-runway' : undefined}>
        <div className={pinned ? 'story-rail-viewport' : undefined}>
          {/* W2.3: THE one page-level chapter navigator — pinned mode only.
              In the vertical fallback the document order is the navigation. */}
          {pinned ? (
            <nav className="story-rail-nav" aria-label="Career journey chapters" data-story-rail-nav="">
              {chapters.map((chapter, i) => (
                <button
                  key={chapter.id}
                  type="button"
                  aria-current={i === navActive ? 'step' : undefined}
                  data-rail-nav-target={chapter.id}
                  onClick={() => scrollToChapter(i)}
                >
                  <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  {chapter.label}
                </button>
              ))}
            </nav>
          ) : null}
          <div
            ref={trackRef}
            className={pinned ? 'story-rail-track' : 'story-rail-stack'}
            onFocusCapture={onFocusCapture}
          >
            {chapters.map((chapter) => (
              <section
                key={chapter.id}
                id={chapter.id}
                data-rail-chapter=""
                data-rail-chapter-id={chapter.id}
                aria-label={chapter.label}
                className={pinned ? 'story-rail-chapter' : 'story-rail-chapter-vertical'}
              >
                {chapter.node}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HorizontalStoryRail;
