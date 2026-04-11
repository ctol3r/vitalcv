import { describe, expect, it } from 'vitest';
import {
  DecisionState,
  getMissingCriticalFields,
  isDecisionReady,
  type DecisionProfile,
} from '../decisionState';

describe('Decision State', () => {
  it('returns ACTION_REQUIRED when identity is missing', () => {
    const profile: DecisionProfile = {
      employment: { verified: true },
    };

    expect(getMissingCriticalFields(profile)).toEqual(['identity']);
    expect(isDecisionReady(profile)).toBe(DecisionState.ACTION_REQUIRED);
  });

  it('returns CONDITIONAL when employment is missing', () => {
    const profile: DecisionProfile = {
      identity: { verified: true },
    };

    expect(getMissingCriticalFields(profile)).toEqual(['employment']);
    expect(isDecisionReady(profile)).toBe(DecisionState.CONDITIONAL);
  });

  it('returns READY when identity and employment are verified', () => {
    const profile: DecisionProfile = {
      identity: { verified: true },
      employment: { verified: true },
    };

    expect(getMissingCriticalFields(profile)).toEqual([]);
    expect(isDecisionReady(profile)).toBe(DecisionState.READY);
  });
});
