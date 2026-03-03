'use client';

import { popIn } from '@/animations/motionVariants';
import { cn } from '@/lib/utils';
import { HTMLMotionProps, motion } from 'framer-motion';
import * as React from 'react';

export type BadgeLevel = 'L0' | 'L1' | 'L2' | 'L3';

interface BadgeStatusProps extends HTMLMotionProps<'div'> {
  level: BadgeLevel;
  label: string;
  pulse?: boolean;
}

const levelStyles: Record<BadgeLevel, string> = {
  L0: 'bg-[var(--claim-l0)] text-[var(--claim-l0-foreground)] border-transparent',
  L1: 'bg-[var(--claim-l1)] text-[var(--claim-l1-foreground)] border-transparent',
  L2: 'bg-[var(--claim-l2)] text-[var(--claim-l2-foreground)] border-transparent',
  L3: 'bg-[var(--claim-l3)] text-[var(--claim-l3-foreground)] border-transparent',
};

export const BadgeStatus = React.forwardRef<HTMLDivElement, BadgeStatusProps>(
  ({ level, label, pulse = false, className, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        variants={popIn}
        initial="hidden"
        animate="visible"
        whileHover={{ y: -2, scale: 1.05, transition: { type: 'spring', stiffness: 400, damping: 10 } }}
        className={cn(
          'inline-flex items-center justify-center rounded-full border px-3 py-1',
          'text-xs font-semibold tracking-wide uppercase',
          levelStyles[level],
          pulse && level === 'L1' && 'animate-badge-pulse',
          className
        )}
        {...props}
      >
        {label}
      </motion.div>
    );
  }
);
BadgeStatus.displayName = 'BadgeStatus';
