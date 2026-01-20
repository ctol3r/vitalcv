/**
 * Invariants and validation helpers for authority domain logic.
 */

import type { Authority } from './Authority';
import type { AuthorityEvent } from './AuthorityEvent';
import type { AuthorityScope } from './AuthorityScope';
import {
  AuthorityAction,
  AuthorityEventError,
  AuthorityEventType,
  AuthorityInvariantError,
  AuthorityKind,
  AuthorityScopeError,
} from './types';

type ErrorConstructor = new (message: string) => Error;

function assertNonEmptyString(
  value: unknown,
  label: string,
  ErrorCtor: ErrorConstructor,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ErrorCtor(`${label} must be a non-empty string`);
  }
  return value;
}

function assertValidDate(
  value: unknown,
  label: string,
  ErrorCtor: ErrorConstructor,
): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new ErrorCtor(`${label} must be a valid Date`);
  }
  return value;
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

export function assertValidAuthority(authority: Authority): void {
  if (!authority) {
    throw new AuthorityInvariantError('Authority is required');
  }

  assertNonEmptyString(authority.authority_id, 'authority_id', AuthorityInvariantError);

  if (!Object.values(AuthorityKind).includes(authority.kind)) {
    throw new AuthorityInvariantError(
      `authority kind must be one of ${Object.values(AuthorityKind).join(', ')}`,
    );
  }
}

export function assertValidScope(scope: AuthorityScope): void {
  if (!scope) {
    throw new AuthorityScopeError('Authority scope is required');
  }

  assertNonEmptyString(scope.scope_id, 'scope_id', AuthorityScopeError);
  assertNonEmptyString(scope.authority_id, 'authority_id', AuthorityScopeError);
  assertNonEmptyString(scope.domain, 'domain', AuthorityScopeError);

  if (!Array.isArray(scope.actions) || scope.actions.length === 0) {
    throw new AuthorityScopeError('actions must be a non-empty array');
  }

  const allowedActions = new Set(Object.values(AuthorityAction));
  const uniqueActions = new Set(scope.actions);
  if (uniqueActions.size !== scope.actions.length) {
    throw new AuthorityScopeError('actions must be unique');
  }

  for (const action of scope.actions) {
    if (!allowedActions.has(action)) {
      throw new AuthorityScopeError(`Unsupported action: ${action}`);
    }
  }

  if (scope.subject) {
    assertNonEmptyString(scope.subject.id, 'subject.id', AuthorityScopeError);
    if (scope.subject.type !== undefined) {
      assertNonEmptyString(scope.subject.type, 'subject.type', AuthorityScopeError);
    }
  }
}

export function assertValidEvent(event: AuthorityEvent): void {
  if (!event) {
    throw new AuthorityEventError('Authority event is required');
  }

  assertNonEmptyString(event.event_id, 'event_id', AuthorityEventError);
  assertNonEmptyString(event.authority_id, 'authority_id', AuthorityEventError);

  if (!Object.values(AuthorityEventType).includes(event.event_type)) {
    throw new AuthorityEventError(
      `event_type must be one of ${Object.values(AuthorityEventType).join(', ')}`,
    );
  }

  assertValidDate(event.occurred_at, 'occurred_at', AuthorityEventError);
  if (event.effective_at) {
    assertValidDate(event.effective_at, 'effective_at', AuthorityEventError);
  }

  switch (event.event_type) {
    case AuthorityEventType.GRANT:
      if (!event.scope) {
        throw new AuthorityEventError('GRANT event missing scope');
      }
      assertValidScope(event.scope);
      if (event.scope.authority_id !== event.authority_id) {
        throw new AuthorityEventError('GRANT event authority_id mismatch in scope');
      }
      return;
    case AuthorityEventType.OVERRIDE:
      if (!event.scope) {
        throw new AuthorityEventError('OVERRIDE event missing scope');
      }
      assertValidScope(event.scope);
      if (event.scope.authority_id !== event.authority_id) {
        throw new AuthorityEventError('OVERRIDE event authority_id mismatch in scope');
      }
      assertNonEmptyString(
        event.supersedes_event_id,
        'supersedes_event_id',
        AuthorityEventError,
      );
      return;
    case AuthorityEventType.REVOKE:
    case AuthorityEventType.EXPIRE:
      assertNonEmptyString(event.scope_id, 'scope_id', AuthorityEventError);
      return;
  }
}

export function assertAppendOnlyEvents(
  previous: readonly AuthorityEvent[],
  next: readonly AuthorityEvent[],
): void {
  if (!Array.isArray(previous) || !Array.isArray(next)) {
    throw new AuthorityInvariantError('Events must be arrays');
  }

  if (next.length < previous.length) {
    throw new AuthorityInvariantError('Event log is not append-only');
  }

  for (const event of previous) {
    assertValidEvent(event);
  }
  for (const event of next) {
    assertValidEvent(event);
  }

  for (let i = 0; i < previous.length; i += 1) {
    const prior = previous[i];
    const candidate = next[i];
    if (!candidate) {
      throw new AuthorityInvariantError(`Missing event at index ${i}`);
    }
    if (stableSerialize(prior) !== stableSerialize(candidate)) {
      throw new AuthorityInvariantError(`Event log mutation detected at index ${i}`);
    }
  }
}
