import * as React from 'react';

import { cn } from '@/lib/utils';

interface ConfidenceScoreProps {
  /** 0-100 */
  value: number;
  size?: 'sm' | 'md';
  className?: string;
}

function getConfidenceColor(value: number): string {
  if (value >= 95) return 'var(--trust-green)';
  if (value >= 80) return 'var(--trust-yellow)';
  return 'var(--trust-red)';
}

/**
 * Visual 0-100% confidence indicator with a tiny horizontal bar
 * and numeric label. Fields below 95% are highlighted amber.
 */
export function ConfidenceScore({ value, size = 'sm', className }: ConfidenceScoreProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = getConfidenceColor(clamped);
  const isLow = clamped < 95;
  const barH = size === 'sm' ? 'h-1' : 'h-1.5';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className={cn('w-12 rounded-full bg-muted/40 overflow-hidden', barH)}>
        <div
          className={cn('h-full rounded-full transition-all duration-300')}
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
      <span
        className={cn(
          'tabular-nums font-medium',
          textSize,
          isLow ? 'text-[var(--trust-yellow)]' : 'text-muted-foreground',
        )}
      >
        {clamped}%
      </span>
    </div>
  );
}
