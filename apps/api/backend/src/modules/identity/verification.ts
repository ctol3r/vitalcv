import type { JWTPayload } from 'jose';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const ALGORITHM = 'ES256';
const ISSUER = 'vitalcv';
const DEFAULT_JWKS_PATH = '/identity/.well-known/jwks.json';
const DEFAULT_JWKS_BASE_URL = 'http://localhost:3000';

function getJwksUrl(): URL {
  const explicitUrl = process.env.IDENTITY_JWKS_URL ?? process.env.VCV_IDENTITY_JWKS_URL;
  if (explicitUrl) {
    return new URL(explicitUrl);
  }

  const baseUrl =
    process.env.IDENTITY_API_BASE_URL?.trim() ?? DEFAULT_JWKS_BASE_URL;
  return new URL(DEFAULT_JWKS_PATH, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
}

function createJwksClient() {
  return createRemoteJWKSet(getJwksUrl());
}

/**
 * Verify a signed identity artifact JWT and return the decoded payload.
 *
 * Verification is fixed to ES256 only; algorithm selection is not user-configurable.
 */
export async function verifyArtifactSignature(jwt: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(jwt, createJwksClient(), {
    algorithms: [ALGORITHM],
    issuer: ISSUER,
  });

  return payload;
}
