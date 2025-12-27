import { importJWK, jwtVerify, JWK } from 'jose';

const DEFAULT_PUBLIC_JWK: JWK = {
  crv: 'Ed25519',
  kty: 'OKP',
  x: 'P0Q-BmhysK7nM1Lw0Eh69JhK2h2foQSqKFEgLL1uLKA',
};

const ISSUER_DID = process.env.VC_ISSUER_DID || 'did:key:dev-issuer';

function parseJwkEnv(raw: string | undefined): JWK | null {
  if (!raw) return null;
  return JSON.parse(raw) as JWK;
}

function extractJwt(vc: unknown): string | null {
  if (typeof vc === 'string') return vc;
  if (vc && typeof vc === 'object') {
    const proof = (vc as { proof?: { jwt?: string } }).proof;
    if (typeof proof?.jwt === 'string') {
      return proof.jwt;
    }
  }
  return null;
}

export interface VerifySignatureResult {
  valid: boolean;
  issuer?: string;
  subject?: string;
  claims?: Record<string, unknown>;
  credentialId?: string;
  reason?: string;
}

export async function verifySignature(vc: unknown): Promise<VerifySignatureResult> {
  const jwt = extractJwt(vc);
  if (!jwt) {
    return { valid: false, reason: 'Credential missing JWT proof.' };
  }

  try {
    const publicJwk = parseJwkEnv(process.env.VC_ISSUER_PUBLIC_JWK) || DEFAULT_PUBLIC_JWK;
    const publicKey = await importJWK(publicJwk, 'EdDSA');

    const { payload } = await jwtVerify(jwt, publicKey, {
      issuer: ISSUER_DID,
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
      credentialId:
        (vcPayload?.id as string | undefined) || (payload.jti as string | undefined),
    };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : 'Signature verification failed.',
    };
  }
}
