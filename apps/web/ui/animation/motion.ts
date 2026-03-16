export {
  motionDurations,
  motionEasings,
  motionTransitions,
  motionVariants,
} from '@/design-system/tokens/motion';
export { motionCssVariables } from '@/design-system/styles';

import {
  motionTransitions,
  motionVariants,
} from '@/design-system/tokens/motion';

export type MotionTransitionKey = keyof typeof motionTransitions;
export type MotionVariantKey = keyof typeof motionVariants;
