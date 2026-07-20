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
  sceneCharacterWindow,
  segmentHeading,
  typedCount,
  type HeadingVariant,
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
 * (The former hero ScrollTypeNarrative — a word-cadenced sentence scrub — was
 * removed by HERO-RESET-1, 2026-07-19; this display-typography scrub remains.)
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
  /**
   * `type` is the Palantir register: characters TYPE OUT in time (with a
   * caret) once the heading enters the viewport, rather than scrubbing with
   * scroll. All other variants remain pure functions of scroll.
   */
  variant?: HeadingVariant;
  /** `type` only: ms to wait after entering the viewport before typing. */
  typeDelayMs?: number;
  className?: string;
  /** Viewport position where the reveal begins (heading top). */
  startOffset?: string;
  /** Viewport position where the reveal completes. */
  endOffset?: string;
  /** One phrase that finishes in the accent colour instead of primary ink. */
  accentWords?: string[];
  /**
   * The accent colour for accentWords. Defaults to source-green
   * (`--vt-accent-emerald`); pass `'var(--accent)'` for the persona indigo/
   * violet. Used to spread the purple/green primary palette across headings.
   */
  accentColor?: string;
  /** Hero/manifesto mode: taller runway + sticky stage. Use once per page. */
  pin?: boolean;
  /**
   * Content pinned WITH the heading (pin mode only) — typically the lede.
   * A pinned stage that holds only a display heading is mostly empty paper for
   * the length of the runway; anything that belongs on the same screen as the
   * claim belongs in here rather than after the runway.
   */
  stageFooter?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLHeadingElement>, 'children'>;

/**
 * Choreography = the two-point range each character travels, from its faint
 * unresolved state to full ink. Plain arrays (not `as const`) so useTransform
 * reads them as string[]/number[] ranges.
 */
interface Choreography {
  x: [number, number];
  y: [string, string];
  z: [number, number];
  rotateX: [number, number];
  scale: [number, number];
  opacity: [number, number];
}

/** Desktop `assemble`: tips up into place from below. */
const ASSEMBLE: Choreography = {
  x: [0, 0],
  y: ['0.55em', '0em'],
  z: [0, 0],
  rotateX: [-55, 0],
  scale: [1, 1],
  opacity: [0.12, 1],
};

/** Mobile `assemble`: shorter travel, NO perspective rotation, no blur. */
const ASSEMBLE_MOBILE: Choreography = {
  x: [0, 0],
  y: ['0.3em', '0em'],
  z: [0, 0],
  rotateX: [0, 0],
  scale: [1, 1],
  opacity: [0.14, 1],
};

/** `ink`: words progressively inked onto paper; movement ≤ 0.15em. */
const INK: Choreography = {
  x: [0, 0],
  y: ['0.12em', '0em'],
  z: [0, 0],
  rotateX: [0, 0],
  scale: [1, 1],
  opacity: [0.16, 1],
};

/** Scene values are completed per character in sceneChoreography(). */
const SCENE: Choreography = {
  x: [0, 0],
  y: ['120%', '0%'],
  z: [-180, 0],
  rotateX: [72, 0],
  scale: [0.82, 1],
  opacity: [0, 1],
};

