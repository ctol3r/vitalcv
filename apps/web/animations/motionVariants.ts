/**
 * Shared Framer Motion Variants for Antigravity UI
 * Used to orchestrate page transitions, scroll reveals, and interactive states.
 */

import { Variants } from 'framer-motion';
import { durations, easings } from '../design/tokens';

export const pageWrap: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durations.slow,
      ease: easings.decelerate,
      when: 'beforeChildren',
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: durations.fast, ease: easings.easeOut },
  },
};

export const cardReveal: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
      mass: 0.8,
    },
  },
};

export const hoverElevate: Variants = {
  rest: { y: 0, scale: 1, boxShadow: '0 4px 24px oklch(0.30 0.01 60 / 0.06)' },
  hover: {
    y: -2,
    scale: 1.01,
    boxShadow: '0 8px 32px oklch(0.30 0.01 60 / 0.10)',
    transition: {
      duration: durations.normal,
      ease: easings.easeOut,
    },
  },
  tap: {
    y: 0,
    scale: 0.995,
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.9, filter: 'blur(10px)' },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 120, damping: 14 },
  },
};

/* ── Directional reveals ──────────────────────────────── */

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.slow, ease: easings.decelerate },
  },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.slow, ease: easings.decelerate },
  },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: durations.slow, ease: easings.easeOut },
  },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: durations.slow, ease: easings.easeOut },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 100, damping: 18 },
  },
};

export const blurReveal: Variants = {
  hidden: { opacity: 0, filter: 'blur(12px)' },
  visible: {
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: durations.slow, ease: easings.decelerate },
  },
};

/* ── Scroll reveal variants (direction factory) ────────── */

export type ScrollDirection = 'up' | 'left' | 'right' | 'scale';

const scrollHiddenByDirection: Record<ScrollDirection, Record<string, number | string>> = {
  up: { opacity: 0, y: 30 },
  left: { opacity: 0, x: -40 },
  right: { opacity: 0, x: 40 },
  scale: { opacity: 0, scale: 0.92 },
};

export function scrollRevealVariants(direction: ScrollDirection = 'up'): Variants {
  return {
    hidden: scrollHiddenByDirection[direction],
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      transition: { duration: durations.slow, ease: easings.easeOut },
    },
  };
}

/* ── Hero stagger (orchestrated hero section) ──────────── */

export const heroStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

/* ── Mobile Layout & Interaction variants ──────────────── */

export const slideInUpMobile: Variants = {
  hidden: { opacity: 0, y: '100%' },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: {
    opacity: 0,
    y: '100%',
    transition: { duration: durations.fast, ease: easings.easeOut },
  },
};

export const swipeTransition: Variants = {
  hidden: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
    transition: { duration: durations.fast, ease: easings.easeOut },
  }),
};

export const cardStack: Variants = {
  hidden: { opacity: 0, y: 50, scale: 0.9 },
  visible: (customStatusIndex: number) => ({
    opacity: 1,
    y: customStatusIndex * 15, // Stacks them visually downwards
    scale: 1 - customStatusIndex * 0.05,
    zIndex: 10 - customStatusIndex,
    transition: { type: 'spring', stiffness: 200, damping: 20, delay: customStatusIndex * 0.05 },
  }),
  exit: { opacity: 0, scale: 0.9, transition: { duration: durations.fast } },
};
