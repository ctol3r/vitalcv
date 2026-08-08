/**
 * POST /api/agent/execute-action — run one planned action for the signed-in
 * clinician.
 *
 * The client sends only an action id. Everything else is server-derived: the
 * context is reassembled from canonical services and the plan is REGENERATED
 * here, so a stale or forged client plan cannot authorize anything, and a
 * consent revoked since the plan was shown is honored (the executor
 * re-reads the ledger).
 *
 * A refusal is a 200 with `executed: false` and a named reason — the request
 * was understood and correctly declined. Transport/auth problems keep their
 * own status codes.
 */
import { auth } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
import { ContextAssemblyError } from '@/lib/agent/context-assembler';
import { buildCurrentPlan } from '@/lib/agent/current-plan';
import { executeAgentAction } from '@/lib/agent/execution/execute-action';
import { isStructurallyValidNpi, invalidNpiResponse } from '@/lib/trust/npi-format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CLIENT_AUTHORED_KEYS = [
  'plan',
  'planId',
  'consentProof',
  'proof',
  'consents',
  'context',
  'subjectRef',
  'owner',
  'permission',
];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = (await request.json()) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = {};
  }

  const offending = CLIENT_AUTHORED_KEYS.filter((key) => key in body);
  if (offending.length > 0) {
    return NextResponse.json(
      {
        error: 'the plan, consent, and subject are server-derived and may not be supplied',
        rejectedFields: offending,
      },
      { status: 400 },
    );
  }

  const actionId = body.actionId;
  if (typeof actionId !== 'string' || actionId.length === 0 || actionId.length > 200) {
    return NextResponse.json({ error: 'actionId is required' }, { status: 400 });
  }

  let npi: string | undefined;
  if (body.npi !== undefined) {
    if (typeof body.npi !== 'string' || !isStructurallyValidNpi(body.npi)) {
      return invalidNpiResponse();
    }
    npi = body.npi;
  }

  try {
    // Regenerated here — the client's view of the plan is never authoritative.
    const { plan, context, registry } = await buildCurrentPlan({
      subjectRef: session.userId,
      ...(npi ? { npi } : {}),
      contextClass: 'holder_execute',
    });

    const result = await executeAgentAction(
      { plan, context, actionId, subjectRef: session.userId },
      { registry },
    );

    return NextResponse.json({
      executed: result.executed,
      actionId: result.actionId,
      planId: result.planId,
      policyVersion: plan.policyVersion,
      ...(result.refusal ? { refusal: result.refusal } : {}),
      ...(result.output !== undefined ? { output: result.output } : {}),
      ...(result.consentId ? { consentId: result.consentId } : {}),
      elapsedMs: result.elapsedMs,
    });
  } catch (error) {
    if (error instanceof ContextAssemblyError) {
      return NextResponse.json(
        { error: 'canonical state unavailable', detail: error.message },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'action execution failed' }, { status: 500 });
  }
}
