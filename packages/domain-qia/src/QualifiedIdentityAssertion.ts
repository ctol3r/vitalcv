/**
 * Qualified Identity Assertion (QIA) creation and validation.
 */

import type {
  AuthorityRef,
  CredentialRef,
  EvidenceRef,
  FreshnessProof,
  QiaEvent,
  QiaTemporalBounds,
  SignatureEnvelope,
  SubjectRef,
} from './types';
import { AmbiguousQiaStateError, QiaEventType, QiaInvariantError } from './types';
import type { IntentBinding } from './IntentBinding';
import {
  assertNonEmptyString,
  assertValidAuthorityRef,
  assertValidDate,
  assertValidFreshnessProof,
  assertValidIntentBinding,
  assertValidQiaEvent,
  assertValidSignatureEnvelope,
  assertValidStringArray,
  assertValidSubjectRef,
  assertValidTemporalBounds,
} from './invariants';

export interface QualifiedIdentityAssertion {
  readonly qia_id: string;
  readonly subject: SubjectRef;
  readonly authority: AuthorityRef;
  readonly intent: IntentBinding;
  readonly temporal: QiaTemporalBounds;
  readonly freshness: FreshnessProof;
  readonly credential_refs?: readonly CredentialRef[];
  readonly evidence_refs?: readonly EvidenceRef[];
  readonly event_log: readonly QiaEvent[];
  readonly signature?: SignatureEnvelope;
}

export interface CreateQiaInput {
  readonly qia_id: string;
  readonly subject: SubjectRef;
  readonly authority: AuthorityRef;
  readonly intent: IntentBinding;
  readonly temporal: QiaTemporalBounds;
  readonly freshness: FreshnessProof;
  readonly credential_refs?: readonly CredentialRef[];
  readonly evidence_refs?: readonly EvidenceRef[];
  readonly event_log?: readonly QiaEvent[];
  readonly signature?: SignatureEnvelope;
}

function assertValidQualifiedIdentityAssertion(qia: QualifiedIdentityAssertion): void {
  if (!qia) {
    throw new QiaInvariantError('QIA is required');
  }
  assertNonEmptyString(qia.qia_id, 'qia.qia_id');
  assertValidSubjectRef(qia.subject);
  assertValidAuthorityRef(qia.authority);
  assertValidIntentBinding(qia.intent);
  assertValidTemporalBounds(qia.temporal);
  if (!qia.freshness) {
    throw new AmbiguousQiaStateError('freshness proof is required for QIA');
  }
  assertValidFreshnessProof(qia.freshness);
  if (qia.credential_refs) {
    assertValidStringArray(qia.credential_refs, 'qia.credential_refs', QiaInvariantError, {
      allowEmpty: true,
    });
  }
  if (qia.evidence_refs) {
    assertValidStringArray(qia.evidence_refs, 'qia.evidence_refs', QiaInvariantError, {
      allowEmpty: true,
    });
  }
  if (!Array.isArray(qia.event_log) || qia.event_log.length === 0) {
    throw new QiaInvariantError('qia.event_log must be a non-empty array');
  }
  for (const event of qia.event_log) {
    assertValidQiaEvent(event);
    if (event.qia_id !== qia.qia_id) {
      throw new QiaInvariantError(
        `QIA event ${event.event_id} qia_id mismatch: expected ${qia.qia_id}, got ${event.qia_id}`,
      );
    }
  }
  if (qia.signature) {
    assertValidSignatureEnvelope(qia.signature);
  }
}

function buildIssueEvent(qiaId: string, issuedAt: Date): QiaEvent {
  return {
    event_id: `${qiaId}:issue:${issuedAt.toISOString()}`,
    qia_id: qiaId,
    event_type: QiaEventType.ISSUE,
    occurred_at: issuedAt,
    effective_at: issuedAt,
  };
}

function getEventEffectiveAt(event: QiaEvent): Date {
  return event.effective_at ?? event.occurred_at;
}

function findRevocationEvent(events: readonly QiaEvent[], now: Date): QiaEvent | null {
  for (const event of events) {
    if (event.event_type === QiaEventType.REVOKE) {
      const effectiveAt = getEventEffectiveAt(event);
      if (effectiveAt <= now) {
        return event;
      }
    }
  }
  return null;
}

export function createQIA(input: CreateQiaInput): QualifiedIdentityAssertion {
  if (!input) {
    throw new QiaInvariantError('input is required');
  }

  const issuedAt = assertValidDate(input.temporal?.issued_at, 'temporal.issued_at');

  const eventLog =
    input.event_log && input.event_log.length > 0
      ? [...input.event_log]
      : [buildIssueEvent(input.qia_id, issuedAt)];

  const qia: QualifiedIdentityAssertion = {
    qia_id: input.qia_id,
    subject: input.subject,
    authority: input.authority,
    intent: input.intent,
    temporal: input.temporal,
    freshness: input.freshness,
    credential_refs: input.credential_refs,
    evidence_refs: input.evidence_refs,
    event_log: eventLog,
    signature: input.signature,
  };

  assertValidQualifiedIdentityAssertion(qia);

  return qia;
}

export function validateQIA(
  qia: QualifiedIdentityAssertion,
  now: Date = new Date(),
): { ok: true } | { ok: false; reasons: string[] } {
  assertValidQualifiedIdentityAssertion(qia);

  const checkTime = assertValidDate(now, 'now', AmbiguousQiaStateError);

  // REVOCATION-FIRST: terminal state
  const revocation = findRevocationEvent(qia.event_log, checkTime);
  if (revocation) {
    const effectiveAt = getEventEffectiveAt(revocation);
    const suffix = revocation.reason ? `: ${revocation.reason}` : '';
    return {
      ok: false,
      reasons: [
        `Revoked by event ${revocation.event_id} effective ${effectiveAt.toISOString()}${suffix}`,
      ],
    };
  }

  const reasons: string[] = [];
  const temporal = qia.temporal;
  const notBefore = temporal.not_before ?? temporal.issued_at;

  if (checkTime < notBefore) {
    reasons.push(`Not valid before ${notBefore.toISOString()}`);
  }
  if (checkTime >= temporal.expires_at) {
    reasons.push(`Expired at ${temporal.expires_at.toISOString()}`);
  }

  const freshness = qia.freshness;
  if (!freshness) {
    throw new AmbiguousQiaStateError('freshness proof is required for validation');
  }
  const provenAt = freshness.proven_at;
  const ageSeconds = (checkTime.getTime() - provenAt.getTime()) / 1000;
  if (ageSeconds < 0) {
    throw new AmbiguousQiaStateError('freshness proof time is in the future');
  }
  if (ageSeconds > freshness.max_age_seconds) {
    reasons.push(
      `Freshness proof expired (age ${Math.floor(ageSeconds)}s > max ${freshness.max_age_seconds}s)`,
    );
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  return { ok: true };
}
