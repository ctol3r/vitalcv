'use client';

import * as React from 'react';

/**
 * ScrollTypeHeading — Palantir-register section headers (Chris, 2026-07-16):
 * the LETTERS of the header fill from muted ink to full ink as the visitor
 * reaches that section's anchor, scrubbed by scroll. Scrolling back un-fills.
 *
 *  - Character-level reveal; words are wrapped nowrap so the fill can never
 *    re-break a line — the full header always occupies its own space (zero
 *    layout shift, same guarantee as the hero narrative).
 *  - Two drivers:
 *      default — the header's own viewport transit: starts as its top crosses
 *      ~90% of the viewport (the anchor arriving), completes by ~52%;
 *      pinned — progress of the closest [data-pin-container] ancestor, over
 *      the pinWindow fraction of the pin (for headers that sit sticky).
 *  - Reduced motion renders the plain full-ink header; the real text is
 *    always in the DOM for screen readers (sr-only) with the char layer
 *    aria-hidden.
 */

export type HeadingSegment = { text: string; accent?: boolean };

type CharUnit = { ch: string; segIdx: number; wordIdx: number };

export function buildHeadingChars(segments: readonly HeadingSegment[]): CharUnit[] {
  const units: CharUnit[] = [];
  let wordIdx = 0;
  segments.forEach((segment, segIdx) => {
    const words = segment.text.split(' ').filter((word) => word.length > 0);
    words.forEach((word, i) => {
      for (const ch of word) units.push({ ch, segIdx, wordIdx });
      // Word boundary: spaces are layout, not fill units.
      if (i < words.length - 1 || segIdx < segments.length - 1) wordIdx += 1;
    });
  });
  return units;
}

/** Pure scroll→fill mapping: 0 chars at rest, all chars at progress 1. */
export function headingRevealAt(progress: number, total: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.max(0, Math.min(total, Math.round(p * total)));
}

const PENDING_OPACITY = 0.22;
const FILL_TRANSITION = 'opacity 120ms ease-out';

export function ScrollTypeHeading({
  as: Tag = 'h2',
  segments,
  pinned = false,
  pinWindow = [0.02, 0.16],
  className,
  accentClassName = 'mz-accent',
  ...rest
}: {
  as?: 'h1' | 'h2' | 'h3';
  segments: readonly HeadingSegment[];
  /** Drive from the closest [data-pin-container] instead of viewport transit. */
  pinned?: boolean;
  /** Pin-progress window [start, end] over which the fill completes. */
  pinWindow?: readonly [number, number];
  className?: string;
  accentClassName?: string;
} & Omit<React.HTMLAttributes<HTMLHeadingElement>, 'children'>) {
  const segmentsKey = segments.map((segment) => `${segment.accent ? '*' : ''}${segment.text}`).join('|');
  const chars = React.useMemo(
    () => buildHeadingChars(segments),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segmentsKey],
  );
  const fullText = segments.map((segment) => segment.text).join(' ');

  const ref = React.useRef<HTMLHeadingElement>(null);
  // SSR/no-JS: fully inked. The first scroll measurement takes over.
  const [reveal, setReveal] = React.useState(chars.length);
  const [reduce, setReduce] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReduce(media.matches);
    syncMotion();
    media.addEventListener('change', syncMotion);
    let raf = 0;
    const update = () => {
      raf = 0;
      if (media.matches) return;
      const node = ref.current;
      if (!node) return;
      const vh = window.innerHeight || 1;
      let p: number;
      if (pinned) {
        const container = node.closest<HTMLElement>('[data-pin-container]');
        if (!container) return;
        const top = container.getBoundingClientRect().top + window.scrollY;
        const distance = Math.max(1, container.offsetHeight - vh);
        const raw = (window.scrollY - top) / distance;
        p = (raw - pinWindow[0]) / Math.max(0.001, pinWindow[1] - pinWindow[0]);
      } else {
        const rect = node.getBoundingClientRect();
        // Anchor arrival: fill begins as the header crosses 90% of the
        // viewport and completes by ~52% — reading position.
        p = (vh * 0.9 - rect.top) / (vh * 0.38);
      }
      setReveal(headingRevealAt(p, chars.length));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      media.removeEventListener('change', syncMotion);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [chars.length, pinned, pinWindow]);

  // Group chars into word wrappers so lines can only break at spaces.
  const words: Array<{ wordIdx: number; segIdx: number; chars: Array<{ ch: string; unitIdx: number }> }> = [];
  chars.forEach((unit, unitIdx) => {
    const last = words[words.length - 1];
    if (!last || last.wordIdx !== unit.wordIdx) {
      words.push({ wordIdx: unit.wordIdx, segIdx: unit.segIdx, chars: [{ ch: unit.ch, unitIdx }] });
    } else {
      last.chars.push({ ch: unit.ch, unitIdx });
    }
  });

  return (
    <Tag
      ref={ref}
      className={className}
      data-heading-fill={reduce ? chars.length : reveal}
      data-heading-total={chars.length}
      data-heading-complete={reduce || reveal >= chars.length ? '' : undefined}
      {...rest}
    >
      {reduce ? (
        <span aria-hidden="true">
          {segments.map((segment, i) => (
            <React.Fragment key={i}>
              {i > 0 ? ' ' : ''}
              {segment.accent ? <em className={accentClassName}>{segment.text}</em> : segment.text}
            </React.Fragment>
          ))}
        </span>
      ) : (
        <span aria-hidden="true" data-heading-chars="">
          {words.map((word, i) => {
            const body = (
              <span key={`w${word.wordIdx}`} style={{ whiteSpace: 'nowrap' }}>
                {word.chars.map(({ ch, unitIdx }) => (
                  <span
                    key={unitIdx}
                    data-ch=""
                    style={{
                      opacity: unitIdx < reveal ? 1 : PENDING_OPACITY,
                      transition: FILL_TRANSITION,
                    }}
                  >
                    {ch}
                  </span>
                ))}
              </span>
            );
            return (
              <React.Fragment key={word.wordIdx}>
                {i > 0 ? ' ' : ''}
                {word.segIdx >= 0 && segments[word.segIdx]?.accent ? (
                  <em className={accentClassName}>{body}</em>
                ) : (
                  body
                )}
              </React.Fragment>
            );
          })}
        </span>
      )}
      {/* The real header text — screen readers and guards read this. */}
      <span className="sr-only">{fullText}</span>
    </Tag>
  );
}

export default ScrollTypeHeading;
