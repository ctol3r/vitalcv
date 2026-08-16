'use client';

import { useEffect } from 'react';

/**
 * DirectoryReveal — the one-shot entrance driver for /directory/[npi].
 *
 * The server frame is COMPLETE: every section is fully visible without this
 * component, without JavaScript, and under prefers-reduced-motion (EC-4 —
 * meaning never lives in motion). This effect is pure enhancement, following
 * the EasyHome arming pattern (WorkSurface.tsx): hydration explicitly arms
 * the animation by adding `.dra-armed` to the island root, an
 * IntersectionObserver lands each `[data-dra-reveal]` section once as it
 * enters the viewport, and a safety timer lands everything so a transition
 * that never paints can strand nothing.
 *
 * EC-29: single-shot only — each section is unobserved the moment it lands,
 * and nothing here loops. XS-1: the browser scrolls; we observe. No wheel
 * interception, no scroll library, no snap.
 */
export default function DirectoryReveal() {
  useEffect(() => {
    const root = document.querySelector('.dra');
    if (!root) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const targets = Array.from(
      root.querySelectorAll<HTMLElement>('[data-dra-reveal]'),
    );
    if (targets.length === 0) return undefined;

    root.classList.add('dra-armed');

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      // Land a section when a sliver of it is genuinely on screen. The small
      // bottom margin keeps the rise visible instead of finishing below the
      // fold edge.
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    targets.forEach((t) => observer.observe(t));

    // Safety: whatever the observer did or did not do, the finished frame
    // stands. After this fires, remaining sections are simply present — a
    // calmer page, never a blank one.
    const settle = window.setTimeout(() => {
      targets.forEach((t) => t.classList.add('is-in'));
      observer.disconnect();
    }, 10_000);

    const stopForReducedMotion = () => {
      if (!reduced.matches) return;
      root.classList.remove('dra-armed');
      targets.forEach((t) => t.classList.add('is-in'));
      observer.disconnect();
    };
    reduced.addEventListener('change', stopForReducedMotion);

    return () => {
      window.clearTimeout(settle);
      observer.disconnect();
      reduced.removeEventListener('change', stopForReducedMotion);
      // Unmount leaves the finished frame, never the armed-hidden one.
      root.classList.remove('dra-armed');
    };
  }, []);

  return null;
}
