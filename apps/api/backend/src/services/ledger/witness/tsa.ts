import { createHash, randomBytes } from 'crypto';

/**
 * RFC 3161 timestamp client — hand-rolled DER, zero dependencies.
 *
 * Scope is deliberately minimal: build a TimeStampReq over the SHA-256 of a
 * Merkle-root string, POST it to a TSA, and confirm the response status is
 * granted. The returned TimeStampResp (TSR) is stored opaque; full
 * cryptographic verification is performed off-platform with standard tooling:
 *
 *   openssl ts -verify -digest <sha256(root)> -in <token.tsr> -CAfile <tsa-ca.pem>
 *
 * Hand-rolling ~40 lines of DER is preferred over adding a dependency: the
 * Rust-pallet deletion (ADR: substrate anchoring) showed what unaudited
 * supply-chain surface costs, and the SCA gate is a required check.
 */

const SHA256_OID = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]);
const DER_NULL = Buffer.from([0x05, 0x00]);

function derLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  const bytes: number[] = [];
  let value = len;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derWrap(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

/**
 * TimeStampReq ::= SEQUENCE {
 *   version        INTEGER 1,
 *   messageImprint SEQUENCE { AlgorithmIdentifier(sha256), OCTET STRING },
 *   nonce          INTEGER OPTIONAL,
 *   certReq        BOOLEAN TRUE }
 */
export function buildTimestampRequest(sha256Digest: Buffer, nonce?: Buffer): Buffer {
  if (sha256Digest.length !== 32) {
    throw new Error('timestamp request requires a 32-byte SHA-256 digest');
  }
  const algorithmId = derWrap(0x30, Buffer.concat([SHA256_OID, DER_NULL]));
  const messageImprint = derWrap(0x30, Buffer.concat([algorithmId, derWrap(0x04, sha256Digest)]));
  const version = derWrap(0x02, Buffer.from([0x01]));
  let nonceBytes = nonce ?? randomBytes(8);
  if (nonceBytes[0] & 0x80) {
    // Keep the INTEGER positive: DER integers are signed, so a leading 1-bit
    // needs a zero pad byte.
    nonceBytes = Buffer.concat([Buffer.from([0x00]), nonceBytes]);
  }
  const nonceDer = derWrap(0x02, nonceBytes);
  const certReq = Buffer.from([0x01, 0x01, 0xff]);
  return derWrap(0x30, Buffer.concat([version, messageImprint, nonceDer, certReq]));
}

interface DerHeader {
  tag: number;
  length: number;
  contentStart: number;
}

function readDerHeader(der: Buffer, offset: number): DerHeader {
  if (offset + 2 > der.length) throw new Error('truncated DER');
  const tag = der[offset];
  const first = der[offset + 1];
  if ((first & 0x80) === 0) {
    return { tag, length: first, contentStart: offset + 2 };
  }
  const lengthBytes = first & 0x7f;
  if (lengthBytes === 0 || lengthBytes > 4 || offset + 2 + lengthBytes > der.length) {
    throw new Error('unsupported DER length');
  }
  let length = 0;
  for (let i = 0; i < lengthBytes; i += 1) {
    length = length * 256 + der[offset + 2 + i];
  }
  return { tag, length, contentStart: offset + 2 + lengthBytes };
}

/**
 * TimeStampResp ::= SEQUENCE { status PKIStatusInfo, timeStampToken OPTIONAL }
 * PKIStatusInfo ::= SEQUENCE { status INTEGER, ... }
 *
 * Returns the PKIStatus integer. 0 = granted, 1 = grantedWithMods.
 */
export function parseTimestampResponseStatus(der: Buffer): number {
  const outer = readDerHeader(der, 0);
  if (outer.tag !== 0x30) throw new Error('timestamp response is not a SEQUENCE');
  const statusInfo = readDerHeader(der, outer.contentStart);
  if (statusInfo.tag !== 0x30) throw new Error('missing PKIStatusInfo');
  const statusInt = readDerHeader(der, statusInfo.contentStart);
  if (statusInt.tag !== 0x02) throw new Error('missing PKIStatus INTEGER');
  let status = 0;
  for (let i = 0; i < statusInt.length; i += 1) {
    status = status * 256 + der[statusInt.contentStart + i];
  }
  return status;
}

export const TSA_GRANTED_STATUSES = new Set([0, 1]);

/**
 * The witnessed artifact is the UTF-8 bytes of the lowercase hex root string.
 * This convention is shared with the Rekor leg and the verification docs.
 */
export function rootDigest(rootHex: string): Buffer {
  return createHash('sha256').update(Buffer.from(rootHex, 'utf8')).digest();
}

export async function obtainTimestampToken(
  tsaUrl: string,
  rootHex: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer> {
  const tsq = buildTimestampRequest(rootDigest(rootHex));
  const response = await fetchImpl(tsaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/timestamp-query' },
    body: new Uint8Array(tsq),
  });
  if (!response.ok) {
    throw new Error(`tsa_http_${response.status}`);
  }
  const tsr = Buffer.from(await response.arrayBuffer());
  const status = parseTimestampResponseStatus(tsr);
  if (!TSA_GRANTED_STATUSES.has(status)) {
    throw new Error(`tsa_status_${status}`);
  }
  return tsr;
}
