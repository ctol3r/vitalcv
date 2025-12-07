import { createHash, randomBytes, randomUUID } from 'crypto';
import { calculateJwkThumbprint, importJWK, type JWK, SignJWT } from 'jose';
import type { HolderDisclosure } from '@chai-vc/vc-formats-csdjwt';

export interface PresentationRequestOptions {
  csdJwt: string;
  disclosures: HolderDisclosure[];
  revealGroups: string[];
  verifierEndpoint: string;
  method?: string;
  dpopKey: JWK;
}

export interface WalletPresentationPayload {
  csdJwt: string;
  disclosures: Array<Pick<HolderDisclosure, 'groupId' | 'path' | 'salt' | 'value'>>;
  revealGroups: string[];
  proof: {
    nonce: string;
    binding: string;
    dpop: {
      proof: string;
      jkt: string;
    };
  };
}

export async function requestCredentialPresentation(
  options: PresentationRequestOptions,
): Promise<WalletPresentationPayload> {
  const method = (options.method ?? 'POST').toUpperCase();
  const revealSet = new Set(options.revealGroups);

  const selected = options.disclosures.filter(
    (entry) => entry.required || revealSet.has(entry.groupId),
  );

  const missing = options.revealGroups.filter(
    (groupId) => !selected.some((entry) => entry.groupId === groupId),
  );

  if (missing.length) {
    throw new Error(`Disclosures for groups ${missing.join(', ')} are not available`);
  }

  const nonce = randomBytes(16).toString('base64url');
  const { proof, jkt, binding } = await buildDpopProof({
    dpopKey: options.dpopKey,
    method,
    endpoint: options.verifierEndpoint,
    nonce,
  });

  return {
    csdJwt: options.csdJwt,
    disclosures: selected.map(({ groupId, path, salt, value }) => ({
      groupId,
      path,
      salt,
      value,
    })),
    revealGroups: Array.from(revealSet),
    proof: {
      nonce,
      binding,
      dpop: { proof, jkt },
    },
  };
}

async function buildDpopProof(options: {
  dpopKey: JWK;
  method: string;
  endpoint: string;
  nonce: string;
}): Promise<{ proof: string; jkt: string; binding: string }> {
  const alg = options.dpopKey.alg ?? 'ES256';
  const signer = await importJWK(options.dpopKey, alg);
  const { d, ...publicJwk } = options.dpopKey;
  const jkt = await calculateJwkThumbprint(publicJwk as JWK);
  const binding = createHash('sha256').update(`${options.nonce}.${jkt}`).digest('base64url');

  const jws = await new SignJWT({
    htm: options.method,
    htu: options.endpoint,
    nonce: binding,
    jti: randomUUID(),
  })
    .setProtectedHeader({
      alg,
      typ: 'dpop+jwt',
      jwk: publicJwk,
    })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(signer);

  return { proof: jws, jkt, binding };
}


