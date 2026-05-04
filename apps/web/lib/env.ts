// Optional environment variables consumed by apps/web.
// This file will be superseded by the comprehensive schema from SEC-ENV-1 (PR #228)
// when that PR merges. At that point, add ALLOWED_EMAIL_DOMAINS and
// GOOGLE_OAUTH_CONFIGURED to the ENV_SCHEMA array in the merged version.
export const env = {
  // Comma-separated list of allowed signup email domains.
  // Empty/unset = no restriction (open gate — prevents accidental lockout).
  ALLOWED_EMAIL_DOMAINS: process.env.ALLOWED_EMAIL_DOMAINS,

  // Set to 'true' once Google OAuth app is configured in the Clerk dashboard
  // and verified in production. Used to gate Google-login copy on the sign-in page.
  GOOGLE_OAUTH_CONFIGURED: process.env.GOOGLE_OAUTH_CONFIGURED === 'true',

  // Stripe checkout gate (added by wave-4b/stripe-foundation)
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_CHECKOUT_LIVE: process.env.STRIPE_CHECKOUT_LIVE ?? 'false',

  // CORS gate (added by wave-4c/api-security)
  ALLOWED_CORS_ORIGINS: process.env.ALLOWED_CORS_ORIGINS,
} as const;
