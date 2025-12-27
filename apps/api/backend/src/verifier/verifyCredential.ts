import { getIssuerDid, getIssuerPublicJwk } from '../crypto/issuerKeys';

export interface VerificationResult {
  valid: boolean;
  issuer?: string;
  subject?: string;
  claims?: Record<string, unknown>;
  reason?: string;
}

function extractJwt(vc: unknown): string | null {
  if (typeof vc === 'string') return vc;
  if (vc && typeof vc === 'object') {
    const proof = (vc as { proof?: { jwt?: string } }).proof;
    if (proof?.jwt && typeof proof.jwt === 'string') {
      return proof.jwt;
    }
  }
  return null;
}

export async function verifySignature(vc: unknown): Promise<VerificationResult> {
  const jwt = extractJwt(vc);
  if (!jwt) {
    return { valid: false, reason: 'Credential is missing a JWT proof.' };
  }

  const { jwtVerify, importJWK } = await import('jose');
  const publicKey = await importJWK(getIssuerPublicJwk(), 'EdDSA');
  const issuerDid = getIssuerDid();

  try {
    const { payload } = await jwtVerify(jwt, publicKey, {
      issuer: issuerDid,
    });

    const vcPayload = payload.vc as Record<string, unknown> | undefined;
    const credentialSubject = vcPayload?.credentialSubject as
      | Record<string, unknown>
      | undefined;

    return {
      valid: true,
      issuer: payload.iss as string | undefined,
      subject: payload.sub as string | undefined,
      claims: credentialSubject,
    };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : 'Signature verification failed.',
    };
  }
}
