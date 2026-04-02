'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ConfidenceMeterProps {
  value: number; // 0–100
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Compact horizontal confidence bar.
 * Animated fill on mount, color mapped from trust tokens.
 * - low (0–40): amber
 * - mid (41–70): accent blue
 * - high (71–100): control green
 */
export function ConfidenceMeter({ value, size = 'sm', className }: ConfidenceMeterProps) {
  const clamped = Math.max(0, Math.min(100, value));

  const colorClass =
    clamped <= 40
      ? 'bg-amber-500'
      : clamped <= 70
        ? 'bg-[var(--control-accent)]'
        : 'bg-[var(--control-success)]';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'relative overflow-hidden rounded-full bg-muted',
          size === 'sm' ? 'h-1 w-16' : 'h-1.5 w-24'
        )}
      >
        <motion.div
          className={cn('absolute inset-y-0 left-0 rounded-full', colorClass)}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{
            duration: 0.12,
            ease: [0.16, 1, 0.3, 1],
            delay: 0.05,
          }}
        />
      </div>
      <span
        className={cn(
          'font-mono tabular-nums tracking-tight',
          size === 'sm' ? 'text-[10px]' : 'text-xs',
          'text-[var(--control-text-muted)]'
        )}
      >
        {clamped}%
      </span>
    </div>
  );
}
