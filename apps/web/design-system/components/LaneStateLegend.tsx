import * as React from 'react';
import { cn } from '@/lib/utils';
import { LANE_STATE_META, LaneStateBadge, type LaneState } from './LaneStateBadge';

const DEFAULT_ORDER: LaneState[] = [
  'verified',
  'pending',
  'access',
  'blocked',
  'contradicted',
  'unknown',
];

export interface LaneStateLegendProps {
  /** States to render, in order. Defaults to all 6 standard states. */
  states?: LaneState[];
  /** Compact horizontal row vs. stacked vertical list. */
  layout?: 'row' | 'stack';
  /** Show the meaning blurb under each badge. Defaults to true for stack, false for row. */
  showDescriptions?: boolean;
  className?: string;
}

/**
 * LaneStateLegend — the canonical key for the credential-readiness
 * vocabulary. Use at the top of any view that surfaces lane chips so
 * first-time visitors can decode the palette without hovering each one.
 */
export function LaneStateLegend({
  states = DEFAULT_ORDER,
  layout = 'row',
  showDescriptions,
  className,
}: LaneStateLegendProps) {
  const showText = showDescriptions ?? layout === 'stack';

  return (
    <div
      role="list"
      aria-label="Lane state legend"
      className={cn(
        layout === 'row'
          ? 'flex flex-wrap items-center gap-x-4 gap-y-2'
          : 'flex flex-col gap-3',
        className,
      )}
    >
      {states.map((state) => {
        const meta = LANE_STATE_META[state];
        return (
          <div
            key={state}
            role="listitem"
            className={cn(
              'flex',
              layout === 'row' ? 'items-center gap-2' : 'items-start gap-3',
            )}
          >
            <LaneStateBadge state={state} size="sm" />
            {showText && (
              <span
                className={cn(
                  'text-[11.5px] leading-snug text-[var(--vt-text-secondary)]',
                  layout === 'stack' && 'max-w-[280px]',
                )}
              >
                {meta.description}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
