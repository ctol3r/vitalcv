import fetch from 'node-fetch';
import { createRemoteJWKSet, JWTPayload, jwtVerify } from 'jose';

type MetadataCacheEntry = {
  metadata: OidcMetadata;
  expiresAt: number;
};

const metadataCache = new Map<string, MetadataCacheEntry>();
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const METADATA_TTL_MS = Number(process.env.SSO_METADATA_TTL_MS || 10 * 60 * 1000);

export interface OidcMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri: string;
}

export async function getOidcMetadata(issuer: string): Promise<OidcMetadata> {
  const normalizedIssuer = issuer.replace(/\/+$/, '');
  const cached = metadataCache.get(normalizedIssuer);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.metadata;
  }

  const response = await fetch(`${normalizedIssuer}/.well-known/openid-configuration`);
  if (!response.ok) {
    throw new Error(`Failed to load OIDC metadata (${response.status})`);
  }
  const metadata = (await response.json()) as OidcMetadata;

  if (!metadata.authorization_endpoint || !metadata.token_endpoint || !metadata.jwks_uri) {
    throw new Error('OIDC metadata missing required endpoints');
  }

  metadataCache.set(normalizedIssuer, {
    metadata,
    expiresAt: Date.now() + METADATA_TTL_MS,
  });

  return metadata;
}

export interface TokenExchangeInput {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEndpoint: string;
}

export interface TokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in?: number;
}

export async function exchangeCodeForTokens(input: TokenExchangeInput): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
  });

  const response = await fetch(input.tokenEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token endpoint error (${response.status}): ${text}`);
  }

  const tokenResponse = (await response.json()) as TokenResponse;

  if (!tokenResponse.id_token || !tokenResponse.access_token) {
    throw new Error('Token endpoint response missing id_token or access_token');
  }

  return tokenResponse;
}

export async function fetchUserInfo(
  endpoint: string | undefined,
  accessToken: string
): Promise<Record<string, unknown>> {
  if (!endpoint) {
    return {};
  }

  const response = await fetch(endpoint, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`UserInfo endpoint error (${response.status})`);
  }

  return (await response.json()) as Record<string, unknown>;
}

export interface VerifyIdTokenInput {
  idToken: string;
  issuer: string;
  audience: string;
  jwksUri: string;
  nonce?: string;
}

export async function verifyIdToken(input: VerifyIdTokenInput): Promise<JWTPayload> {
  let jwks = jwksCache.get(input.jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(input.jwksUri));
    jwksCache.set(input.jwksUri, jwks);
  }

  const { payload } = await jwtVerify(input.idToken, jwks, {
    issuer: input.issuer,
    audience: input.audience,
  });

  if (input.nonce && payload.nonce !== input.nonce) {
    throw new Error('ID token nonce mismatch');
  }

  return payload;
}
