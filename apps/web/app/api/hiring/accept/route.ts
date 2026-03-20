import { type NextRequest, NextResponse } from 'next/server';
import {
  buildForwardHeaders,
  requireAuthenticatedOrgContext,
  resolveIntelligenceAuthContext,
} from '@/app/api/intelligence/_shared';
import {
  getServerApiKey,
  MARKETPLACE_BACKEND,
} from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const authContext = await resolveIntelligenceAuthContext();
  const blocked = requireAuthenticatedOrgContext(req, authContext);
  if (blocked) {
    return NextResponse.json(blocked.payload, { status: blocked.status });
  }

  const apiKey = getServerApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'Server API key unavailable' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as {
    clinicianNpi?: string;
    artifactId?: string;
  };

  const headers = await buildForwardHeaders({
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  }, { context: authContext });

  const response = await fetch(`${MARKETPLACE_BACKEND}/api/hiring/accept`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      clinicianNpi: body.clinicianNpi,
      artifactId: body.artifactId,
      employerId: authContext.orgId,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
}
