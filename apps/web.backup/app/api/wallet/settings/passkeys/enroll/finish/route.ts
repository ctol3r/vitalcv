import { NextRequest, NextResponse } from 'next/server';

import { consumeChallenge, savePasskey } from '../../state';
import { resolveClinicianId } from '../../../utils';

interface FinishRequest {
  challengeId: string;
  credential: {
    id: string;
    type: string;
    rawId: string;
    transports?: string[];
    response: {
      clientDataJSON: string;
      attestationObject?: string;
      publicKey?: string;
    };
  };
  deviceName?: string;
}

export async function POST(request: NextRequest) {
  const clinicianId = resolveClinicianId(request);
  const body = (await request.json()) as FinishRequest;
  const challenge = consumeChallenge(body.challengeId);

  if (!challenge || challenge.clinicianId !== clinicianId || challenge.type !== 'enroll') {
    return NextResponse.json(
      { error: 'invalid_challenge', message: 'Passkey enrollment challenge is invalid or expired.' },
      { status: 400 },
    );
  }

  const providedChallenge = extractChallenge(body.credential.response.clientDataJSON);
  if (providedChallenge !== challenge.challenge) {
    return NextResponse.json(
      { error: 'challenge_mismatch', message: 'Client proof does not satisfy issued challenge.' },
      { status: 400 },
    );
  }

  const record = {
    id: body.credential.id,
    clinicianId,
    name: body.deviceName?.trim() || `Wallet Passkey • ${body.credential.id.slice(-6)}`,
    transports: body.credential.transports ?? [],
    createdAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    attestation: body.credential.response,
  };
  savePasskey(record);

  return NextResponse.json({ passkey: record });
}

function extractChallenge(clientDataB64: string): string | null {
  try {
    const decoded = Buffer.from(clientDataB64, 'base64url').toString('utf-8');
    const parsed = JSON.parse(decoded) as { challenge?: string };
    return parsed.challenge ?? null;
  } catch (error) {
    console.warn('[wallet][passkeys] failed to parse clientDataJSON', error);
    return null;
  }
}









