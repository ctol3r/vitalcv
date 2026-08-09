import { createHash, createPrivateKey, createPublicKey, sign as cryptoSign, KeyObject } from 'crypto';

/**
 * Rekor transparency-log client (hashedrekord), zero dependencies.
 *
 * The witnessed artifact is the UTF-8 bytes of the lowercase hex Merkle-root
 * string, signed with a dedicated ES256 (P-256) witness key. This key is
 * deliberately NOT the receipt-signing key: witnessing is a separate duty,
 * and rotating either key must not entangle the other.
 *
 * The public key travels inside the Rekor entry, so any third party can
 * verify the signature and the log inclusion without asking VitalCV anything.
 */

export interface RekorWitness {
  uuid: string;
  logIndex: string | null;
}

export function loadWitnessSigningKey(
  pem: string | undefined = process.env.ANCHOR_WITNESS_SIGNING_KEY,
): KeyObject | null {
  const trimmed = pem?.trim();
  if (!trimmed) return null;
  return createPrivateKey(trimmed);
}

export function witnessPublicKeyPem(privateKey: KeyObject): string {
  return createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
}

export function buildHashedRekordBody(rootHex: string, privateKey: KeyObject): Record<string, unknown> {
  const artifact = Buffer.from(rootHex, 'utf8');
  const signature = cryptoSign('sha256', artifact, privateKey);
  const publicKeyPem = witnessPublicKeyPem(privateKey);
  return {
    apiVersion: '0.0.1',
    kind: 'hashedrekord',
    spec: {
      data: {
        hash: {
          algorithm: 'sha256',
          value: createHash('sha256').update(artifact).digest('hex'),
        },
      },
      signature: {
        content: signature.toString('base64'),
        publicKey: { content: Buffer.from(publicKeyPem, 'utf8').toString('base64') },
      },
    },
  };
}

export async function submitRootToRekor(
  rekorBaseUrl: string,
  rootHex: string,
  privateKey: KeyObject,
  fetchImpl: typeof fetch = fetch,
): Promise<RekorWitness> {
  const body = buildHashedRekordBody(rootHex, privateKey);
  const response = await fetchImpl(`${rekorBaseUrl.replace(/\/$/, '')}/api/v1/log/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });

  if (response.status === 409) {
    // Already witnessed (identical entry). Rekor points at the existing entry.
    const location = response.headers.get('location') ?? '';
    const uuid = location.split('/').filter(Boolean).pop() ?? '';
    if (!uuid) throw new Error('rekor_conflict_without_location');
    return { uuid, logIndex: null };
  }

  if (!response.ok) {
    throw new Error(`rekor_http_${response.status}`);
  }

  const payload = (await response.json()) as Record<string, { logIndex?: number }>;
  const uuid = Object.keys(payload)[0];
  if (!uuid) throw new Error('rekor_empty_response');
  const logIndex = payload[uuid]?.logIndex;
  return { uuid, logIndex: logIndex != null ? String(logIndex) : null };
}
