'use client';

/**
 * useHeaderScene — reflects the page's declared scenes onto the header.
 *
 * Sections opt in with an explicit contract:
 *
 *   <section data-header-theme="dark" data-header-stage="sources">
 *
 * The hook watches those sections with an IntersectionObserver whose
 * rootMargin collapses the viewport to a band just under the header, so the
 * section currently passing beneath the bar decides its treatment. This is
 * declaration, not detection: no pixel sampling, no scroll listener, no rAF —
 * the header observes discrete activation, which XS-1 explicitly permits, and
 * never drives page progression.
 *
 * Late-mounting sections (a phase change on the activation flow, a variant
 * swap) are caught by a MutationObserver that re-collects declared sections
 * when the DOM under <main>/<body> changes. Both observers are disconnected
 * on cleanup; nothing global leaks.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  isHeaderTheme,
  isJourneyStageId,
  type HeaderTheme,
  type JourneyStageId,
} from './journeyStages';

export interface HeaderScene {
  theme: HeaderTheme;
  stage: JourneyStageId;
}

const SCENE_SELECTOR = '[data-header-theme], [data-header-stage]';

/**
 * The observation band: the top 35% of the viewport. A section takes the
 * header as it becomes the reader's context — slightly before it slides
 * under the bar, which reads as the header anticipating the scene (the
 * 300ms surface transition covers the hand-off). The band is deliberately
 * NOT a thin strip at the header line: a final section shorter than the
 * remaining viewport can never reach a thin top band before the page
 * bottoms out, and would be unreachable by scroll.
 */
const BAND_ROOT_MARGIN = '0px 0px -65% 0px';

export function useHeaderScene(defaults: HeaderScene): HeaderScene {
  const [declared, setDeclared] = useState<Partial<HeaderScene>>({});

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined') {
      return;
    }

    // Sections currently intersecting the band, in observation insertion
    // order; document order decides when several overlap the band at once.
    const intersecting = new Set<Element>();

    const apply = () => {
      let winner: Element | null = null;
      for (const el of intersecting) {
        if (!winner) {
          winner = el;
          continue;
        }
        // The later section in document order is the one the reader has
        // scrolled INTO; it takes the band from the one above it.
        if (winner.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
          winner = el;
        }
      }
      if (!winner) {
        setDeclared({});
        return;
      }
      const theme = winner.getAttribute('data-header-theme');
      const stage = winner.getAttribute('data-header-stage');
      setDeclared({
        theme: isHeaderTheme(theme) ? theme : undefined,
        stage: isJourneyStageId(stage) ? stage : undefined,
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target);
          else intersecting.delete(entry.target);
        }
        apply();
      },
      { rootMargin: BAND_ROOT_MARGIN, threshold: 0 },
    );

    const observed = new Set<Element>();
    const collect = () => {
      const found = document.querySelectorAll(SCENE_SELECTOR);
      for (const el of found) {
        // The header itself reflects the resolved scene through the same
        // attribute names; observing it would feed the output back in.
        if (el.closest('header')) continue;
        if (!observed.has(el)) {
          observed.add(el);
          io.observe(el);
        }
      }
      for (const el of observed) {
        if (!el.isConnected) {
          observed.delete(el);
          intersecting.delete(el);
          io.unobserve(el);
        }
      }
    };
    collect();

    // Re-collect when sections mount or unmount after hydration. Attribute
    // filtering keeps this from firing on unrelated DOM churn.
    let scheduled = 0;
    const mo = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = window.setTimeout(() => {
        scheduled = 0;
        collect();
        apply();
      }, 100);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (scheduled) window.clearTimeout(scheduled);
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return useMemo(
    () => ({
      theme: declared.theme ?? defaults.theme,
      stage: declared.stage ?? defaults.stage,
    }),
    [declared.theme, declared.stage, defaults.theme, defaults.stage],
  );
}
