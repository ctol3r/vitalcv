/**
 * Invariants and validation helpers for QIA domain logic.
 */

import type {
  AuthorityRef,
  DecisionEvent,
  FreshnessProof,
  QiaEvent,
  QiaTemporalBounds,
  SignatureEnvelope,
  SubjectRef,
} from './types';
import { DecisionEventType, QiaEventType, QiaInvariantError } from './types';
import type { IntentBinding } from './IntentBinding';

type ErrorConstructor = new (message: string) => Error;

export function assertNonEmptyString(
  value: unknown,
  label: string,
  ErrorCtor: ErrorConstructor = QiaInvariantError,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ErrorCtor(`${label} must be a non-empty string`);
  }
  return value;
}

export function assertValidDate(
  value: unknown,
  label: string,
  ErrorCtor: ErrorConstructor = QiaInvariantError,
): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new ErrorCtor(`${label} must be a valid Date`);
  }
  return value;
}

export function assertValidStringArray(
  value: unknown,
  label: string,
  ErrorCtor: ErrorConstructor = QiaInvariantError,
  options: { allowEmpty?: boolean } = {},
): string[] {
  if (!Array.isArray(value)) {
    throw new ErrorCtor(`${label} must be an array of non-empty strings`);
  }
  if (!options.allowEmpty && value.length === 0) {
    throw new ErrorCtor(`${label} must be a non-empty array`);
  }
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      throw new ErrorCtor(`${label} must contain non-empty strings`);
    }
  }
  return value;
}

export function assertValidSignatureEnvelope(signature: SignatureEnvelope): void {
  if (!signature) {
    throw new QiaInvariantError('signature is required');
  }
  assertNonEmptyString(signature.algorithm, 'signature.algorithm');
  assertNonEmptyString(signature.key_id, 'signature.key_id');
  assertNonEmptyString(signature.signature, 'signature.signature');
  if (signature.signed_at) {
    assertValidDate(signature.signed_at, 'signature.signed_at');
  }
}

export function assertValidSubjectRef(subject: SubjectRef): void {
  if (!subject) {
    throw new QiaInvariantError('subject is required');
  }
  assertNonEmptyString(subject.subject_id, 'subject.subject_id');
  if (subject.subject_type !== undefined) {
    assertNonEmptyString(subject.subject_type, 'subject.subject_type');
  }
}

export function assertValidAuthorityRef(authority: AuthorityRef): void {
  if (!authority) {
    throw new QiaInvariantError('authority is required');
  }
  assertNonEmptyString(authority.authority_id, 'authority.authority_id');
  if (authority.authority_kind !== undefined) {
    assertNonEmptyString(authority.authority_kind, 'authority.authority_kind');
  }
}

export function assertValidTemporalBounds(temporal: QiaTemporalBounds): void {
  if (!temporal) {
    throw new QiaInvariantError('temporal bounds are required');
  }
  const issuedAt = assertValidDate(temporal.issued_at, 'temporal.issued_at');
  const expiresAt = assertValidDate(temporal.expires_at, 'temporal.expires_at');
  if (issuedAt >= expiresAt) {
    throw new QiaInvariantError(
      `temporal.issued_at (${issuedAt.toISOString()}) must be before temporal.expires_at (${expiresAt.toISOString()})`,
    );
  }
  if (temporal.not_before) {
    const notBefore = assertValidDate(temporal.not_before, 'temporal.not_before');
    if (notBefore < issuedAt) {
      throw new QiaInvariantError(
        `temporal.not_before (${notBefore.toISOString()}) must be >= temporal.issued_at (${issuedAt.toISOString()})`,
      );
    }
    if (notBefore >= expiresAt) {
      throw new QiaInvariantError(
        `temporal.not_before (${notBefore.toISOString()}) must be < temporal.expires_at (${expiresAt.toISOString()})`,
      );
    }
  }
}

export function assertValidFreshnessProof(freshness: FreshnessProof): void {
  if (!freshness) {
    throw new QiaInvariantError('freshness proof is required');
  }
  assertValidDate(freshness.proven_at, 'freshness.proven_at');
  if (!Number.isFinite(freshness.max_age_seconds) || freshness.max_age_seconds < 0) {
    throw new QiaInvariantError('freshness.max_age_seconds must be a non-negative number');
  }
  if (freshness.evidence_refs) {
    assertValidStringArray(freshness.evidence_refs, 'freshness.evidence_refs', QiaInvariantError, {
      allowEmpty: true,
    });
  }
}

