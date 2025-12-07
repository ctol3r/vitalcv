import { NextRequest, NextResponse } from 'next/server';

import { consumeChallenge, getPasskey, updateVerificationTimestamp } from '../../state';
import { resolveClinicianId } from '../../../utils';

interface VerifyRequest {
  challengeId: string;
  credentialId: string;
  response: {
    clientDataJSON: string;
    authenticatorData?: string;
    signature?: string;
  };
}

export async function POST(request: NextRequest) {
  const clinicianId = resolveClinicianId(request);
  const body = (await request.json()) as VerifyRequest;
  const challenge = consumeChallenge(body.challengeId);

  if (!challenge || challenge.clinicianId !== clinicianId || challenge.type !== 'verify') {
    return NextResponse.json(
      { error: 'invalid_challenge', message: 'Verification challenge invalid or expired.' },
      { status: 400 },
    );
  }

  const passkey = getPasskey(body.credentialId);
  if (!passkey || passkey.clinicianId !== clinicianId) {
    return NextResponse.json(
      { error: 'unknown_passkey', message: 'Passkey not registered for this clinician.' },
      { status: 404 },
    );
  }

  const providedChallenge = extractChallenge(body.response.clientDataJSON);
  if (providedChallenge !== challenge.challenge) {
    return NextResponse.json(
      { error: 'challenge_mismatch', message: 'Passkey assertion does not satisfy issued challenge.' },
      { status: 400 },
    );
  }

  updateVerificationTimestamp(passkey.id);
  return NextResponse.json({
    verified: true,
    passkey: {
      ...passkey,
      lastVerifiedAt: new Date().toISOString(),
    },
  });
}

function extractChallenge(clientData: string): string | null {
  try {
    const decoded = Buffer.from(clientData, 'base64url').toString('utf-8');
    const parsed = JSON.parse(decoded) as { challenge?: string };
    return parsed.challenge ?? null;
  } catch (error) {
    console.warn('[wallet][passkeys] failed to parse clientDataJSON (verify)', error);
    return null;
  }
}









