/**
 * Authority scope definitions and derived state.
 */

import type {
  AuthorityEvent,
  AuthorityExpireEvent,
  AuthorityGrantEvent,
  AuthorityOverrideEvent,
  AuthorityRevokeEvent,
} from './AuthorityEvent';
import {
  getAuthorityEventEffectiveTime,
  getAuthorityEventScopeId,
} from './AuthorityEvent';
import {
  AmbiguousAuthorityStateError,
  AuthorityAction,
  AuthorityEventError,
  AuthorityEventType,
  AuthorityScopeError,
  AuthorityScopeStatus,
} from './types';
import { assertValidEvent } from './invariants';

export interface AuthoritySubject {
  readonly id: string;
  readonly type?: string;
}

export interface AuthorityScope {
  readonly scope_id: string;
  readonly authority_id: string;
  readonly domain: string;
  readonly actions: readonly AuthorityAction[];
  readonly subject?: AuthoritySubject;
  readonly constraints?: Record<string, unknown>;
}

type ScopeSnapshotBase = {
  readonly authority_id: string;
  readonly scope_id: string;
  readonly scope: AuthorityScope;
  readonly as_of: Date;
  readonly effective_at: Date;
  readonly reason?: string;
};

export type AuthorityScopeSnapshot =
  | (ScopeSnapshotBase & {
      readonly status: AuthorityScopeStatus.PENDING;
      readonly event: AuthorityGrantEvent | AuthorityOverrideEvent;
    })
  | (ScopeSnapshotBase & {
      readonly status: AuthorityScopeStatus.ACTIVE;
      readonly event: AuthorityGrantEvent | AuthorityOverrideEvent;
    })
  | (ScopeSnapshotBase & {
      readonly status: AuthorityScopeStatus.REVOKED;
      readonly event: AuthorityRevokeEvent;
    })
  | (ScopeSnapshotBase & {
      readonly status: AuthorityScopeStatus.EXPIRED;
      readonly event: AuthorityExpireEvent;
    });

function assertValidDate(value: Date, label: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new AuthorityScopeError(`${label} must be a valid Date`);
  }
  return value;
}

function isGrantLike(
  event: AuthorityEvent,
): event is AuthorityGrantEvent | AuthorityOverrideEvent {
  return (
    event.event_type === AuthorityEventType.GRANT ||
    event.event_type === AuthorityEventType.OVERRIDE
  );
}

function getSingleScopeContext(events: AuthorityEvent[]): {
  scope_id: string;
  authority_id: string;
} {
  const scopeIds = new Set(events.map((event) => getAuthorityEventScopeId(event)));
  if (scopeIds.size !== 1) {
    throw new AmbiguousAuthorityStateError('Events must target a single scope_id');
  }
  const authorityIds = new Set(events.map((event) => event.authority_id));
  if (authorityIds.size !== 1) {
    throw new AmbiguousAuthorityStateError('Events must target a single authority_id');
  }
  return {
    scope_id: Array.from(scopeIds)[0],
    authority_id: Array.from(authorityIds)[0],
  };
}

function findLastGrantEvent(
  events: AuthorityEvent[],
  upToIndex: number,
): AuthorityGrantEvent | AuthorityOverrideEvent | null {
  for (let i = upToIndex; i >= 0; i -= 1) {
    const event = events[i];
    if (isGrantLike(event)) {
      return event;
    }
  }
  return null;
}

