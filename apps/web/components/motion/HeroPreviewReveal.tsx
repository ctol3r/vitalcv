'use client';

/**
 * HeroPreviewReveal — orchestrated reveal for the hero app preview.
 * Fades up with blur removal, then scales the inner chrome into place.
 * Respects prefers-reduced-motion.
 */

import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface HeroPreviewRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function HeroPreviewReveal({
  children,
  className,
  delay = 0.3,
}: HeroPreviewRevealProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={cn(className)}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 40, scale: 0.96, filter: 'blur(12px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{
        duration: 0.9,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.5,
          delay: delay + 0.4,
          ease: [0.2, 0.8, 0.2, 1],
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
