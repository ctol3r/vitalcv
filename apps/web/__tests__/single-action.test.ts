import { describe, expect, it } from 'vitest';
import {
  ALL_CLEAR_ACTION_DETAIL,
  ALL_CLEAR_ACTION_LABEL,
  buildAllClearTruthAction,
  ensureSingleActionArray,
  MULTIPLE_ACTIONS_FORBIDDEN_MESSAGE,
} from '../lib/trust/single-action';

describe('single action guard', () => {
  it('returns the only action when exactly one is present', () => {
    const [action] = ensureSingleActionArray(
      [{ id: 'next-1', label: 'Attach DEA evidence', detail: 'Upload the missing artifact.' }],
      buildAllClearTruthAction(),
    );

    expect(action).toEqual({
      id: 'next-1',
      label: 'Attach DEA evidence',
      detail: 'Upload the missing artifact.',
    });
  });

  it('returns an explicit all-clear action when no action is present', () => {
    const [action] = ensureSingleActionArray([], buildAllClearTruthAction());

    expect(action).toEqual({
      id: 'action:all-clear',
      label: ALL_CLEAR_ACTION_LABEL,
      detail: ALL_CLEAR_ACTION_DETAIL,
    });
  });

  it('throws when more than one action is present', () => {
    expect(() => ensureSingleActionArray(
      [
        'Request updated data',
        'Route to review',
      ],
      ALL_CLEAR_ACTION_LABEL,
    )).toThrow(MULTIPLE_ACTIONS_FORBIDDEN_MESSAGE);
  });
});
