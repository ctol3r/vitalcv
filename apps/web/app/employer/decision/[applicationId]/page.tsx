import type { ReactElement } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { DecisionContext } from '@/components/verifier/DecisionContext';
import { PageFrame } from '@/components/layout/PageFrame';
import { Reveal } from '@/components/motion/Reveal';
import { deriveDecisionContext } from '@/lib/applications/decisionContext';
import { loadApplicationEvidenceView } from '@/lib/server/applicationEvidence';

export const dynamic = 'force-dynamic';

/**
 * Employer decision surface (ACT-1.1).
 *
 * Driven by the real, sealed application via the same authorized loader the
 * review page uses — no mock. Authorization, not-found, and unavailable states
 * are honest; a superseded/revoked packet is flagged before a decision is made.
 * Recording the decision itself is ACT-1.2.
 */
export default async function EmployerDecisionPage(props: {
  params: Promise<{ applicationId: string }>;
}): Promise<ReactElement> {
  const { applicationId } = await props.params;
  const result = await loadApplicationEvidenceView(applicationId);

  if (result.status === 'unauthorized') {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(`/employer/decision/${applicationId}`)}`);
  }

  return (
    <PageFrame
      as="main"
      mode="workflow"
      aria-label="Employer decision"
      className="mz mz-paper mz-persona-employer min-h-screen"
    >
      <div className="mz-ambient grid gap-6">
        <Reveal variant="fade">
          <div className="flex flex-col gap-3">
            <Link
              href="/employer/worklist"
              className="text-sm font-medium text-[var(--ink-600)] hover:text-[var(--ink-900)]"
            >
              ← Employer worklist
            </Link>
            <p className="mz-eyebrow">Employer decision</p>
            <h1 className="mz-h1">Decision context</h1>
            <p className="max-w-2xl mz-lede">
              The sealed application as submitted. Accepting proof as a head start remains a scoped employer decision —
              final institutional review is separate.
            </p>
            <p className="mz-mono text-xs text-[var(--ink-600)] break-all">Application {applicationId}</p>
          </div>
        </Reveal>

        {(() => {
          if (result.status !== 'ok') {
            return (
              <Reveal delay={80}>
                <div className="mz-card mz-card-pad text-sm text-[var(--ink-700)]" role="status">
                  <p className="font-semibold text-[var(--ink-900)]">
                    {result.status === 'not_found'
                      ? 'This application was not found.'
                      : 'Application evidence is temporarily unavailable.'}
                  </p>
                  <p className="mt-1">
                    {result.status === 'not_found'
                      ? 'It may have been withdrawn, or it belongs to another organization.'
                      : 'This is a system state, not a finding about the clinician. Try again shortly.'}
                  </p>
                </div>
              </Reveal>
            );
          }

          const context = deriveDecisionContext(result.data);
          if (!context) {
            // A legacy application with no sealed packet — honest, not adverse.
            return (
              <Reveal delay={80}>
                <div className="mz-card mz-card-pad text-sm text-[var(--ink-700)]" role="status" data-decision-legacy="true">
                  <p className="font-semibold text-[var(--ink-900)]">No sealed packet for this application.</p>
                  <p className="mt-1">
                    {result.data.legacyNotice ??
                      'This application predates sealed evidence packets. Review its evidence directly rather than a frozen packet.'}
                  </p>
                </div>
              </Reveal>
            );
          }

          return (
            <Reveal delay={80}>
              <DecisionContext context={context} />
            </Reveal>
          );
        })()}
      </div>
    </PageFrame>
  );
}
