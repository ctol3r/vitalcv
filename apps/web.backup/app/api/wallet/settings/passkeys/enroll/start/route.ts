import { NextRequest, NextResponse } from 'next/server';

import { issueChallenge } from '../../state';
import { resolveClinicianId } from '../../../utils';
import { buildCreationOptions } from '../../webauthn';

interface Body {
  requireDeviceBound?: boolean;
}

export async function POST(request: NextRequest) {
  const clinicianId = resolveClinicianId(request);
  const body = (await request.json().catch(() => ({}))) as Body;
  const challenge = issueChallenge(clinicianId, 'enroll');
  const options = buildCreationOptions({
    challenge: challenge.challenge,
    clinicianId,
    requireDeviceBound: body.requireDeviceBound,
  });
  return NextResponse.json({
    challengeId: challenge.id,
    options,
  });
}









