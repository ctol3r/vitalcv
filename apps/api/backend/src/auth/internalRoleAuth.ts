/**
 * internalRoleAuth.ts — transport-auth for GET /api/me/role (Wave 2B follow-up).
 *
 * Closes the residual documented in #504: `api.vitalcv.com/api/me/role` is
 * internet-reachable and header-trusting (skip-listed from the tenant guard by
 * #503 so signed-in role resolution works). #504 already blocked the account
 * *takeover* path in ensureWorkspaceUser; this gate additionally requires the
 * shared internal `MONITORING_SECRET` so only our own web tier — which has
 * Clerk-verified the session — can reach the route at all, closing the residual
 * role-disclosure and email pre-squat vectors.
 *
 * Rollout safety: gated behind `ENFORCE_ME_ROLE_INTERNAL_AUTH`. Default OFF, so
 * shipping the code is a no-op and cannot re-break the just-recovered signed-in
 * P0. It is armed only after `MONITORING_SECRET` is confirmed on BOTH the web
 * and backend tiers. See docs/product/me-role-transport-auth.md.
 *
 * Pure and dependency-free so both the flag and the secret comparison are unit
 * testable without Prisma or a live Express app.
 */

/**
 * Decide whether an internal call to /api/me/role is authorized.
 *
 * - enforce=false  → always authorized (P0-safe default; secret ignored).
 * - enforce=true   → authorized only when a non-empty secret is configured AND
 *                    the provided value matches it exactly (fails closed).
 */
export function isInternalRoleCallAuthorized(
  providedSecret: string | undefined | null,
  expectedSecret: string | undefined | null,
  enforce: boolean,
): boolean {
  if (!enforce) {
    return true;
  }
  if (!expectedSecret || !providedSecret) {
    return false;
  }
  return providedSecret === expectedSecret;
}
