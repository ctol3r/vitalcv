'use client';

import * as React from 'react';
import {
  cubicBezier,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
  type UseScrollOptions,
} from 'framer-motion';

import {
  characterWindow,
  resolveVariant,
  segmentHeading,
  type HeadingWord,
} from '@/lib/motion/characterReveal';

/**
 * ScrollScrubHeading — character-level scroll-scrubbed display headings
 * (Motion M1).
 *
 * The heading is fully laid out from the first paint; its characters resolve
 * into place as a pure function of section scroll progress. Forward assembles,
 * backward reverses, nothing is timed, and the text never changes.
 *
 * NOT a typing effect: no character is ever absent, so layout cannot shift and
 * a fast scroller always reads a complete line.
 *
 * Distinct from ScrollTypeNarrative (the hero sentence), which stays as-is —
 * that is a word-cadenced narrative scrub; this is display typography.
 *
 * Motion architecture (the performance contract):
 *  - ONE scroll source per heading (`useScroll` on the section), never a
 *    listener per character.
 *  - Each character derives its own MotionValues via `useTransform`, which
 *    update OUTSIDE React rendering — zero setState per frame.
 *  - `useSpring` smooths the source with `bounce: 0`: restrained, never
 *    overshooting (the finished heading should feel inevitable, not bouncy).
 */

export type ScrollScrubHeadingProps = {
  as?: 'h1' | 'h2' | 'h3';
  text: string;
  variant?: 'assemble' | 'ink';
  className?: string;
  /** Viewport position where the reveal begins (heading top). */
  startOffset?: string;
  /** Viewport position where the reveal completes. */
  endOffset?: string;
  /** One phrase that finishes in source-green instead of primary ink. */
  accentWords?: string[];
  /** Hero/manifesto mode: taller runway + sticky stage. Use once per page. */
  pin?: boolean;
} & Omit<React.HTMLAttributes<HTMLHeadingElement>, 'children'>;

/**
 * Choreography = the two-point range each character travels, from its faint
 * unresolved state to full ink. Plain arrays (not `as const`) so useTransform
 * reads them as string[]/number[] ranges.
 */
interface Choreography {
  y: [string, string];
  rotateX: [number, number];
  opacity: [number, number];
}

/** Desktop `assemble`: tips up into place from below. */
const ASSEMBLE: Choreography = {
  y: ['0.55em', '0em'],
  rotateX: [-55, 0],
  opacity: [0.12, 1],
};

/** Mobile `assemble`: shorter travel, NO perspective rotation, no blur. */
const ASSEMBLE_MOBILE: Choreography = {
  y: ['0.3em', '0em'],
  rotateX: [0, 0],
  opacity: [0.14, 1],
};

/** `ink`: words progressively inked onto paper; movement ≤ 0.15em. */
const INK: Choreography = {
  y: ['0.12em', '0em'],
  rotateX: [0, 0],
  opacity: [0.16, 1],
};

/**
 * Restrained ease — precise arrival, no overshoot. `cubicBezier` (not a raw
 * tuple): useTransform's `ease` takes an EasingFunction.
 */
const EASE = cubicBezier(0.22, 0.61, 0.24, 1);

function useIsMobile(): boolean {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 767px)');
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return mobile;
}

function Character({
  char,
  index,
  total,
  progress,
  choreography,
  accent,
}: {
  char: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
  choreography: Choreography;
  accent: boolean;
}) {
  const { start, end } = characterWindow(index, total);
  const range: [number, number] = [start, end];
  const options = { ease: EASE };

  // Each of these is a derived MotionValue: it recomputes on the animation
  // frame without re-rendering React.
  const y = useTransform(progress, range, choreography.y, options);
  const rotateX = useTransform(progress, range, choreography.rotateX, options);
  const opacity = useTransform(progress, range, choreography.opacity, options);
  const color = useTransform(
    progress,
    range,
    [
      'var(--vt-text-muted)',
      accent ? 'var(--vt-accent-emerald)' : 'var(--vt-text-primary)',
    ],
    options,
  );

  return (
    <motion.span
      data-motion-character=""
      className="motion-character"
      style={{ y, rotateX, opacity, color }}
    >
      {char}
    </motion.span>
  );
}

function Word({
  word,
  total,
  progress,
  choreography,
}: {
  word: HeadingWord;
  total: number;
  progress: MotionValue<number>;
  choreography: Choreography;
}) {
  return (
    // inline-block + nowrap: a line can only break BETWEEN words, so letters
    // never wrap onto separate lines at any width.
    <span className="motion-word" data-motion-word="">
      {word.characters.map((char, i) => (
        <Character
          key={i}
          char={char}
          index={word.characterOffset + i}
          total={total}
          progress={progress}
          choreography={choreography}
          accent={word.accent}
        />
      ))}
    </span>
  );
}

