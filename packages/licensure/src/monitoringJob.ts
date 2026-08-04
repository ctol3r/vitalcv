/**
 * LicensureMonitoringJob — scheduled re-reads and delta detection.
 *
 * The job is defined here and is deliberately inert: `plan()` returns the set
 * of routes that would be re-read, and in the current build that set is empty
 * because no route is live. There is no code path that emits a delta event
 * from a source that has never produced a reading.
 *
 * Delta semantics that matter:
 *   - A source going quiet is NOT a status change. Losing the ability to read a
 *     license says nothing about the license, so `SOURCE_LOST` is a distinct
 *     event kind from `STATUS_CHANGED` and must never be rendered as adverse.
 *   - A result ageing past its freshness window is NOT a status change either;
 *     it is `WENT_STALE`.
 */

import { listRuntimeStates } from './runtimeState';
import { resolveDeclaredChain } from './sourceRouter';
import { isLive } from './types';
import type {
  Jurisdiction,
  LicensureObservation,
  LicensureRouteKind,
  Profession,
} from './types';

export interface MonitoringTarget {
  readonly authorityId: string;
  readonly profession: Profession;
  readonly routeKind: LicensureRouteKind;
  readonly freshnessWindowHours: number;
}

export type LicensureDeltaKind =
  /** The authority returned a different status than last time. */
  | 'STATUS_CHANGED'
  /** Expiration date moved. */
  | 'EXPIRATION_CHANGED'
  /** A disciplinary indicator appeared or cleared. */
  | 'DISCIPLINE_INDICATOR_CHANGED'
  /** Previously readable, now unreadable. Not a finding about the clinician. */
  | 'SOURCE_LOST'
  /** Last reading aged past its window. Not a finding about the clinician. */
  | 'WENT_STALE';

export interface LicensureDelta {
  readonly kind: LicensureDeltaKind;
  readonly authorityId: string;
  readonly boardName: string;
  readonly profession: Profession;
  readonly detectedAt: string;
  readonly previous: string | null;
  readonly current: string | null;
  readonly isAdverse: boolean;
}

/** Only a real status change can be adverse, and only toward an adverse status. */
const ADVERSE_STATUSES = new Set(['REVOKED', 'SUSPENDED', 'SURRENDERED']);

export function isAdverseDelta(kind: LicensureDeltaKind, current: string | null): boolean {
  if (kind !== 'STATUS_CHANGED') return false;
  if (current === null) return false;
  return ADVERSE_STATUSES.has(current);
}

/**
 * Which routes this job would re-read for a clinician.
 *
 * Returns only live routes. An empty plan means monitoring cannot run, and the
 * caller must not report "no changes detected" — it must report that monitoring
 * is not established.
 */
export function plan(
  jurisdiction: Jurisdiction,
  profession: Profession,
  now: Date,
): readonly MonitoringTarget[] {
  const states = new Map(
    listRuntimeStates().map((state) => [
      `${state.authorityId}::${state.profession}::${state.routeKind}`,
      state,
    ]),
  );

  return resolveDeclaredChain(jurisdiction, profession)
    .filter((route) => {
      const state = states.get(`${route.authorityId}::${route.profession}::${route.routeKind}`);
      if (state === undefined) return false;
      if (!route.monitoringAvailable) return false;
      return isLive(state, now, route.freshnessWindowHours);
    })
    .map((route) => ({
      authorityId: route.authorityId,
      profession: route.profession,
      routeKind: route.routeKind,
      freshnessWindowHours: route.freshnessWindowHours,
    }));
}

/**
 * Compare two readings of the same authority and emit deltas.
 *
 * `previous` and `current` must come from the SAME originating authority —
 * comparing a Texas reading against a California reading would manufacture a
 * status change out of two unrelated licenses.
 */
export function diff(
  previous: LicensureObservation,
  current: LicensureObservation,
  now: Date,
): readonly LicensureDelta[] {
  if (previous.originatingAuthorityId !== current.originatingAuthorityId) {
    throw new Error(
      'Refusing to diff observations from different authorities: ' +
        `${previous.originatingAuthorityId} vs ${current.originatingAuthorityId}.`,
    );
  }

  const deltas: LicensureDelta[] = [];
  const base = {
    authorityId: current.originatingAuthorityId,
    boardName: current.originatingBoardName,
    profession: current.profession,
    detectedAt: now.toISOString(),
  };

  // Losing readability is a source event, never a credential event.
  if (previous.outcome === 'RECORD_RETURNED' && current.outcome !== 'RECORD_RETURNED') {
    return [
      {
        ...base,
        kind: 'SOURCE_LOST',
        previous: previous.status,
        current: null,
        isAdverse: false,
      },
    ];
  }

  if (current.outcome !== 'RECORD_RETURNED') return [];

  if (previous.status !== current.status) {
    deltas.push({
      ...base,
      kind: 'STATUS_CHANGED',
      previous: previous.status,
      current: current.status,
      isAdverse: isAdverseDelta('STATUS_CHANGED', current.status),
    });
  }

  if (previous.expiresAt !== current.expiresAt) {
    deltas.push({
      ...base,
      kind: 'EXPIRATION_CHANGED',
      previous: previous.expiresAt,
      current: current.expiresAt,
      isAdverse: false,
    });
  }

  if (previous.disciplineIndicator !== current.disciplineIndicator) {
    deltas.push({
      ...base,
      kind: 'DISCIPLINE_INDICATOR_CHANGED',
      previous: String(previous.disciplineIndicator),
      current: String(current.disciplineIndicator),
      isAdverse: false,
    });
  }

  if (previous.freshness.isCurrent && !current.freshness.isCurrent) {
    deltas.push({
      ...base,
      kind: 'WENT_STALE',
      previous: null,
      current: null,
      isAdverse: false,
    });
  }

  return deltas;
}
