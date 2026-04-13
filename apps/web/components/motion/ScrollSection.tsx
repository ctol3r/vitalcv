'use client';

/**
 * ScrollSection — scroll-triggered section wrapper with staggered children.
 * Wraps a full-width section and reveals its children as a group on scroll.
 */

import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface ScrollSectionProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay between child elements */
  stagger?: number;
  /** Viewport margin before triggering */
  margin?: string;
  as?: 'section' | 'div';
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: 'beforeChildren' as const,
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

export function ScrollSection({
  children,
  className,
  stagger = 0.12,
  margin = '-80px',
  as: Tag = 'section',
}: ScrollSectionProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <Tag className={cn(className)}>{children}</Tag>;
  }

  const MotionTag = motion.create(Tag);

  return (
    <MotionTag
      className={cn(className)}
      variants={{
        ...containerVariants,
        visible: {
          ...containerVariants.visible,
          transition: {
            ...containerVariants.visible.transition,
            staggerChildren: stagger,
          },
        },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin }}
    >
      {children}
    </MotionTag>
  );
}

/** Wrap direct children of ScrollSection for staggered reveal */
export function ScrollItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={cn(className)} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
