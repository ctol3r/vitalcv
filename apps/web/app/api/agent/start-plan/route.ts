/**
 * POST /api/agent/start-plan — Start Agent A0 planning endpoint.
 *
 * Authenticated, internal, self-subject only: the plan is generated for the
 * signed-in clinician. Input may reference canonical identities (an NPI) and
 * NOTHING else — client-authored provenance, evidence, or state is rejected
 * outright. The endpoint mutates no clinician truth state; its only writes
 * are the agent telemetry rows (AgentRun/AgentRunAction/AgentEvent) plus the
 * paired AuditEvent append, and plan generation survives even when telemetry
 * cannot persist.
 */
import { auth } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
import { assembleStartAgentContext, ContextAssemblyError } from '@/lib/agent/context-assembler';
import { validateNarrative, type AgentNarrative } from '@/lib/agent/model/agent-model';
import { buildModelContext } from '@/lib/agent/model/context-builder';
import { getAgentModel } from '@/lib/agent/model/template-model';
import { generateStartPlan } from '@/lib/agent/policy/start-policy-v1';
import { buildProductionReaders } from '@/lib/agent/server-readers';
import { persistAgentRun } from '@/lib/agent/telemetry/agent-run-store';
import { invalidNpiResponse, isStructurallyValidNpi } from '@/lib/trust/npi-format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Truth enters the plan only through canonical services. A request that
 * tries to hand the agent state or provenance is refused, not sanitized.
 */
const CLIENT_AUTHORED_PROVENANCE_KEYS = [
  'provenance',
  'evidence',
  'evidenceRefs',
  'identity',
  'ownership',
  'observations',
  'readiness',
  'consents',
  'employerReview',
  'profile',
  'actionHistory',
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

  const offendingKeys = CLIENT_AUTHORED_PROVENANCE_KEYS.filter((key) => key in body);
  if (offendingKeys.length > 0) {
    return NextResponse.json(
      {
        error: 'client-authored provenance is not accepted',
        rejectedFields: offendingKeys,
      },
      { status: 400 },
    );
  }

  let npi: string | undefined;
  if (body.npi !== undefined) {
    if (typeof body.npi !== 'string' || !isStructurallyValidNpi(body.npi)) {
      return invalidNpiResponse();
    }
    npi = body.npi;
  }

  try {
    const { context, inputGaps } = await assembleStartAgentContext({
      subject: { profileRef: session.userId, ...(npi ? { npi } : {}) },
      contextClass: 'holder_api',
      now: new Date().toISOString(),
      readers: buildProductionReaders(session.userId),
    });

    const plan = generateStartPlan(context, { now: context.collectedAt });

    const persistence = await persistAgentRun({
      plan,
      subjectRef: session.userId,
      ...(npi ? { npi } : {}),
      inputGaps,
    });

    let narrative: AgentNarrative | null = await getAgentModel().explain(
      buildModelContext(plan, context),
    );
    if (narrative && validateNarrative(narrative, plan, context).length > 0) {
      // A narrative that fails validation is dropped, never repaired.
      narrative = null;
    }

    return NextResponse.json({
      plan,
      narrative,
      inputGaps,
      telemetry: { persisted: persistence.persisted, runId: persistence.runId },
    });
  } catch (error) {
    if (error instanceof ContextAssemblyError) {
      return NextResponse.json(
        { error: 'canonical state unavailable', detail: error.message },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'plan generation failed' }, { status: 500 });
  }
}
