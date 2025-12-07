import { emitMetric } from '@vitalcv/metrics-core';

const PACKAGE_NAME = 'oidc-utils';

export interface TokenIntrospectionResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  aud?: string | string[];
  iss?: string;
  jti?: string;
  error?: string;
  [claim: string]: unknown;
}

export interface TokenIntrospectionOptions {
  endpoint: string;
  clientId?: string;
  clientSecret?: string;
  tokenTypeHint?: string;
  dpopProof?: string;
  fetchFn?: typeof fetch;
  headers?: Record<string, string>;
}

function getFetchImplementation(options: TokenIntrospectionOptions): typeof fetch {
  if (options.fetchFn) {
    return options.fetchFn;
  }
  if (typeof fetch === 'function') {
    return fetch;
  }
  throw new Error('No fetch implementation available for token introspection');
}

export async function introspectToken(
  token: string,
  options: TokenIntrospectionOptions
): Promise<TokenIntrospectionResponse> {
  if (!token) {
    throw new Error('Token is required for introspection');
  }

  const fetchImpl = getFetchImplementation(options);
  const params = new URLSearchParams();
  params.set('token', token);

  if (options.tokenTypeHint) {
    params.set('token_type_hint', options.tokenTypeHint);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    ...(options.headers || {}),
  };

  if (options.clientId && options.clientSecret) {
    const basic = Buffer.from(`${options.clientId}:${options.clientSecret}`).toString('base64');
    headers.Authorization = `Basic ${basic}`;
  } else if (options.clientId) {
    params.set('client_id', options.clientId);
  }

  if (options.dpopProof) {
    headers.DPoP = options.dpopProof;
  }

  const metricLabels = {
    package: PACKAGE_NAME,
    operation: 'token.introspect',
    endpoint: options.endpoint,
  };

  const start = Date.now();
  try {
    const response = await fetchImpl(options.endpoint, {
      method: 'POST',
      headers,
      body: params.toString(),
    });
    const durationMs = Date.now() - start;

    if (!response.ok) {
      await emitMetric('oidc.token.introspect', {
        ...metricLabels,
        status: 'error',
        httpStatus: response.status,
        durationMs,
      });
      return {
        active: false,
        error: `Introspection call failed with status ${response.status}`,
      };
    }

    const payload = (await response.json()) as TokenIntrospectionResponse;
    await emitMetric('oidc.token.introspect', {
      ...metricLabels,
      status: payload.active ? 'active' : 'inactive',
      httpStatus: response.status,
      durationMs,
    });
    return payload;
  } catch (error) {
    const durationMs = Date.now() - start;
    await emitMetric('oidc.token.introspect', {
      ...metricLabels,
      status: 'error',
      durationMs,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return {
      active: false,
      error: error instanceof Error ? error.message : 'unknown error',
    };
  }
}

