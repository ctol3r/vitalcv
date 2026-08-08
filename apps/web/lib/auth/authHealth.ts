/**
 * authHealth.ts — fail-closed evaluation of authentication CONFIGURATION
 * (Wave 0.1). Presence booleans only; never values.
 *
 * The 18c9311 incident class this detects: Next.js inlines NEXT_PUBLIC_* at
 * BUILD time, so a build that ran without the Clerk publishable key ships a
 * client bundle with auth compiled off even when the RUNTIME environment is
 * fully configured. Comparing the build-time constant against a runtime
 * lookup makes that divergence a monitorable, 503-ing state instead of a
 * quiet signed-out experience.
 */

export interface AuthHealthInputs {
  /** CLERK_ENABLED as compiled into this build (inlined at build time). */
  buildTimeClerk: boolean;
  /** Publishable key present in the RUNTIME environment (dynamic lookup). */
  runtimePublishableKey: boolean;
  /** Secret key present in the runtime environment (server-only, never inlined). */
  runtimeSecretKey: boolean;
  /**
   * ROLE_COOKIE_SECRET present — the INDEPENDENT role-cookie signing secret.
   *
   * Reported, never gated on. Its absence is not an outage: `roleCookie.ts`
   * falls back to `CLERK_SECRET_KEY` and cookies sign correctly. It is a
   * latent ROTATION hazard, and 503-ing on it would take production down for
   * a condition production is currently surviving.
   */
  runtimeRoleCookieSecret: boolean;
  /** Clerk is expected: production deployments (Railway) must have auth. */
  authExpected: boolean;
}

export type AuthHealthStatus =
  | 'ok'
  | 'auth_disabled'
  | 'build_artifact_missing_auth'
  | 'auth_config_unavailable';

export interface AuthHealthReport {
  status: AuthHealthStatus;
  /** HTTP status the health route should return. */
  httpStatus: 200 | 503;
  authExpected: boolean;
  buildTimeClerk: boolean;
  runtimePublishableKey: boolean;
  runtimeSecretKey: boolean;
  runtimeRoleCookieSecret: boolean;
  /**
   * True when `roleCookie.ts` is signing with `CLERK_SECRET_KEY` through its
   * fallback — i.e. `ROLE_COOKIE_SECRET` is unset and the Clerk key is present.
   *
   * This is the single fact the rotation runbook's Step 0 needs and could not
   * previously obtain: while true, rotating `CLERK_SECRET_KEY` invalidates
   * EVERY outstanding role cookie at once, and signed-in users lose their
   * resolved role until it re-mints. Nothing in the Clerk dashboard hints at
   * it, which is exactly why it needs reporting here.
   *
   * Deliberately does not affect `status` — see `runtimeRoleCookieSecret`.
   */
  roleCookieSignedWithClerkKey: boolean;
}

export function evaluateAuthHealth(inputs: AuthHealthInputs): AuthHealthReport {
  const {
    buildTimeClerk,
    runtimePublishableKey,
    runtimeSecretKey,
    runtimeRoleCookieSecret,
    authExpected,
  } = inputs;
  const base = {
    authExpected,
    buildTimeClerk,
    runtimePublishableKey,
    runtimeSecretKey,
    runtimeRoleCookieSecret,
    // Mirrors getSecret() in roleCookie.ts: ROLE_COOKIE_SECRET wins, else the
    // Clerk key, else ''. The fallback is only actually load-bearing when the
    // override is absent AND the Clerk key is present; with neither set,
    // signing is broken for a different reason and this flag would mislead.
    roleCookieSignedWithClerkKey: !runtimeRoleCookieSecret && runtimeSecretKey,
  };

  if (!authExpected) {
    // Local/preview builds run without Clerk on purpose (e2e clears the keys).
    // Report honestly, but do not page anyone.
    return { ...base, status: buildTimeClerk ? 'ok' : 'auth_disabled', httpStatus: 200 };
  }
  if (!runtimePublishableKey || !runtimeSecretKey) {
    // Expected but not configured — fail closed.
    return { ...base, status: 'auth_config_unavailable', httpStatus: 503 };
  }
  if (!buildTimeClerk) {
    // Runtime is configured but this BUILD was compiled without the key:
    // prerendered pages + the client bundle have auth off (18c9311).
    return { ...base, status: 'build_artifact_missing_auth', httpStatus: 503 };
  }
  return { ...base, status: 'ok', httpStatus: 200 };
}
