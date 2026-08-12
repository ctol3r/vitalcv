/**
 * Server-side NPI ownership scope check.
 *
 * The middleware role guard is a TURNSTILE, not a scope: it proves someone is
 * signed in, not that this NPI is theirs. A route like `/career-map/:entityId`
 * is keyed by NPI, so without this check any authenticated user could read any
 * clinician's record simply by editing the URL.
 *
 * The authoritative predicate lives in the backend
 * (`services/ownership/npiOwnershipState.ts` → `authorizesPrivateAccess`):
 * only `verified` and `delegated` may reach private clinician information.
 * `pending` explicitly may NOT — a claim is not a verification, and treating it
 * as one would let anyone claim an arbitrary NPI and immediately read it. The
 * backend computes the state; this module only reads the state it returns, so
 * the two cannot drift on HOW a state is derived.
 */

import { auth } from '@clerk/nextjs/server';

import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

/** The only two ownership states that may reach private clinician information. */
const PRIVATE_ACCESS_STATES = new Set(['verified', 'delegated']);

interface OwnershipView {
  npi?: unknown;
  state?: unknown;
}

/**
 * True when the signed-in caller owns `npi` at a state that authorizes private
 * access.
 *
 * Fails CLOSED on every ambiguity — not signed in, backend unreachable, non-200,
 * unparseable body, unexpected shape. A surface that cannot confirm ownership
 * must behave exactly as it does for a stranger, so a backend outage degrades to
 * "not yours" rather than to "everyone's".
 */
export async function viewerOwnsNpi(npi: string): Promise<boolean> {
  if (!/^\d{10}$/.test(npi)) return false;

  try {
    const { userId } = await auth();
    if (!userId) return false;

    const res = await fetch(`${BACKEND}/api/ownership/me`, {
      headers: { ...(await buildIdentityHeaders({ userId })) },
      cache: 'no-store',
    });
    if (!res.ok) return false;

    const body: unknown = await res.json();
    const ownerships = (body as { ownerships?: unknown })?.ownerships;
    if (!Array.isArray(ownerships)) return false;

    return ownerships.some((row: OwnershipView) => {
      const rowNpi = typeof row?.npi === 'string' ? row.npi : null;
      const state = typeof row?.state === 'string' ? row.state : null;
      return rowNpi === npi && state !== null && PRIVATE_ACCESS_STATES.has(state);
    });
  } catch {
    return false;
  }
}
