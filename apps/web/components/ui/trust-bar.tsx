'use client';

/**
 * TrustBar — horizontal readiness/trust progress indicator.
 * Segments fill to represent verified vs pending vs missing coverage.
 */

import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';

interface TrustSegment {
  label: string;
  value: number; // 0–100
  status: 'verified' | 'pending' | 'missing';
}

const SEGMENT_COLORS: Record<TrustSegment['status'], string> = {
  verified: 'bg-[var(--vt-status-resolved)]',
  pending: 'bg-[var(--vt-severity-high)]',
  missing: 'bg-[var(--vt-severity-critical)]/40',
};

interface TrustBarProps {
  segments: TrustSegment[];
  className?: string;
  /** Show segment labels below the bar */
  showLabels?: boolean;
  /** Animate fill on mount / scroll into view */
  animate?: boolean;
}

export function TrustBar({
  segments,
  className,
  showLabels = true,
  animate = true,
}: TrustBarProps) {
  const reducedMotion = useReducedMotion();
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const shouldAnimate = animate && !reducedMotion;

  return (
    <div className={cn('w-full', className)}>
      {/* Bar */}
      <div
        className="flex h-2 w-full overflow-hidden rounded-sm bg-[var(--vt-surface-dim)]"
        role="meter"
        aria-label="Trust readiness"
        aria-valuenow={segments.filter((s) => s.status === 'verified').reduce((a, s) => a + s.value, 0)}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        {segments.map((segment) => {
          const widthPct = total > 0 ? (segment.value / total) * 100 : 0;

          if (shouldAnimate) {
            return (
              <motion.div
                key={segment.label}
                className={cn('h-full', SEGMENT_COLORS[segment.status])}
                initial={{ width: 0 }}
                whileInView={{ width: `${widthPct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              />
            );
          }

          return (
            <div
              key={segment.label}
              className={cn('h-full', SEGMENT_COLORS[segment.status])}
              style={{ width: `${widthPct}%` }}
            />
          );
        })}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="mt-2 flex justify-between">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'h-2 w-2 rounded-sm shrink-0',
                  SEGMENT_COLORS[segment.status],
                )}
              />
              <span className="text-[10px] font-medium text-[var(--vt-text-muted)]">
                {segment.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { TrustSegment, TrustBarProps };
