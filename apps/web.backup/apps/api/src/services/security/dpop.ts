import { createHash } from 'crypto';
import {
  calculateJwkThumbprint,
  importJWK,
  jwtVerify,
  type JWK,
  type JWTPayload,
  type ProtectedHeaderParameters,
} from 'jose';

export interface VerifyDpopOptions {
  proof?: string;
  method: string;
  url: string;
  accessToken?: string;
  clockToleranceSeconds?: number;
}

export interface VerifyDpopResult {
  jkt: string;
  payload: JWTPayload & {
    htm?: string;
    htu?: string;
    ath?: string;
  };
  protectedHeader: ProtectedHeaderParameters;
}

const DEFAULT_CLOCK_TOLERANCE_SECONDS = 120;

export class DPoPVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DPoPVerificationError';
  }
}

export async function verifyDpopProof(options: VerifyDpopOptions): Promise<VerifyDpopResult> {
  if (!options.proof) {
    throw new DPoPVerificationError('DPoP proof missing');
  }

  try {
    const verification = await jwtVerify(
      options.proof,
      async (header) => {
        if (!header.jwk) {
          throw new DPoPVerificationError('DPoP header missing jwk');
        }
        return importJWK(header.jwk as JWK, header.alg || 'EdDSA');
      },
    );

    const method = options.method.toUpperCase();
    const payloadMethod = typeof verification.payload.htm === 'string' ? verification.payload.htm.toUpperCase() : undefined;
    if (payloadMethod !== method) {
      throw new DPoPVerificationError('DPoP htm mismatch');
    }

    const expectedHtu = normalizeHtu(options.url);
    const payloadHtu = typeof verification.payload.htu === 'string' ? normalizeHtu(verification.payload.htu) : undefined;
    if (payloadHtu !== expectedHtu) {
      throw new DPoPVerificationError('DPoP htu mismatch');
    }

    const iat = typeof verification.payload.iat === 'number' ? verification.payload.iat : undefined;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tolerance = options.clockToleranceSeconds ?? DEFAULT_CLOCK_TOLERANCE_SECONDS;
    if (!iat || Math.abs(nowSeconds - iat) > tolerance) {
      throw new DPoPVerificationError('DPoP iat outside acceptable window');
    }

    if (options.accessToken) {
      const ath = verification.payload.ath;
      const expectedAth = hashAccessToken(options.accessToken);
      if (typeof ath !== 'string' || ath !== expectedAth) {
        throw new DPoPVerificationError('DPoP access token hash mismatch');
      }
    }

    if (!verification.protectedHeader.jwk) {
      throw new DPoPVerificationError('DPoP protected header missing jwk');
    }

    const jkt = await calculateJwkThumbprint(verification.protectedHeader.jwk as JWK, 'sha256');

    return {
      jkt,
      payload: verification.payload as VerifyDpopResult['payload'],
      protectedHeader: verification.protectedHeader,
    };
  } catch (error) {
    if (error instanceof DPoPVerificationError) {
      throw error;
    }
    throw new DPoPVerificationError(error instanceof Error ? error.message : 'unknown dpop error');
  }
}

export function hashAccessToken(token: string): string {
  const digest = createHash('sha256').update(token).digest();
  return digest
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function normalizeHtu(input: string): string {
  const parsed = new URL(input);
  parsed.hash = '';
  // RFC 9449 recommends stripping default ports
  if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) {
    parsed.port = '';
  }
  return parsed.toString();
}


