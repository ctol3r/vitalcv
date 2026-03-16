import type { Transition, Variants } from 'framer-motion';

export const motionTokens = {
  duration: {
    fast: '160ms',
    normal: '240ms',
    slow: '360ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
} as const;

export const motionEasings = {
  standard: [0.2, 0, 0, 1] as const,
  easeOut: [0, 0, 0.2, 1] as const,
  spring: [0.2, 0.8, 0.2, 1] as const,
  swiftOut: [0.2, 0.8, 0.2, 1] as const,
  fadeOut: [0.2, 0, 0, 1] as const,
} as const;

export const motionDurations = {
  instant: 0.08,
  fast: 0.16,
  tooltip: 0.1,
  highlight: 0.12,
  panel: 0.14,
  drawer: 0.14,
  normal: 0.24,
  slow: 0.36,
} as const;

export const motionTransitions = {
  fast: {
    duration: motionDurations.fast,
    ease: motionEasings.standard,
  } satisfies Transition,
  normal: {
    duration: motionDurations.normal,
    ease: motionEasings.standard,
  } satisfies Transition,
  slow: {
    duration: motionDurations.slow,
    ease: motionEasings.easeOut,
  } satisfies Transition,
  spring: {
    duration: motionDurations.normal,
    ease: motionEasings.spring,
  } satisfies Transition,
  hover: {
    duration: motionDurations.fast,
    ease: motionEasings.easeOut,
  } satisfies Transition,
  tooltip: {
    duration: motionDurations.tooltip,
    ease: motionEasings.fadeOut,
  } satisfies Transition,
  highlight: {
    duration: motionDurations.highlight,
    ease: motionEasings.standard,
  } satisfies Transition,
  panel: {
    duration: motionDurations.panel,
    ease: motionEasings.easeOut,
  } satisfies Transition,
  drawer: {
    duration: motionDurations.drawer,
    ease: motionEasings.swiftOut,
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
