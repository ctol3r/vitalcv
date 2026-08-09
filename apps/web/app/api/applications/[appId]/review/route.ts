import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildMarketplaceHeaders,
  MARKETPLACE_BACKEND,
} from '@/lib/server/marketplace-proxy';
import { classifyWorkflowKind, recordHiringOutcome } from '@/lib/agent/outcomes/record-outcome';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { appId } = await params;
  const body = await req.text();
  const res = await fetch(`${MARKETPLACE_BACKEND}/api/applications/${appId}/review`, {
    method: 'PATCH',
    headers: await buildMarketplaceHeaders(session, { 'Content-Type': 'application/json' }),
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });

  if (res.ok) {
    // L3 outcome join — same subject-resolution caveat as the workflow route.
    let decision = '';
    try {
      const parsed = JSON.parse(body) as { decision?: unknown; status?: unknown };
      if (typeof parsed.decision === 'string') decision = parsed.decision;
      else if (typeof parsed.status === 'string') decision = parsed.status;
    } catch {
      /* non-JSON body: classify falls back to 'application' */
    }
    await recordHiringOutcome({
      kind: classifyWorkflowKind(decision),
      ref: appId,
      subjectRef: session.userId,
      metadata: { reviewDecision: decision || null, route: 'review' },
    });
  }

  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
