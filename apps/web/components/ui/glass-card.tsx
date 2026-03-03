'use client';

import { HTMLMotionProps, motion } from 'framer-motion';
import * as React from 'react';

import { hoverElevate } from '@/animations/motionVariants';
import { cn } from '@/lib/utils';

type GlassWeight = 'light' | 'heavy';
type GlassVariant = 'default' | 'elevated' | 'heavy';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  weight?: GlassWeight;
  variant?: GlassVariant;
  interactive?: boolean;
}

const variantStyles: Record<GlassVariant, string> = {
  default: 'glass-card-base',
  elevated: 'glass-card-base shadow-elevated',
  heavy: 'glass-heavy',
};

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, weight = 'light', variant, interactive = false, ...props }, ref) => {
    // variant prop takes precedence; if not set, derive from weight
    const resolvedVariant = variant ?? (weight === 'heavy' ? 'heavy' : 'default');

    return (
      <motion.div
        ref={ref}
        data-slot="glass-card"
        variants={interactive ? hoverElevate : undefined}
        initial={interactive ? 'rest' : undefined}
        whileHover={interactive ? 'hover' : undefined}
        whileTap={interactive ? 'tap' : undefined}
        className={cn(
          'rounded-2xl p-6',
          variantStyles[resolvedVariant],
          interactive && 'cursor-pointer focus-ring',
          className
        )}
        {...props}
      />
    );
  }
);
GlassCard.displayName = 'GlassCard';

const GlassCardHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="glass-card-header"
      className={cn('flex items-start justify-between gap-4 pb-4', className)}
      {...props}
    />
  )
);
GlassCardHeader.displayName = 'GlassCardHeader';

const GlassCardTitle = React.forwardRef<HTMLHeadingElement, React.ComponentProps<'h3'>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      data-slot="glass-card-title"
      className={cn('font-heading text-lg font-semibold tracking-tight', className)}
      {...props}
    />
  )
);
GlassCardTitle.displayName = 'GlassCardTitle';

const GlassCardContent = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="glass-card-content"
      className={cn('text-sm', className)}
      {...props}
    />
  )
);
GlassCardContent.displayName = 'GlassCardContent';

const GlassCardFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="glass-card-footer"
      className={cn('flex items-center gap-3 pt-4 border-t border-[var(--glass-border)]', className)}
      {...props}
    />
  )
);
GlassCardFooter.displayName = 'GlassCardFooter';

export { GlassCard, GlassCardContent, GlassCardFooter, GlassCardHeader, GlassCardTitle };
export type { GlassVariant, GlassWeight };
