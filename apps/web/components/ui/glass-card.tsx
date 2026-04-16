'use client';

/**
 * @deprecated — migrating to canonical Card. Import from '@/components/ui/card' instead.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

type GlassWeight = 'light' | 'heavy';
type GlassVariant = 'default' | 'elevated' | 'heavy';

interface GlassCardProps extends React.ComponentProps<'div'> {
  weight?: GlassWeight;
  variant?: GlassVariant;
  interactive?: boolean;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, weight: _w, variant: _v, interactive: _i, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card"
      className={cn(
        'flex flex-col gap-[var(--vt-space-24)]',
        'rounded-[var(--vt-radius-lg)]',
        'border border-[var(--vt-border)]',
        'bg-[var(--vt-surface)] text-[var(--vt-text-primary)]',
        'p-[var(--vt-space-24)]',
        className,
      )}
      {...props}
    />
  ),
);
GlassCard.displayName = 'GlassCard';

const GlassCardHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-header"
      className={cn('flex items-start justify-between gap-[var(--vt-space-16)]', className)}
      {...props}
    />
  ),
);
GlassCardHeader.displayName = 'GlassCardHeader';

const GlassCardTitle = React.forwardRef<HTMLHeadingElement, React.ComponentProps<'h3'>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      data-slot="card-title"
      className={cn(
        'text-[length:var(--vt-type-h3-size)] leading-[var(--vt-line-tight)] font-[var(--vt-font-weight-semibold)]',
        className,
      )}
      {...props}
    />
  ),
);
GlassCardTitle.displayName = 'GlassCardTitle';

const GlassCardContent = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-content"
      className={cn(className)}
      {...props}
    />
  ),
);
GlassCardContent.displayName = 'GlassCardContent';

const GlassCardFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-footer"
      className={cn(
        'flex items-center gap-[var(--vt-space-12)] border-t border-[var(--vt-border)] pt-[var(--vt-space-16)]',
        className,
      )}
      {...props}
    />
  ),
);
GlassCardFooter.displayName = 'GlassCardFooter';

export { GlassCard, GlassCardContent, GlassCardFooter, GlassCardHeader, GlassCardTitle };
export type { GlassVariant, GlassWeight };
