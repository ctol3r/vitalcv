/**
 * GET   /api/clinician-profile/[npi] — read the caller's draft.
 * PATCH /api/clinician-profile/[npi] — persist corrections to it.
 *
 * A correction is a DRAFT write. It deliberately does not save the reusable
 * profile and does not activate anything — that separation is what stops a
 * single keystroke from satisfying the condition activation depends on. The UI
 * says so in as many words; this route simply must not blur it.
 *
 * Only `corrections` is forwarded. The backend allowlists field names and
 * validates every value, so this is belt-and-braces — but it means a client
 * cannot even attempt to write `savedAt`, `activatedAt` or a source
 * observation by nesting it in the request body.
 */

import { NextRequest } from 'next/server';

import { invalidNpiResponse, isValidNpi, proxyClinicianProfile } from '@/lib/clinician-profile/proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ npi: string }> }) {
  const { npi } = await ctx.params;
  if (!isValidNpi(npi)) return invalidNpiResponse();
  return proxyClinicianProfile({ path: `/${npi}`, method: 'GET' });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ npi: string }> }) {
  const { npi } = await ctx.params;
  if (!isValidNpi(npi)) return invalidNpiResponse();

  const body = (await req.json().catch(() => ({}))) as { corrections?: unknown };
  const corrections =
    body.corrections && typeof body.corrections === 'object' && !Array.isArray(body.corrections)
      ? body.corrections
      : {};

  return proxyClinicianProfile({ path: `/${npi}`, method: 'PATCH', body: { corrections } });
}
