/**
 * POST /api/agent/consent — approve or withdraw approval for one action.
 * GET  /api/agent/consent — the clinician's current per-scope consent state.
 *
 * The client expresses approval OF AN ACTION and never authors the
 * authorization namespace:
 *
 *   grant  { decision: 'grant',  actionId }
 *   revoke { decision: 'revoke', actionId }  or  { decision: 'revoke', consentRef }
 *
 * On grant the server authenticates the clinician, rebuilds the canonical
 * context, REGENERATES the plan, locates the action, requires it to be
 * `execute_with_consent` and VitalCV-owned, derives the scope from that
 * canonical action, and records the derived scope. A scope, plan, subject,
 * or proof supplied by the caller is rejected outright.
 *
 * Revocation resolves its scope the same way — from a live action, or from
 * a server-issued `consentRef` handed out by GET. Neither path can introduce
 * a scope string the server did not already know, so the revoke surface
 * cannot be used to create authorization namespace either.
 *
 * Consent writes are strict: a write that does not persist answers 503
 * rather than implying an authorization exists.
 */
import { auth } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
import { authorizeConsentForAction } from '@/lib/agent/consent/authorize';
import {
  grantAgentConsent,
  readAgentConsentStates,
  resolveConsentScopeByRef,
  revokeAgentConsent,
} from '@/lib/agent/consent/consent-store';
import { buildCurrentPlan } from '@/lib/agent/current-plan';
import { ContextAssemblyError } from '@/lib/agent/context-assembler';
import { invalidNpiResponse, isStructurallyValidNpi } from '@/lib/trust/npi-format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Fields that would let a caller author its own authorization. `scope` is on
 * this list deliberately — it is the whole point of the contract.
 */
const CLIENT_AUTHORED_KEYS = [
  'scope',
  'consentScope',
  'planId',
  'plan',
  'subjectRef',
  'subject',
  'consentProof',
  'proof',
  'grantedAt',
  'seq',
];

export async function GET() {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const consents = await readAgentConsentStates(session.userId);
    return NextResponse.json({ consents });
  } catch {
    return NextResponse.json({ error: 'consent ledger unavailable' }, { status: 503 });
  }
}

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
        error:
          'the consent scope, plan, and subject are server-derived; approve an action by id instead',
        rejectedFields: offending,
      },
      { status: 400 },
    );
  }

  const decision = body.decision;
  if (decision !== 'grant' && decision !== 'revoke') {
    return NextResponse.json({ error: 'decision must be "grant" or "revoke"' }, { status: 400 });
  }

  const actionId = typeof body.actionId === 'string' && body.actionId.length > 0 ? body.actionId : null;
  const consentRef =
    typeof body.consentRef === 'string' && body.consentRef.length > 0 ? body.consentRef : null;

  if (decision === 'grant' && !actionId) {
    return NextResponse.json({ error: 'actionId is required to grant' }, { status: 400 });
  }
  if (decision === 'revoke' && !actionId && !consentRef) {
    return NextResponse.json(
      { error: 'revoke requires an actionId or a server-issued consentRef' },
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

  // Revocation by server-issued reference: resolve the scope from the
  // ledger. Used when the action has left the plan but the consent has not
  // left the ledger — the clinician must still be able to withdraw it.
  if (decision === 'revoke' && !actionId && consentRef) {
    let scope: string | null;
    try {
      scope = await resolveConsentScopeByRef(session.userId, consentRef);
    } catch {
      return NextResponse.json({ error: 'consent ledger unavailable' }, { status: 503 });
    }
    if (!scope) {
      return NextResponse.json(
        { error: 'unknown consent reference', refusal: 'consent_ref_not_found' },
        { status: 404 },
      );
    }
    const result = await revokeAgentConsent({ subjectRef: session.userId, scope });
    if (!result.persisted) {
      return NextResponse.json(
        { error: 'consent could not be recorded', scope, decision },
        { status: 503 },
      );
    }
    return NextResponse.json({
      scope,
      decision,
      granted: false,
      changed: result.changed,
      eventRef: result.eventId,
      seq: result.seq,
    });
  }

  // Action-driven path (all grants, and revokes naming a live action):
  // rebuild canonical state, regenerate the plan, derive the scope.
  let plan;
  try {
    ({ plan } = await buildCurrentPlan({
      subjectRef: session.userId,
      ...(npi ? { npi } : {}),
      contextClass: 'holder_consent',
    }));
  } catch (error) {
    if (error instanceof ContextAssemblyError) {
      return NextResponse.json(
        { error: 'canonical state unavailable', detail: error.message },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'consent authorization failed' }, { status: 500 });
  }

  const authorization = authorizeConsentForAction(plan, actionId!);
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.detail, refusal: authorization.refusal },
      { status: authorization.refusal === 'action_not_in_current_plan' ? 409 : 422 },
    );
  }

  const { scope } = authorization;
  const result =
    decision === 'grant'
      ? await grantAgentConsent({
          subjectRef: session.userId,
          scope,
          actionId: actionId!,
          planId: plan.planId,
        })
      : await revokeAgentConsent({
          subjectRef: session.userId,
          scope,
          actionId: actionId!,
          planId: plan.planId,
        });

  if (!result.persisted) {
    return NextResponse.json(
      { error: 'consent could not be recorded', scope, decision },
      { status: 503 },
    );
  }

  return NextResponse.json({
    scope,
    decision,
    granted: decision === 'grant',
    changed: result.changed,
    eventRef: result.eventId,
    seq: result.seq,
    actionId,
    planId: plan.planId,
  });
}
