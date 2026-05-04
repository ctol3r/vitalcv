import { describe, expect, it } from 'vitest';
import { buildPricingFoundationPlan, isCheckoutLiveModeEnabled } from '@/lib/commercial/pricingFoundation';
import { resolveCheckoutGate } from '@/lib/commerce/stripeFoundation';

describe('pricing foundation — collectsPayment invariant', () => {
  it('all foundation plans have collectsPayment: false as literal', () => {
    const plans = buildPricingFoundationPlan();
    for (const plan of plans) {
      expect(plan.collectsPayment).toBe(false);
    }
  });

  it('all foundation plans have subscriptionActive: false as literal', () => {
    const plans = buildPricingFoundationPlan();
    for (const plan of plans) {
      expect(plan.subscriptionActive).toBe(false);
    }
  });
});

describe('checkout gate — default config (no env vars)', () => {
  it('resolveCheckoutGate returns collectsPayment: false when flag is off', () => {
    const gate = resolveCheckoutGate();
    expect(gate.collectsPayment).toBe(false);
  });

  it('isCheckoutLiveModeEnabled returns false when STRIPE_CHECKOUT_LIVE is unset', () => {
    // STRIPE_CHECKOUT_LIVE is not set in the test environment
    expect(isCheckoutLiveModeEnabled()).toBe(false);
  });
});
