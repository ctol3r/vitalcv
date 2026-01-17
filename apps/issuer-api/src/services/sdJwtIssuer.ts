import { createHash, randomBytes } from 'crypto';
import { importJWK, JWK, JWSHeaderParameters, JWTPayload, jwtVerify, SignJWT } from 'jose';
import { getActiveSigningKey } from './signingKeyProvider';
import { allocateStatusListEntry, buildCredentialStatus, buildStatusClaim } from './statusList';

export interface SdJwtCredentialSubject {
  id: string;
  name?: string;
  npi?: string;
  specialty?: string;
  [key: string]: unknown;
}

export interface IssueSdJwtOptions {
  issuerDid: string;
  issuerUrl: string;
  holderJkt: string;
  credentialTypes: string[];
  subject: SdJwtCredentialSubject;
  expiresInSeconds?: number;
  disclosableFields?: string[];
  vcOverrides?: Record<string, unknown>;
  statusListId?: string;
}

export interface SdJwtIssueResult {
  credential: string;
  disclosures: string[];
  credentialId: string;
  subjectId: string;
  issuedAt: string;
  expiresAt?: string;
}

export interface SdJwtDisclosure {
  encoded: string;
  salt: string;
  key: string;
  value: unknown;
  digest: string;
}

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
const DEFAULT_DISCLOSABLE_FIELDS = ['name', 'npi', 'specialty'];

function base64UrlEncode(value: string | Buffer): string {
  const buffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
  return buffer.toString('base64url');
}

function computeDisclosureDigest(disclosure: string): string {
  return createHash('sha256').update(disclosure).digest('base64url');
}

function createDisclosure(key: string, value: unknown): SdJwtDisclosure {
  const salt = base64UrlEncode(randomBytes(16));
  const disclosurePayload = JSON.stringify([salt, key, value]);
  const encoded = base64UrlEncode(disclosurePayload);
  const digest = computeDisclosureDigest(encoded);
  return { encoded, salt, key, value, digest };
}

function parseDisclosure(encoded: string): SdJwtDisclosure {
  const payload = Buffer.from(encoded, 'base64url').toString('utf8');
  const parsed = JSON.parse(payload);
  if (!Array.isArray(parsed) || parsed.length < 3) {
    throw new Error('Invalid disclosure payload');
  }

  const [salt, key, value] = parsed;
  if (typeof salt !== 'string' || typeof key !== 'string') {
    throw new Error('Disclosure payload must include salt and key strings');
  }

  return {
    encoded,
    salt,
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

export async function issueSdJwtCredential(options: IssueSdJwtOptions): Promise<SdJwtIssueResult> {
  const { issuerDid, issuerUrl, holderJkt, credentialTypes, subject } = options;

  if (!issuerDid) {
    throw new Error('issuerDid is required');
  }
  if (!issuerUrl) {
    throw new Error('issuerUrl is required');
  }
  if (!holderJkt) {
    throw new Error('holderJkt is required for holder binding');
  }
  if (!subject?.id) {
    throw new Error('subject.id is required');
  }

  const credentialId = `${issuerUrl}/credentials/${randomBytes(16).toString('hex')}`;
  const issuedAt = new Date();
  const expiresAt = options.expiresInSeconds
    ? new Date(issuedAt.getTime() + options.expiresInSeconds * 1000)
    : undefined;

  const overridePayload = options.vcOverrides ?? {};
  const statusOverride =
    (overridePayload as Record<string, unknown>).credentialStatus ??
    (overridePayload as Record<string, unknown>).status;
  const statusAllocation = statusOverride
    ? null
    : await allocateStatusListEntry(credentialId, options.statusListId);
  const credentialStatus = statusAllocation ? buildCredentialStatus(statusAllocation) : undefined;
  const statusClaim = statusAllocation ? buildStatusClaim(statusAllocation) : undefined;

  const disclosures: SdJwtDisclosure[] = [];
  const disclosureDigests: string[] = [];
  const disclosableFields = options.disclosableFields ?? DEFAULT_DISCLOSABLE_FIELDS;
  const disclosableSet = new Set(disclosableFields.filter((field) => field !== 'id'));

  const credentialSubject: Record<string, unknown> = {
    id: subject.id,
    _sd: disclosureDigests,
  };

  Object.entries(subject).forEach(([key, value]) => {
    if (key === 'id' || typeof value === 'undefined') {
      return;
    }

    if (disclosableSet.has(key)) {
      const disclosure = createDisclosure(key, value);
      disclosures.push(disclosure);
      disclosureDigests.push(disclosure.digest);
      return;
    }

    credentialSubject[key] = value;
  });

  const basePayload: Record<string, unknown> = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: credentialId,
    type: ['VerifiableCredential', ...credentialTypes],
    issuer: issuerDid,
    issuanceDate: issuedAt.toISOString(),
    ...(expiresAt ? { expirationDate: expiresAt.toISOString() } : {}),
    credentialSubject,
  };

  const overrideSubject = (overridePayload.credentialSubject as Record<string, unknown>) || {};
  const overrideHasCredentialStatus = Object.prototype.hasOwnProperty.call(
    overridePayload,
    'credentialStatus',
  );
  const overrideHasStatus = Object.prototype.hasOwnProperty.call(overridePayload, 'status');
  const vcPayload = {
    ...basePayload,
    ...overridePayload,
    ...(credentialStatus && !overrideHasCredentialStatus ? { credentialStatus } : {}),
    ...(statusClaim && !overrideHasStatus ? { status: statusClaim } : {}),
    credentialSubject: {
      ...credentialSubject,
      ...overrideSubject,
    },
  };

  const { jwk, kid } = await getActiveSigningKey();
  const algorithm = (jwk.alg as string) || 'EdDSA';
  const privateKey = await importJWK(jwk as JWK, algorithm);

  const jwtPayload = {
    vc: vcPayload,
    cnf: { jkt: holderJkt },
    _sd_alg: SD_JWT_ALG,
  };

  const signer = new SignJWT(jwtPayload)
    .setProtectedHeader({
      alg: algorithm,
      typ: 'vc+sd-jwt',
      kid: kid || 'issuer-key-default',
    })
    .setIssuedAt(Math.floor(issuedAt.getTime() / 1000))
    .setIssuer(issuerDid)
    .setSubject(subject.id)
    .setJti(credentialId);

  if (expiresAt) {
    signer.setExpirationTime(Math.floor(expiresAt.getTime() / 1000));
  }

  const jwt = await signer.sign(privateKey);
  const sdJwt = [jwt, ...disclosures.map((disclosure) => disclosure.encoded)].join('~');

  return {
    credential: sdJwt,
    disclosures: disclosures.map((disclosure) => disclosure.encoded),
    credentialId,
    subjectId: subject.id,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt?.toISOString(),
  };
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
    const { jwk } = options.issuerJwk ? { jwk: options.issuerJwk } : await getActiveSigningKey();

    const { d, ...publicJwk } = jwk as JWK & { d?: string };
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
