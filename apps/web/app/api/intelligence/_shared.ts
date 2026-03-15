import { getApiBase } from '@/lib/api';
import { auth } from '@clerk/nextjs/server';

const FALLBACK_BACKEND = 'http://localhost:4000';

function backendBase(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    getApiBase() ||
    process.env.NEXT_PUBLIC_API_URL ||
    FALLBACK_BACKEND
  );
}

export async function buildForwardHeaders() {
  const session = await auth();
  const headers = new Headers({
    Accept: 'application/json',
  });

  if (session.userId) {
    headers.set('x-clerk-user-id', session.userId);
  }

  const claims = session.sessionClaims as Record<string, unknown> | undefined;
  const email = typeof claims?.email === 'string' ? claims.email : null;
  const role = typeof claims?.role === 'string'
    ? claims.role
    : typeof claims?.org_role === 'string'
      ? claims.org_role
      : null;
  const orgId = typeof (session as { orgId?: unknown }).orgId === 'string'
    ? (session as { orgId: string }).orgId
    : null;

  if (email) {
    headers.set('x-clerk-user-email', email);
  }

  if (role) {
    headers.set('x-clerk-user-role', role);
  }

  if (orgId) {
    headers.set('x-org-id', orgId);
  }

  return headers;
}

export async function fetchBackendJson<T>(
  path: string,
  searchParams?: URLSearchParams,
  timeoutMs = 12_000,
) {
  const headers = await buildForwardHeaders();
  const url = `${backendBase()}${path}${searchParams && searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await fetch(url, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });

  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    payload: payload as T,
  };
}

export function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}
