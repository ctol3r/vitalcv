/**
 * Opportunity actions — the clinician's own Save / Connect / Decline decisions.
 *
 * These are real user actions, persisted server-side (append-only rows keyed by the
 * authenticated Clerk user) with localStorage as the optimistic cache. "New" is simply an
 * opportunity that hasn't been acted on yet. Pure + SSR-safe; the React hook lives in
 * components/matcha/useOpportunityActions.ts.
 */

export type OpportunityStatus = 'saved' | 'connected' | 'declined';
export type OpportunityBucket = 'new' | OpportunityStatus;

/** What gets written to the server log: a status, or 'cleared' (toggled back to "new"). */
export type OpportunityActionValue = OpportunityStatus | 'cleared';

export type OpportunityActionMap = Record<string, OpportunityStatus>;

export const OPPORTUNITY_ACTIONS_KEY = 'vitalcv.matcha.opportunity-actions';

export const BUCKET_ORDER: readonly OpportunityBucket[] = ['new', 'saved', 'connected', 'declined'];

export const BUCKET_LABEL: Record<OpportunityBucket, string> = {
  new: 'New',
  saved: 'Saved',
  connected: 'Connected',
  declined: 'Declined',
};

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadOpportunityActions(): OpportunityActionMap {
  const ls = safeLocalStorage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(OPPORTUNITY_ACTIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as OpportunityActionMap) : {};
  } catch {
    return {};
  }
}

export function persistOpportunityActions(map: OpportunityActionMap): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(OPPORTUNITY_ACTIONS_KEY, JSON.stringify(map));
  } catch {
    /* no-op */
  }
}

/** The bucket an opportunity falls in — acted-on status, or 'new' if untouched. */
export function bucketFor(map: OpportunityActionMap, id: string): OpportunityBucket {
  return map[id] ?? 'new';
}

export const OPPORTUNITY_ACTION_VALUES: readonly OpportunityActionValue[] = [
  'saved',
  'connected',
  'declined',
  'cleared',
];

export function isOpportunityActionValue(value: unknown): value is OpportunityActionValue {
  return typeof value === 'string' && (OPPORTUNITY_ACTION_VALUES as readonly string[]).includes(value);
}

/**
 * The action value the server log should record for a tap on `status`:
 * tapping the already-active status toggles the opportunity back to "new",
 * which the append-only log represents as 'cleared'.
 */
export function actionValueForTap(
  map: OpportunityActionMap,
  id: string,
  status: OpportunityStatus,
): OpportunityActionValue {
  return map[id] === status ? 'cleared' : status;
}

/**
 * Server actions layered over the local optimistic cache. The server is the
 * source of truth for every opportunity it has a decision for ('cleared'
 * removes the local entry); local-only entries are kept so a signed-out or
 * not-yet-migrated session loses nothing.
 */
export function mergeServerActions(
  local: OpportunityActionMap,
  server: Record<string, OpportunityActionValue>,
): OpportunityActionMap {
  const merged: OpportunityActionMap = { ...local };
  for (const [id, action] of Object.entries(server)) {
    if (action === 'cleared') {
      delete merged[id];
    } else {
      merged[id] = action;
    }
  }
  return merged;
}

/**
 * Count opportunities per bucket across a known set of ids. "new" = ids with no recorded action;
 * saved/connected/declined come from recorded actions (restricted to the given ids).
 */
export function statusCounts(
  map: OpportunityActionMap,
  ids: readonly string[],
): Record<OpportunityBucket, number> {
  const counts: Record<OpportunityBucket, number> = { new: 0, saved: 0, connected: 0, declined: 0 };
  for (const id of ids) {
    counts[bucketFor(map, id)] += 1;
  }
  return counts;
}
