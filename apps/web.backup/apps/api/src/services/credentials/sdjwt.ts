import { createHash, randomBytes, randomUUID } from 'crypto';
import {
  importPKCS8,
  importSPKI,
  jwtVerify,
  SignJWT,
  type JWTPayload,
  type JWSHeaderParameters,
  type KeyLike,
} from 'jose';

const SIGNING_ALG = 'EdDSA';
const DEFAULT_ISSUER = process.env.SDJWT_ISSUER_DID ?? 'did:web:vitalcv.com/issuer';
const SIGNING_KEY_ID = process.env.SDJWT_KEY_ID ?? `${DEFAULT_ISSUER}#sd-jwt`;
const PRIVATE_KEY_SOURCE =
  process.env.SDJWT_PRIVATE_KEY ??
  process.env.PASSPORT_SIGNING_KEY ??
  process.env.ISSUER_SECRET_KEY ??
  '';
const PUBLIC_KEY_SOURCE = process.env.SDJWT_PUBLIC_KEY ?? '';

let signingKeyPromise: Promise<KeyLike> | null = null;
let verificationKeyPromise: Promise<KeyLike> | null = null;

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type JsonObject = { [key: string]: Json };

export interface SdJwtDisclosure {
  path: string;
  value: Json;
  salt: string;
  digest: string;
}

export interface SdJwtDigestEntry {
  path: string;
  digest: string;
}

export interface SdJwtPayload extends JWTPayload {
  vc: JsonObject;
  sd_digests: SdJwtDigestEntry[];
  digest_root: string;
  credential_id?: string;
}

export interface SdJwtIssueResult {
  sd_jwt: string;
  disclosures: SdJwtDisclosure[];
}

export interface VerifiedSdJwt {
  payload: SdJwtPayload;
  header: JWSHeaderParameters;
}

export async function createSdJwt(vcPayload: Json): Promise<SdJwtIssueResult> {
  const normalized = cloneAsObject(vcPayload, 'vcPayload');
  const subject = getCredentialSubject(normalized);
  const subjectId = typeof subject.id === 'string' ? subject.id : undefined;

  const disclosures: SdJwtDisclosure[] = [];
  const digestIndex: SdJwtDigestEntry[] = [];
  const redactedSubject = redactClaims(subject, 'credentialSubject', disclosures, digestIndex);
  normalized.credentialSubject = redactedSubject;

  const orderedDisclosures = [...disclosures].sort((a, b) => a.path.localeCompare(b.path));
  const orderedDigests = [...digestIndex].sort((a, b) => a.path.localeCompare(b.path));
  const digestRoot = createHash('sha256')
    .update(canonicalizeJson(orderedDigests))
    .digest('base64url');

  const payload: SdJwtPayload = {
    vc: normalized,
    sd_digests: orderedDigests,
    digest_root: digestRoot,
    credential_id: typeof normalized.id === 'string' ? normalized.id : undefined,
  };

  const issueTime = Math.floor(Date.now() / 1000);
  const issuer = getIssuer(normalized);
  const credentialId = payload.credential_id ?? randomUUID();
  const signer = await getSigningKey();

  const jwtBuilder = new SignJWT(payload as JWTPayload)
    .setProtectedHeader({
      alg: SIGNING_ALG,
      typ: 'vc+sd-jwt',
      kid: SIGNING_KEY_ID,
    })
    .setIssuer(issuer)
    .setSubject(subjectId ?? 'did:holder:unknown')
    .setIssuedAt(issueTime)
    .setNotBefore(issueTime)
    .setJti(credentialId);

  const expiresAt = getExpiration(normalized);
  if (expiresAt) {
    jwtBuilder.setExpirationTime(expiresAt);
  }

  const token = await jwtBuilder.sign(signer);

  return {
    sd_jwt: token,
    disclosures: orderedDisclosures,
  };
}

export async function verifySdJwtSignature(token: string): Promise<VerifiedSdJwt> {
  const verifier = await getVerificationKey();
  const { payload, protectedHeader } = await jwtVerify(token, verifier, {
    algorithms: [SIGNING_ALG],
  });

  if (!isJsonObject(payload.vc)) {
    throw new Error('SD-JWT payload is missing vc object');
  }

  if (!Array.isArray(payload.sd_digests)) {
    throw new Error('SD-JWT payload missing sd_digests');
  }

  return {
    payload: payload as SdJwtPayload,
    header: protectedHeader,
  };
}

export function canonicalizeJson(value: Json): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizeJson(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as JsonObject)
    .filter(([, child]) => child !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  const fragments = entries.map(
    ([key, entry]) => `${JSON.stringify(key)}:${canonicalizeJson(entry)}`,
  );
  return `{${fragments.join(',')}}`;
}

export function computeDisclosureDigest(path: string, value: Json, salt: string): string {
  return createHash('sha256')
    .update(`${path}|${salt}|${canonicalizeJson(value)}`)
    .digest('base64url');
}

