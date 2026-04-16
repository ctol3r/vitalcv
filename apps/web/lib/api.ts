import {
  normalizePassportData,
} from '@/lib/trust/passport-contract';
import {
  normalizeEmployerAcceptanceHistoryResponse,
  normalizeEmployerReviewStatusResponse,
} from '@/lib/employer-review-actions';

type ApiPath =
  | '/trust-state'
  | '/ingest/npi'
  | '/ingest/files'
  | '/verification/run'
  | '/acceptances'
  | '/starts'
  | '/verify'
  | '/compliance/emergency/declare'
  | '/compliance/emergency/status'
  | '/api/pilot/activate'
  | '/metrics/public';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
export const DEFAULT_PUBLIC_API_BASE = 'https://api.vitalcv.com';
const DEFAULT_FETCH_TIMEOUT_MS = 8000;

const DEMO_PATHS: Record<
  Extract<ApiPath, '/trust-state' | '/ingest/npi'>,
  string
> = {
  '/trust-state': '/demo/status',
  '/ingest/npi': '/demo/issue',
};

function normalizeApiBase(base: string): string {
  if (!base) return '';
  const trimmed = base.replace(/[\r\n]/g, '').trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function stripProtocol(value: string): string {
  return value.replace(/^https?:\/\//, '');
}

function isDemoPath(p: string): p is keyof typeof DEMO_PATHS {
  return p in DEMO_PATHS;
}

function describeApiError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logApiError(message: string, details: Record<string, unknown>): void {
  console.error(`[lib/api] ${message}`, details);
}

/** Single source of truth for API base URL (empty string if no env var set). */
export function getApiBase(): string {
  const raw =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';
  return normalizeApiBase(raw);
}

/** Backend base URL with Railway fallback on Vercel — safe for server-side proxy routes. */
export function getBackendBase(): string {
  const base = getApiBase();
  if (base) return base;
  // Match the shared resolver: fall back to Railway on Vercel, localhost otherwise
  return process.env.VERCEL
    ? 'https://api.vitalcv.com'
    : 'http://localhost:4000';
}

/** Public-facing API base URL for docs and preview surfaces. */
export function getPublicApiBase(): string {
  return getApiBase() || DEFAULT_PUBLIC_API_BASE;
}

/** Human-readable host label for docs and developer stats. */
export function getPublicApiHostLabel(): string {
  const base = getPublicApiBase();

  try {
    return new URL(base).host;
  } catch {
    return stripProtocol(base);
  }
}

/** Build a full API URL for any path (not limited to ApiPath type). */
export function apiUrl(path: string): string {
  const base = getApiBase();
  return base ? `${base}${path}` : path;
}

export function apiRoute(path: ApiPath): string {
  const resolvedPath = DEMO_MODE && isDemoPath(path) ? DEMO_PATHS[path] : path;
  const base = getApiBase();
  return base ? `${base}${resolvedPath}` : resolvedPath;
}

async function readJsonBody<T>(response: Response, context: string): Promise<T | null> {
  try {
    return await response.json() as T;
  } catch (error) {
    logApiError('Failed to parse JSON response', {
      context,
      url: response.url,
      status: response.status,
      error: describeApiError(error),
    });
    return null;
  }
}

export function buildPublicIngestStreamUrl(runId: string): string {
  return `/api/ingest/stream/${encodeURIComponent(runId)}`;
}

export async function startPublicIngest(npi: string): Promise<{
  ok: boolean;
  status: number;
  body: Record<string, unknown> | null;
}> {
  try {
    const response = await fetch(`/api/ingest/${encodeURIComponent(npi)}`, {
      method: 'POST',
      signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
    });

    return {
      ok: response.ok,
      status: response.status,
      body: await readJsonBody<Record<string, unknown>>(response, 'startPublicIngest'),
    };
  } catch (error) {
    logApiError('Public ingest request failed', {
      npi,
      error: describeApiError(error),
    });
    return {
      ok: false,
      status: 0,
      body: null,
    };
  }
}

export async function fetchPassportEntity(
  entityId: string,
): Promise<{
  ok: boolean;
  status: number;
  body: import('@/lib/trust/passport-contract').PassportData | null;
}> {
  // NPI (10 digits) → /api/passport/npi/{npi} which returns full PassportData.
  // UUID → /api/passport/entity/{id} for entity-based lookups.
  const isNpi = /^\d{10}$/.test(entityId);
  const url = isNpi
    ? `/api/passport/npi/${encodeURIComponent(entityId)}`
    : `/api/passport/entity/${encodeURIComponent(entityId)}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
    });
    const payload = normalizePassportData(await readJsonBody<unknown>(response, 'fetchPassportEntity'));

    if (response.ok && payload === null) {
      logApiError('Passport entity payload failed normalization', {
        entityId,
        url,
        status: response.status,
      });
    }

    return {
      ok: response.ok && payload !== null,
      status: response.status,
      body: payload,
    };
  } catch (error) {
    logApiError('Passport entity request failed', {
      entityId,
      url,
      error: describeApiError(error),
    });
    return {
      ok: false,
      status: 0,
      body: null,
    };
  }
}

export async function fetchReviewAcceptanceHistory(
  entityId: string,
): Promise<{
  ok: boolean;
  status: number;
  body: import('@/lib/employer-review-actions').EmployerAcceptanceHistoryResponse | null;
}> {
  try {
    const response = await fetch(
      `/api/employer-review/${encodeURIComponent(entityId)}/acceptance-history`,
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
      },
    );
    const payload = normalizeEmployerAcceptanceHistoryResponse(
      await readJsonBody<unknown>(response, 'fetchReviewAcceptanceHistory'),
    );

    if (response.ok && payload === null) {
      logApiError('Acceptance history payload failed normalization', {
        entityId,
        status: response.status,
      });
    }

    return {
      ok: response.ok && payload !== null,
      status: response.status,
      body: payload,
    };
  } catch (error) {
    logApiError('Acceptance history request failed', {
      entityId,
      error: describeApiError(error),
    });
    return {
      ok: false,
      status: 0,
      body: null,
    };
  }
}

export async function fetchEmployerReviewStatus(
  entityId: string,
  scope?: {
    contextId?: string;
    bundleId?: string;
  },
): Promise<{
  ok: boolean;
  status: number;
  body: import('@/lib/employer-review-actions').EmployerReviewStatusResponse | null;
}> {
  const params = new URLSearchParams();
  if (scope?.contextId) {
    params.set('organizationContextId', scope.contextId);
  }
  if (scope?.bundleId) {
    params.set('bundleId', scope.bundleId);
  }

  const query = params.toString();
  try {
    const response = await fetch(
      `/api/employer-review/${encodeURIComponent(entityId)}/status${query ? `?${query}` : ''}`,
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
      },
    );
    const payload = normalizeEmployerReviewStatusResponse(
      await readJsonBody<unknown>(response, 'fetchEmployerReviewStatus'),
    );

    if (response.ok && payload === null) {
      logApiError('Employer review status payload failed normalization', {
        entityId,
        status: response.status,
        query,
      });
    }

    return {
      ok: response.ok && payload !== null,
      status: response.status,
      body: payload,
    };
  } catch (error) {
    logApiError('Employer review status request failed', {
      entityId,
      query,
      error: describeApiError(error),
    });
    return {
      ok: false,
      status: 0,
      body: null,
    };
  }
}

export async function fireEmployerReviewOpened(
  entityId: string,
  payload: {
    organizationContextId?: string | null;
    bundleId?: string | null;
    readinessScore?: number | null;
    blockers?: string[];
  },
): Promise<Response> {
  return fetch(`/api/employer-review/${encodeURIComponent(entityId)}/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationContextId: payload.organizationContextId ?? null,
      bundleId: payload.bundleId ?? null,
      readinessScore: payload.readinessScore ?? null,
      blockers: payload.blockers ?? [],
    }),
  });
}

export type { ApiPath };
