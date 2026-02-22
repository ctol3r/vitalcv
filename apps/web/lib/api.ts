const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function apiRoute(path: string) {
    if (DEMO_MODE) {
          if (path.startsWith('/ingest/npi')) return `${API_BASE}/demo/issue`;
          if (path.startsWith('/trust-state')) return `${API_BASE}/demo/status`;
    }
    return `${API_BASE}${path}`;
}
