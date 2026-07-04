/**
 * Opportunity actions — the clinician's own Save / Connect / Decline decisions.
 *
 * These are real user actions, persisted locally (the clinician owns them). "New" is simply an
 * opportunity that hasn't been acted on yet. Pure + SSR-safe; the React hook lives in
 * components/matcha/useOpportunityActions.ts.
 */

export type OpportunityStatus = 'saved' | 'connected' | 'declined';
export type OpportunityBucket = 'new' | OpportunityStatus;

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
