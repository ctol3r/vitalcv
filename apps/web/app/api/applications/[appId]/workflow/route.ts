import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildMarketplaceHeaders,
  MARKETPLACE_BACKEND,
} from '@/lib/server/marketplace-proxy';
import { classifyWorkflowKind, recordHiringOutcome } from '@/lib/agent/outcomes/record-outcome';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { appId } = await params;
  const res = await fetch(`${MARKETPLACE_BACKEND}/api/applications/${appId}/workflow`, {
    headers: await buildMarketplaceHeaders(session),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });

  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { appId } = await params;
  const body = await req.text();
  const res = await fetch(`${MARKETPLACE_BACKEND}/api/applications/${appId}/workflow-action`, {
    method: 'POST',
    headers: await buildMarketplaceHeaders(session, { 'Content-Type': 'application/json' }),
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });

  if (res.ok) {
    // L3 outcome join. Employer-session actions resolve against the employer's
    // user id, find no agent runs, and honestly drop (see record-outcome.ts);
    // clinician-side actions join. Raw action always travels in metadata.
    let action = '';
    try {
      const parsed = JSON.parse(body) as { action?: unknown };
      if (typeof parsed.action === 'string') action = parsed.action;
    } catch {
      /* non-JSON body: classify falls back to 'application' */
    }
    await recordHiringOutcome({
      kind: classifyWorkflowKind(action),
      ref: appId,
      subjectRef: session.userId,
      metadata: { workflowAction: action || null, route: 'workflow' },
    });
  }

  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
