'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { SpotlightCard } from './SpotlightCard';

interface BentoGridProps extends React.ComponentProps<'div'> {
  /** Number of columns at desktop. Defaults to 3. Responsive: 1 col mobile, 2 col tablet. */
  columns?: 2 | 3 | 4;
}

const COLUMN_CLASSES: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-2 lg:grid-cols-3',
  4: 'md:grid-cols-2 lg:grid-cols-4',
};

function BentoGrid({ className, columns = 3, ...props }: BentoGridProps) {
  return (
    <div
      data-slot="bento-grid"
      className={cn(
        'grid grid-cols-1 gap-4',
        COLUMN_CLASSES[columns],
        className,
      )}
      {...props}
    />
  );
}

interface BentoItemProps extends React.ComponentProps<'div'> {
  /** Span 2 columns on desktop */
  span2?: boolean;
}

function BentoItem({ className, span2, children, ...props }: BentoItemProps) {
  return (
    <SpotlightCard
      className={cn(
        'rounded-2xl',
        span2 && 'md:col-span-2',
        className,
      )}
    >
      <div data-slot="bento-item" {...props}>
        {children}
      </div>
    </SpotlightCard>
  );
}

export { BentoGrid, BentoItem };
export type { BentoGridProps, BentoItemProps };
