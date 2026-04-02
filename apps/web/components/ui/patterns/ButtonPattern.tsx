'use client';

import { easings } from '@/design/tokens';
import { cn } from '@/lib/utils';
import { HTMLMotionProps, motion } from 'framer-motion';
import { forwardRef } from 'react';

export interface ButtonPatternProps extends HTMLMotionProps<'button'> {
  variant?: 'primary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const ButtonPattern = forwardRef<HTMLButtonElement, ButtonPatternProps>(
  ({ className, variant = 'primary', size = 'md', children, icon, ...props }, ref) => {
    const isPrimary = variant === 'primary';

    return (
      <motion.button
        ref={ref}
        whileHover="hover"
        whileTap="tap"
        initial="rest"
        className={cn(
          'relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl font-medium transition-colors focus-ring',
          {
            'h-9 px-4 text-sm': size === 'sm',
            'h-11 px-6 text-base': size === 'md',
            'h-14 px-8 text-lg': size === 'lg',
            'bg-zinc-100 text-zinc-900 hover:bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700':
              variant === 'primary',
            'bg-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-muted':
              variant === 'ghost',
            'bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30':
              variant === 'destructive',
          },
          className
        )}
        {...props}
      >
        {/* Animated Glow Backdrop for Primary variant */}
        {isPrimary && (
          <motion.div
            className="absolute inset-0 z-0 bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-purple-500/20 opacity-0 blur-md transition-opacity duration-500"
            variants={{
              rest: { opacity: 0 },
              hover: { opacity: 1 },
              tap: { opacity: 0.8 },
            }}
          />
        )}

        {/* Shine Sweep Effect */}
        {isPrimary && (
          <motion.div
            className="absolute inset-0 z-0 -translate-x-[150%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/20 to-transparent"
            variants={{
              rest: { x: '-150%' },
              hover: { x: '150%' },
            }}
            transition={{ duration: 0.7, ease: easings.easeOut }}
          />
        )}

        <span className="relative z-10 flex items-center gap-2">
          {icon && (
            <motion.span
              variants={{
                rest: { scale: 1 },
                hover: { scale: 1.1, rotate: 5 },
                tap: { scale: 0.95 },
              }}
              transition={{ ease: easings.spring }}
            >
              {icon}
            </motion.span>
          )}
          {children}
        </span>
      </motion.button>
    );
  }
);
ButtonPattern.displayName = 'ButtonPattern';
