import type { Transition, Variants } from 'framer-motion';

export const motionEasings = {
  easeOut: [0.2, 0.8, 0.2, 1] as const,
  swiftOut: [0.16, 1, 0.3, 1] as const,
  fadeOut: [0.22, 1, 0.36, 1] as const,
} as const;

export const motionDurations = {
  instant: 0.08,
  fast: 0.1,
  tooltip: 0.1,
  highlight: 0.12,
  panel: 0.14,
  drawer: 0.14,
} as const;

export const motionTransitions = {
  fast: {
    duration: motionDurations.fast,
    ease: motionEasings.easeOut,
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
    ease: motionEasings.easeOut,
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
    enter: {
      opacity: 1,
      transition: motionTransitions.panel,
    },
    exit: {
      opacity: 0,
      transition: motionTransitions.fast,
    },
  } satisfies Variants,
  panel: {
    initial: { opacity: 0, y: 8, scale: 0.985 },
    enter: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: motionTransitions.panel,
    },
    exit: {
      opacity: 0,
      y: 6,
      scale: 0.992,
      transition: motionTransitions.fast,
    },
  } satisfies Variants,
  tooltip: {
    initial: { opacity: 0, y: 4, scale: 0.985 },
    enter: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: motionTransitions.tooltip,
    },
    exit: {
      opacity: 0,
      y: 2,
      scale: 0.985,
      transition: motionTransitions.fast,
    },
  } satisfies Variants,
  drawer: {
    initial: { opacity: 0, x: '4%', scale: 0.995 },
    enter: {
      opacity: 1,
      x: '0%',
      scale: 1,
      transition: motionTransitions.drawer,
    },
    exit: {
      opacity: 0,
      x: '4%',
      scale: 0.995,
      transition: motionTransitions.fast,
    },
  } satisfies Variants,
} as const;

export const motionCssVariables = {
  '--ui-motion-duration-instant': '80ms',
  '--ui-motion-duration-fast': '100ms',
  '--ui-motion-duration-tooltip': '100ms',
  '--ui-motion-duration-highlight': '120ms',
  '--ui-motion-duration-panel': '140ms',
  '--ui-motion-duration-drawer': '140ms',
  '--ui-motion-ease-out': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  '--ui-motion-ease-swift-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  '--ui-motion-ease-fade-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const satisfies Record<`--${string}`, string>;

export type MotionTransitionKey = keyof typeof motionTransitions;
export type MotionVariantKey = keyof typeof motionVariants;
