/**
 * Web-v2 Clerk configuration — mirrors apps/web/lib/auth/clerkConfig.ts.
 *
 * Centralizes Clerk env-var reads. All auth logic in web-v2 should
 * import from here rather than touching process.env directly.
 *
 * Truth contract:
 *   - CLERK_PROVIDER_ENABLED is derived from the presence of the
 *     publishable key. When the key is absent, ClerkProvider is NOT
 *     mounted and protected routes are NOT gated by Clerk — the app
 *     degrades to an unauthenticated sandbox rather than crashing.
 *   - Production-mode is derived from the pk_live_ prefix; never
 *     asserted independently.
 */

export const CLERK_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

export const CLERK_PROVIDER_ENABLED = CLERK_ENABLED;

export const CLERK_PRODUCTION_MODE =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_') ?? false;

export const CLERK_SIGN_IN_URL =
  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? '/sign-in';

export const CLERK_SIGN_UP_URL =
  process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? '/sign-up';

export const CLERK_AFTER_SIGN_IN_URL =
  process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL ?? '/';

export const CLERK_AFTER_SIGN_UP_URL =
  process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL ?? '/';
