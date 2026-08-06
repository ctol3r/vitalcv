/**
 * POST /api/clinician-profile/[npi]/review — the clinician confirms they have
 * looked at what VitalCV found.
 *
 * One of the three conditions the server reads when it concludes activation.
 * Idempotent upstream: confirming twice keeps the first confirmation time and
 * emits no second activation.
 */

import { NextRequest } from 'next/server';

import { invalidNpiResponse, isValidNpi, proxyClinicianProfile } from '@/lib/clinician-profile/proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ npi: string }> }) {
  const { npi } = await ctx.params;
  if (!isValidNpi(npi)) return invalidNpiResponse();
  return proxyClinicianProfile({ path: `/${npi}/review`, method: 'POST', body: {} });
}
