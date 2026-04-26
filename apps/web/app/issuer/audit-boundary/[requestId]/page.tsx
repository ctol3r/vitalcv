import * as React from 'react';
import {
  buildIssuerLifecycleReplay,
  createNoopIssuerAuditWriter,
  explainIssuerAuditPersistenceStatus,
} from '@/lib/issuer-verification/auditPersistence';
import {
  appendIssuerLifecycleEvent,
  getIssuerRequestTimeline,
} from '@/lib/issuer-verification/requestLifecycle';
import type {
  IssuerRequestLifecycleActor,
  IssuerRequestLifecycleEvent,
} from '@/lib/issuer-verification/requestLifecycle';
import { recommendPartnerRoute } from '@/lib/issuer-verification/partnerRouter';
import {
  ISSUER_AUDIT_PERSISTENCE_COPY,
  getIssuerAuditPersistenceCopy,
} from '@/lib/issuer-verification/statusCopy';
import type {
  IssuerVerificationRequest,
  VerificationClaimType,
} from '@/lib/issuer-verification/types';

/**
 * ISSUER-7 — Audit persistence boundary surface (demo render).
 *
 * The page does NOT persist an audit row. The default writer is the
 * no-op writer; events render with persistenceStatus
 * `demo_not_persisted` and the disclaimer makes that explicit.
 */

