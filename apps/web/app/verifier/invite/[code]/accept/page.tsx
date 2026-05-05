/**
 * /verifier/invite/[code]/accept — invitation accept surface.
 *
 * Server component: reads the invitation row, runs the pure
 * decideAccept gate, and renders one of:
 *   - 200 success render (decision.ok)
 *   - 410 Gone copy (expired or revoked)
 *   - 409 Conflict copy (already accepted)
 *   - 404 Not found copy (unknown code)
 *
 * The actual write (status → 'accepted') is performed by acceptInvitation
 * once the user is signed in — for the demo render we display gates only.
 */
import { auth } from '@clerk/nextjs/server';
import * as React from 'react';
import { acceptInvitation, getInvitationByCode } from '@/lib/auth/invitationRepo';
import { decideAccept } from '@/lib/auth/invitationLifecycle';

interface PageProps {
  params: Promise<{ code: string }>;
}

const REASON_COPY: Record<string, { headline: string; detail: string }> = {
  invitation_not_found: {
    headline: 'Invitation not found',
    detail: 'This invitation link is not valid. Ask the inviter to send a new one.',
  },
  invitation_expired: {
    headline: 'Invitation expired',
    detail: 'This invitation passed its expiry window. Ask the inviter to send a new one.',
  },
  invitation_revoked: {
    headline: 'Invitation revoked',
    detail: 'This invitation was revoked by the inviting team and is no longer valid.',
  },
  invitation_already_accepted: {
    headline: 'Already accepted',
    detail: 'This invitation has already been accepted. If that was not you, contact the inviting team.',
  },
};

export default async function AcceptInvitationPage({ params }: PageProps) {
  const { code } = await params;
  const { userId } = await auth();

  // Pre-flight: read the row and run the pure gate so we render the
  // correct status without writing anything until the user is signed in.
  const existing = await getInvitationByCode(code).catch(() => null);
  const preflight = decideAccept(existing, new Date());

  let outcome:
    | { kind: 'sign_in_required' }
    | { kind: 'accepted'; email: string; role: string }
    | { kind: 'refused'; statusCode: 404 | 409 | 410; reason: string };

  if (!preflight.ok) {
    outcome = {
      kind: 'refused',
      statusCode: preflight.statusCode,
      reason: preflight.reason,
    };
  } else if (!userId) {
    outcome = { kind: 'sign_in_required' };
  } else {
    const result = await acceptInvitation(code, userId).catch(() => null);
    if (!result || !result.decision.ok) {
      outcome = {
        kind: 'refused',
        statusCode: result?.decision.ok === false ? result.decision.statusCode : 404,
        reason: result?.decision.ok === false ? result.decision.reason : 'invitation_not_found',
      };
    } else {
      outcome = {
        kind: 'accepted',
        email: result.invitation?.email ?? '',
        role: result.invitation?.role ?? '',
      };
    }
  }

  return (
    <main
      className="mx-auto w-full max-w-xl px-4 py-12"
      data-testid="verifier-invite-accept"
      data-invitation-code={code}
      data-outcome-kind={outcome.kind}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Verifier team invitation
      </p>

      {outcome.kind === 'sign_in_required' && (
        <section className="mt-4 space-y-3">
          <h1 className="text-2xl font-semibold">Sign in to accept</h1>
          <p className="text-sm text-muted-foreground">
            This invitation is valid. Sign in or create an account to accept it.
          </p>
        </section>
      )}

      {outcome.kind === 'accepted' && (
        <section className="mt-4 space-y-3" role="status" data-status-code="200">
          <h1 className="text-2xl font-semibold">Invitation accepted</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;ve joined the verifier team as <strong>{outcome.role}</strong>.
          </p>
        </section>
      )}

      {outcome.kind === 'refused' && (
        <section
          className="mt-4 space-y-3"
          role="alert"
          data-status-code={String(outcome.statusCode)}
          data-refusal-reason={outcome.reason}
        >
          <h1 className="text-2xl font-semibold">
            {REASON_COPY[outcome.reason]?.headline ?? 'Invitation unavailable'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {REASON_COPY[outcome.reason]?.detail ?? 'This invitation is not available.'}
          </p>
        </section>
      )}
    </main>
  );
}
