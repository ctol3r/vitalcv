import * as React from 'react';
import {
  buildBackendPersistenceDeferDecision,
  evaluateBackendPersistenceReadiness,
  explainBackendPersistenceDecision,
} from '@/lib/issuer-verification/backendPersistenceDecision';
import type {
  BackendPersistenceCapabilityCheck,
  BackendPersistenceDecision,
} from '@/lib/issuer-verification/backendPersistenceDecision';

/**
 * ISSUER-9 — Backend persistence decision surface (demo render).
 *
 * The page renders both:
 *   1. The default decision (no capabilities satisfied) — what
 *      operators see today.
 *   2. A hypothetical fully-satisfied decision — what the surface
 *      WOULD show if every capability were proven.
 *
 * The page does not write anything, does not call any service, and
 * does not claim a row was persisted.
 */

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export default async function BackendPersistencePage({ params }: PageProps) {
  const { requestId } = await params;
  const decidedAt = '2026-04-26T00:00:00.000Z';

  const deferDecision = buildBackendPersistenceDeferDecision({
    decidedAt,
    reason:
      'Default backend persistence readiness — no capabilities satisfied.',
  });

  const hypotheticalReady = evaluateBackendPersistenceReadiness({
    decidedAt,
    reason:
      'Hypothetical: every backend persistence capability proven satisfied.',
    capabilities: {
      stores_scoped_psv_receipt: true,
      preserves_limitation_notes: true,
      preserves_source_basis: true,
      preserves_responder_attribution: true,
      preserves_freshness_and_scope: true,
      distinguishes_candidate_vs_receipt: true,
      supports_audit_event_persistence: true,
      exposes_server_only_writer: true,
      has_test_coverage: true,
    },
  }).decision;

  function renderDecisionCard(
    label: string,
    decision: BackendPersistenceDecision,
  ) {
    return (
      <section
        className="rounded-2xl border border-border bg-card p-5 space-y-3"
        aria-label={`Decision: ${label}`}
        data-decision-label={label}
        data-decision-status={decision.status}
        data-implied-adapter-kind={decision.impliedAdapterKind}
        data-blocker-count={String(decision.blockers.length)}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="text-sm text-foreground">
            status: {decision.status}; implied adapter kind:{' '}
            {decision.impliedAdapterKind}
          </p>
          <p
            className="text-xs text-muted-foreground italic"
            data-testid={`decision-explanation-${label}`}
          >
            {explainBackendPersistenceDecision(decision)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Capability checks
          </p>
          <ul className="space-y-1" data-testid={`capability-checks-${label}`}>
            {decision.capabilityChecks.map(
              (check: BackendPersistenceCapabilityCheck) => (
                <li
                  key={check.capability}
                  className="text-[11px] text-muted-foreground"
                  data-capability={check.capability}
                  data-capability-satisfied={String(check.satisfied)}
                  data-mapped-blocker={check.mappedBlocker ?? ''}
                >
                  {check.satisfied ? '✓' : '·'} {check.capability}
                  {!check.satisfied && check.mappedBlocker
                    ? ` — blocker: ${check.mappedBlocker}`
                    : ''}
                </li>
              ),
            )}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Blockers
          </p>
          {decision.blockers.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No blockers recorded for this decision.
            </p>
          ) : (
            <ul className="text-xs text-muted-foreground space-y-1">
              {decision.blockers.map((b) => (
                <li key={b} data-blocker={b}>
                  • {b}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Recommendation
          </p>
          <p className="text-xs text-muted-foreground">
            {decision.recommendation.summary}
          </p>
          <ol className="mt-1 text-[11px] text-muted-foreground/80 list-decimal pl-5 space-y-0.5">
            {decision.recommendation.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <main
      className="min-h-screen bg-background"
      data-testid="backend-persistence-page"
      data-request-id={requestId}
      data-default-decision-status={deferDecision.status}
      data-hypothetical-decision-status={hypotheticalReady.status}
    >
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        <header className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Backend persistence
          </p>
          <h1 className="text-xl font-semibold text-foreground">
            Decision for request {requestId}
          </h1>
          <p
            className="text-sm text-muted-foreground"
            data-testid="backend-persistence-warning"
          >
            Backend persistence is not active unless a server-side writer
            confirms the write. Repository compatibility alone is not an audit
            trail.
          </p>
        </header>

        {renderDecisionCard('default', deferDecision)}

        {renderDecisionCard('hypothetical-ready', hypotheticalReady)}

        <section className="text-[11px] text-muted-foreground/70">
          <p data-testid="defer-memo-pointer">
            See docs/architecture/vitalcv-backend-persistence-defer-decision.md for
            the full defer rationale, adapter acceptance criteria, and the
            next safe implementation wave.
          </p>
        </section>
      </div>
    </main>
  );
}
