/**
 * Workspace caller authentication (Wave 1300, security)
 * ──────────────────────────────────────────────────────────────────────────
 * Authorization (which role an app may assume) is meaningless if the app's
 * identity is merely CLAIMED. This authenticates the appId against a per-app
 * secret configured server-side, BEFORE any role grant is honored — so a caller
 * cannot simply assert `appId=app-vitalcv-web` to obtain its grants.
 *
 * Fails closed: no appId, no presented key, or no configured key ⇒ not
 * authenticated. Comparison is timing-safe.
 */
import { timingSafeEqual } from 'node:crypto';

/** Env var holding a given app's key, e.g. app-coastal-ats → WORKSPACE_APP_KEY_APP_COASTAL_ATS. */
export function appKeyEnvVar(appId: string): string {
  return `WORKSPACE_APP_KEY_${appId.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

/**
 * Authenticate a claimed appId by verifying the presented key against the
 * configured expected key. Returns false unless all three are present and the
 * keys match (timing-safe).
 */
export function authenticateApp(appId: string, providedKey: string, expectedKey: string | undefined): boolean {
  if (!appId.trim() || !providedKey || !expectedKey) return false;
  const a = Buffer.from(providedKey);
  const b = Buffer.from(expectedKey);
  return a.length === b.length && timingSafeEqual(a, b);
}
