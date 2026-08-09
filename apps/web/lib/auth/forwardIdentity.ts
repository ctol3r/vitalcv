/**
 * G1 enforce-flip prerequisite — verified-token forwarding for backend proxies.
 *
 * The backend's verified-identity middleware
 * (apps/api/backend/src/middleware/verifiedIdentity.ts) will, in `enforce`
 * mode, 401 any request that carries `x-clerk-user-id` WITHOUT a matching
 * verified `Authorization: Bearer <clerk session jwt>`. Many web route
 * handlers historically set only `x-clerk-user-id`. This helper attaches BOTH,
 * so those handlers survive the enforce flip.
 *
 * Usage — replace ad-hoc `{ 'x-clerk-user-id': userId }` with:
 *
 *   const { userId } = await auth();
 *   if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   const headers = await buildIdentityHeaders();          // plain object
 *   // or, to extend an existing Headers/record:
 *   await applyIdentityHeaders(headers, { userId });
 *
 * The bearer is minted via Clerk's `auth().getToken()`; if token minting is
 * unavailable (older Clerk session, edge cases) we still forward
 * `x-clerk-user-id` alone — identical to today's behavior, so this is
 * strictly additive and safe to land before the backend flips to enforce.
 */

import { auth } from '@clerk/nextjs/server';

export interface IdentityHeaderInput {
  /** Pre-resolved Clerk user id (skips a second auth() call). */
  userId?: string | null;
  /** Pre-resolved session token (skips getToken()). */
  token?: string | null;
}

/**
 * Resolve `{ 'x-clerk-user-id', Authorization }` for the current Clerk session.
 * Returns `{}` when there is no signed-in user (caller should have already
 * guarded on that and returned 401).
 */
export async function buildIdentityHeaders(
  input: IdentityHeaderInput = {},
): Promise<Record<string, string>> {
  let { userId, token } = input;

  if (userId === undefined || token === undefined) {
    const session = await auth();
    if (userId === undefined) userId = session.userId;
    if (token === undefined) {
      try {
        token = typeof session.getToken === 'function' ? await session.getToken() : null;
      } catch {
        token = null;
      }
    }
  }

  const headers: Record<string, string> = {};
  if (userId) headers['x-clerk-user-id'] = userId;
  if (token) headers.Authorization = `Bearer ${token}`;

  // The degradation this helper's docblock calls "safe to land before the
  // backend flips to enforce" is exactly what breaks *after* it: an identity
  // header with no bearer is a hard 401 under enforce. It stays permissive for
  // now — flipping it to fail-closed while the backend is still in shadow would
  // break sessions that currently work — but it is no longer silent. Every
  // occurrence is a session that WILL 401 once enforce is on, so this warning
  // is the measurement that decides whether the flip is safe.
  if (userId && !token) {
    console.warn(
      JSON.stringify({
        event: 'identity_header_without_bearer',
        where: 'buildIdentityHeaders',
        detail: 'getToken() returned no session token; this request 401s under CLERK_JWT_VERIFICATION=enforce',
      }),
    );
  }

  return headers;
}

/**
 * The signed-in user's email, read from the Clerk session claims.
 *
 * The backend's `ensureWorkspaceUser` creates a missing `User` row from
 * `x-clerk-user-email`, and 404s ("Authenticated user has no VitalCV user
 * record") when the header is absent. `/api/profile/npi/bootstrap` has always
 * forwarded it; its sibling write proxies did not, so a signed-in clinician
 * whose backend row did not yet exist got a permanent 404 on every save.
 *
 * Returns `{}` when the claim is missing — the header is additive, never a
 * substitute for the verified identity pair above.
 */
export function buildEmailHeader(
  sessionClaims: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const email = sessionClaims?.email;
  return typeof email === 'string' && email.length > 0
    ? { 'x-clerk-user-email': email }
    : {};
}

/**
 * Mutate an existing plain-object header map (or a `Headers`) in place with the
 * identity pair. Convenience for handlers that build a `Record<string,string>`
 * or `new Headers()` before fetching.
 */
export async function applyIdentityHeaders(
  target: Record<string, string> | Headers,
  input: IdentityHeaderInput = {},
): Promise<void> {
  const identity = await buildIdentityHeaders(input);
  if (target instanceof Headers) {
    for (const [k, v] of Object.entries(identity)) target.set(k, v);
  } else {
    Object.assign(target, identity);
  }
}
