/**
 * clerkConfig.ts — Wave 136: Clerk Production Activation
 *
 * Centralizes Clerk environment configuration and production-readiness checks.
 * All auth logic should import from here rather than reading env vars directly.
 */

/** True when Clerk keys are present (both dev and prod modes). */
export const CLERK_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

/**
 * True when running with production Clerk keys (pk_live_ / sk_live_ prefixes).
 * Used to gate production-only features and suppress test-mode warnings.
 */
export const CLERK_PRODUCTION_MODE =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_') ?? false;

/** Configured sign-in URL — falls back to /sign-in if env var is absent. */
export const CLERK_SIGN_IN_URL =
  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? '/sign-in';

/** Configured sign-up URL — falls back to /sign-up if env var is absent. */
export const CLERK_SIGN_UP_URL =
  process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? '/sign-up';

/** Post-auth default redirect (before role-based middleware kicks in). */
export const CLERK_AFTER_SIGN_IN_URL =
  process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL ?? '/';

export const CLERK_AFTER_SIGN_UP_URL =
  process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL ?? '/';
