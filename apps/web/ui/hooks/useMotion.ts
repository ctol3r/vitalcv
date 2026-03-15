'use client';

import { useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  motionTransitions,
  motionVariants,
  type MotionTransitionKey,
  type MotionVariantKey,
} from '@/ui/animation/motion';

function reduceTransition<T extends { duration?: number }>(transition: T): T {
  return {
    ...transition,
    duration: 0,
  };
}

function reduceVariant() {
  return {
    initial: { opacity: 0 },
    enter: { opacity: 1, transition: { duration: 0 } },
    exit: { opacity: 0, transition: { duration: 0 } },
  };
}

export function useMotion() {
  const prefersReducedMotion = useReducedMotion() ?? false;

  const transition = useMemo(
    () => (key: MotionTransitionKey) => (
      prefersReducedMotion
        ? reduceTransition(motionTransitions[key])
        : motionTransitions[key]
    ),
    [prefersReducedMotion],
  );

  const variant = useMemo(
    () => (key: MotionVariantKey) => (
      prefersReducedMotion
        ? reduceVariant()
        : motionVariants[key]
    ),
    [prefersReducedMotion],
  );

  return {
    prefersReducedMotion,
    shouldAnimate: !prefersReducedMotion,
    transition,
    variant,
  };
}
