'use client';

import { useEffect, type RefObject } from 'react';

/**
 * useSectionReveals — the amendment E.2 one-shot section entrances.
 *
 * Enhancement grammar, same as WorkSurface's row reveal: the server frame is
 * COMPLETE; this hook only arms a one-shot reveal after hydration, and only
 * outside prefers-reduced-motion. Arming sets `data-ezh-motion="armed"` on
 * the island root; an IntersectionObserver adds `.is-in` to each
 * `[data-ezh-reveal]` section exactly once; a safety timer force-completes
 * everything and flips the root to `"done"`, so a reveal that never fires can
 * strand nothing (the hidden state only exists while the root reads
 * `"armed"`).
 *
 * Two repo-taught traps handled here:
 *  - Late mounts: sections or rows that appear after hydration (the live
 *    feed) are caught by a MutationObserver and observed on arrival — the
 *    IntersectionObserver alone misses them (reveal_observer_missed_late_mounts).
 *  - A mid-session switch to reduced motion completes the frame immediately
 *    and disarms, exactly like the figure machinery.
 *
 * Nothing here loops, listens to wheel events, or owns scrolling: the
 * document remains the page's one scroll owner (EC-4).
 */
export function useSectionReveals(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return undefined;

    const sections = () => root.querySelectorAll<HTMLElement>('[data-ezh-reveal]');

    const completeAll = () => {
      sections().forEach((section) => section.classList.add('is-in'));
      root.setAttribute('data-ezh-motion', 'done');
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );

    const observe = (el: Element) => {
      if (!el.classList.contains('is-in')) io.observe(el);
    };

    sections().forEach(observe);

    // The late-mount trap: a section (or its content) arriving after
    // hydration must still be caught, or it reveals never.
    const mo = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches('[data-ezh-reveal]')) observe(node);
          node.querySelectorAll('[data-ezh-reveal]').forEach(observe);
        }
      }
    });
    mo.observe(root, { childList: true, subtree: true });

    root.setAttribute('data-ezh-motion', 'armed');

    // Safety: whatever the observers did, the finished page stands.
    const settle = window.setTimeout(completeAll, 4000);

    const stopForReducedMotion = () => {
      if (reducedMotion.matches) {
        completeAll();
        root.removeAttribute('data-ezh-motion');
      }
    };
    reducedMotion.addEventListener('change', stopForReducedMotion);

    return () => {
      io.disconnect();
      mo.disconnect();
      window.clearTimeout(settle);
      reducedMotion.removeEventListener('change', stopForReducedMotion);
      root.removeAttribute('data-ezh-motion');
    };
  }, [rootRef]);
}
