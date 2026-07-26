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
}

export function evaluateAuthHealth(inputs: AuthHealthInputs): AuthHealthReport {
  const { buildTimeClerk, runtimePublishableKey, runtimeSecretKey, authExpected } = inputs;
  const base = { authExpected, buildTimeClerk, runtimePublishableKey, runtimeSecretKey };

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
