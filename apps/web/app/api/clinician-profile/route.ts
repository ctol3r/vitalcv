/**
 * GET /api/clinician-profile — the caller's own profiles.
 *
 * `?include=all` also returns drafts that have not been saved yet. That is what
 * makes recovery work on a machine that has never seen this flow: a clinician
 * who claimed a profile, closed the browser and signed in a week later has no
 * URL and no local storage to recover from, and the durable draft on the server
 * is the only thing that remembers what they already filled in. Without it the
 * product would ask them to type it again, which is the one thing the reusable
 * profile exists to stop.
 *
 * The default is unchanged (saved profiles only), so callers that want the
 * reusable list keep getting exactly that.
 */

import { NextRequest } from 'next/server';

import { proxyClinicianProfile } from '@/lib/clinician-profile/proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const includeDrafts = req.nextUrl.searchParams.get('include') === 'all';
  return proxyClinicianProfile({
    path: includeDrafts ? '?include=all' : '',
    method: 'GET',
  });
}
