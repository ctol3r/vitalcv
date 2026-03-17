import { type NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';
import {
  buildForwardHeaders,
  decorateAuthFailurePayload,
  logIntelligenceFallbackUsage,
  requireAuthenticatedOrgContext,
  resolveIntelligenceAuthContext,
} from '../../../intelligence/_shared';

export const runtime = 'nodejs';

const BACKEND = getBackendBase();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  const authContext = await resolveIntelligenceAuthContext();
  const blocked = requireAuthenticatedOrgContext(req, authContext);
  if (blocked) {
    return NextResponse.json(blocked.payload, { status: blocked.status });
  }

  const { npi } = await params;
  const body = await req.text();
  const headers = await buildForwardHeaders({
    'Content-Type': 'application/json',
  }, { context: authContext });
  const query = req.nextUrl.searchParams.toString();
  const path = `${BACKEND}/api/investigation/network/${encodeURIComponent(npi)}${query ? `?${query}` : ''}`;

  try {
    const response = await fetch(path, {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    const payload = decorateAuthFailurePayload(await response.json().catch(() => ({})), response.status);
    return NextResponse.json(payload, { status: response.status });
  } catch {
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(
      {
        error: 'investigation_source_unavailable',
        error_description: 'Network investigation is currently unavailable.',
      },
      { status: 503 },
    );
  }
}