const REQUESTER: IssuerRequestLifecycleActor = {
  actorId: 'demo-requester',
  displayName: 'Demo Requester',
  role: 'requester',
};
const HOLDER: IssuerRequestLifecycleActor = {
  actorId: 'demo-holder',
  displayName: 'Demo Holder',
  role: 'holder',
};
const ISSUER_OBSERVER: IssuerRequestLifecycleActor = {
  actorId: 'demo-issuer',
  displayName: 'Demo Issuer',
  role: 'issuer',
};

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export default async function AuditBoundaryPage({ params }: PageProps) {
  const { requestId } = await params;

  const claimType: VerificationClaimType = 'residency';
  const request: IssuerVerificationRequest = {
    requestId,
    claimType,
    claimSummary: 'Residency: Internal Medicine, 2018–2021',
    issuerCandidate: {
      candidateId: 'cand-demo',
      organizationName: 'Demo GME Office',
      contactRole: 'GME Coordinator',
      source: 'clinician_provided',
    },
    route: recommendPartnerRoute(claimType),
    consent: {
      consentId: 'consent-demo',
      scope: 'verify_residency',
      status: 'granted',
      consentedAt: '2026-04-26T00:00:00.000Z',
    },
    status: 'sent',
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T01:00:00.000Z',
    history: [],
  };

  // Build a representative timeline in-memory.
  const seedEvents: IssuerRequestLifecycleEvent[] = [
    {
      eventId: 'ev-1',
      status: 'consent_recorded',
      occurredAt: '2026-04-26T00:00:00.000Z',
      actor: HOLDER,
      source: 'attested',
    },
    {
      eventId: 'ev-2',
      status: 'manual_link_generated',
      occurredAt: '2026-04-26T01:00:00.000Z',
      actor: REQUESTER,
      source: 'system',
    },
    {
      eventId: 'ev-3',
      status: 'copied_by_requester',
      occurredAt: '2026-04-26T01:05:00.000Z',
      actor: REQUESTER,
      source: 'attested',
    },
    {
      eventId: 'ev-4',
      status: 'sent_by_requester',
      occurredAt: '2026-04-26T01:10:00.000Z',
      actor: REQUESTER,
      source: 'attested',
    },
    {
      eventId: 'ev-5',
      status: 'viewed_by_issuer',
      occurredAt: '2026-04-26T03:00:00.000Z',
      actor: ISSUER_OBSERVER,
      source: 'observed',
    },
  ];
  const timeline = appendIssuerLifecycleEvent(
    getIssuerRequestTimeline(request, seedEvents),
    {
      eventId: 'ev-6',
      status: 'response_received',
      occurredAt: '2026-04-26T05:00:00.000Z',
      actor: ISSUER_OBSERVER,
      source: 'observed',
    },
  );

  // No-op writer is the default; nothing is persisted.
  const writer = createNoopIssuerAuditWriter({ mode: 'demo' });
  const replay = buildIssuerLifecycleReplay(
    timeline,
    {
      correlationId: `corr-${requestId}`,
      requestId,
      subjectId: 'demo-subject',
    },
    writer,
  );

  return (
    <main
      className="min-h-screen bg-background"
      data-testid="issuer-audit-boundary-page"
      data-request-id={request.requestId}
      data-correlation-id={replay.correlationId}
      data-persistence-mode={writer.mode}
      data-event-count={String(replay.events.length)}
      data-fully-replay-safe={String(replay.fullyReplaySafe)}
    >
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        <header className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Audit boundary
          </p>
          <h1 className="text-xl font-semibold text-foreground">
            Replay {replay.correlationId}
          </h1>
          <p
            className="text-sm text-muted-foreground"
            data-testid="audit-boundary-warning"
          >
            This page shows audit-boundary metadata. Events marked demo or
            pending are not persisted audit records.
          </p>
          <p
            className="text-xs text-muted-foreground italic"
            data-testid="audit-boundary-disclaimer"
          >
            {replay.disclaimer}
          </p>
        </header>

        <section
          className="rounded-2xl border border-border bg-card p-5 space-y-3"
          aria-label="Persistence mode"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Persistence mode
          </p>
          <p className="text-sm text-foreground">{writer.mode}</p>
          <p className="text-xs text-muted-foreground">
            The no-op writer is wired by default. No database, network, or
            external call is made by this page.
          </p>
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5"
          aria-label="Audit event records"
        >
          <h2 className="text-sm font-semibold mb-3 text-foreground">
            Records
          </h2>
          <ol className="space-y-2" data-testid="audit-event-list">
            {replay.events.map((record) => {
              const statusCopy = getIssuerAuditPersistenceCopy(
                record.persistenceStatus === 'persisted'
                  ? 'persisted'
                  : record.persistenceStatus === 'failed'
                  ? 'audit_write_failed'
                  : record.persistenceStatus === 'demo_not_persisted'
                  ? 'demo_not_persisted'
                  : 'pending_not_written',
              );
              return (
                <li
                  key={record.eventId}
                  className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-1"
                  data-event-id={record.eventId}
                  data-event-type={record.eventType}
                  data-persistence-status={record.persistenceStatus}
                  data-persistence-mode={record.persistenceMode}
                  data-replay-safe={String(record.replaySafe)}
                >
                  <p className="text-sm font-medium text-foreground">
                    {record.eventType}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {record.occurredAt} — {record.actor.displayName} ({record.actorRole}, source: {record.source})
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">
                    Status: {statusCopy.label} — {statusCopy.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">
                    Persistence mode: {record.persistenceMode}; payloadHash:{' '}
                    {record.payloadHash || '(placeholder; no anchoring writer wired)'}
                  </p>
                  {record.relatedArtifactId && (
                    <p className="text-[11px] text-muted-foreground/80">
                      Related artifact: {record.relatedArtifactId}
                    </p>
                  )}
                  <p className="text-[11px] italic text-muted-foreground/80">
                    {explainIssuerAuditPersistenceStatus(record.persistenceStatus)}
                  </p>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-[11px] italic text-muted-foreground/80">
            Replay-safe means events MAY be included in timeline replay for
            context. Replay-safe is not legal proof and does not change any
            claim truth tier.
          </p>
        </section>

        <section className="text-[11px] text-muted-foreground/70">
          <p data-testid="audit-boundary-copy">
            Audit persistence copy:{' '}
            {Object.values(ISSUER_AUDIT_PERSISTENCE_COPY)
              .map((s) => s.label)
              .join(' · ')}
          </p>
        </section>
      </div>
    </main>
  );
}
