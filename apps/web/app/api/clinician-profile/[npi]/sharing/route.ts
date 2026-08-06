/**
 * POST /api/clinician-profile/[npi]/sharing — the clinician confirms they
 * understand who controls sharing.
 *
 * Not a preference and not a toggle: it records that the person was shown, and
 * acknowledged, that nothing leaves VitalCV until they send it and that an
 * employer decides its own outcome. A profile can be saved and reusable
 * without anyone having seen it.
 */

import { NextRequest } from 'next/server';

import { invalidNpiResponse, isValidNpi, proxyClinicianProfile } from '@/lib/clinician-profile/proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ npi: string }> }) {
  const { npi } = await ctx.params;
  if (!isValidNpi(npi)) return invalidNpiResponse();
  return proxyClinicianProfile({ path: `/${npi}/sharing`, method: 'POST', body: {} });
}
