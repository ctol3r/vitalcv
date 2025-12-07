import { verifyWithPublicKey } from '@packages/domain-identity';
import { computeCredentialHashFromPayload } from './sdJwt';

export interface DecodedSdJwt {
  header: Record<string, any>;
  payload: Record<string, any>;
  signature: string;
  signingInput: string;
}

export interface VerifyPassportCredentialInput {
  sdJwt: string;
  disclosures: string[];
  publicKeyHex: string;
}

export interface VerifyPassportCredentialResult {
  payload: Record<string, any>;
  disclosedClaims: Record<string, any>;
  hash: string;
  passportId: string;
  credentialId: string;
  domain: string;
}

export function decodeSdJwt(sdJwt: string): DecodedSdJwt {
  const parts = sdJwt.split('.');
  if (parts.length !== 3) {
    throw new Error('SD-JWT must contain header, payload, and signature');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  return {
    header: JSON.parse(base64urlDecode(headerB64)),
    payload: JSON.parse(base64urlDecode(payloadB64)),
    signature: Buffer.from(base64urlDecode(signatureB64), 'binary').toString('hex'),
    signingInput: `${headerB64}.${payloadB64}`,
  };
}

export async function verifySdJwtSignature(
  decoded: DecodedSdJwt,
  publicKeyHex: string,
): Promise<boolean> {
  return verifyWithPublicKey(decoded.signingInput, decoded.signature, publicKeyHex);
}

export async function verifyPassportCredential(
  input: VerifyPassportCredentialInput,
): Promise<VerifyPassportCredentialResult> {
  const decoded = decodeSdJwt(input.sdJwt);
  const signatureValid = await verifySdJwtSignature(decoded, input.publicKeyHex);

  if (!signatureValid) {
    throw new Error('SD-JWT signature verification failed');
  }

  const credentialHash = computeCredentialHashFromPayload(decoded.payload, input.disclosures);
  const providedHash = decoded.payload.credential_hash;

  if (!providedHash || providedHash !== credentialHash) {
    throw new Error('Credential hash mismatch');
  }

  return {
    payload: decoded.payload,
    disclosedClaims: mergeDisclosures(decoded.payload, input.disclosures),
    hash: credentialHash,
    passportId: decoded.payload.passport_id,
    credentialId: decoded.payload.jti,
    domain: decoded.payload.credential_domain,
  };
}

function mergeDisclosures(
  payload: Record<string, any>,
  disclosures: string[],
): Record<string, any> {
  const claims = { ...payload };

  for (const disclosure of disclosures) {
    try {
      const parsed = JSON.parse(base64urlDecode(disclosure));
      if (Array.isArray(parsed)) {
        if (parsed.length === 3) {
          const [, claim, value] = parsed;
          if (typeof claim === 'string') {
            claims[claim] = value;
          }
        }
      }
    } catch {
      // Ignore invalid disclosure parsing – validation happens elsewhere.
    }
  }

  delete claims._sd;
  return claims;
}

function base64urlDecode(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64').toString('utf-8');
}

