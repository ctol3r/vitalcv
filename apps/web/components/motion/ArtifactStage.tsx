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
 * `@/styles/artifact-motion.css` (grammar + step timing) and
 * `@/styles/motion.css` (keyframe definitions) are imported globally via
 * app/globals.css — no per-page import is needed.
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
  /** Frosted glass housing. OFF by default and reserved for the PACKET —
   * glass is the material that makes the packet feel tactile and valuable, and
   * spending it on every drawing is what turns it into wallpaper. Never true
   * for a REAL evidence surface (CD-12). */
  glass?: boolean;
  /** Compact vignette: narrows a wide artifact and tightens the glass
   * padding. The founder density lever for landing pages where the drawing
   * earns its place but not half a viewport (2026-08-07, /employers). */
  dense?: boolean;
}

export function ArtifactStage({
  children,
  caption = 'Illustrative — not a live result',
  className = '',
  threshold = 0.45,
  glass = false,
  dense = false,
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
    <figure
      ref={ref}
      className={`vt-artifact ${glass ? 'vt-artifact--glass' : ''} ${dense ? 'vt-artifact--dense' : ''} ${className}`.trim().replace(/\s+/g, ' ')}
    >
      {children}
      {caption ? <figcaption className="ask-art-cap">{caption}</figcaption> : null}
    </figure>
  );
}
