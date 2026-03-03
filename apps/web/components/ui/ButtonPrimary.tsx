'use client';

import { hoverElevate } from '@/animations/motionVariants';
import { cn } from '@/lib/utils';
import { HTMLMotionProps, motion } from 'framer-motion';
import * as React from 'react';

interface ButtonPrimaryProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children?: React.ReactNode;
  icon?: React.ReactNode;
}

export const ButtonPrimary = React.forwardRef<HTMLButtonElement, ButtonPrimaryProps>(
  ({ children, className, icon, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        variants={hoverElevate}
        whileHover="hover"
        whileTap="tap"
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3',
          'bg-[var(--primary)] text-[var(--primary-foreground)]',
          'font-semibold tracking-wide shadow-md',
          'transition-colors duration-200 hover:bg-[oklch(0.20_0.015_60)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]',
          className
        )}
        {...props}
      >
        <span>{children}</span>
        {icon && <span className="flex items-center justify-center">{icon}</span>}
      </motion.button>
    );
  }
);
ButtonPrimary.displayName = 'ButtonPrimary';
