import { generateKeyPair, exportJWK } from 'jose';

let _cache: { jwks: any; kid: string; ts: number } | null = null;

export function getCurrentJwks() {
  if (_cache) return _cache.jwks;
  return { keys: [] };
}

export async function rotateKeys() {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA');
  const kid = 'kid-' + Date.now();

  const pub = await exportJWK(publicKey);
  const priv = await exportJWK(privateKey);

  (pub as any).kid = kid;
  (pub as any).alg = 'EdDSA';
  (priv as any).kid = kid;
  (priv as any).alg = 'EdDSA';

  _cache = {
    jwks: { keys: [pub] },
    kid,
    ts: Date.now()
  };

  return {
    kid,
    publicJwk: pub,
    privateJwk: priv
  };
}
