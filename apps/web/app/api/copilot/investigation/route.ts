import { type NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';
import {
  buildForwardHeaders,
  decorateAuthFailurePayload,
  logIntelligenceFallbackUsage,
  requireAuthenticatedOrgContext,
  resolveIntelligenceAuthContext,
} from '../../intelligence/_shared';

export const runtime = 'nodejs';

const BACKEND = getBackendBase();

export async function POST(req: NextRequest) {
  const authContext = await resolveIntelligenceAuthContext();
  const blocked = requireAuthenticatedOrgContext(req, authContext);
  if (blocked) {
    return NextResponse.json(blocked.payload, { status: blocked.status });
  }

  const body = await req.text();
  const headers = await buildForwardHeaders({
    'Content-Type': 'application/json',
  }, { context: authContext });

  try {
    const response = await fetch(`${BACKEND}/api/copilot/investigation`, {
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
        error: 'copilot_source_unavailable',
        error_description: 'Copilot investigation planning is currently unavailable.',
      },
      { status: 503 },
    );
  }
}
