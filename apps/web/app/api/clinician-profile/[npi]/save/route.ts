/**
 * POST /api/clinician-profile/[npi]/save — the explicit reusable-profile save.
 *
 * There is deliberately no `/activate` proxy, because there is deliberately no
 * activation endpoint to proxy. The clinician asks to KEEP the profile;
 * activation is what the server concludes once review, sharing control and
 * save are all true. A client that could POST `/activate` could activate
 * without having done any of them.
 *
 * A 422 here is not a failure state to be smoothed over — it is the profile
 * telling the clinician which fields an employer would have needed. The UI
 * renders that list; this route relays it intact.
 */

import { NextRequest } from 'next/server';

import { invalidNpiResponse, isValidNpi, proxyClinicianProfile } from '@/lib/clinician-profile/proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ npi: string }> }) {
  const { npi } = await ctx.params;
  if (!isValidNpi(npi)) return invalidNpiResponse();
  return proxyClinicianProfile({ path: `/${npi}/save`, method: 'POST', body: {} });
}
