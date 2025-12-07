import { NextRequest, NextResponse } from 'next/server';

import { issueChallenge, listPasskeys } from '../../state';
import { resolveClinicianId } from '../../../utils';
import { buildRequestOptions } from '../../webauthn';

export async function POST(request: NextRequest) {
  const clinicianId = resolveClinicianId(request);
  const passkeys = listPasskeys(clinicianId);
  if (passkeys.length === 0) {
    return NextResponse.json(
      { error: 'no_passkeys', message: 'No registered passkeys available for this clinician.' },
      { status: 400 },
    );
  }
  const challenge = issueChallenge(clinicianId, 'verify');
  const options = buildRequestOptions({
    challenge: challenge.challenge,
    passkeys,
  });
  return NextResponse.json({ challengeId: challenge.id, options });
}









