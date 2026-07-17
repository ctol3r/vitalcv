import { auth } from '@clerk/nextjs/server';
import { getBackendBase } from '@/lib/api';
import { applyIdentityHeaders } from '@/lib/auth/forwardIdentity';

export const MARKETPLACE_BACKEND = getBackendBase();

type SessionClaims = Record<string, unknown> | undefined;

function sessionClaims(session: Awaited<ReturnType<typeof auth>>): SessionClaims {
  return session.sessionClaims as SessionClaims;
}

/**
 * App-level role (clinician | employer | super-admin | …) read server-side from
 * the verified Clerk session. Mirrors parseSessionRole in
 * app/api/intelligence/_shared.ts and parseInitialClerkRole in app/layout.tsx.
 *
 * Forwarded as `x-user-role` so the backend can resolve platform super-admins
 * (`isSuperAdminRequest` reads `x-user-role`) — which is what lets a super-admin
 * bypass the verifier org-role guard's org-role requirement. Non-super values
 * are inert for authz on the backend (super-admin is the only elevation from
 * this header; search role hints read `x-clerk-user-role`, which we do not set).
 */
function parseSessionAppRole(claims: SessionClaims): string | null {
  const vitalcv = claims?.vitalcv;
  const vitalcvRole =
    vitalcv && typeof vitalcv === 'object' && 'role' in vitalcv && typeof vitalcv.role === 'string'
      ? vitalcv.role
      : null;

  return typeof claims?.role === 'string'
    ? claims.role
    : typeof claims?.org_role === 'string'
      ? claims.org_role
      : vitalcvRole;
}

/**
 * Organization-membership role (admin | reviewer | read_only vocabulary) read
 * server-side from the verified Clerk session's `org_role` claim — never a
 * client-supplied value.
 *
 * Forwarded as `x-org-role` to feed the backend `requireOrgRole` guard
 * (apps/api/backend/src/middleware/orgRoleGuard.ts), which normalizes the
 * vocabulary. This is deliberately the org-membership role, NOT the app role
 * above: `parseSessionAppRole` would answer "clinician"/"employer" here, which
 * the guard would reject. See docs/security/verifier-rbac-rollout.md (step 2).
 */
function parseSessionOrgRole(claims: SessionClaims): string | null {
  return typeof claims?.org_role === 'string' && claims.org_role.trim().length > 0
    ? claims.org_role
    : null;
}

export async function buildMarketplaceHeaders(
  session: Awaited<ReturnType<typeof auth>>,
  init?: HeadersInit,
): Promise<Headers> {
  const headers = new Headers(init);
  headers.set('Accept', 'application/json');

  // Forward x-clerk-user-id AND Authorization: Bearer <clerk jwt>, so these
  // proxies survive the backend's CLERK_JWT_VERIFICATION=enforce flip (which
  // 401s an identity header without a verified token). Additive and safe in
  // off/shadow today. Mirrors the 40 routes already on forwardIdentity.
  if (session.userId) {
    await applyIdentityHeaders(headers, { userId: session.userId });
  }

  const claims = sessionClaims(session);

  const emailClaim = claims?.email;
  if (typeof emailClaim === 'string' && emailClaim.length > 0) {
    headers.set('x-clerk-user-email', emailClaim);
  }

  const appRole = parseSessionAppRole(claims);
  if (appRole) {
    headers.set('x-user-role', appRole);
  }

  const orgRole = parseSessionOrgRole(claims);
  if (orgRole) {
    headers.set('x-org-role', orgRole);
  }

  return headers;
}

export function getServerApiKey(): string | null {
  const raw = process.env.VERIFIER_WALLET_API_KEYS ?? process.env.API_KEYS ?? '';
  const apiKey = raw
    .split(',')
    .map((value) => value.trim())
    .find((value) => value.length > 0);

  return apiKey ?? null;
}
