/**
 * POST /api/agent/consent — record or revoke agent consent for one scope.
 * GET  /api/agent/consent — read the current per-scope fold for the subject.
 *
 * Consent is always the signed-in clinician's own, for their own subject
 * key: the subject is taken from the session and never from the body, so a
 * caller cannot grant consent on someone else's behalf. Grants and
 * revocations are ledger events; a write that does not persist reports
 * failure (503) rather than pretending — an authorization must never be
 * assumed to exist.
 */
import { auth } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
import {
  grantAgentConsent,
  readAgentConsentStates,
  revokeAgentConsent,
} from '@/lib/agent/consent/consent-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Scope grammar: `family:target`, conservative charset, bounded length. */
const SCOPE_RE = /^[a-z][a-z0-9_]{2,40}:[A-Za-z0-9][A-Za-z0-9._:-]{0,80}$/;

export async function GET() {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const states = await readAgentConsentStates(session.userId);
    return NextResponse.json({ consents: states });
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

  // A client may never hand us a subject or a proof.
  const forbidden = ['subjectRef', 'subject', 'consentProof', 'proof', 'grantedAt'].filter(
    (key) => key in body,
  );
  if (forbidden.length > 0) {
    return NextResponse.json(
      { error: 'consent subject and proofs are server-derived', rejectedFields: forbidden },
      { status: 400 },
    );
  }

  const decision = body.decision;
  if (decision !== 'grant' && decision !== 'revoke') {
    return NextResponse.json(
      { error: 'decision must be "grant" or "revoke"' },
      { status: 400 },
    );
  }

  const scope = body.scope;
  if (typeof scope !== 'string' || !SCOPE_RE.test(scope)) {
    return NextResponse.json({ error: 'invalid consent scope' }, { status: 400 });
  }

  const actionId = typeof body.actionId === 'string' ? body.actionId : undefined;
  const planId = typeof body.planId === 'string' ? body.planId : undefined;

  const result =
    decision === 'grant'
      ? await grantAgentConsent({ subjectRef: session.userId, scope, actionId, planId })
      : await revokeAgentConsent({ subjectRef: session.userId, scope, actionId, planId });

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
  });
}
