import type { Request } from 'express';

type JsonRecord = Record<string, unknown>;

const DEFAULT_ISSUER_API_URL = 'http://localhost:4001/oidc4vci';

function resolveIssuerApiBaseUrl(): string {
  const raw = String(
    process.env.ISSUER_API_URL || process.env.OIDC4VCI_ISSUER_URL || DEFAULT_ISSUER_API_URL,
  ).trim();
  if (!raw) return DEFAULT_ISSUER_API_URL;
  const trimmed = raw.replace(/\/+$/, '');
  return trimmed.endsWith('/oidc4vci') ? trimmed : `${trimmed}/oidc4vci`;
}

const ISSUER_API_BASE_URL = resolveIssuerApiBaseUrl();

function headerValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    const joined = value.filter(Boolean).join(',');
    return joined || undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function buildForwardHeaders(req: Request, includeContentType: boolean): Record<string, string> {
  const headers: Record<string, string> = {};

  if (includeContentType) {
    headers['content-type'] = headerValue(req.headers['content-type']) || 'application/json';
  }

  const authorization = headerValue(req.headers.authorization);
  if (authorization) headers.authorization = authorization;

  const dpop = headerValue(req.headers.dpop);
  if (dpop) headers.dpop = dpop;

  const signature = headerValue(req.headers['x-signature']);
  if (signature) headers['x-signature'] = signature;

  const requestId = headerValue(req.headers['x-request-id']);
  if (requestId) headers['x-request-id'] = requestId;

  const sinkId = headerValue(req.headers['x-sink-id']) || 'svc.issuer-api';
  headers['x-sink-id'] = sinkId;

  const allowedSinks = headerValue(req.headers['x-allowed-sinks']) || sinkId;
  headers['x-allowed-sinks'] = allowedSinks;

  return headers;
}

async function forwardRequest(
  req: Request,
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<JsonRecord> {
  const url = `${ISSUER_API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = buildForwardHeaders(req, init.method !== 'GET');
  const response = await fetch(url, {
    method: init.method,
    headers,
    body: init.method === 'GET' ? undefined : JSON.stringify(init.body ?? {}),
  });

  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as JsonRecord;
  } catch {
    return { raw: text };
  }
}

function resolveTransactionId(req: Request): string | null {
  const candidate = (req.query?.transaction_id ?? req.query?.transactionId) as
    | string
    | string[]
    | undefined;
  if (Array.isArray(candidate)) {
    const [first] = candidate;
    return first ? first.trim() : null;
  }
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

export async function issueOidcCredential(req: Request): Promise<JsonRecord> {
  return forwardRequest(req, '/credential', { method: 'POST', body: req.body ?? {} });
}

export async function issueNonce(req: Request): Promise<JsonRecord> {
  return forwardRequest(req, '/nonce', { method: 'POST', body: req.body ?? {} });
}

export async function pollDeferredCredential(req: Request): Promise<JsonRecord> {
  const transactionId = resolveTransactionId(req);
  if (transactionId) {
    return forwardRequest(req, `/deferred/${encodeURIComponent(transactionId)}/status`, {
      method: 'GET',
    });
  }
  return forwardRequest(req, '/deferred', { method: 'POST', body: req.body ?? {} });
}
