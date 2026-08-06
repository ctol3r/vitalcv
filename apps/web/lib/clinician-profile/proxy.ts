/**
 * The authenticated web proxy for the clinician-profile API — Wave 1076 B1.
 *
 * Every clinician-profile route in `app/api/clinician-profile/**` goes through
 * here rather than calling the backend itself. One helper, because the three
 * things that must be true on every one of these requests are easy to get right
 * once and easy to forget on the sixth copy:
 *
 *   1. A Clerk session must exist, and the 401 is answered HERE — the browser
 *      never reaches the backend without one.
 *   2. Identity is forwarded as the verified pair (`Authorization: Bearer` +
 *      `x-clerk-user-id`) minted from the session, never read from the request.
 *      `requireVerifiedClerkUserId` on the backend consults only the verified
 *      bearer, so a forged header cannot authorize anything — but forwarding a
 *      client-supplied id would still be a lie in the logs.
 *   3. The request body is CONSTRUCTED here from named fields, never streamed
 *      through. The claim route in particular must send an NPI and nothing
 *      else: the whole point of the server-authoritative snapshot is that a
 *      browser cannot hand the backend a payload and have it stored as a
 *      registry answer.
 *
 * The NPI is validated before it is interpolated into an upstream path. The
 * backend validates it too; this exists so a malformed value fails at the edge
 * with the same message the UI shows, instead of composing a URL out of it.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

/** The upstream can be slow; it may not be indefinite. */
const UPSTREAM_TIMEOUT_MS = 15_000;

const NPI_RE = /^\d{10}$/;

export function isValidNpi(npi: string): boolean {
  return NPI_RE.test((npi ?? '').trim());
}

export interface ProxyRequest {
  /** Path under `/api/clinician-profile`, already composed. */
  path: string;
  method: 'GET' | 'POST' | 'PATCH';
  /**
   * Body to send. Constructed by the caller from named fields — never a
   * pass-through of the incoming request stream.
   */
  body?: unknown;
}

/**
 * Forward an authenticated clinician-profile request and relay the answer.
 *
 * The upstream status is preserved rather than flattened: the UI depends on
 * telling 404 (no draft yet — claim it) from 422 (incomplete — here is what is
 * missing) from 401 (session expired — sign in again), and a helper that
 * collapsed those into 500 would make every one of those states look like an
 * outage.
 */
export async function proxyClinicianProfile(req: ProxyRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Sign in to work on your profile.' }, { status: 401 });
  }

  const headers: Record<string, string> = {
    ...(await buildIdentityHeaders({ userId })),
  };
  if (req.body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const upstream = await fetch(`${BACKEND}/api/clinician-profile${req.path}`, {
      method: req.method,
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const data = (await upstream.json().catch(() => ({
      error: `The profile service returned ${upstream.status}.`,
    }))) as unknown;

    // `private, no-store`: this is one person's draft profile. A shared cache
    // must never be able to serve it to anyone else.
    return NextResponse.json(data, {
      status: upstream.status,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    /*
     * An unreachable profile service is a SYSTEM state, and the message says
     * so. It is deliberately not phrased as a finding about the clinician or
     * their NPI — "we could not find your profile" for a network timeout is
     * how a product tells a true-sounding lie.
     */
    return NextResponse.json(
      { error: 'The profile service is unavailable right now. Nothing was changed.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}

/** The 400 for a malformed NPI, worded the way the surface words it. */
export function invalidNpiResponse(): NextResponse {
  return NextResponse.json(
    { error: 'An NPI is exactly 10 digits.' },
    { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
  );
}