export function resolveScopeState(
  events: AuthorityEvent[],
  asOf: Date = new Date(),
): AuthorityScopeSnapshot {
  if (!Array.isArray(events) || events.length === 0) {
    throw new AuthorityScopeError('Authority scope requires at least one event');
  }

  const checkedAsOf = assertValidDate(asOf, 'as_of');

  const eventById = new Map<string, AuthorityEvent>();
  for (const event of events) {
    assertValidEvent(event);
    if (eventById.has(event.event_id)) {
      throw new AmbiguousAuthorityStateError(
        `Duplicate event_id detected: ${event.event_id}`,
      );
    }
    eventById.set(event.event_id, event);
  }

  const { scope_id: scopeId, authority_id: authorityId } =
    getSingleScopeContext(events);

  for (const event of events) {
    if (event.event_type !== AuthorityEventType.OVERRIDE) {
      continue;
    }

    const superseded = eventById.get(event.supersedes_event_id);
    if (!superseded) {
      throw new AuthorityEventError(
        `Override event ${event.event_id} supersedes unknown event ${event.supersedes_event_id}`,
      );
    }

    if (!isGrantLike(superseded)) {
      throw new AuthorityEventError(
        `Override event ${event.event_id} must supersede a GRANT or OVERRIDE`,
      );
    }

    if (getAuthorityEventScopeId(superseded) !== scopeId) {
      throw new AuthorityEventError(
        `Override event ${event.event_id} scope_id mismatch`,
      );
    }

    if (superseded.authority_id !== authorityId) {
      throw new AuthorityEventError(
        `Override event ${event.event_id} authority_id mismatch`,
      );
    }

    const supersededTime = getAuthorityEventEffectiveTime(superseded).getTime();
    const overrideTime = getAuthorityEventEffectiveTime(event).getTime();
    if (overrideTime < supersededTime) {
      throw new AmbiguousAuthorityStateError(
        `Override event ${event.event_id} is effective before superseded event`,
      );
    }
  }

  const ordered = [...events].sort(
    (a, b) =>
      getAuthorityEventEffectiveTime(a).getTime() -
      getAuthorityEventEffectiveTime(b).getTime(),
  );

  for (let i = 1; i < ordered.length; i += 1) {
    const prevTime = getAuthorityEventEffectiveTime(ordered[i - 1]).getTime();
    const currentTime = getAuthorityEventEffectiveTime(ordered[i]).getTime();
    if (prevTime === currentTime) {
      throw new AmbiguousAuthorityStateError(
        `Multiple events share the same effective time for scope ${scopeId}`,
      );
    }
  }

  let seenGrant = false;
  for (const event of ordered) {
    if (isGrantLike(event)) {
      seenGrant = true;
      continue;
    }
    if (!seenGrant) {
      throw new AuthorityScopeError(
        `Event ${event.event_id} (${event.event_type}) precedes any GRANT or OVERRIDE`,
      );
    }
  }

  const asOfTime = checkedAsOf.getTime();
  let latestIndex = -1;
  for (let i = 0; i < ordered.length; i += 1) {
    const effectiveTime = getAuthorityEventEffectiveTime(ordered[i]).getTime();
    if (effectiveTime <= asOfTime) {
      latestIndex = i;
    } else {
      break;
    }
  }

  if (latestIndex === -1) {
    const nextEvent = ordered[0];
    if (!isGrantLike(nextEvent)) {
      throw new AuthorityScopeError('Next effective event must be GRANT or OVERRIDE');
    }

    return {
      status: AuthorityScopeStatus.PENDING,
      authority_id: authorityId,
      scope_id: scopeId,
      scope: nextEvent.scope,
      as_of: checkedAsOf,
      effective_at: getAuthorityEventEffectiveTime(nextEvent),
      event: nextEvent,
      reason: nextEvent.reason,
    };
  }

  const latestEvent = ordered[latestIndex];
  const lastGrant = findLastGrantEvent(ordered, latestIndex);
  if (!lastGrant) {
    throw new AuthorityScopeError('No GRANT or OVERRIDE event found for scope');
  }

  const baseSnapshot = {
    authority_id: authorityId,
    scope_id: scopeId,
    scope: lastGrant.scope,
    as_of: checkedAsOf,
    effective_at: getAuthorityEventEffectiveTime(latestEvent),
    reason: latestEvent.reason,
  };

  switch (latestEvent.event_type) {
    case AuthorityEventType.GRANT:
    case AuthorityEventType.OVERRIDE:
      return {
        ...baseSnapshot,
        status: AuthorityScopeStatus.ACTIVE,
        event: latestEvent,
      };
    case AuthorityEventType.REVOKE:
      return {
        ...baseSnapshot,
        status: AuthorityScopeStatus.REVOKED,
        event: latestEvent,
      };
    case AuthorityEventType.EXPIRE:
      return {
        ...baseSnapshot,
        status: AuthorityScopeStatus.EXPIRED,
        event: latestEvent,
      };
    default:
      throw new AuthorityScopeError(
        `Unsupported event type for scope resolution: ${latestEvent.event_type}`,
      );
  }
}
