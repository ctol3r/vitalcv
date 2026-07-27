'use client';

/**
 * ArtifactStage — mounts an animated evidence drawing anywhere.
 *
 * The homepage's ask surface wires its own IntersectionObserver; every other
 * page uses this instead: a figure that adds `ask-art-play` to itself once,
 * the first time it scrolls into view, so the drawing's step sequence plays
 * and then rests (CD-11).
 *
 * Progressive enhancement three times over, same as the ask surface: without
 * JS the class is never added and the base CSS is already the final
 * composition; under `prefers-reduced-motion` the keyframes are disabled in
 * artifact-motion.css; without IntersectionObserver the drawing simply
 * stands.
 *
 * Pages using this must import `@/styles/artifact-motion.css` (grammar +
 * step timing) — keyframe definitions live in `@/styles/motion.css`.
 */

import * as React from 'react';

export interface ArtifactStageProps {
  children: React.ReactNode;
  /** Figure caption. Defaults to the house illustrative disclaimer — pass
   * `null` explicitly only when the artifact renders REAL data. */
  caption?: string | null;
  className?: string;
  /** How much of the figure must be visible before the sequence plays. */
  threshold?: number;
}

export function ArtifactStage({
  children,
  caption = 'Illustrative — not a live result',
  className = '',
  threshold = 0.45,
}: ArtifactStageProps) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('ask-art-play');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <figure ref={ref} className={`vt-artifact ${className}`.trim()}>
      {children}
      {caption ? <figcaption className="ask-art-cap">{caption}</figcaption> : null}
    </figure>
  );
}
