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
import { recordHiringOutcome } from '@/lib/agent/outcomes/record-outcome';

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

  const headers = await buildForwardHeaders({
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  }, { context: authContext });

  const bodyText = await req.text();
  const response = await fetch(`${MARKETPLACE_BACKEND}/api/hiring/start`, {
    method: 'POST',
    headers,
    body: bodyText,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  if (response.ok) {
    // L3 outcome join — `start` is the north-star terminal: time-to-qualified-
    // start becomes measurable as (first AgentRun.createdAt -> this event).
    let parsed: { clinicianNpi?: unknown; artifactId?: unknown } = {};
    try {
      parsed = JSON.parse(bodyText) as typeof parsed;
    } catch {
      /* non-JSON body: nothing joinable */
    }
    if (typeof parsed.clinicianNpi === 'string' && parsed.clinicianNpi) {
      await recordHiringOutcome({
        kind: 'start',
        ref: String(typeof parsed.artifactId === 'string' ? parsed.artifactId : parsed.clinicianNpi),
        npi: parsed.clinicianNpi,
        metadata: { route: 'hiring_start', employerId: authContext.orgId ?? null },
      });
    }
  }

  return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
}
