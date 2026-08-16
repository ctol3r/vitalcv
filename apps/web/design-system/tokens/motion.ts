import type { Transition, Variants } from 'framer-motion';

/**
 * Motion Token System — Precision + Flow
 *
 * SYSTEM CURVE: [0.2, 0.8, 0.2, 1]  (all motion uses this)
 * DURATION BANDS (EC-29, Class A):
 *   80–150ms control feedback · 150–250ms state transition ·
 *   250–450ms product transformation · 450–800ms rare narrative
 *
 * This file MIRRORS the canonical values in `styles/tokens.css` for
 * framer-motion consumers. It never sets its own values — agreement is
 * enforced by `__tests__/motion-token-sync.test.ts` (UX-02).
 */

/** The one canonical easing array for Framer Motion */
const SYSTEM_EASE = [0.2, 0.8, 0.2, 1] as const;

export const motionTokens = {
  duration: {
    control: '120ms',
    fast: '200ms',
    normal: '320ms',
    slow: '380ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    spring: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
} as const;

export const motionEasings = {
  standard: SYSTEM_EASE,
  easeOut: SYSTEM_EASE,
  spring: SYSTEM_EASE,
  swiftOut: SYSTEM_EASE,
  fadeOut: SYSTEM_EASE,
} as const;

export const motionDurations = {
  instant: 0.12,
  fast: 0.2,
  tooltip: 0.18,
  highlight: 0.2,
  panel: 0.32,
  drawer: 0.36,
  normal: 0.32,
  slow: 0.38,
} as const;

export const motionTransitions = {
  fast: {
    duration: motionDurations.fast,
    ease: SYSTEM_EASE,
  } satisfies Transition,
  normal: {
    duration: motionDurations.normal,
    ease: SYSTEM_EASE,
  } satisfies Transition,
  slow: {
    duration: motionDurations.slow,
    ease: SYSTEM_EASE,
  } satisfies Transition,
  spring: {
    duration: motionDurations.normal,
    ease: SYSTEM_EASE,
  } satisfies Transition,
  hover: {
    duration: motionDurations.fast,
    ease: SYSTEM_EASE,
  } satisfies Transition,
  tooltip: {
    duration: motionDurations.tooltip,
    ease: SYSTEM_EASE,
  } satisfies Transition,
  highlight: {
    duration: motionDurations.highlight,
    ease: SYSTEM_EASE,
  } satisfies Transition,
  panel: {
    duration: motionDurations.panel,
    ease: SYSTEM_EASE,
  } satisfies Transition,
  drawer: {
    duration: motionDurations.drawer,
    ease: SYSTEM_EASE,
  } satisfies Transition,
} as const;

export const motionVariants = {
  backdrop: {
    initial: { opacity: 0 },
    enter: { opacity: 1, transition: motionTransitions.panel },
    exit: { opacity: 0, transition: motionTransitions.fast },
  } satisfies Variants,
  fade: {
    initial: { opacity: 0 },
    enter: { opacity: 1, transition: motionTransitions.normal },
    exit: { opacity: 0, transition: motionTransitions.fast },
  } satisfies Variants,
  panel: {
    initial: { opacity: 0, y: 8 },
    enter: { opacity: 1, y: 0, transition: motionTransitions.panel },
    exit: { opacity: 0, y: 6, transition: motionTransitions.fast },
  } satisfies Variants,
  tooltip: {
    initial: { opacity: 0, y: 4, scale: 0.985 },
    enter: { opacity: 1, y: 0, scale: 1, transition: motionTransitions.tooltip },
    exit: { opacity: 0, y: 2, scale: 0.985, transition: motionTransitions.fast },
  } satisfies Variants,
  drawer: {
    initial: { opacity: 0, x: '4%', scale: 0.995 },
    enter: { opacity: 1, x: '0%', scale: 1, transition: motionTransitions.drawer },
    exit: { opacity: 0, x: '4%', scale: 0.995, transition: motionTransitions.fast },
  } satisfies Variants,
  status: {
    initial: { opacity: 0.7, scale: 0.985 },
    enter: { opacity: 1, scale: 1, transition: motionTransitions.spring },
    exit: { opacity: 0.7, scale: 0.985, transition: motionTransitions.fast },
  } satisfies Variants,
} as const;
