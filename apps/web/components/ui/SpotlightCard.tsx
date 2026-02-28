'use client';

/**
 * SpotlightCard — Wave 11: Antigravity Aesthetic
 *
 * A glassmorphic card wrapper that renders a cursor-tracked radial gradient
 * "beneath" the surface, producing a glowing border exactly where the mouse
 * is hovering. Uses framer-motion `useMotionValue` + `useMotionTemplate` so
 * the gradient update is fully rAF-driven and never triggers a React re-render.
 *
 * Zero hydration risk: the gradient is applied via a CSS custom property on
 * the wrapper element, not via React state. On first SSR paint the spotlight
 * is invisible (opacity 0); it only activates after client hydration.
 */

import { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  /** Spotlight colour. Default: a warm teal glow. */
  color?: string;
  /** Spotlight radius in px. Default: 340. */
  radius?: number;
}

export function SpotlightCard({
  children,
  className,
  color = 'oklch(0.68 0.12 180)',
  radius = 340,
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Motion values — updated off the main thread via Framer's pointer pipeline
  const mouseX = useMotionValue(-9999);
  const mouseY = useMotionValue(-9999);
  const spotOpacity = useMotionValue(0);

  const background = useMotionTemplate`
    radial-gradient(
      ${radius}px circle at ${mouseX}px ${mouseY}px,
      ${color} / 0.14,
      transparent 80%
    )
  `;

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
    spotOpacity.set(1);
  }

  function onMouseLeave() {
    spotOpacity.set(0);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={cn('group relative overflow-hidden', className)}
    >
      {/* ── Spotlight gradient layer (behind content) ─────── */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] transition-opacity duration-300"
        style={{ background, opacity: spotOpacity }}
      />
      {/* ── Glowing border ring ───────────────────────────── */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              ${radius}px circle at ${mouseX}px ${mouseY}px,
              ${color} / 0.30,
              transparent 80%
            )
          `,
          opacity: spotOpacity,
          WebkitMaskImage: 'linear-gradient(#fff, #fff)',
          maskImage: 'linear-gradient(#fff, #fff)',
          padding: '1px',
        }}
      >
        <div className="h-full w-full rounded-[inherit] bg-transparent" />
      </motion.div>
      {/* ── Card content ──────────────────────────────────── */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
