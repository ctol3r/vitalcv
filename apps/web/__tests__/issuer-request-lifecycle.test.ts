import { describe, expect, it } from 'vitest';
import {
  appendIssuerLifecycleEvent,
  buildConsentRequirement,
  buildManualIssuerSendLink,
  canGenerateIssuerSendLink,
  canMarkIssuerViewed,
  canMarkResponseReceived,
  getIssuerRequestTimeline,
  recordConsentArtifactSummary,
} from '../lib/issuer-verification/requestLifecycle';
import type {
  IssuerRequestLifecycleActor,
  IssuerRequestLifecycleEvent,
} from '../lib/issuer-verification/requestLifecycle';
import {
  ISSUER_REQUEST_LIFECYCLE_COPY,
  getIssuerLifecycleStatusCopy,
} from '../lib/issuer-verification/statusCopy';
import { recommendPartnerRoute } from '../lib/issuer-verification/partnerRouter';
import type {
  ConsentArtifact,
  IssuerVerificationRequest,
  VerificationClaimType,
} from '../lib/issuer-verification/types';

// Banned tokens via split-join to avoid self-grep matches.
const BANNED = [
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
  ['final', 'verification', 'without', 'review'].join(' '),
  ['source', 'confirmed', 'before', 'response'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
  ['issuer', 'confirmed'].join(' '),
  ['legally', 'sent'].join(' '),
];

const REQUESTER: IssuerRequestLifecycleActor = {
  actorId: 'r-1',
  displayName: 'Pat Requester',
  role: 'requester',
};

const HOLDER: IssuerRequestLifecycleActor = {
  actorId: 'h-1',
  displayName: 'Sam Holder',
  role: 'holder',
};

const ISSUER_OBSERVER: IssuerRequestLifecycleActor = {
  actorId: 'i-1',
  displayName: 'Verification Surface',
  role: 'issuer',
};

function makeConsent(overrides: Partial<ConsentArtifact> = {}): ConsentArtifact {
  return {
    consentId: 'consent-1',
    scope: 'verify_residency',
    status: 'granted',
    consentedAt: '2026-04-26T00:00:00.000Z',
    ...overrides,
  };
}

function makeRequest(
  overrides: Partial<IssuerVerificationRequest> = {},
): IssuerVerificationRequest {
  const claimType: VerificationClaimType = 'residency';
  return {
    requestId: 'req-1',
    claimType,
    claimSummary: 'Residency: Internal Medicine',
    issuerCandidate: {
      candidateId: 'cand-1',
      organizationName: 'Demo GME Office',
      source: 'clinician_provided',
    },
    route: recommendPartnerRoute(claimType),
    consent: makeConsent(),
    status: 'sent',
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z',
    history: [],
    ...overrides,
  };
}

describe('buildConsentRequirement', () => {
  it('returns required=true for residency', () => {
    const req = buildConsentRequirement(makeRequest());
    expect(req.required).toBe(true);
    expect(req.scope).toBe('verify_residency');
    expect(req.claimType).toBe('residency');
  });
  it('returns required=true for unknown claim types (conservative default)', () => {
    const req = buildConsentRequirement(makeRequest({ claimType: 'unknown' }));
    expect(req.required).toBe(true);
  });
});

describe('recordConsentArtifactSummary', () => {
  it('round-trips fields verbatim', () => {
    const consent = makeConsent({
      releaseFormUrl: 'https://demo/release/1',
      expiresAt: '2027-04-26T00:00:00.000Z',
    });
    const summary = recordConsentArtifactSummary(consent);
    expect(summary.consentId).toBe(consent.consentId);
    expect(summary.scope).toBe(consent.scope);
    expect(summary.status).toBe(consent.status);
    expect(summary.consentedAt).toBe(consent.consentedAt);
    expect(summary.expiresAt).toBe(consent.expiresAt);
    expect(summary.releaseFormUrl).toBe(consent.releaseFormUrl);
  });
});

describe('canGenerateIssuerSendLink', () => {
  it('cannot generate when consent required and not granted (pending)', () => {
    const request = makeRequest();
    const requirement = buildConsentRequirement(request);
    const consent = recordConsentArtifactSummary(makeConsent({ status: 'pending' }));
    const result = canGenerateIssuerSendLink({ request, requirement, consent });
    expect(result.canGenerate).toBe(false);
    expect(result.refusalReason).toBe('consent_required_not_recorded');
  });

  it('cannot generate when consent revoked', () => {
    const request = makeRequest();
    const requirement = buildConsentRequirement(request);
    const consent = recordConsentArtifactSummary(makeConsent({ status: 'revoked' }));
    const result = canGenerateIssuerSendLink({ request, requirement, consent });
    expect(result.canGenerate).toBe(false);
    expect(result.refusalReason).toBe('consent_revoked');
  });

  it('cannot generate when consent expired', () => {
    const request = makeRequest();
    const requirement = buildConsentRequirement(request);
    const consent = recordConsentArtifactSummary(makeConsent({ status: 'expired' }));
    const result = canGenerateIssuerSendLink({ request, requirement, consent });
    expect(result.canGenerate).toBe(false);
    expect(result.refusalReason).toBe('consent_expired');
  });

  it('cannot generate when request canceled', () => {
    const request = makeRequest({ status: 'canceled' });
    const requirement = buildConsentRequirement(request);
    const consent = recordConsentArtifactSummary(makeConsent());
    const result = canGenerateIssuerSendLink({ request, requirement, consent });
    expect(result.canGenerate).toBe(false);
    expect(result.refusalReason).toBe('request_canceled');
  });

  it('cannot generate when request expired', () => {
    const request = makeRequest({ status: 'expired' });
    const requirement = buildConsentRequirement(request);
    const consent = recordConsentArtifactSummary(makeConsent());
    const result = canGenerateIssuerSendLink({ request, requirement, consent });
    expect(result.canGenerate).toBe(false);
    expect(result.refusalReason).toBe('request_expired');
  });

  it('can generate after consent recorded as granted', () => {
    const request = makeRequest();
    const requirement = buildConsentRequirement(request);
    const consent = recordConsentArtifactSummary(makeConsent({ status: 'granted' }));
    const result = canGenerateIssuerSendLink({ request, requirement, consent });
    expect(result.canGenerate).toBe(true);
  });
});

describe('buildManualIssuerSendLink', () => {
  function ok() {
    const request = makeRequest();
    const requirement = buildConsentRequirement(request);
    const consent = recordConsentArtifactSummary(makeConsent());
    return { request, requirement, consent };
  }

  it('throws when permission would refuse (consent revoked)', () => {
    const { request, requirement } = ok();
    const consent = recordConsentArtifactSummary(makeConsent({ status: 'revoked' }));
    expect(() =>
      buildManualIssuerSendLink(
        { request, requirement, consent },
        {
          linkId: 'link-1',
          baseUrl: 'https://demo.vitalcv.example',
          generatedAt: '2026-04-26T01:00:00.000Z',
          ttlMinutes: 60,
        },
      ),
    ).toThrow(/consent_revoked/);
  });

  it('builds a link with TTL-derived expiresAt and copy/send instructions', () => {
    const link = buildManualIssuerSendLink(ok(), {
      linkId: 'link-1',
      baseUrl: 'https://demo.vitalcv.example',
      generatedAt: '2026-04-26T01:00:00.000Z',
      ttlMinutes: 60,
    });
    expect(link.url).toContain('issuer/verify/req-1');
    expect(link.url).toContain('link=link-1');
    expect(link.expiresAt).toBe('2026-04-26T02:00:00.000Z');
    expect(link.instructions.toLowerCase()).toContain('copy');
    expect(link.instructions.toLowerCase()).toContain('manually');
    expect(link.instructions.toLowerCase()).not.toContain('vitalcv sends');
  });

  it('generation does not constitute delivery — instructions explicitly disclaim VitalCV-side dispatch', () => {
    const link = buildManualIssuerSendLink(ok(), {
      linkId: 'link-1',
      baseUrl: 'https://demo.vitalcv.example',
      generatedAt: '2026-04-26T01:00:00.000Z',
      ttlMinutes: 60,
    });
    expect(link.instructions.toLowerCase()).toMatch(
      /vitalcv does not (dispatch|send)/,
    );
    expect(link.instructions.toLowerCase()).toContain('manually');
    expect(link.instructions.toLowerCase()).toContain('the requester');
  });
});

describe('appendIssuerLifecycleEvent + getIssuerRequestTimeline', () => {
  it('empty timeline starts as draft', () => {
    const t = getIssuerRequestTimeline(makeRequest(), []);
    expect(t.currentStatus).toBe('draft');
    expect(t.events.length).toBe(0);
    expect(t.latestEvent).toBeUndefined();
  });

  it('events are sorted by occurredAt and currentStatus reflects latest', () => {
    const request = makeRequest();
    const events: IssuerRequestLifecycleEvent[] = [
      {
        eventId: 'e2',
        status: 'manual_link_generated',
        occurredAt: '2026-04-26T01:00:00.000Z',
        actor: REQUESTER,
        source: 'system',
      },
      {
        eventId: 'e1',
        status: 'consent_recorded',
        occurredAt: '2026-04-26T00:00:00.000Z',
        actor: HOLDER,
        source: 'attested',
      },
    ];
    const t = getIssuerRequestTimeline(request, events);
    expect(t.events.map((e) => e.eventId)).toEqual(['e1', 'e2']);
    expect(t.currentStatus).toBe('manual_link_generated');
    expect(t.latestEvent?.eventId).toBe('e2');
  });

  it('appendIssuerLifecycleEvent does not mutate the input timeline', () => {
    const initial = getIssuerRequestTimeline(makeRequest(), []);
    const next = appendIssuerLifecycleEvent(initial, {
      eventId: 'e1',
      status: 'consent_recorded',
      occurredAt: '2026-04-26T00:00:00.000Z',
      actor: HOLDER,
      source: 'attested',
    });
    expect(next).not.toBe(initial);
    expect(initial.events.length).toBe(0);
    expect(next.events.length).toBe(1);
  });

  it('preserves actor / occurredAt / source on each event', () => {
    const initial = getIssuerRequestTimeline(makeRequest(), []);
    const next = appendIssuerLifecycleEvent(initial, {
      eventId: 'e1',
      status: 'sent_by_requester',
      occurredAt: '2026-04-26T01:10:00.000Z',
      actor: REQUESTER,
      source: 'attested',
      notes: 'Sent via own email client.',
    });
    expect(next.latestEvent?.actor).toEqual(REQUESTER);
    expect(next.latestEvent?.occurredAt).toBe('2026-04-26T01:10:00.000Z');
    expect(next.latestEvent?.source).toBe('attested');
    expect(next.latestEvent?.notes).toContain('email client');
  });
});

describe('Truth-contract gates between statuses', () => {
  it('manual_link_generated does not equal sent', () => {
    const t = getIssuerRequestTimeline(makeRequest(), [
      {
        eventId: 'e1',
        status: 'manual_link_generated',
        occurredAt: '2026-04-26T01:00:00.000Z',
        actor: REQUESTER,
        source: 'system',
      },
    ]);
    expect(t.currentStatus).not.toBe('sent_by_requester');
  });

  it('copied_by_requester does not equal sent', () => {
    const t = getIssuerRequestTimeline(makeRequest(), [
      {
        eventId: 'e1',
        status: 'copied_by_requester',
        occurredAt: '2026-04-26T01:05:00.000Z',
        actor: REQUESTER,
        source: 'attested',
      },
    ]);
    expect(t.currentStatus).toBe('copied_by_requester');
    expect(t.currentStatus).not.toBe('sent_by_requester');
  });

  it('sent_by_requester does not equal viewed (canMarkIssuerViewed gate)', () => {
    const t = getIssuerRequestTimeline(makeRequest(), [
      {
        eventId: 'e1',
        status: 'sent_by_requester',
        occurredAt: '2026-04-26T01:10:00.000Z',
        actor: REQUESTER,
        source: 'attested',
      },
    ]);
    expect(t.currentStatus).toBe('sent_by_requester');
    expect(
      canMarkIssuerViewed({ timeline: t, proposedSource: 'attested' }).allowed,
    ).toBe(false);
    expect(
      canMarkIssuerViewed({ timeline: t, proposedSource: 'observed' }).allowed,
    ).toBe(true);
  });

  it('viewed_by_issuer does not verify the claim — it is a placeholder, not a finalization', () => {
    const t = getIssuerRequestTimeline(makeRequest(), [
      {
        eventId: 'e1',
        status: 'manual_link_generated',
        occurredAt: '2026-04-26T01:00:00.000Z',
        actor: REQUESTER,
        source: 'system',
      },
      {
        eventId: 'e2',
        status: 'viewed_by_issuer',
        occurredAt: '2026-04-26T03:00:00.000Z',
        actor: ISSUER_OBSERVER,
        source: 'observed',
      },
    ]);
    expect(t.currentStatus).toBe('viewed_by_issuer');
    expect((t.currentStatus as string)).not.toBe('verified');
    // Truth-contract guard: copy for viewed_by_issuer never claims finality.
    const copy = getIssuerLifecycleStatusCopy('viewed_by_issuer');
    expect(copy.description.toLowerCase()).not.toContain('verified');
    expect(copy.description.toLowerCase()).not.toContain('confirmed');
  });

  it('canMarkIssuerViewed refuses requester-attested view events', () => {
    const t = getIssuerRequestTimeline(makeRequest(), [
      {
        eventId: 'e1',
        status: 'manual_link_generated',
        occurredAt: '2026-04-26T01:00:00.000Z',
        actor: REQUESTER,
        source: 'system',
      },
    ]);
    const result = canMarkIssuerViewed({
      timeline: t,
      proposedSource: 'attested',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason.toLowerCase()).toContain('observed');
  });

  it('canMarkIssuerViewed refuses before manual_link_generated', () => {
    const t = getIssuerRequestTimeline(makeRequest(), []);
    expect(
      canMarkIssuerViewed({ timeline: t, proposedSource: 'observed' }).allowed,
    ).toBe(false);
  });

  it('response_received does not verify the claim', () => {
    const t = getIssuerRequestTimeline(makeRequest(), [
      {
        eventId: 'e1',
        status: 'sent_by_requester',
        occurredAt: '2026-04-26T01:10:00.000Z',
        actor: REQUESTER,
        source: 'attested',
      },
    ]);
    const result = canMarkResponseReceived({
      timeline: t,
      proposedSource: 'observed',
    });
    expect(result.allowed).toBe(true);
    expect(result.reason.toLowerCase()).toContain('does not verify');
    // Copy guard:
    const copy = getIssuerLifecycleStatusCopy('response_received');
    expect(copy.description.toLowerCase()).toContain('does not finalize');
  });

  it('canMarkResponseReceived refuses before sent_by_requester', () => {
    const t = getIssuerRequestTimeline(makeRequest(), [
      {
        eventId: 'e1',
        status: 'copied_by_requester',
        occurredAt: '2026-04-26T01:05:00.000Z',
        actor: REQUESTER,
        source: 'attested',
      },
    ]);
    expect(
      canMarkResponseReceived({ timeline: t, proposedSource: 'observed' })
        .allowed,
    ).toBe(false);
  });

  it('canMarkResponseReceived refuses requester-attested response events', () => {
    const t = getIssuerRequestTimeline(makeRequest(), [
      {
        eventId: 'e1',
        status: 'sent_by_requester',
        occurredAt: '2026-04-26T01:10:00.000Z',
        actor: REQUESTER,
        source: 'attested',
      },
    ]);
    const result = canMarkResponseReceived({
      timeline: t,
      proposedSource: 'attested',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason.toLowerCase()).toContain('observed');
  });

  it('receipt_candidate_created does not finalize PSV', () => {
    const t = getIssuerRequestTimeline(makeRequest(), [
      {
        eventId: 'e1',
        status: 'receipt_candidate_created',
        occurredAt: '2026-04-26T05:00:00.000Z',
        actor: REQUESTER,
        source: 'system',
      },
    ]);
    expect(t.currentStatus).toBe('receipt_candidate_created');
    const copy = getIssuerLifecycleStatusCopy('receipt_candidate_created');
    expect(copy.description.toLowerCase()).toContain('candidate');
    expect(copy.description.toLowerCase()).toContain('still required');
  });

  it('psv_receipt_promoted reflects ISSUER-4 outcome and does not claim global truth', () => {
    const copy = getIssuerLifecycleStatusCopy('psv_receipt_promoted');
    expect(copy.description.toLowerCase()).toContain('scoped');
    expect(copy.description.toLowerCase()).toContain('not global credential truth');
  });
});

describe('Lifecycle copy', () => {
  it('exposes copy for every IssuerRequestLifecycleCopyKey', () => {
    const keys = Object.keys(ISSUER_REQUEST_LIFECYCLE_COPY) as Array<
      keyof typeof ISSUER_REQUEST_LIFECYCLE_COPY
    >;
    for (const k of keys) {
      const c = getIssuerLifecycleStatusCopy(k);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });

  it('keeps banned overclaim phrases out of lifecycle copy', () => {
    const blob = JSON.stringify(ISSUER_REQUEST_LIFECYCLE_COPY).toLowerCase();
    for (const phrase of BANNED) {
      expect(blob).not.toContain(phrase.toLowerCase());
    }
  });

  it('no lifecycle copy label is the bare word "Verified"', () => {
    for (const c of Object.values(ISSUER_REQUEST_LIFECYCLE_COPY)) {
      expect(c.label).not.toBe('Verified');
    }
  });
});

describe('Knowledge Trust Graph — ISSUER-6 alignment', () => {
  it('keeps the lifecycle nodes and rules parseable and aligned', async () => {
    const raw = await import(
      '../../../docs/architecture/vitalcv-knowledge-trust-graph.json'
    );
    const graph = raw.default ?? raw;
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        'ConsentRequirement',
        'ConsentArtifactSummary',
        'ManualIssuerSendLink',
        'IssuerRequestTimeline',
        'IssuerRequestLifecycleEvent',
        'IssuerRequestDeliveryState',
        'RequesterAction',
        'IssuerViewEvent',
      ]),
    );
    expect(graph.rules).toEqual(
      expect.arrayContaining([
        'Consent enables a manual send link to be generated; consent is not verification.',
        'Manual link generation is not delivery; VitalCV does not send email or SMS from the lifecycle module.',
        'copied_by_requester and sent_by_requester are requester-attested; they do not mean the issuer received or viewed anything.',
        'viewed_by_issuer requires an explicit observed event from the verification surface; requester attestation does not satisfy this gate.',
        'response_received does not finalize verification; receipt candidate review and policy review are still required.',
        'No issuer request lifecycle status creates global credential truth.',
      ]),
    );
  });
});
