import { createHash } from 'crypto';
import { importJWK, JWK, JWSHeaderParameters, JWTPayload, jwtVerify } from 'jose';
import { getPublicSigningJwk } from './signingKeyProvider';

export interface SdJwtVerificationResult {
  valid: boolean;
  payload?: JWTPayload;
  header?: JWSHeaderParameters;
  vc?: Record<string, unknown>;
  subjectId?: string;
  revealedClaims?: Record<string, unknown>;
  undisclosedDigests?: string[];
  error?: string;
}

const SD_JWT_ALG = 'sha-256';

function computeDisclosureDigest(disclosure: string): string {
  return createHash('sha256').update(disclosure).digest('base64url');
}

function parseDisclosure(encoded: string): { key: string; value: unknown; digest: string } {
  const payload = Buffer.from(encoded, 'base64url').toString('utf8');
  const parsed = JSON.parse(payload);
  if (!Array.isArray(parsed) || parsed.length < 3) {
    throw new Error('Invalid disclosure payload');
  }
  const [, key, value] = parsed;
  if (typeof key !== 'string') {
    throw new Error('Disclosure payload must include key string');
  }
  return {
    key,
    value,
    digest: computeDisclosureDigest(encoded),
  };
}

function splitSdJwt(token: string): { jwt: string; disclosures: string[] } {
  const parts = token.split('~');
  const jwt = parts.shift();
  if (!jwt) {
    throw new Error('SD-JWT missing JWT component');
  }
  const disclosures = parts.filter((part) => part.length > 0);
  return { jwt, disclosures };
}

export async function verifySdJwtCredential(
  token: string,
  options: {
    issuerJwk?: JWK;
    expectedIssuer?: string;
    expectedHolderJkt?: string;
  } = {},
): Promise<SdJwtVerificationResult> {
  try {
    const { jwt, disclosures } = splitSdJwt(token);
    const issuerJwk = options.issuerJwk ?? (await getPublicSigningJwk());
    const { d, ...publicJwk } = issuerJwk as JWK & { d?: string };
    const algorithm = (publicJwk.alg as string) || 'EdDSA';
    const publicKey = await importJWK(publicJwk, algorithm);

    const verified = await jwtVerify(jwt, publicKey, {
      algorithms: [algorithm],
    });

    const payload = verified.payload as JWTPayload & Record<string, unknown>;
    const header = verified.protectedHeader;

    if (header.typ !== 'vc+sd-jwt') {
      return { valid: false, error: 'Invalid typ header for SD-JWT VC' };
    }

    if (!payload.iss || !payload.sub || !payload.iat) {
      return { valid: false, error: 'Missing required JWT claims (iss, sub, iat)' };
    }

    if (options.expectedIssuer && payload.iss !== options.expectedIssuer) {
      return { valid: false, error: 'Issuer mismatch' };
    }

    if (payload._sd_alg !== SD_JWT_ALG) {
      return { valid: false, error: 'Unsupported or missing _sd_alg' };
    }

    const vc = payload.vc as Record<string, unknown> | undefined;
    if (!vc) {
      return { valid: false, error: 'Missing vc claim in SD-JWT payload' };
    }

    const issuerValue = vc.issuer as { id?: string } | string | undefined;
    const issuer = typeof issuerValue === 'string' ? issuerValue : issuerValue?.id;
    const issuanceDate = vc.issuanceDate as string | undefined;
    if (!issuer || !issuanceDate) {
      return { valid: false, error: 'VC is missing issuer or issuanceDate' };
    }

    if (issuer !== payload.iss) {
      return { valid: false, error: 'VC issuer does not match JWT issuer' };
    }

    const credentialSubject = vc.credentialSubject as Record<string, unknown> | undefined;
    if (!credentialSubject || typeof credentialSubject.id !== 'string') {
      return { valid: false, error: 'VC credentialSubject.id is required' };
    }

    if (credentialSubject.id !== payload.sub) {
      return { valid: false, error: 'VC subject does not match JWT sub' };
    }

    const cnf = payload.cnf as { jkt?: string } | undefined;
    if (!cnf?.jkt) {
      return { valid: false, error: 'Missing holder binding cnf.jkt claim' };
    }
    if (options.expectedHolderJkt && cnf.jkt !== options.expectedHolderJkt) {
      return { valid: false, error: 'Holder binding cnf.jkt mismatch' };
    }

    const digestList = Array.isArray(credentialSubject._sd)
      ? (credentialSubject._sd as string[])
      : [];

    const revealedClaims: Record<string, unknown> = {};
    for (const disclosureEncoded of disclosures) {
      const disclosure = parseDisclosure(disclosureEncoded);
      if (!digestList.includes(disclosure.digest)) {
        return { valid: false, error: 'Disclosure digest does not match any _sd entry' };
      }
      if (Object.prototype.hasOwnProperty.call(revealedClaims, disclosure.key)) {
        return { valid: false, error: `Duplicate disclosure for ${disclosure.key}` };
      }
      revealedClaims[disclosure.key] = disclosure.value;
    }

    const undisclosedDigests = digestList.filter(
      (digest) => !disclosures.some((encoded) => computeDisclosureDigest(encoded) === digest),
    );

    return {
      valid: true,
      payload,
      header,
      vc,
      subjectId: credentialSubject.id as string,
      revealedClaims,
      undisclosedDigests,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'SD-JWT verification failed',
    };
  }
}
