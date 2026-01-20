/**
 * Authority identity and derived state.
 */

import type { AuthorityEvent } from './AuthorityEvent';
import { getAuthorityEventScopeId } from './AuthorityEvent';
import { AuthorityInvariantError, AuthorityKind } from './types';
import { resolveScopeState, type AuthorityScopeSnapshot } from './AuthorityScope';
import { assertValidAuthority, assertValidEvent } from './invariants';

export interface Authority {
  readonly authority_id: string;
  readonly kind: AuthorityKind;
  readonly label?: string;
}

export interface AuthoritySnapshot {
  readonly authority: Authority;
  readonly as_of: Date;
  readonly scopes: AuthorityScopeSnapshot[];
}

function assertValidDate(value: Date, label: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new AuthorityInvariantError(`${label} must be a valid Date`);
  }
  return value;
}

export function resolveAuthoritySnapshot(
  authority: Authority,
  events: AuthorityEvent[],
  asOf: Date = new Date(),
): AuthoritySnapshot {
  assertValidAuthority(authority);

  if (!Array.isArray(events)) {
    throw new AuthorityInvariantError('events must be an array');
  }

  const checkedAsOf = assertValidDate(asOf, 'as_of');

  for (const event of events) {
    assertValidEvent(event);
    if (event.authority_id !== authority.authority_id) {
      throw new AuthorityInvariantError(
        `Event ${event.event_id} authority_id mismatch: expected ${authority.authority_id}, got ${event.authority_id}`,
      );
    }
  }

  const eventsByScope = new Map<string, AuthorityEvent[]>();
  for (const event of events) {
    const scopeId = getAuthorityEventScopeId(event);
    const current = eventsByScope.get(scopeId);
    if (current) {
      current.push(event);
    } else {
      eventsByScope.set(scopeId, [event]);
    }
  }

  const scopes = Array.from(eventsByScope.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, scopeEvents]) => resolveScopeState(scopeEvents, checkedAsOf));

  return {
    authority,
    as_of: checkedAsOf,
    scopes,
  };
}
