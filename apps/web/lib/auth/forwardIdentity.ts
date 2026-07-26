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
  return headers;
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
