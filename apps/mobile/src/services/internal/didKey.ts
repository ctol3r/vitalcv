import { base64url, type JWK } from 'jose';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const P256_PUBLIC_KEY_MULTICODEC = 0x1200;

function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  let remaining = value;

  while (remaining >= 0x80) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining >>= 7;
  }

  bytes.push(remaining);

  return Uint8Array.from(bytes);
}

function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return '';
  }

  const digits = [0];

  for (const byte of bytes) {
    let carry = byte;

    for (let index = 0; index < digits.length; index += 1) {
      carry += digits[index] << 8;
      digits[index] = carry % 58;
      carry = Math.floor(carry / 58);
    }

    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let prefix = '';
  for (const byte of bytes) {
    if (byte !== 0) {
      break;
    }
    prefix += BASE58_ALPHABET[0];
  }

  return `${prefix}${digits
    .reverse()
    .map((digit) => BASE58_ALPHABET[digit])
    .join('')}`;
}

export function publicJwkToDidKey(publicKeyJwk: JWK): string {
  if (publicKeyJwk.kty !== 'EC' || publicKeyJwk.crv !== 'P-256' || !publicKeyJwk.x || !publicKeyJwk.y) {
    throw new Error('Only P-256 public JWKs can be converted to did:key');
  }

  const x = base64url.decode(publicKeyJwk.x);
  const y = base64url.decode(publicKeyJwk.y);

  if (x.length !== 32 || y.length !== 32) {
    throw new Error('Unexpected P-256 public key length');
  }

  const compressedPoint = new Uint8Array(33);
  compressedPoint[0] = (y[y.length - 1] & 1) === 0 ? 0x02 : 0x03;
  compressedPoint.set(x, 1);

  const prefix = encodeVarint(P256_PUBLIC_KEY_MULTICODEC);
  const fingerprint = new Uint8Array(prefix.length + compressedPoint.length);
  fingerprint.set(prefix);
  fingerprint.set(compressedPoint, prefix.length);

  return `did:key:z${encodeBase58(fingerprint)}`;
}

export function didKeyToVerificationMethod(did: string): string {
  const fingerprint = did.replace(/^did:key:/, '');
  return `${did}#${fingerprint}`;
}
