import * as React from 'react';

import { cn } from '@/lib/utils';

type GlassWeight = 'light' | 'heavy';

interface GlassCardProps extends React.ComponentProps<'div'> {
  weight?: GlassWeight;
}

function GlassCard({ className, weight = 'light', ...props }: GlassCardProps) {
  return (
    <div
      data-slot="glass-card"
      className={cn(
        'rounded-2xl p-6',
        weight === 'heavy' ? 'glass-heavy' : 'glass',
        'glass-border',
        className,
      )}
      {...props}
    />
  );
}

function GlassCardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-header"
      className={cn('flex items-start justify-between gap-4 pb-4', className)}
      {...props}
    />
  );
}

function GlassCardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="glass-card-title"
      className={cn('font-heading text-lg font-semibold tracking-tight', className)}
      {...props}
    />
  );
}

function GlassCardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-content"
      className={cn('text-sm', className)}
      {...props}
    />
  );
}

function GlassCardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-footer"
      className={cn('flex items-center gap-3 pt-4 border-t border-[var(--glass-border)]', className)}
      {...props}
    />
  );
}

export { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent, GlassCardFooter };
export type { GlassWeight };
