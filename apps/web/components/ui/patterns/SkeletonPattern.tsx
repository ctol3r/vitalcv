'use client';

import { easings } from '@/design/tokens';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface SkeletonPatternProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'text';
}

export function SkeletonPattern({ className, variant = 'rectangular', ...props }: SkeletonPatternProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-zinc-200/50 dark:bg-zinc-800/50',
        {
          'rounded-xl': variant === 'rectangular',
          'rounded-full': variant === 'circular',
          'rounded-md h-4': variant === 'text',
        },
        className
      )}
      {...props}
    >
      <motion.div
        className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10"
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: easings.easeOut,
        }}
      />
    </div>
  );
}