export function assertValidIntentBinding(intent: IntentBinding): void {
  if (!intent) {
    throw new QiaInvariantError('intent is required');
  }
  assertNonEmptyString(intent.intent_id, 'intent.intent_id');
  assertNonEmptyString(intent.purpose, 'intent.purpose');
  assertValidStringArray(intent.scope, 'intent.scope');
  assertValidStringArray(intent.audience, 'intent.audience');
  const issuedAt = assertValidDate(intent.issued_at, 'intent.issued_at');
  const expiresAt = assertValidDate(intent.expires_at, 'intent.expires_at');
  if (issuedAt >= expiresAt) {
    throw new QiaInvariantError(
      `intent.issued_at (${issuedAt.toISOString()}) must be before intent.expires_at (${expiresAt.toISOString()})`,
    );
  }
  if (intent.constraints !== undefined) {
    if (
      intent.constraints === null ||
      typeof intent.constraints !== 'object' ||
      Array.isArray(intent.constraints)
    ) {
      throw new QiaInvariantError('intent.constraints must be an object');
    }
  }
  if (intent.evidence_refs) {
    assertValidStringArray(intent.evidence_refs, 'intent.evidence_refs', QiaInvariantError, {
      allowEmpty: true,
    });
  }
  if (intent.signature) {
    assertValidSignatureEnvelope(intent.signature);
  }
}

export function assertValidQiaEvent(event: QiaEvent): void {
  if (!event) {
    throw new QiaInvariantError('QIA event is required');
  }
  assertNonEmptyString(event.event_id, 'event.event_id');
  assertNonEmptyString(event.qia_id, 'event.qia_id');
  if (!Object.values(QiaEventType).includes(event.event_type)) {
    throw new QiaInvariantError(
      `event.event_type must be one of ${Object.values(QiaEventType).join(', ')}`,
    );
  }
  assertValidDate(event.occurred_at, 'event.occurred_at');
  if (event.effective_at) {
    assertValidDate(event.effective_at, 'event.effective_at');
  }
  if (event.reason !== undefined) {
    assertNonEmptyString(event.reason, 'event.reason');
  }
  if (event.evidence_refs) {
    assertValidStringArray(event.evidence_refs, 'event.evidence_refs', QiaInvariantError, {
      allowEmpty: true,
    });
  }
}

export function assertValidDecisionEvent(event: DecisionEvent): void {
  if (!event) {
    throw new QiaInvariantError('decision event is required');
  }
  assertNonEmptyString(event.event_id, 'event.event_id');
  assertNonEmptyString(event.capsule_id, 'event.capsule_id');
  if (!Object.values(DecisionEventType).includes(event.event_type)) {
    throw new QiaInvariantError(
      `event.event_type must be one of ${Object.values(DecisionEventType).join(', ')}`,
    );
  }
  assertValidDate(event.occurred_at, 'event.occurred_at');
  if (event.supersedes_event_id !== undefined) {
    assertNonEmptyString(event.supersedes_event_id, 'event.supersedes_event_id');
  }
  if (event.reason !== undefined) {
    assertNonEmptyString(event.reason, 'event.reason');
  }
}

function stableSerialize(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  const valueType = typeof value;
  if (valueType === 'function' || valueType === 'symbol') {
    return JSON.stringify(String(value));
  }
  if (valueType !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => left.localeCompare(right),
  );
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
    .join(',')}}`;
}

export function assertAppendOnlyEvents<T>(
  previous: readonly T[],
  next: readonly T[],
  validate?: (event: T) => void,
): void {
  if (!Array.isArray(previous) || !Array.isArray(next)) {
    throw new QiaInvariantError('Event logs must be arrays');
  }
  if (next.length < previous.length) {
    throw new QiaInvariantError('Event log is not append-only');
  }
  if (validate) {
    for (const event of previous) {
      validate(event);
    }
    for (const event of next) {
      validate(event);
    }
  }
  for (let i = 0; i < previous.length; i += 1) {
    const prior = previous[i];
    const candidate = next[i];
    if (!candidate) {
      throw new QiaInvariantError(`Missing event at index ${i}`);
    }
    if (stableSerialize(prior) !== stableSerialize(candidate)) {
      throw new QiaInvariantError(`Event log mutation detected at index ${i}`);
    }
  }
}
