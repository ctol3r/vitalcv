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
