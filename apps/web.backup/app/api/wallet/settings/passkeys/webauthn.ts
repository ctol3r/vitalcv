import type { RegisteredPasskey } from './state';

export interface CreationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
  timeout: number;
  attestation: 'none';
  authenticatorSelection: {
    residentKey: 'required' | 'preferred';
    userVerification: 'preferred' | 'required';
    requireResidentKey: boolean;
  };
}

export interface RequestOptions {
  challenge: string;
  timeout: number;
  rpId: string;
  userVerification: 'preferred' | 'required';
  allowCredentials: Array<{ id: string; type: 'public-key'; transports: string[] }>;
}

export function buildCreationOptions(params: {
  challenge: string;
  clinicianId: string;
  requireDeviceBound?: boolean;
}): CreationOptions {
  const rpId = process.env.NEXT_PUBLIC_DOMAIN ?? 'localhost';
  return {
    challenge: params.challenge,
    rp: {
      name: 'VitalCV Wallet',
      id: rpId,
    },
    user: {
      id: Buffer.from(params.clinicianId).toString('base64url'),
      name: params.clinicianId,
      displayName: `Clinician ${params.clinicianId}`,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    timeout: 60000,
    attestation: 'none',
    authenticatorSelection: {
      residentKey: params.requireDeviceBound ? 'required' : 'preferred',
      userVerification: params.requireDeviceBound ? 'required' : 'preferred',
      requireResidentKey: Boolean(params.requireDeviceBound),
    },
  };
}

export function buildRequestOptions(params: {
  challenge: string;
  passkeys: RegisteredPasskey[];
}): RequestOptions {
  const rpId = process.env.NEXT_PUBLIC_DOMAIN ?? 'localhost';
  return {
    challenge: params.challenge,
    rpId,
    timeout: 60000,
    userVerification: 'preferred',
    allowCredentials: params.passkeys.map((key) => ({
      id: key.id,
      type: 'public-key' as const,
      transports: key.transports ?? [],
    })),
  };
}









