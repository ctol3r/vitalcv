'use client';

import * as React from 'react';
import { FormSystemsDiagram } from './FormSystemsDiagram';

/**
 * ScrollFocusManifesto — the reframe band (Chris, 2026-07-18, from the reader
 * reference): a dark panel whose short manifesto lines come into FOCUS as they
 * pass the centre of the viewport and fade toward the edges (image 2's
 * scroll-reveal reading effect), paired with the hand-drawn form/systems
 * diagram. The idea: a résumé is a form that states; VitalCV is the system that
 * proves.
 *
 * The focus is a pure function of scroll, applied by writing opacity/blur onto
 * line refs inside a rAF loop — React never re-renders per frame. Reduced
 * motion and the pre-hydration/no-JS state render every line fully legible, so
 * meaning never depends on scroll. Honest copy: no banned claims, no bare
 * "Verified"; "prove" is the product's actual posture (source-backed evidence),
 * not a completion guarantee.
 */

const LINES: readonly string[] = [
  'A résumé says you are qualified.',
  'It is a form. It states — it cannot prove.',
  'VitalCV is the system beneath it:',
  'source-backed evidence that connects, updates, and carries to your next role.',
];

export function ScrollFocusManifesto() {
  const lineRefs = React.useRef<Array<HTMLParagraphElement | null>>([]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    const paint = () => {
      raf = 0;
      const mid = window.innerHeight / 2;
      for (const el of lineRefs.current) {
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const lineMid = rect.top + rect.height / 2;
        // Distance from viewport centre, normalised to half a viewport.
        const d = Math.min(1, Math.abs(lineMid - mid) / (window.innerHeight * 0.42));
        const eased = d * d; // sharpen the focus falloff
        el.style.opacity = String(1 - eased * 0.82);
        el.style.filter = eased > 0.02 ? `blur(${(eased * 2.4).toFixed(2)}px)` : 'none';
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section
      data-home-manifesto=""
      aria-label="A résumé is a form; VitalCV is the system"
      className="mt-14 overflow-hidden rounded-[20px] px-6 py-12 sm:px-10 sm:py-16"
      style={{ background: 'var(--ink-900, #0e1414)', color: '#f4f2ec' }}
    >
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-5">
          {/* Explicit bright values: this band is ALWAYS dark, so the light-
              theme --accent (deep indigo) would read too dim here. */}
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: '#a7a1ff' }}>
            Form → System
          </p>
          <FormSystemsDiagram className="w-full max-w-[360px]" />
        </div>

        <div data-manifesto-lines="" className="max-w-2xl">
          {LINES.map((line, i) => (
            <p
              key={i}
              ref={(node) => { lineRefs.current[i] = node; }}
              data-manifesto-line=""
              className="font-[var(--mz-serif)] text-[clamp(1.5rem,3vw,2.4rem)] font-medium leading-[1.2]"
              style={{
                marginTop: i === 0 ? 0 : '0.6em',
                // The VitalCV answer (last line) reads in bright source-green;
                // the rest in warm off-white. Bright literals for the dark band.
                color: i === LINES.length - 1 ? '#6cc79a' : '#f4f2ec',
                transition: 'opacity 120ms linear, filter 120ms linear',
              }}
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ScrollFocusManifesto;
