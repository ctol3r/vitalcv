/**
 * POST /api/clinician-profile/claim — bind a resolved NPI to the signed-in
 * clinician, or recover the draft that already belongs to them.
 *
 * Sends the NPI and NOTHING else. The anonymous preview the browser is holding
 * is not forwarded and is not persisted: the backend resolves its own snapshot
 * so that every value labelled "found in NPPES" is one the SERVER saw. A
 * proxy that passed the preview through would reintroduce exactly the defect
 * the server-authoritative claim was built to close — edit the preview in
 * devtools, claim, and your own text carries a registry label for the life of
 * the profile.
 */

import { NextRequest } from 'next/server';

import { invalidNpiResponse, isValidNpi, proxyClinicianProfile } from '@/lib/clinician-profile/proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { npi?: unknown };
  const npi = typeof body.npi === 'string' ? body.npi.trim() : '';
  if (!isValidNpi(npi)) return invalidNpiResponse();

  return proxyClinicianProfile({ path: '/claim', method: 'POST', body: { npi } });
}
