import * as React from 'react';
import {
  appendIssuerLifecycleEvent,
  buildConsentRequirement,
  buildManualIssuerSendLink,
  canGenerateIssuerSendLink,
  getIssuerRequestTimeline,
  recordConsentArtifactSummary,
} from '@/lib/issuer-verification/requestLifecycle';
import type {
  IssuerRequestLifecycleActor,
  IssuerRequestLifecycleEvent,
} from '@/lib/issuer-verification/requestLifecycle';
import {
  ISSUER_REQUEST_LIFECYCLE_COPY,
  getIssuerLifecycleStatusCopy,
} from '@/lib/issuer-verification/statusCopy';
import { recommendPartnerRoute } from '@/lib/issuer-verification/partnerRouter';
import type {
  IssuerVerificationRequest,
  VerificationClaimType,
} from '@/lib/issuer-verification/types';

/**
 * ISSUER-6 — Issuer request lifecycle / consent / manual send link
 * (demo render).
 *
 * Truth surface:
 *   - VitalCV does not send email or SMS from this page.
 *   - All "sent" statuses on this surface are requester-attested.
 *   - "Viewed" requires an observation event from the verification
 *     surface; the page only displays an observed event when one
 *     exists in the timeline.
 *   - Audit metadata defaults to pending_not_written.
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

export default async function IssuerRequestLifecyclePage({ params }: PageProps) {
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

  const requirement = buildConsentRequirement(request);
  const consent = recordConsentArtifactSummary(request.consent);
  const permission = canGenerateIssuerSendLink({
    request,
    requirement,
    consent,
  });

  const sendLink = permission.canGenerate
    ? buildManualIssuerSendLink(
        { request, requirement, consent },
        {
          linkId: `link-${requestId}`,
          baseUrl: 'https://demo.vitalcv.example',
          generatedAt: '2026-04-26T01:00:00.000Z',
          ttlMinutes: 60 * 24 * 7,
          purposeHint: 'Residency verification',
        },
      )
    : undefined;

  // Demo timeline assembled in-memory; nothing persisted.
  const seedEvents: IssuerRequestLifecycleEvent[] = [
    {
      eventId: 'ev-1',
      status: 'consent_recorded',
      occurredAt: '2026-04-26T00:00:00.000Z',
      actor: HOLDER,
      source: 'attested',
      notes: 'Holder recorded consent for residency verification scope.',
    },
    {
      eventId: 'ev-2',
      status: 'manual_link_generated',
      occurredAt: '2026-04-26T01:00:00.000Z',
      actor: REQUESTER,
      source: 'system',
      notes:
        'Manual link generated. Generation is not delivery; the requester must copy and send the link manually.',
    },
    {
      eventId: 'ev-3',
      status: 'copied_by_requester',
      occurredAt: '2026-04-26T01:05:00.000Z',
      actor: REQUESTER,
      source: 'attested',
      notes: 'Requester attested to copying the link.',
    },
    {
      eventId: 'ev-4',
      status: 'sent_by_requester',
      occurredAt: '2026-04-26T01:10:00.000Z',
      actor: REQUESTER,
      source: 'attested',
      notes:
        'Requester attested to sending the link via their own email client. Send attestation does not mean the issuer has viewed the request.',
    },
    {
      eventId: 'ev-5',
      status: 'viewed_by_issuer',
      occurredAt: '2026-04-26T03:00:00.000Z',
      actor: ISSUER_OBSERVER,
      source: 'observed',
      notes:
        'Verification surface observed the issuer opening the request. Observation does not finalize the claim.',
    },
  ];

  const timeline = getIssuerRequestTimeline(request, seedEvents);

  // Dry-run a response_received event to show what the next step
  // would look like — not persisted.
  const dryRunNext = appendIssuerLifecycleEvent(timeline, {
    eventId: 'ev-dry',
    status: 'response_received',
    occurredAt: '2026-04-26T05:00:00.000Z',
    actor: ISSUER_OBSERVER,
    source: 'observed',
    notes:
      'Dry-run: response received from issuer. Receipt does not finalize verification.',
  });

  const statusCopy = getIssuerLifecycleStatusCopy(timeline.currentStatus);

  return (
    <main
      className="min-h-screen bg-background"
      data-testid="issuer-request-page"
      data-request-id={request.requestId}
      data-current-status={timeline.currentStatus}
      data-can-generate-link={String(permission.canGenerate)}
      data-consent-required={String(requirement.required)}
      data-consent-status={consent.status}
    >
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        <header className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Issuer request lifecycle
          </p>
          <h1 className="text-xl font-semibold text-foreground">
            Request {request.requestId}
          </h1>
          <p
            className="text-sm text-muted-foreground"
            data-testid="issuer-request-warning"
          >
            Timeline events organize the request workflow. They do not verify
            the claim. Verification still depends on attributed issuer
            response, policy review, and source limitations.
          </p>
        </header>

        <section
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
          aria-label="Claim and consent summary"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Claim
            </p>
            <p className="text-sm text-foreground">{request.claimSummary}</p>
            <p className="text-xs text-muted-foreground">
              Recommended route: {request.route.partnerCategory}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Consent requirement
            </p>
            <p className="text-sm text-foreground">
              {requirement.required
                ? 'Consent is required for this claim type.'
                : `Consent is not required: ${requirement.reason ?? '(no reason recorded)'}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Scope: {requirement.scope}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Recorded consent
            </p>
            <p className="text-sm text-foreground">{consent.status}</p>
            {consent.consentedAt && (
              <p className="text-xs text-muted-foreground">
                Recorded at {consent.consentedAt}
              </p>
            )}
          </div>
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5 space-y-3"
          aria-label="Manual send link"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Manual send link
          </p>
          {sendLink ? (
            <>
              <p
                className="text-xs text-muted-foreground break-all font-mono"
                data-testid="manual-send-link-url"
              >
                {sendLink.url}
              </p>
              <p className="text-xs text-muted-foreground italic">
                {sendLink.instructions}
              </p>
              <p className="text-[11px] text-muted-foreground/80">
                Generated at {sendLink.generatedAt}; expires at {sendLink.expiresAt}.
              </p>
            </>
          ) : (
            <p
              className="text-xs text-muted-foreground"
              data-testid="manual-send-link-blocked"
            >
              {permission.message}
            </p>
          )}
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5"
          aria-label="Lifecycle timeline"
        >
          <h2 className="text-sm font-semibold mb-3 text-foreground">
            Timeline
          </h2>
          <ol
            className="space-y-2"
            data-testid="issuer-request-timeline"
            data-event-count={String(timeline.events.length)}
          >
            {timeline.events.map((event) => {
              const copy = getIssuerLifecycleStatusCopy(event.status);
              return (
                <li
                  key={event.eventId}
                  className="rounded-xl border border-border/60 bg-background/40 p-3"
                  data-event-id={event.eventId}
                  data-event-status={event.status}
                  data-event-source={event.source}
                >
                  <p className="text-sm font-medium text-foreground">
                    {copy.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event.occurredAt} — {event.actor.displayName} ({event.actor.role}, source: {event.source})
                  </p>
                  {event.notes && (
                    <p className="text-[11px] text-muted-foreground/80 mt-1">
                      {event.notes}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-[11px] italic text-muted-foreground/80">
            Current status: {statusCopy.label} — {statusCopy.description}
          </p>
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5"
          aria-label="Next actions"
        >
          <h2 className="text-sm font-semibold mb-3 text-foreground">
            Next actions
          </h2>
          <ul className="space-y-2" data-testid="issuer-request-actions">
            {[
              {
                key: 'record_consent',
                label: 'Record consent',
                description:
                  'Capture holder consent for this verification scope. Required before a manual send link can be generated.',
              },
              {
                key: 'generate_manual_link',
                label: 'Generate manual send link',
                description:
                  'Generate the manual link the requester will copy. Generation is not delivery.',
              },
              {
                key: 'copy_link',
                label: 'Copy link',
                description:
                  'Attest that the link has been copied. Copying is not delivery.',
              },
              {
                key: 'mark_sent_manually',
                label: 'Mark sent manually',
                description:
                  'Attest that the requester sent the link from their own email client. Sent attestation does not mean the issuer viewed the request.',
              },
              {
                key: 'mark_viewed',
                label: 'Mark viewed (observed)',
                description:
                  'Record an observed view event from the verification surface. Observation does not finalize the claim.',
              },
              {
                key: 'record_response_received',
                label: 'Record response received (observed)',
                description:
                  'Record that a response was received. Receipt does not finalize verification.',
              },
              {
                key: 'create_receipt_candidate',
                label: 'Create receipt candidate',
                description:
                  'Build a receipt candidate from the response. The candidate is not a global PSV.',
              },
            ].map((action) => (
              <li
                key={action.key}
                className="rounded-xl border border-border/60 bg-background/40 p-3"
                data-action-key={action.key}
              >
                <p className="text-sm font-medium text-foreground">
                  {action.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {action.description}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] italic text-muted-foreground/80">
            Submitting on this page does not write a real audit-event row and
            does not send any email or SMS.
          </p>
        </section>

        <section
          className="rounded-2xl border border-border bg-card/60 p-4"
          aria-label="Dry-run next event"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Dry-run next event
          </p>
          <p
            className="text-xs text-muted-foreground"
            data-testid="dry-run-next-event"
            data-next-status={dryRunNext.currentStatus}
          >
            If a response were received next, the timeline would advance to{' '}
            {dryRunNext.currentStatus}. Receipt of a response does not
            finalize verification.
          </p>
        </section>

        <section className="text-[11px] text-muted-foreground/70">
          <p data-testid="issuer-request-copy">
            Lifecycle status copy:{' '}
            {Object.values(ISSUER_REQUEST_LIFECYCLE_COPY)
              .map((s) => s.label)
              .join(' · ')}
          </p>
        </section>
      </div>
    </main>
  );
}
