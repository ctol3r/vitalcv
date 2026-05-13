import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as B } from '@/lib/backend-url';
import { assertPassportData } from '@/lib/trust/passport-contract';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
export const runtime = 'nodejs';

/**
 * Proxy for passport lookups by entity ID (UUID) or NPI.
 * NPI → backend /api/passport/npi/:npi (returns canonical PassportData).
 * UUID → backend /api/passport/entity/:id.
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const isNpi = /^\d{10}$/.test(id);

  const upstream = isNpi
    ? `${B}/api/passport/npi/${id}`
    : `${B}/api/passport/entity/${id}`;

  try {
    const res = await fetchWithRetry(upstream, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': 'vcv-system',
      },
    });
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const error = typeof (payload as { error?: unknown } | null)?.error === 'string'
        ? (payload as { error: string }).error
        : 'Passport unavailable';
      const detail = typeof (payload as { detail?: unknown } | null)?.detail === 'string'
        ? (payload as { detail: string }).detail
        : `Passport upstream returned ${res.status}.`;
      return NextResponse.json({ error, detail }, { status: res.status });
    }

    return NextResponse.json(assertPassportData(payload), { status: res.status });
  } catch (error) {
    const isNetworkError = error instanceof TypeError && (error as TypeError).message.includes('fetch failed');
    console.error('[passport-entity-proxy]', { id, upstream, isNetworkError, error: String(error) });
    return NextResponse.json(
      {
        error: isNetworkError
          ? 'upstream_unreachable'
          : error instanceof Error && error.message.startsWith('Invalid passport payload')
            ? 'invalid_upstream_payload'
            : 'Passport unavailable',
        detail: isNetworkError
          ? `Backend at ${B} is unreachable. Ensure BACKEND_URL is set and the API server is running.`
          : String(error),
        upstream: B,
      },
      { status: error instanceof Error && error.message.startsWith('Invalid passport payload') ? 502 : 503 },
    );
  }
}
