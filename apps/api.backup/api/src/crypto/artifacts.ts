import { SignJWT, jwtVerify, importJWK } from 'jose';

const priv = async () => ({
  kty: 'OKP',
  crv: 'Ed25519',
  d: process.env.ARTIFACT_SIGNING_D || 'devDevDevDevDevDevDevDevDevDevDevDevDev',
  x: process.env.ARTIFACT_SIGNING_X || 'devPubX'
} as any);

export async function signArtifact(payload: any) {
  const key = await importJWK(await priv(), 'EdDSA');
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .sign(key);
}

export async function verifyArtifact(jws: string, jwk: any) {
  const key = await importJWK(jwk, 'EdDSA');
  return jwtVerify(jws, key);
}

