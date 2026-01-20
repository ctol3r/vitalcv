/**
 * Authority events are append-only, immutable facts.
 */

import type { AuthorityScope } from './AuthorityScope';
import { AuthorityEventError, AuthorityEventType } from './types';

export interface AuthorityEventBase {
  readonly event_id: string;
  readonly authority_id: string;
  readonly event_type: AuthorityEventType;
  readonly occurred_at: Date;
  /**
   * Optional effective time. When omitted, effective_at = occurred_at.
   */
  readonly effective_at?: Date;
  readonly reason?: string;
}

export type AuthorityGrantEvent = AuthorityEventBase & {
  readonly event_type: AuthorityEventType.GRANT;
  readonly scope: AuthorityScope;
};

export type AuthorityOverrideEvent = AuthorityEventBase & {
  readonly event_type: AuthorityEventType.OVERRIDE;
  readonly scope: AuthorityScope;
  readonly supersedes_event_id: string;
};

export type AuthorityRevokeEvent = AuthorityEventBase & {
  readonly event_type: AuthorityEventType.REVOKE;
  readonly scope_id: string;
};

export type AuthorityExpireEvent = AuthorityEventBase & {
  readonly event_type: AuthorityEventType.EXPIRE;
  readonly scope_id: string;
};

export type AuthorityEvent =
  | AuthorityGrantEvent
  | AuthorityOverrideEvent
  | AuthorityRevokeEvent
  | AuthorityExpireEvent;

function assertValidDate(value: Date, label: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new AuthorityEventError(`${label} must be a valid Date`);
  }
  return value;
}

export function getAuthorityEventEffectiveTime(event: AuthorityEvent): Date {
  const occurredAt = assertValidDate(event.occurred_at, 'occurred_at');
  if (!event.effective_at) {
    return occurredAt;
  }
  return assertValidDate(event.effective_at, 'effective_at');
}

export function getAuthorityEventScopeId(event: AuthorityEvent): string {
  switch (event.event_type) {
    case AuthorityEventType.GRANT:
    case AuthorityEventType.OVERRIDE:
      return event.scope.scope_id;
    case AuthorityEventType.REVOKE:
    case AuthorityEventType.EXPIRE:
      return event.scope_id;
  }
}
