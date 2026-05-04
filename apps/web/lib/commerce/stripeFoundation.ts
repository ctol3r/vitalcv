import { env } from '@/lib/env';

export type CheckoutGateReason = 'env_flag_off' | 'keys_missing' | 'ready';

export type CheckoutGateState = {
  collectsPayment: false;
  checkoutLive: boolean;
  reason: CheckoutGateReason;
};

// Evaluates whether the Stripe checkout gate is open.
// collectsPayment remains false at foundation tier regardless of gate state.
export function resolveCheckoutGate(): CheckoutGateState {
  if (env.STRIPE_CHECKOUT_LIVE !== 'true') {
    return { collectsPayment: false, checkoutLive: false, reason: 'env_flag_off' };
  }
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PUBLISHABLE_KEY) {
    return { collectsPayment: false, checkoutLive: false, reason: 'keys_missing' };
  }
  return { collectsPayment: false, checkoutLive: true, reason: 'ready' };
}
