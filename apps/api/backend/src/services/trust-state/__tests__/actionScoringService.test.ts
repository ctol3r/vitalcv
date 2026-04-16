import { scoreDeterministicBestAction } from '../actionScoringService';

describe('actionScoringService', () => {
  it('prefers activation blockers over acceptance and recognition regardless of effort', () => {
    const result = scoreDeterministicBestAction({
      blockers: [
        {
          domain: 'recognition',
          blockerId: 'rec-1',
          label: 'State license missing',
          detail: 'Recognition is missing current state license evidence.',
          actionTitle: 'Resolve license evidence',
          effort_estimate: 1,
        },
        {
          domain: 'acceptance',
          blockerId: 'acc-1',
          label: 'Employer countersignature missing',
          detail: 'Acceptance is not countersigned.',
          actionTitle: 'Collect countersignature',
          effort_estimate: 1,
        },
        {
          domain: 'activation',
          blockerId: 'act-1',
          label: 'Start readiness below threshold',
          detail: 'Activation cannot proceed until start_ready is true.',
          actionTitle: 'Raise start readiness',
          effort_estimate: 5,
        },
      ],
    });

    expect(result).toEqual({
      domain: 'activation',
      blockerId: 'act-1',
      blocker_label: 'Start readiness below threshold',
      title: 'Raise start readiness',
      detail: 'Activation cannot proceed until start_ready is true.',
      effort_estimate: 5,
    });
  });

  it('sorts by effort_estimate ascending within the same domain', () => {
    const result = scoreDeterministicBestAction({
      blockers: [
        {
          domain: 'acceptance',
          blockerId: 'acc-2',
          label: 'Missing facility binding',
          detail: 'Acceptance does not include the facility.',
          actionTitle: 'Bind facility',
          effort_estimate: 3,
        },
        {
          domain: 'acceptance',
          blockerId: 'acc-1',
          label: 'Audit event missing',
          detail: 'Acceptance output is missing the audit record.',
          actionTitle: 'Write audit event',
          effort_estimate: 1,
        },
      ],
    });

    expect(result?.blockerId).toBe('acc-1');
    expect(result?.effort_estimate).toBe(1);
  });

  it('places blockers without a deterministic effort estimate after blockers with explicit effort', () => {
    const result = scoreDeterministicBestAction({
      blockers: [
        {
          domain: 'recognition',
          blockerId: 'rec-unknown',
          label: 'Legacy mapping missing',
          detail: 'Recognition requirement is unmapped.',
          effort_estimate: null,
        },
        {
          domain: 'recognition',
          blockerId: 'rec-known',
          label: 'NPI verification missing',
          detail: 'Recognition is missing an NPI verification fact.',
          effort_estimate: 2,
        },
      ],
    });

    expect(result?.blockerId).toBe('rec-known');
    expect(result?.title).toBe('Resolve NPI verification missing');
  });

  it('uses deterministic lexical tie-breakers when domain and effort are identical', () => {
    const input = {
      blockers: [
        {
          domain: 'activation' as const,
          blockerId: 'b',
          label: 'Orientation missing',
          detail: 'Orientation is not complete.',
          actionTitle: 'Complete orientation',
          effort_estimate: 2,
        },
        {
          domain: 'activation' as const,
          blockerId: 'a',
          label: 'Badge missing',
          detail: 'Badge is not issued.',
          actionTitle: 'Issue badge',
          effort_estimate: 2,
        },
      ],
    };

    const first = scoreDeterministicBestAction(input);
    const second = scoreDeterministicBestAction(input);

    expect(first).toEqual(second);
    expect(first?.blockerId).toBe('a');
  });

  it('returns null when no valid blockers are provided', () => {
    const result = scoreDeterministicBestAction({
      blockers: [
        {
          domain: 'recognition',
          label: '',
          detail: '',
        },
      ],
    });

    expect(result).toBeNull();
  });
});
