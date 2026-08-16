'use client';

/**
 * Reveal — the platform's entrance-motion primitive (Calm Wave "calm glass").
 *
 * Wraps content and lets it rise+fade into place the first time it scrolls into
 * view, once, calmly. Stagger siblings with `delay`. Motion is CSS (keyframes in
 * matcha-zen.css: `.mz-reveal` / `.is-in`); this component only toggles the
 * class via IntersectionObserver, so it is cheap and SSR-safe. Respects
 * `prefers-reduced-motion` automatically (the CSS neutralizes the animation).
 *
 *   <Reveal>            — rise + fade
 *   <Reveal variant="fade" delay={120}>  — fade only, 120ms after its neighbor
 *   <Reveal as="li">    — render as a different element
 *
 * Anticipatory by default: `rootMargin` starts the reveal slightly before the
 * element reaches the viewport edge, so content feels ready, never late.
 */

import { useEffect, useRef, useState } from 'react';
import type { ElementType, ReactNode } from 'react';

export interface RevealProps {
  children: ReactNode;
  /** Stagger offset in ms (pair with siblings for a cascade). */
  delay?: number;
  /** 'rise' (default) = rise + fade; 'fade' = opacity only. */
  variant?: 'rise' | 'fade';
  /** Element to render. Default 'div'. */
  as?: ElementType;
  className?: string;
  /** Extra inline styles merged with the stagger var. */
  style?: React.CSSProperties;
  /** Passthrough (data-*, aria-*, etc.). */
  [key: string]: unknown;
}

export function Reveal({
  children,
  delay = 0,
  variant = 'rise',
  as,
  className = '',
  style,
  ...rest
}: RevealProps) {
  const Tag = (as ?? 'div') as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    // If IntersectionObserver is unavailable, show immediately (never hide content).
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    // Safety net: never leave content hidden if the observer never reports an
    // intersection (element laid out off the observer's root, a zero-size
    // ancestor, a late/aborted hydration). The reveal is an enhancement, not a
    // gate — force it complete. The CSS carries an equivalent backstop for the
    // case where this component never hydrates at all.
    const failsafe = window.setTimeout(() => {
      setShown(true);
      io.disconnect();
    }, 1600);
    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [shown]);

  return (
    <Tag
      ref={ref}
      className={`mz-reveal${variant === 'fade' ? ' mz-reveal-fade' : ''}${shown ? ' is-in' : ''}${className ? ` ${className}` : ''}`}
      style={{ ...(style ?? {}), ['--mz-delay' as string]: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