function sceneChoreography(index: number, lineIndex: number): Choreography {
  const x = Math.sin(index * 0.86 + lineIndex * 1.7) * 28;
  const y = 96 + ((index + lineIndex * 3) % 5) * 10;
  const z = -(120 + ((index * 37 + lineIndex * 53) % 141));
  const rotateX = 55 + ((index * 7 + lineIndex * 11) % 31);
  return {
    ...SCENE,
    x: [x, 0],
    y: [`${y}%`, '0%'],
    z: [z, 0],
    rotateX: [rotateX, 0],
  };
}

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
  accentColor,
  scene,
  lineIndex,
}: {
  char: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
  choreography: Choreography;
  accent: boolean;
  accentColor: string;
  scene: boolean;
  lineIndex: number;
}) {
  const { start, end } = scene
    ? sceneCharacterWindow(index, total, lineIndex)
    : characterWindow(index, total);
  const range: [number, number] = [start, end];
  const options = { ease: EASE };
  const path = scene ? sceneChoreography(index, lineIndex) : choreography;

  // Each of these is a derived MotionValue: it recomputes on the animation
  // frame without re-rendering React.
  const x = useTransform(progress, range, path.x, options);
  const y = useTransform(progress, range, path.y, options);
  const z = useTransform(progress, range, path.z, options);
  const rotateX = useTransform(progress, range, path.rotateX, options);
  const scale = useTransform(progress, range, path.scale, options);
  const opacity = useTransform(progress, range, path.opacity, options);
  const color = useTransform(
    progress,
    range,
    [
      'var(--vt-text-muted)',
      accent ? accentColor : 'var(--vt-text-primary)',
    ],
    options,
  );

  return (
    <motion.span
      data-motion-character=""
      className="motion-character"
      style={{ x, y, z, rotateX, scale, opacity, color }}
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
  accentColor,
  scene,
  lineIndex,
}: {
  word: HeadingWord;
  total: number;
  progress: MotionValue<number>;
  choreography: Choreography;
  accentColor: string;
  scene: boolean;
  lineIndex: number;
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
          accentColor={accentColor}
          scene={scene}
          lineIndex={lineIndex}
        />
      ))}
    </span>
  );
}