export function buildDigestLookup(entries: SdJwtDigestEntry[]): Record<string, string> {
  return entries.reduce<Record<string, string>>((acc, entry) => {
    acc[entry.path] = entry.digest;
    return acc;
  }, {});
}

export function redactClaims(
  value: Json,
  path: string,
  disclosures: SdJwtDisclosure[],
  digestIndex: SdJwtDigestEntry[],
): Json {
  if (value === null || typeof value !== 'object') {
    const salt = randomBytes(16).toString('base64url');
    const digest = computeDisclosureDigest(path, value, salt);
    disclosures.push({ path, salt, value, digest });
    digestIndex.push({ path, digest });
    return digest;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      redactClaims(entry, `${path}[${index}]`, disclosures, digestIndex),
    );
  }

  const result: JsonObject = {};
  const entries = Object.entries(value).filter(([, child]) => child !== undefined);
  entries.sort(([a], [b]) => a.localeCompare(b));

  for (const [key, child] of entries) {
    const childPath = path ? `${path}.${key}` : key;
    result[key] = redactClaims(child as Json, childPath, disclosures, digestIndex);
  }

  return result;
}

export function hydrateDisclosedClaims(
  disclosures: Array<Pick<SdJwtDisclosure, 'path' | 'value'>>,
): JsonObject {
  const root: JsonObject = {};
  disclosures.forEach((entry) => setPathValue(root, entry.path, entry.value));
  return root;
}

export function isJsonObject(value: Json): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function setPathValue(target: JsonObject | Json[], path: string, value: Json) {
  const segments = parsePath(path);
  let cursor: JsonObject | Json[] = target;

  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1;
    if (typeof segment === 'number') {
      if (!Array.isArray(cursor)) {
        throw new Error(`Expected array while setting ${path}`);
      }
      if (isLast) {
        cursor[segment] = value;
        return;
      }
      if (cursor[segment] === undefined) {
        cursor[segment] = typeof segments[index + 1] === 'number' ? [] : {};
      }
      cursor = cursor[segment] as JsonObject | Json[];
      return;
    }

    const nextToken = segments[index + 1];
    if (isLast) {
      (cursor as JsonObject)[segment] = value;
      return;
    }

    if ((cursor as JsonObject)[segment] === undefined) {
      (cursor as JsonObject)[segment] = typeof nextToken === 'number' ? [] : {};
    }
    cursor = (cursor as JsonObject)[segment] as JsonObject | Json[];
  });
}

function parsePath(path: string): Array<string | number> {
  const segments: Array<string | number> = [];
  const pattern = /([^[.\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(path))) {
    if (match[1]) {
      segments.push(match[1]);
    } else if (match[2]) {
      segments.push(Number(match[2]));
    }
  }
  return segments;
}

function cloneAsObject(value: Json, label: string): JsonObject {
  if (!isJsonObject(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function getCredentialSubject(vc: JsonObject): JsonObject {
  const subject = vc.credentialSubject;
  if (!isJsonObject(subject)) {
    throw new Error('vcPayload.credentialSubject must be an object');
  }
  return subject;
}

function getIssuer(vc: JsonObject): string {
  const issuer = vc.issuer;
  if (typeof issuer === 'string') {
    return issuer;
  }
  if (isJsonObject(issuer) && typeof issuer.id === 'string') {
    return issuer.id;
  }
  return DEFAULT_ISSUER;
}

function getExpiration(vc: JsonObject): number | undefined {
  const expirationDate = vc.expirationDate;
  if (typeof expirationDate === 'string') {
    const parsed = Date.parse(expirationDate);
    if (!Number.isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }
  return undefined;
}

async function getSigningKey(): Promise<KeyLike> {
  if (!PRIVATE_KEY_SOURCE) {
    throw new Error('SDJWT_PRIVATE_KEY (or PASSPORT_SIGNING_KEY) must be configured');
  }
  if (!signingKeyPromise) {
    signingKeyPromise = importPKCS8(normalizePem(PRIVATE_KEY_SOURCE), SIGNING_ALG);
  }
  return signingKeyPromise;
}

async function getVerificationKey(): Promise<KeyLike> {
  if (!verificationKeyPromise) {
    if (PUBLIC_KEY_SOURCE) {
      verificationKeyPromise = importSPKI(normalizePem(PUBLIC_KEY_SOURCE), SIGNING_ALG);
    } else {
      verificationKeyPromise = getSigningKey();
    }
  }
  return verificationKeyPromise;
}

function normalizePem(value: string): string {
  const trimmed = value.trim();
  if (trimmed.includes('BEGIN')) {
    return trimmed;
  }
  const decoded = Buffer.from(trimmed, 'base64').toString('utf-8').trim();
  if (decoded.includes('BEGIN')) {
    return decoded;
  }
  throw new Error('Provided key must be PEM or base64-encoded PEM');
}











