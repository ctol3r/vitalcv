import * as React from 'react';
import { cn } from '@/lib/utils';
import { ConfidenceTierBadge } from '@/design-system/components/ConfidenceTierBadge';
import {
  CONFIDENCE_TIER_META,
  CONFIDENCE_TIER_ORDER,
  CONFIDENCE_TIER_SHORT,
  type ConfidenceTier,
} from './doctrine';

export interface ConfidenceLegendProps {
  /** Tiers to render, in order. Defaults to the canonical 4. */
  tiers?: readonly ConfidenceTier[];
  /** Compact horizontal row vs. stacked vertical list. */
  layout?: 'row' | 'stack';
  /** Show the short hook under each badge. Defaults to true for stack, false for row. */
  showDescriptions?: boolean;
  className?: string;
}

/**
 * ConfidenceLegend — page-footer key for the categorical confidence
 * vocabulary. Mirrors LaneStateLegend in shape so surfaces that use both
 * legends read consistently.
 */
export function ConfidenceLegend({
  tiers = CONFIDENCE_TIER_ORDER,
  layout = 'row',
  showDescriptions,
  className,
}: ConfidenceLegendProps) {
  const showText = showDescriptions ?? layout === 'stack';

  return (
    <div
      role="list"
      aria-label="Confidence tiers"
      className={cn(
        layout === 'row'
          ? 'flex flex-wrap items-center gap-x-4 gap-y-2'
          : 'flex flex-col gap-3',
        className,
      )}
    >
      {tiers.map((tier) => {
        const meta = CONFIDENCE_TIER_META[tier];
        return (
          <div
            key={tier}
            role="listitem"
            className={cn(
              'flex',
              layout === 'row' ? 'items-center gap-2' : 'items-start gap-3',
            )}
          >
            <ConfidenceTierBadge tier={tier} size="sm" />
            {showText && (
              <div className="text-[11px] leading-snug">
                <span className="text-[var(--vt-text-primary)] font-medium">
                  {meta.label}
                </span>
                <span className="text-[var(--vt-text-muted)]">
                  {' '}
                  · {CONFIDENCE_TIER_SHORT[tier]}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
