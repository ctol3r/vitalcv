// Optional environment variables. All default to undefined unless set.
// STRIPE_CHECKOUT_LIVE must be explicitly 'true' to enable checkout.
export const env = {
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_CHECKOUT_LIVE: process.env.STRIPE_CHECKOUT_LIVE ?? 'false',
} as const;
