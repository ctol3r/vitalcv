/**
 * ACT-1.4 — start-ready / started / cancellation, derived from the event stream.
 *
 * The current start-state of an application is not stored; it is folded from its
 * durable START_* audit events in chronological order. A correction is therefore
 * a new event (e.g. a START_CANCELLED after a START_RECORDED), never a silent
 * overwrite — the whole history stays replayable. A qualified start is an
 * explicit authorized event, never inferred from a score, an export, or a page
 * view.
 */

export type StartEventType = 'START_READY' | 'START_RECORDED' | 'START_CANCELLED';

export type StartState = 'not_ready' | 'start_ready' | 'started' | 'cancelled';

export interface StartEvent {
  readonly type: StartEventType;
  /** ISO timestamp — events are folded in ascending order of this. */
  readonly at: string;
}

const EVENT_STATE: Record<StartEventType, StartState> = {
  START_READY: 'start_ready',
  START_RECORDED: 'started',
  START_CANCELLED: 'cancelled',
};

/**
 * Fold the events into the current state. Latest event wins; an empty history is
 * `not_ready`. Ordering is by `at` (stable — insertion order breaks ties), so a
 * caller passing DB rows should pass them createdAt-ascending or let this sort.
 */
export function deriveStartState(events: readonly StartEvent[]): StartState {
  if (events.length === 0) return 'not_ready';
  const ordered = [...events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return EVENT_STATE[ordered[ordered.length - 1].type];
}

/** Whether a START_RECORDED may be written given the current state. */
export function canRecordStart(state: StartState): boolean {
  // A start may only be recorded from an explicit start-ready decision.
  return state === 'start_ready';
}

/** Whether a START_READY may be written given the current state. */
export function canMarkStartReady(state: StartState): boolean {
  // Re-mark allowed after a cancellation; a no-op if already start-ready/started.
  return state === 'not_ready' || state === 'cancelled';
}
