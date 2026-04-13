'use client';

/**
 * RoleCardHover — interactive card with hover elevation and border glow.
 * Used for audience/role selection cards on marketing pages.
 */

import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface RoleCardHoverProps {
  children: ReactNode;
  className?: string;
  /** Accent color for hover border glow — CSS custom property name */
  accentVar?: string;
}

export function RoleCardHover({
  children,
  className,
  accentVar = '--vt-accent',
}: RoleCardHoverProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return (
      <div
        className={cn(
          'rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6',
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={cn(
        'rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6 cursor-pointer',
        className,
      )}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      variants={{
        rest: {
          y: 0,
          scale: 1,
          borderColor: 'var(--vt-border)',
          boxShadow: '0 1px 4px oklch(0 0 0 / 0.06)',
        },
        hover: {
          y: -3,
          scale: 1.005,
          borderColor: `var(${accentVar})`,
          boxShadow: `0 8px 24px oklch(0 0 0 / 0.08), 0 0 0 1px var(${accentVar})`,
          transition: {
            duration: 0.28,
            ease: [0.2, 0.8, 0.2, 1],
          },
        },
        tap: {
          y: 0,
          scale: 0.995,
          transition: { duration: 0.12 },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
