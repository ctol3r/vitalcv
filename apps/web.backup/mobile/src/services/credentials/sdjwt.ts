import { getPublicKey, sign, utils as edUtils } from '@noble/ed25519';
import CryptoJS from 'crypto-js';

export interface SdJwtOptions {
  issuerDid: string;
  holderDid: string;
  audience: string;
  nonce: string;
  privateKeyHex: string;
  expiresAt?: string;
  selectiveDisclosure?: string[];
}

export interface SdJwtResult {
  token: string;
  disclosures: string[];
}

export async function createSdJwt(
  claims: Record<string, unknown>,
  options: SdJwtOptions,
): Promise<SdJwtResult> {
  const [redacted, disclosures] = createNestedDisclosures(claims, options.selectiveDisclosure);
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    ...redacted,
    iss: options.issuerDid,
    sub: options.holderDid,
    aud: options.audience,
    nonce: options.nonce,
    iat: issuedAt,
    nbf: issuedAt,
    exp: options.expiresAt ? Math.floor(new Date(options.expiresAt).getTime() / 1000) : undefined,
    cnf: {
      kid: `${options.holderDid}#dpop`,
    },
  };

  const header = {
    alg: 'EdDSA',
    typ: 'vc+sd-jwt',
    jwk: {
      kty: 'OKP',
      crv: 'Ed25519',
      x: Buffer.from(await getPublicKey(hexToBytes(options.privateKeyHex))).toString('base64url'),
    },
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await sign(new TextEncoder().encode(signingInput), hexToBytes(options.privateKeyHex));
  const encodedSignature = Buffer.from(signature).toString('base64url');

  return {
    token: `${signingInput}.${encodedSignature}`,
    disclosures: disclosures.map((entry) => entry.disclosure),
  };
}

export function generateDisclosures(
  claims: Record<string, unknown>,
  fieldsToReveal: string[],
): { redacted: Record<string, unknown>; disclosures: string[] } {
  const [redacted, disclosures] = createNestedDisclosures(claims, fieldsToReveal);
  return {
    redacted,
    disclosures: disclosures.map((entry) => entry.disclosure),
  };
}

type DisclosureEntry = {
  path: string;
  salt: string;
  disclosure: string;
};

function createNestedDisclosures(
  value: Record<string, unknown>,
  selective: string[] = [],
): [Record<string, unknown>, DisclosureEntry[]] {
  const disclosures: DisclosureEntry[] = [];
  const redacted: Record<string, unknown> = {};

  Object.entries(value)
    .filter(([, child]) => child !== undefined)
    .forEach(([key, child]) => {
      if (selective.length && !selective.includes(key)) {
        redacted[key] = child;
        return;
      }

      const salt = randomSalt();
      const disclosure = base64UrlEncode(JSON.stringify([salt, key, child]));
      redacted[key] = sha256Base64Url(disclosure);
      disclosures.push({ path: key, salt, disclosure });
    });

  return [redacted, disclosures];
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function hexToBytes(value: string): Uint8Array {
  const normalized = value.startsWith('0x') ? value.slice(2) : value;
  return Uint8Array.from(Buffer.from(normalized, 'hex'));
}

function sha256Base64Url(value: string): string {
  return CryptoJS.SHA256(value)
    .toString(CryptoJS.enc.Base64)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomSalt(): string {
  const bytes = edUtils.randomBytes(16);
  return Buffer.from(bytes).toString('base64url');
}

