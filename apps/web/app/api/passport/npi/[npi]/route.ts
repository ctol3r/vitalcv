import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as B } from '@/lib/backend-url';
import { assertPassportData } from '@/lib/trust/passport-contract';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, context: { params: Promise<{ npi: string }> }) {
  const { npi } = await context.params;
  try {
    const res = await fetch(`${B}/api/passport/npi/${npi}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
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
    return NextResponse.json(
      {
        error: error instanceof Error && error.message.startsWith('Invalid passport payload')
          ? 'invalid_upstream_payload'
          : 'Passport unavailable',
        detail: String(error),
      },
      { status: error instanceof Error && error.message.startsWith('Invalid passport payload') ? 502 : 503 },
    );
  }
}
