'use client';

import { hoverElevate } from '@/animations/motionVariants';
import { cn } from '@/lib/utils';
import { HTMLMotionProps, motion } from 'framer-motion';
import * as React from 'react';

interface ButtonPrimaryProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  loading?: boolean;
}

export const ButtonPrimary = React.forwardRef<HTMLButtonElement, ButtonPrimaryProps>(
  ({ children, className, icon, loading = false, disabled, ...props }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        variants={hoverElevate}
        initial="rest"
        whileHover={isDisabled ? undefined : 'hover'}
        whileTap={isDisabled ? undefined : 'tap'}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3',
          'bg-[var(--primary)] text-[var(--primary-foreground)]',
          'font-semibold tracking-wide shadow-md',
          'transition-colors duration-200 hover:bg-[oklch(0.20_0.015_60)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]',
          isDisabled && 'opacity-60 cursor-not-allowed',
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        <span>{children}</span>
        {icon && !loading && <span className="flex items-center justify-center">{icon}</span>}
      </motion.button>
    );
  }
);
ButtonPrimary.displayName = 'ButtonPrimary';