export function ScrollScrubHeading({
  as: Tag = 'h2',
  text,
  variant = 'assemble',
  className,
  startOffset = '85%',
  endOffset = '35%',
  accentWords,
  pin = false,
  ...rest
}: ScrollScrubHeadingProps) {
  const accentKey = accentWords?.join('|') ?? '';
  const segmented = React.useMemo(
    () => segmentHeading(text, accentWords ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, accentKey],
  );
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const ref = React.useRef<HTMLDivElement>(null);

  /**
   * The no-JS contract, enforced structurally.
   *
   * At progress 0 a character's opacity is 0.12 — so if the animated spans were
   * server-rendered, the HTML would ship a FAINT heading and a visitor without
   * JS would be stuck reading it forever. Instead the server (and the first
   * client render) paint the finished heading as plain text; the scrubbed
   * version mounts only once JS is running. No hydration mismatch, no
   * permanently-transparent text, and identical layout across the swap.
   */
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const effectiveVariant = resolveVariant(variant, segmented.characterCount);
  const choreography =
    effectiveVariant === 'ink' ? INK : isMobile ? ASSEMBLE_MOBILE : ASSEMBLE;

  // ONE scroll source for the whole heading. Pinned mode reads its tall
  // container; standard mode maps the heading's own viewport transit.
  // The public API takes plain strings ("85%"), while framer-motion's
  // ScrollOffset is a literal-template union no `string` can satisfy — so the
  // cast lives HERE, at the single boundary, rather than loosening the props.
  const offset = (
    pin
      ? ['start start', 'end end']
      : [`start ${startOffset}`, `start ${endOffset}`]
  ) as UseScrollOptions['offset'];

  const { scrollYProgress } = useScroll({ target: ref, offset });
  // bounce: 0 — smoothing without overshoot, and it still reverses exactly.
  const progress = useSpring(scrollYProgress, { bounce: 0, duration: 0.25 });

  const MotionTag = Tag;

  // ── Static vs. scrubbed ────────────────────────────────────────────────
  //
  // HYDRATION CONTRACT: the pre-mount render must be byte-identical to the
  // server's, so `reduceMotion` must NOT leak into it. useReducedMotion()
  // returns null on the server and true|false on the client — reading it
  // pre-mount made the server emit `static` while the first client render
  // emitted `reduced`. React kept the server's stale attribute and never
  // corrected it: a silent mismatch that shipped the wrong state. So gate on
  // `mounted` ALONE first; only once mounted may reduceMotion decide anything.
  const isStatic = !mounted || reduceMotion;
  // The runway exists ONLY when actually scrubbing — never for reduced motion.
  const usePin = pin && !isStatic;

  return (
    // The ref div is ALWAYS rendered, even in the static paths: useScroll binds
    // its target at mount, and an early return meant it bound to null and fell
    // back to page progress — headings arrived pre-assembled.
    <div
      ref={ref}
      className={usePin ? 'scrub-heading-pin' : undefined}
      data-scrub-pin={usePin ? '' : undefined}
    >
      <div className={usePin ? 'scrub-heading-stage' : undefined}>
        {isStatic ? (
          <MotionTag
            className={className}
            // Hydration-safe: pre-mount (server AND first client render) this
            // is always "static". reduceMotion is null on the server and
            // true|false on the client, so reading it here would make the two
            // renders disagree — React would keep the server's attribute and
            // silently never correct it. Inside this branch, mounted ⇒ reduced.
            data-scrub-heading={mounted ? 'reduced' : 'static'}
            {...rest}
          >
            {text}
          </MotionTag>
        ) : (
          // One accessible name for the whole heading (aria-label), with every
          // animated span aria-hidden — assistive tech reads the sentence,
          // never a stream of letters. The characters are still real DOM text,
          // so the heading stays selectable.
          <MotionTag
            className={className}
            aria-label={text}
            data-scrub-heading={effectiveVariant}
            data-scrub-characters={segmented.characterCount}
            {...rest}
          >
            <span aria-hidden="true" data-scrub-lines="">
              {segmented.lines.map((line, lineIndex) => (
                <React.Fragment key={lineIndex}>
                  {lineIndex > 0 ? <br /> : null}
                  {line.map((word, wordIndex) => (
                    <React.Fragment key={wordIndex}>
                      {wordIndex > 0 ? ' ' : ''}
                      <Word
                        word={word}
                        total={segmented.characterCount}
                        progress={progress}
                        choreography={choreography}
                      />
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </span>
          </MotionTag>
        )}
      </div>
    </div>
  );
}

export default ScrollScrubHeading;
