import { describe, expect, it } from 'vitest';
import {
  buildInvestigationSearchParams,
  normalizeInvestigationState,
  parseInvestigationRouteState,
} from '@/stores/investigation-context';

describe('investigation context route state', () => {
  it('treats canonical intelligence views as persisted workspace focus', () => {
    const state = parseInvestigationRouteState(new URLSearchParams('view=graph&npi=1234567890&findingId=finding-1'));

    expect(state.focus).toBe('graph');
    expect(state.selectedProvider).toBe('1234567890');
    expect(state.selectedFinding).toBe('finding-1');
  });

  it('serializes view focus back to canonical view params', () => {
    const params = buildInvestigationSearchParams(normalizeInvestigationState({
      focus: 'investigations',
      mode: 'investigate',
      selectedProvider: '1234567890',
      selectedFinding: 'finding-1',
      graphFocus: 'finding-node',
      openPanels: ['provider', 'finding', 'graph', 'evidence', 'copilot'],
    }));

    expect(params.get('view')).toBe('investigations');
    expect(params.get('focus')).toBeNull();
    expect(params.get('provider')).toBe('1234567890');
    expect(params.get('findingId')).toBe('finding-1');
    expect(params.get('graphFocus')).toBe('finding-node');
  });
});
