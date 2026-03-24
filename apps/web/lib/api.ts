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

const DEMO_PATHS: Record<
  Extract<ApiPath, '/trust-state' | '/ingest/npi'>,
  string
> = {
  '/trust-state': '/demo/status',
  '/ingest/npi': '/demo/issue',
};

function normalizeApiBase(base: string): string {
  if (!base) return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function stripProtocol(value: string): string {
  return value.replace(/^https?:\/\//, '');
}

function isDemoPath(p: string): p is keyof typeof DEMO_PATHS {
  return p in DEMO_PATHS;
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

/** Backend base URL with localhost:4000 fallback — safe for server-side proxy routes. */
export function getBackendBase(): string {
  return getApiBase() || 'http://localhost:4000';
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

export type { ApiPath };
