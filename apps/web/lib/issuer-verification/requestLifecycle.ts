import type {
  ConsentArtifact,
  IssuerVerificationRequest,
  VerificationClaimType,
} from './types';

/**
 * ISSUER-6 — Issuer request lifecycle, consent, and manual send link.
 *
 * Truth contract:
 *   - Consent enables a send; it is NOT verification.
 *   - A generated manual link is NOT delivery. VitalCV does NOT send
 *     emails, SMS, or webhooks from this module.
 *   - `copied_by_requester` is requester-attested; it does NOT mean
 *     the issuer received anything.
 *   - `sent_by_requester` is requester-attested; it does NOT mean
 *     the issuer viewed anything.
 *   - `viewed_by_issuer` requires an explicit observation event;
 *     it does NOT mean the claim is verified.
 *   - `response_received` is NOT final PSV — see ISSUER-2/3/4.
 *   - `receipt_candidate_created` is candidate-grade only.
 *   - `policy_review_pending` is NOT acceptance.
 *   - `psv_receipt_promoted` is the literal proof tier crossover from
 *     candidate to scoped receipt — but the receipt is still scoped
 *     evidence per ISSUER-4 (globalCredentialTruth remains false).
 *   - No lifecycle status creates global credential truth.
 *   - `auditMetadata.eventState` defaults to `'pending_not_written'`.
 *     This module does NOT write a real audit-event row.
 *
 * This module is a pure transform — no fetches, no DB writes, no
 * audit-event writes, no real I/O.
 */

export type IssuerRequestLifecycleStatus =
  | 'draft'
  | 'consent_required'
  | 'consent_recorded'
  | 'ready_to_send'
  | 'manual_link_generated'
  | 'copied_by_requester'
  | 'sent_by_requester'
  | 'viewed_by_issuer'
  | 'response_received'
  | 'receipt_candidate_created'
  | 'policy_review_pending'
  | 'psv_receipt_promoted'
  | 'closed'
  | 'canceled'
  | 'expired';

export type IssuerRequestLifecycleActorRole =
  | 'requester'
  | 'holder'
  | 'issuer'
  | 'reviewer'
  | 'system'
  | 'demo';

export interface IssuerRequestLifecycleActor {
  actorId: string;
  displayName: string;
  role: IssuerRequestLifecycleActorRole;
}

/**
 * Source of an event. `attested` events are recorded based on a
 * party self-asserting that something happened (e.g., the requester
 * marking "I sent this manually"). `observed` events are recorded
 * because VitalCV directly observed something (e.g., the issuer
 * landing on the verification page). `system` events are clock or
 * lifecycle transitions emitted by VitalCV itself.
 */
export type IssuerRequestEventSource = 'attested' | 'observed' | 'system';

export interface IssuerRequestLifecycleEvent {
  eventId: string;
  status: IssuerRequestLifecycleStatus;
  occurredAt: string;
  actor: IssuerRequestLifecycleActor;
  source: IssuerRequestEventSource;
  notes?: string;
}

export interface IssuerRequestTimeline {
  requestId: string;
  events: ReadonlyArray<IssuerRequestLifecycleEvent>;
  /** The most recent status across all events; not derived from a clock. */
  currentStatus: IssuerRequestLifecycleStatus;
  /** Convenience: latest event by occurredAt. Undefined when empty. */
  latestEvent?: IssuerRequestLifecycleEvent;
}

export interface ConsentRequirement {
  required: boolean;
  /** When `required: false`, an explicit reason MUST be supplied. */
  reason?: string;
  /** The scope the issuer is being asked to act under. */
  scope: string;
  claimType: VerificationClaimType;
}

export interface ConsentArtifactSummary {
  consentId: string;
  scope: string;
  status: 'pending' | 'granted' | 'revoked' | 'expired';
  consentedAt?: string;
  expiresAt?: string;
  /** Pointer to the underlying release form, if any. Demo only. */
  releaseFormUrl?: string;
}

export interface ManualIssuerSendLink {
  linkId: string;
  /**
   * The URL the requester is meant to copy / paste into their own
   * email client. VitalCV does NOT send the email.
   */
  url: string;
  generatedAt: string;
  /** Caller-controlled expiration; not enforced by this module. */
  expiresAt: string;
  /**
   * The action a requester is expected to take next. Plain language;
   * surfaced verbatim by the demo page.
   */
  instructions: string;
}

export type IssuerRequestDeliveryAttestation =
  | 'not_attested'
  | 'copied'
  | 'sent_by_requester'
  | 'redacted_for_privacy';

export interface IssuerRequestDeliveryState {
  attestation: IssuerRequestDeliveryAttestation;
  attestedAt?: string;
  attestedBy?: IssuerRequestLifecycleActor;
  channel?: 'email' | 'phone' | 'fax' | 'in_person' | 'other';
  /** Free-text note from the requester. Demo only. */
  note?: string;
}

