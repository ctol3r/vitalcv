import { jwtVerify, createLocalJWKSet } from 'jose';
import { getPublicKeyJwk } from '@/lib/crypto/receiptIssuer';

export interface ReceiptVerificationResult {
  verified: boolean;
  payload?: Record<string, unknown>;
  error?: string;
  errorCode?: 'signature_invalid' | 'token_expired' | 'algorithm_rejected' | 'malformed' | 'unknown';
}

export async function verifyReceiptJWT(token: string): Promise<ReceiptVerificationResult> {
  try {
    const publicJwk = await getPublicKeyJwk();
    const JWKS = createLocalJWKSet({ keys: [publicJwk] } as Parameters<typeof createLocalJWKSet>[0]);
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ['ES256'],
    });
    return { verified: true, payload: payload as Record<string, unknown> };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    let errorCode: ReceiptVerificationResult['errorCode'] = 'unknown';
    if (message.includes('signature')) errorCode = 'signature_invalid';
    else if (message.includes('expired') || message.includes('exp')) errorCode = 'token_expired';
    else if (message.includes('alg') || message.includes('algorithm')) errorCode = 'algorithm_rejected';
    else if (message.includes('malformed') || message.includes('Invalid')) errorCode = 'malformed';
    return { verified: false, error: message, errorCode };
  }
}
