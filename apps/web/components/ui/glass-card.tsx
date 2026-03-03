'use client';

import { HTMLMotionProps, motion } from 'framer-motion';
import * as React from 'react';

import { hoverElevate } from '@/animations/motionVariants';
import { cn } from '@/lib/utils';

type GlassWeight = 'light' | 'heavy';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  weight?: GlassWeight;
  interactive?: boolean;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, weight = 'light', interactive = false, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        data-slot="glass-card"
        variants={interactive ? hoverElevate : undefined}
        whileHover={interactive ? 'hover' : undefined}
        whileTap={interactive ? 'tap' : undefined}
        className={cn(
          'rounded-2xl p-6',
          weight === 'heavy' ? 'glass-heavy' : 'glass-card-base',
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
export type { GlassWeight };