export interface IssuerRequestLifecycleAuditMetadata {
  recordedAt: string;
  recordedBy: 'demo' | 'review_surface' | 'system';
  eventState: 'pending_not_written' | 'queued_demo_only' | 'written';
  notes?: string;
}

/**
 * Pure: derive a ConsentRequirement for a (claim, request) pair.
 * Some claim types are administrative-scope-only and do not require
 * a clinician release; those return `required: false` with an
 * explicit reason. Most claim types require consent.
 */
export function buildConsentRequirement(
  request: IssuerVerificationRequest,
): ConsentRequirement {
  const claimType = request.claimType;
  // Conservative default: every claim type requires consent unless we
  // explicitly carve out an administrative path. Currently no such
  // carve-out exists — listed claim types are kept here for future
  // extension; today the function always returns required: true.
  const exemptReasons: Partial<Record<VerificationClaimType, string>> = {
    // (intentionally empty — no exemptions ship with ISSUER-6)
  };
  const reason = exemptReasons[claimType];
  if (reason) {
    return {
      required: false,
      reason,
      scope: request.consent.scope,
      claimType,
    };
  }
  return {
    required: true,
    scope: request.consent.scope,
    claimType,
  };
}

/**
 * Pure: summarize an existing ConsentArtifact into a stable shape
 * for the lifecycle module. Does not mutate the artifact.
 */
export function recordConsentArtifactSummary(
  artifact: ConsentArtifact,
): ConsentArtifactSummary {
  return {
    consentId: artifact.consentId,
    scope: artifact.scope,
    status: artifact.status,
    consentedAt: artifact.consentedAt,
    expiresAt: artifact.expiresAt,
    releaseFormUrl: artifact.releaseFormUrl,
  };
}

export type SendLinkRefusalReason =
  | 'consent_required_not_recorded'
  | 'consent_revoked'
  | 'consent_expired'
  | 'request_canceled'
  | 'request_expired';

export interface SendLinkPermission {
  canGenerate: boolean;
  refusalReason?: SendLinkRefusalReason;
  message: string;
}

/**
 * Pure predicate: can a manual send link be generated for this
 * (request, consent, requirement) tuple? When consent is required,
 * the consent must be `granted` — `pending`, `revoked`, and
 * `expired` block. When consent is not required, only request-level
 * cancellations/expirations block.
 */
export function canGenerateIssuerSendLink(input: {
  request: IssuerVerificationRequest;
  requirement: ConsentRequirement;
  consent: ConsentArtifactSummary;
}): SendLinkPermission {
  const { request, requirement, consent } = input;
  if (request.status === 'canceled') {
    return {
      canGenerate: false,
      refusalReason: 'request_canceled',
      message:
        'The verification request has been canceled; no manual send link can be generated.',
    };
  }
  if (request.status === 'expired') {
    return {
      canGenerate: false,
      refusalReason: 'request_expired',
      message:
        'The verification request has expired; no manual send link can be generated.',
    };
  }
  if (requirement.required) {
    if (consent.status === 'revoked') {
      return {
        canGenerate: false,
        refusalReason: 'consent_revoked',
        message:
          'Consent for this verification has been revoked; manual send link generation is blocked.',
      };
    }
    if (consent.status === 'expired') {
      return {
        canGenerate: false,
        refusalReason: 'consent_expired',
        message:
          'The recorded consent has expired; manual send link generation is blocked.',
      };
    }
    if (consent.status !== 'granted') {
      return {
        canGenerate: false,
        refusalReason: 'consent_required_not_recorded',
        message:
          'Consent is required for this claim type and has not been recorded yet.',
      };
    }
  }
  return {
    canGenerate: true,
    message:
      'Send link may be generated. Generation is not delivery; the requester must copy the link and send it manually.',
  };
}

interface ManualLinkOptions {
  linkId: string;
  baseUrl: string;
  generatedAt: string;
  ttlMinutes: number;
  /**
   * Optional purpose hint shown to the issuer in the link. Plain
   * language; demo only.
   */
  purposeHint?: string;
}

const ONE_MINUTE_MS = 60 * 1000;

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : url + '/';
}

/**
 * Build a ManualIssuerSendLink. Throws if `canGenerateIssuerSendLink`
 * would have refused — defense-in-depth so callers cannot bypass
 * the consent gate by skipping the predicate.
 */
