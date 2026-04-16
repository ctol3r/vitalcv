export const MULTIPLE_ACTIONS_FORBIDDEN_MESSAGE = 'Multiple actions forbidden';
export const ALL_CLEAR_ACTION_ID = 'action:all-clear';
export const ALL_CLEAR_ACTION_LABEL = 'All clear';
export const ALL_CLEAR_ACTION_DETAIL = 'No next step is required right now.';

export function ensureSingleActionArray<T>(
  actions: readonly T[],
  fallback: T,
): [T] {
  if (actions.length > 1) {
    throw new Error(MULTIPLE_ACTIONS_FORBIDDEN_MESSAGE);
  }

  return [actions[0] ?? fallback];
}

export function buildAllClearReadinessAction(): {
  id: string;
  title: string;
  detail: string;
  priority: 'LOW';
} {
  return {
    id: ALL_CLEAR_ACTION_ID,
    title: ALL_CLEAR_ACTION_LABEL,
    detail: ALL_CLEAR_ACTION_DETAIL,
    priority: 'LOW',
  };
}

export function buildAllClearTruthAction(): {
  id: string;
  label: string;
  detail: string;
} {
  return {
    id: ALL_CLEAR_ACTION_ID,
    label: ALL_CLEAR_ACTION_LABEL,
    detail: ALL_CLEAR_ACTION_DETAIL,
  };
}