export function ScrollScrubHeading({
  as: Tag = 'h2',
  text,
  variant = 'assemble',
  typeDelayMs = 0,
  className,
  startOffset = '85%',
  endOffset = '35%',
  accentWords,
  accentColor = 'var(--vt-accent-emerald)',
  pin = false,
  stageFooter,
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
  const isScene = effectiveVariant === 'scene';
  const sceneMotion = isScene && !isMobile;
  const choreography = effectiveVariant === 'ink'
    ? INK
    : sceneMotion
      ? SCENE
      : isMobile
        ? ASSEMBLE_MOBILE
        : ASSEMBLE;

  // ONE scroll source for the whole heading. Pinned mode reads its tall
  // container; standard mode maps the heading's own viewport transit.
  // The public API takes plain strings ("85%"), while framer-motion's
  // ScrollOffset is a literal-template union no `string` can satisfy — so the
  // cast lives HERE, at the single boundary, rather than loosening the props.
  //
  // Pin starts the scrub while the section is still ENTERING ('start 78%'), not
  // once it has already parked at the top. Under 'start start' progress sits at
  // 0 for the whole approach, and progress 0 in `scene` means every character is
  // still translated 120% down behind an overflow:clip mask at opacity 0 — i.e.
  // an EMPTY SCREEN. That blank stage, not padding, was the homepage's "too much
  // empty space". Given a head start the heading is already legible by the time
  // it parks, and the pin holds a finished sentence instead of a void.
  const offset = (
    pin
      ? ['start 78%', 'end end']
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
  const usePin = pin && !isStatic && !isMobile;
  const isType = effectiveVariant === 'type';

  // ── `type` variant: time-driven typing, armed by viewport entry ──────────
  // Every character is laid out from the first frame (opacity 0 until typed),
  // so typing can never reflow the page — same no-CLS contract as the scrub
  // variants. Reveal count is React state, but the functional update bails
  // when the floor'd character count hasn't changed, so re-renders happen per
  // CHARACTER (≈38/s), not per frame.
  const [typedReveal, setTypedReveal] = React.useState(0);
  const [caretParked, setCaretParked] = React.useState(false);
  React.useEffect(() => {
    if (!isType || isStatic) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setTypedReveal(segmented.characterCount);
      return;
    }
    let raf = 0;
    let started = -1;
    let parkTimer = 0;
    const total = segmented.characterCount;
    const tick = (now: number) => {
      if (started < 0) started = now;
      const next = typedCount(now - started, total, typeDelayMs);
      setTypedReveal((prev) => (prev === next ? prev : next));
      if (next < total) {
        raf = requestAnimationFrame(tick);
      } else {
        // Blink at the end of the line briefly, then park the caret.
        parkTimer = window.setTimeout(() => setCaretParked(true), 1600);
      }
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          io.disconnect();
          raf = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 },
    );
    io.observe(node);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(parkTimer);
    };
  }, [isType, isStatic, segmented.characterCount, typeDelayMs]);
  const typedComplete = typedReveal >= segmented.characterCount;

  return (
    // The ref div is ALWAYS rendered, even in the static paths: useScroll binds
    // its target at mount, and an early return meant it bound to null and fell
    // back to page progress — headings arrived pre-assembled.
    <div
      ref={ref}
      className={usePin ? 'scrub-heading-pin' : undefined}
      data-scrub-pin={usePin ? '' : undefined}
      data-scrub-scene={isScene ? '' : undefined}
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
        ) : isType ? (
          // Typewriter branch: plain spans (no MotionValues — reveal is an
          // index, not a transform), same accessibility shape as the scrub
          // branch: one aria-label, characters aria-hidden and selectable.
          <MotionTag
            className={className}
            aria-label={text}
            data-scrub-heading="type"
            data-scrub-characters={segmented.characterCount}
            data-type-complete={typedComplete ? '' : undefined}
            {...rest}
          >
            <span aria-hidden="true" data-scrub-lines="">
              {segmented.lines.map((line, lineIndex) => (
                <React.Fragment key={lineIndex}>
                  {lineIndex > 0 ? <br /> : null}
                  {line.map((word, wordIndex) => (
                    <React.Fragment key={wordIndex}>
                      {wordIndex > 0 ? ' ' : ''}
                      <span className="motion-word" data-motion-word="">
                        {word.characters.map((char, i) => {
                          const idx = word.characterOffset + i;
                          return (
                            <React.Fragment key={i}>
                              <span
                                data-motion-character=""
                                className={word.accent ? 'motion-character type-accent' : 'motion-character'}
                                style={{
                                  opacity: idx < typedReveal ? 1 : 0,
                                  ...(word.accent ? { color: accentColor } : null),
                                }}
                              >
                                {char}
                              </span>
                              {idx === typedReveal - 1 && !caretParked ? (
                                <span aria-hidden="true" className="type-caret" data-type-caret="" />
                              ) : null}
                            </React.Fragment>
                          );
                        })}
                      </span>
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
              {typedReveal === 0 && !caretParked ? (
                <span aria-hidden="true" className="type-caret" data-type-caret="" />
              ) : null}
            </span>
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
              {segmented.lines.map((line, lineIndex) => {
                const words = line.map((word, wordIndex) => (
                  <React.Fragment key={wordIndex}>
                    {wordIndex > 0 ? ' ' : ''}
                    <Word
                      word={word}
                      total={segmented.characterCount}
                      progress={progress}
                      choreography={choreography}
                      accentColor={accentColor}
                      scene={sceneMotion}
                      lineIndex={lineIndex}
                    />
                  </React.Fragment>
                ));

                return isScene ? (
                  <span className="motion-line-mask" data-motion-line-mask="" key={lineIndex}>
                    <span className="motion-line">{words}</span>
                  </span>
                ) : (
                  <React.Fragment key={lineIndex}>
                    {lineIndex > 0 ? <br /> : null}
                    {words}
                  </React.Fragment>
                );
              })}
            </span>
          </MotionTag>
        )}
        {/* Rendered on every path, not just the pinned one: mobile and reduced
            motion resolve usePin to false, and a pin-only footer would drop the
            lede out of the document for exactly those visitors. */}
        {stageFooter}
      </div>
    </div>
  );
}

export default ScrollScrubHeading;