export function buildManualIssuerSendLink(
  input: {
    request: IssuerVerificationRequest;
    requirement: ConsentRequirement;
    consent: ConsentArtifactSummary;
  },
  options: ManualLinkOptions,
): ManualIssuerSendLink {
  const permission = canGenerateIssuerSendLink(input);
  if (!permission.canGenerate) {
    throw new Error(
      `buildManualIssuerSendLink refused: ${permission.refusalReason ?? 'unknown'} — ${permission.message}`,
    );
  }
  const generated = new Date(options.generatedAt);
  if (Number.isNaN(generated.valueOf())) {
    throw new Error(
      `buildManualIssuerSendLink: invalid generatedAt timestamp: ${options.generatedAt}`,
    );
  }
  const expiresAtMs = generated.valueOf() + options.ttlMinutes * ONE_MINUTE_MS;
  const url = `${ensureTrailingSlash(options.baseUrl)}issuer/verify/${input.request.requestId}?link=${options.linkId}`;
  const purpose = options.purposeHint
    ? ` (${options.purposeHint})`
    : '';
  return {
    linkId: options.linkId,
    url,
    generatedAt: options.generatedAt,
    expiresAt: new Date(expiresAtMs).toISOString(),
    instructions:
      `Copy this link and send it manually${purpose} to the issuer's verification contact. ` +
      'VitalCV does not send email or SMS; the link is delivered by the requester.',
  };
}

interface AppendOptions {
  eventId: string;
  status: IssuerRequestLifecycleStatus;
  occurredAt: string;
  actor: IssuerRequestLifecycleActor;
  source: IssuerRequestEventSource;
  notes?: string;
}

/**
 * Pure: append an event to a timeline and return the updated
 * timeline. Does NOT mutate the input.
 */
export function appendIssuerLifecycleEvent(
  timeline: IssuerRequestTimeline,
  options: AppendOptions,
): IssuerRequestTimeline {
  const event: IssuerRequestLifecycleEvent = {
    eventId: options.eventId,
    status: options.status,
    occurredAt: options.occurredAt,
    actor: options.actor,
    source: options.source,
    notes: options.notes,
  };
  const events = [...timeline.events, event];
  return {
    requestId: timeline.requestId,
    events,
    currentStatus: event.status,
    latestEvent: event,
  };
}

/**
 * Pure: derive a fresh timeline from a request and a list of
 * events. Caller-supplied events; this module does not invent any.
 */
export function getIssuerRequestTimeline(
  request: IssuerVerificationRequest,
  events: ReadonlyArray<IssuerRequestLifecycleEvent>,
): IssuerRequestTimeline {
  if (events.length === 0) {
    return {
      requestId: request.requestId,
      events: [],
      currentStatus: 'draft',
    };
  }
  const sorted = [...events].sort(
    (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
  );
  const latest = sorted[sorted.length - 1];
  return {
    requestId: request.requestId,
    events: sorted,
    currentStatus: latest.status,
    latestEvent: latest,
  };
}

/**
 * Pure predicate: under the truth contract, can the timeline mark
 * the issuer as having viewed the request? Requires an explicit
 * `observed` event source — requester attestation alone is not
 * enough.
 */
export function canMarkIssuerViewed(input: {
  timeline: IssuerRequestTimeline;
  proposedSource: IssuerRequestEventSource;
}): { allowed: boolean; reason: string } {
  if (input.proposedSource !== 'observed') {
    return {
      allowed: false,
      reason:
        'viewed_by_issuer requires an observed event from the verification surface; requester attestation does not satisfy this gate.',
    };
  }
  // Allowed regardless of prior status — observation can be recorded
  // any time after the link is generated.
  const minimumStatuses: IssuerRequestLifecycleStatus[] = [
    'manual_link_generated',
    'copied_by_requester',
    'sent_by_requester',
    'viewed_by_issuer',
  ];
  if (!minimumStatuses.includes(input.timeline.currentStatus)) {
    return {
      allowed: false,
      reason:
        'viewed_by_issuer cannot precede manual_link_generated; generate the link first.',
    };
  }
  return {
    allowed: true,
    reason: 'Observation event may be recorded.',
  };
}

/**
 * Pure predicate: can a `response_received` status be appended? The
 * truth contract requires the request to be at or past
 * `sent_by_requester` AND the event source to be `observed`. This
 * does NOT mean the response is verified — it only means a response
 * was received.
 */
export function canMarkResponseReceived(input: {
  timeline: IssuerRequestTimeline;
  proposedSource: IssuerRequestEventSource;
}): { allowed: boolean; reason: string } {
  if (input.proposedSource !== 'observed') {
    return {
      allowed: false,
      reason:
        'response_received requires an observed event; requester attestation alone does not satisfy this gate.',
    };
  }
  const validPriorStatuses: IssuerRequestLifecycleStatus[] = [
    'sent_by_requester',
    'viewed_by_issuer',
    'response_received',
  ];
  if (!validPriorStatuses.includes(input.timeline.currentStatus)) {
    return {
      allowed: false,
      reason:
        'response_received requires the request to be at or past sent_by_requester before a response can be recorded.',
    };
  }
  return {
    allowed: true,
    reason:
      'Response event may be recorded. Receipt of a response does not verify the claim.',
  };
}
