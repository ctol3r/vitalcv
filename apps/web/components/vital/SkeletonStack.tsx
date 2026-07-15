import * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * SkeletonStack — shape-matched loading placeholder. Mirrors the real layout of
 * the content it stands in for (a stack of rows with a leading glyph, a title
 * line, and a trailing chip) rather than a generic pulsing rectangle, so the
 * page does not visibly jump when the data arrives.
 */
export function SkeletonStack({
  rows = 4,
  className,
  'aria-label': ariaLabel = 'Loading',
}: {
  rows?: number;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      data-skeleton-stack=""
      className={`divide-y divide-[var(--vt-border-subtle,var(--vt-border))] rounded-[12px] border border-[var(--vt-border)] bg-[var(--vt-surface)] ${className ?? ''}`}
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export default SkeletonStack;
