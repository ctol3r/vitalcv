import * as React from 'react';
import {
  buildIssuerAuditEventRecord,
  createNoopIssuerAuditWriter,
  getIssuerAuditPersistenceStatus,
} from '@/lib/issuer-verification/auditPersistence';
import {
  chooseIssuerAuditPersistenceAdapter,
  createPersistenceAdapter,
  explainPersistenceAdapterDecision,
  getIssuerPersistenceAdapterCapabilities,
} from '@/lib/issuer-verification/auditPersistenceAdapter';
import type { IssuerPersistenceAdapterCapability } from '@/lib/issuer-verification/auditPersistenceAdapter';
import {
  createRepositoryAuditAdapter,
  REPOSITORY_AUDIT_ADAPTER_UNAVAILABLE_REASON,
} from '@/lib/issuer-verification/repositoryAuditAdapter';

/**
 * ISSUER-8 — Persistence adapter review surface (demo render).
 *
 * The page does not write rows. The default adapter is the no-op
 * adapter; the repository adapter renders as `repository_candidate`
 * because no client-safe writer is wired in this slice.
 */

const ALL_CAPABILITIES: ReadonlyArray<IssuerPersistenceAdapterCapability> = [
  'write_audit_event',
  'write_psv_receipt',
  'replay_lifecycle',
  'hash_payload',
  'preserve_limitations',
  'preserve_source_basis',
  'preserve_responder_attribution',
];

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export default async function PersistenceAdapterPage({ params }: PageProps) {
  const { requestId } = await params;

  // Default decision (no config)
  const defaultDecision = chooseIssuerAuditPersistenceAdapter();

  // Repository candidate decision — type-safe stub, not enabled
  const repoCandidate = createRepositoryAuditAdapter({ mode: 'repository' }).decision;

  // Repository "enabled" attempt — even with the operator opt-in flag,
  // this slice keeps the adapter unavailable because no writer is
  // wired. The page renders this honestly.
  const repoEnabledAttempt = createRepositoryAuditAdapter({
    mode: 'repository',
    enableRepositoryWrites: true,
  }).decision;

  // Demo write through the no-op writer — confirms the adapter
  // decision flows through to the audit persistence boundary.
  const demoRecord = buildIssuerAuditEventRecord({
    eventId: `ev-${requestId}`,
    correlation: {
      correlationId: `corr-${requestId}`,
      requestId,
      subjectId: 'demo-subject',
    },
    actor: {
      actorId: 'demo-actor',
      displayName: 'Demo Actor',
      role: 'demo',
    },
    eventType: 'consent_recorded',
    occurredAt: '2026-04-26T00:00:00.000Z',
    source: 'attested',
  });
  const demoWriter = createNoopIssuerAuditWriter({ mode: 'demo' });
  const demoResult = getIssuerAuditPersistenceStatus(demoRecord, demoWriter);

  // Adapter preview through the repository_candidate adapter.
  const repoCandidateAdapter = createPersistenceAdapter(repoCandidate);
  const repoCandidatePreview = repoCandidateAdapter.attempt(demoRecord);

  function renderCapabilityRow(
    label: string,
    caps: ReadonlyArray<IssuerPersistenceAdapterCapability>,
  ) {
    return (
      <li
        className="rounded-xl border border-border/60 bg-background/40 p-3"
        data-row-label={label}
      >
        <p className="text-sm font-medium text-foreground">{label}</p>
        <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
          {ALL_CAPABILITIES.map((cap) => {
            const present = caps.includes(cap);
            return (
              <li
                key={cap}
                className="text-[11px] text-muted-foreground"
                data-capability={cap}
                data-capability-present={String(present)}
              >
                {present ? '✓' : '·'} {cap}
              </li>
            );
          })}
        </ul>
      </li>
    );
  }

  return (
    <main
      className="min-h-screen bg-background"
      data-testid="persistence-adapter-page"
      data-request-id={requestId}
      data-default-adapter-kind={defaultDecision.kind}
      data-repository-candidate-kind={repoCandidate.kind}
      data-repository-enabled-kind={repoEnabledAttempt.kind}
      data-demo-write-persisted={String(demoResult.persisted)}
      data-repo-candidate-persisted={String(repoCandidatePreview.persisted)}
    >
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        <header className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Persistence adapter
          </p>
          <h1 className="text-xl font-semibold text-foreground">
            Adapter decision for request {requestId}
          </h1>
          <p
            className="text-sm text-muted-foreground"
            data-testid="persistence-adapter-warning"
          >
            Repository persistence is disabled unless explicitly configured
            and confirmed by a writer. Until then, events remain pending or
            demo-only.
          </p>
        </header>

        <section
          className="rounded-2xl border border-border bg-card p-5 space-y-3"
          aria-label="Default adapter"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Default adapter
          </p>
          <p className="text-sm text-foreground">
            kind: {defaultDecision.kind} (resultMode: {defaultDecision.resultMode})
          </p>
          <p className="text-xs text-muted-foreground italic">
            {explainPersistenceAdapterDecision(defaultDecision)}
          </p>
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5 space-y-3"
          aria-label="Repository candidate"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Repository adapter (candidate)
          </p>
          <p className="text-sm text-foreground">
            kind: {repoCandidate.kind} (resultMode: {repoCandidate.resultMode})
          </p>
          <p className="text-xs text-muted-foreground italic">
            {explainPersistenceAdapterDecision(repoCandidate)}
          </p>
          <p
            className="text-[11px] text-muted-foreground/80"
            data-testid="repo-candidate-preview"
            data-persisted={String(repoCandidatePreview.persisted)}
          >
            Preview attempt under this adapter: persisted={String(repoCandidatePreview.persisted)};
            status={repoCandidatePreview.status}; mode={repoCandidatePreview.mode}.
          </p>
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5 space-y-3"
          aria-label="Repository enabled (with operator flag)"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Repository adapter (operator opt-in attempted)
          </p>
          <p className="text-sm text-foreground">
            kind: {repoEnabledAttempt.kind} (resultMode: {repoEnabledAttempt.resultMode})
          </p>
          <p
            className="text-xs text-muted-foreground italic"
            data-testid="repo-enabled-explanation"
          >
            {explainPersistenceAdapterDecision(repoEnabledAttempt)}
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            Even with the operator opt-in flag, this slice intentionally keeps
            the adapter unavailable because no client-safe repository writer
            exists yet.
          </p>
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5"
          aria-label="Capability matrix"
        >
          <h2 className="text-sm font-semibold mb-3 text-foreground">
            Capability matrix
          </h2>
          <ul className="space-y-2" data-testid="capability-matrix">
            {renderCapabilityRow('noop', getIssuerPersistenceAdapterCapabilities('noop'))}
            {renderCapabilityRow('demo', getIssuerPersistenceAdapterCapabilities('demo'))}
            {renderCapabilityRow(
              'repository_candidate',
              getIssuerPersistenceAdapterCapabilities('repository_candidate'),
            )}
            {renderCapabilityRow(
              'repository_enabled',
              getIssuerPersistenceAdapterCapabilities('repository_enabled'),
            )}
            {renderCapabilityRow(
              'unavailable',
              getIssuerPersistenceAdapterCapabilities('unavailable'),
            )}
          </ul>
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5"
          aria-label="What enabling persistence requires"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            What enabling persistence requires
          </p>
          <p className="text-xs text-muted-foreground">
            {REPOSITORY_AUDIT_ADAPTER_UNAVAILABLE_REASON}
          </p>
        </section>

        <section
          className="rounded-2xl border border-border bg-card/60 p-4"
          aria-label="Demo write outcome"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Demo write outcome (no-op writer)
          </p>
          <p
            className="text-xs text-muted-foreground"
            data-testid="demo-write-result"
            data-persisted={String(demoResult.persisted)}
          >
            persisted={String(demoResult.persisted)}; status={demoResult.status};
            mode={demoResult.mode}.
          </p>
          <p className="text-[11px] italic text-muted-foreground/80 mt-1">
            {demoResult.message}
          </p>
        </section>
      </div>
    </main>
  );
}
