import { JWK } from 'jose';

const DEFAULT_PUBLIC_JWK: JWK = {
  crv: 'Ed25519',
  kty: 'OKP',
  x: 'P0Q-BmhysK7nM1Lw0Eh69JhK2h2foQSqKFEgLL1uLKA',
};

const DEFAULT_PRIVATE_JWK: JWK = {
  crv: 'Ed25519',
  kty: 'OKP',
  x: 'P0Q-BmhysK7nM1Lw0Eh69JhK2h2foQSqKFEgLL1uLKA',
  d: 'RbC0j_3gHJ3FIDon6WxO0x2QxJ9B8OD21XMZ76e0ay8',
};

function parseJwkEnv(raw: string | undefined): JWK | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw) as JWK;
  return parsed;
}

export function getIssuerDid(): string {
  return process.env.VC_ISSUER_DID || 'did:key:dev-issuer';
}

export function getIssuerPrivateJwk(): JWK {
  return parseJwkEnv(process.env.VC_ISSUER_PRIVATE_JWK) || DEFAULT_PRIVATE_JWK;
}

export function getIssuerPublicJwk(): JWK {
  return parseJwkEnv(process.env.VC_ISSUER_PUBLIC_JWK) || DEFAULT_PUBLIC_JWK;
}
