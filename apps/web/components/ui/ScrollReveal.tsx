'use client';

import { scrollRevealVariants, type ScrollDirection } from '@/animations/motionVariants';
import { cn } from '@/lib/utils';
import { motion, useInView } from 'framer-motion';
import * as React from 'react';
import { useRef, useMemo } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  direction?: ScrollDirection;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}

export function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  duration,
  className,
  once = true,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: '-60px' });

  const variants = useMemo(() => {
    const base = scrollRevealVariants(direction);
    if (delay || duration) {
      return {
        ...base,
        visible: {
          ...base.visible,
          transition: {
            ...(typeof base.visible === 'object' && 'transition' in base.visible
              ? base.visible.transition
              : {}),
            ...(delay ? { delay } : {}),
            ...(duration ? { duration } : {}),
          },
        },
      };
    }
    return base;
  }, [direction, delay, duration]);

  return (
    <motion.div
      ref={ref}
      variants={variants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
